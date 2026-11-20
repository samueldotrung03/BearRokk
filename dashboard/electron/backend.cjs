// The agent backend, run inside the desktop app.
//
// A student who downloads the app has nothing else installed, so the app carries the backend and
// starts it on this computer. Their data is kept in the cloud under their own sign-in; the one
// thing they bring is Grok, either the Grok app for the command line signed in to their
// subscription, or an xAI API key. That choice is kept here, on this computer only.
//
// TEMPORARY, FOR TESTING: the agents can also be pointed at the Claude app for the command line,
// as the backend allows until Grok access arrives (backend/SWAP_TO_GROK.md). Remove it with that.
const { app, ipcMain, safeStorage } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 8787;
const URL = `http://localhost:${PORT}`;

let child = null;
/** True when this app started the backend. False when one was already running, as in development. */
let managed = false;

const backendDir = () => (app.isPackaged ? path.join(process.resourcesPath, 'backend-bundle') : path.join(__dirname, '..', '..', 'backend'));
const settingsFile = () => path.join(app.getPath('userData'), 'connections.json');

// ---- the Grok connection, remembered on this computer ---------------------------------------

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), { mode: 0o600 });
}

/** The key is stored encrypted with the operating system's keychain, never as plain text. */
function storedKey(settings) {
  if (!settings.grokKey || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(settings.grokKey, 'base64'));
  } catch {
    return null;
  }
}

/** Where the Grok app for the command line is installed, or null. */
function findGrokCli() {
  const home = os.homedir();
  const places = [path.join(home, '.grok', 'bin', 'grok'), path.join(home, '.local', 'bin', 'grok'), '/opt/homebrew/bin/grok', '/usr/local/bin/grok'];
  return places.find((p) => fs.existsSync(p)) ?? null;
}

/** TEMPORARY: where the Claude app for the command line is installed, or null. */
function findClaudeCli() {
  const home = os.homedir();
  const places = [path.join(home, '.local', 'bin', 'claude'), path.join(home, '.claude', 'local', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  return places.find((p) => fs.existsSync(p)) ?? null;
}

function grokStatus() {
  const settings = readSettings();
  const cli = findGrokCli();
  const claude = findClaudeCli();
  const mode =
    settings.grokMode === 'cli' && cli ? 'cli' : settings.grokMode === 'api' && storedKey(settings) ? 'api' : settings.grokMode === 'claude' && claude ? 'claude' : null;
  return { managed, mode, cliFound: cli !== null, claudeFound: claude !== null, canStoreKey: safeStorage.isEncryptionAvailable() };
}

// ---- running the backend --------------------------------------------------------------------

async function healthy() {
  try {
    const res = await fetch(`${URL}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilHealthy(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await healthy()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function backendEnv() {
  const settings = readSettings();
  const cli = findGrokCli();
  let firebase = {};
  try {
    firebase = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8'));
  } catch {
    // Without it sign-in is off and the app can only be looked around as a guest.
  }
  const env = {
    // An app opened from the Finder gets a short PATH; the Grok app may need the usual places.
    PATH: [process.env.PATH, path.join(os.homedir(), '.grok', 'bin'), path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(path.delimiter),
    HOME: os.homedir(),
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(PORT),
    FIREBASE_WEB_API_KEY: firebase.apiKey ?? '',
    FIREBASE_PROJECT_ID: firebase.projectId ?? '',
    FIREBASE_AUTH_DOMAIN: firebase.authDomain ?? '',
    // Each student's memory goes to the cloud under their own sign-in; nothing secret ships in the app.
    STUDENT_STORE: 'account',
    // Students connect Google once; the backend on their computer keeps the connection.
    ...(firebase.googleOAuth ? { GOOGLE_OAUTH_CLIENT_ID: firebase.googleOAuth.clientId, GOOGLE_OAUTH_CLIENT_SECRET: firebase.googleOAuth.clientSecret } : {}),
    LOCAL_DATA_FILE: path.join(app.getPath('userData'), 'store.json'),
  };
  for (const name of ['TMPDIR', 'USER', 'LANG', 'SystemRoot', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE']) if (process.env[name]) env[name] = process.env[name];
  if (settings.grokMode === 'cli' && cli) {
    env.GROK_TRANSPORT = 'cli';
    env.GROK_CLI_BIN = cli;
  } else if (settings.grokMode === 'api') {
    const key = storedKey(settings);
    if (key) env.XAI_API_KEY = key;
  } else if (settings.grokMode === 'claude' && findClaudeCli()) {
    // TEMPORARY test set-up: Opus for the master, managers, validation and presentation; Sonnet for the workers.
    env.GROK_TRANSPORT = 'claude';
    env.CLAUDE_CLI_BIN = findClaudeCli();
    env.CLAUDE_MODEL_NORMAL = 'opus';
    env.CLAUDE_MODEL_LOW = 'sonnet';
  }
  return env;
}

function stopBackend() {
  if (!child) return;
  const old = child;
  child = null;
  old.removeAllListeners('exit');
  old.kill();
}

async function startBackend() {
  // Set by `npm run app:dev`: the developer runs the backend themselves.
  if (process.env.ELECTRON_START_URL) return;
  if (!child && !managed && (await healthy())) return;
  stopBackend();
  // The old one has to let go of the port before the new one can take it.
  for (let i = 0; i < 20 && (await healthy()); i++) await new Promise((r) => setTimeout(r, 150));
  managed = true;
  const dir = backendDir();
  const log = fs.openSync(path.join(app.getPath('userData'), 'backend.log'), 'a');
  child = spawn(process.execPath, [path.join(dir, 'src', 'server.ts')], { cwd: dir, env: backendEnv(), stdio: ['ignore', log, log] });
  child.on('exit', (code) => {
    child = null;
    // Come back after a crash, but not in a tight loop.
    if (code !== 0 && !app.isQuitting) setTimeout(() => void startBackend(), 3000);
  });
  await waitUntilHealthy(20_000);
}

const KEY_SHAPE = /^[A-Za-z0-9_\-.]{20,300}$/;

function mount() {
  ipcMain.handle('grok:status', () => grokStatus());
  ipcMain.handle('grok:connect', async (_event, choice) => {
    const settings = readSettings();
    if (choice && choice.mode === 'cli') {
      if (!findGrokCli()) return { ...grokStatus(), error: 'The Grok app for the command line was not found on this computer.' };
      settings.grokMode = 'cli';
    } else if (choice && choice.mode === 'api') {
      const key = typeof choice.key === 'string' ? choice.key.trim() : '';
      if (!KEY_SHAPE.test(key)) return { ...grokStatus(), error: 'That does not look like an xAI API key.' };
      if (!safeStorage.isEncryptionAvailable()) return { ...grokStatus(), error: 'This computer cannot store the key securely.' };
      settings.grokMode = 'api';
      settings.grokKey = safeStorage.encryptString(key).toString('base64');
    } else if (choice && choice.mode === 'claude') {
      if (!findClaudeCli()) return { ...grokStatus(), error: 'The Claude app for the command line was not found on this computer.' };
      settings.grokMode = 'claude';
      delete settings.grokKey;
    } else {
      return { ...grokStatus(), error: 'Unknown choice.' };
    }
    writeSettings(settings);
    if (managed) await startBackend();
    return grokStatus();
  });
  ipcMain.handle('grok:disconnect', async () => {
    const settings = readSettings();
    delete settings.grokMode;
    delete settings.grokKey;
    writeSettings(settings);
    if (managed) await startBackend();
    return grokStatus();
  });
  app.on('before-quit', () => {
    app.isQuitting = true;
    stopBackend();
  });
}

module.exports = { mount, startBackend };
