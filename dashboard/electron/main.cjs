// Desktop shell for the dashboard. It hosts the built web app and runs the agent backend beside
// it (backend.cjs). No Node access is given to the page, and links to outside sites open in the
// system browser instead of inside the app.
const { app, BrowserWindow, ipcMain, nativeTheme, shell, systemPreferences } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const backend = require('./backend.cjs');
const menuBar = require('./menuBar.cjs');
const notch = require('./notch.cjs');

/** The one app window; closing it on macOS keeps the app (and the menu bar icon) running. */
let mainWindow = null;

// Set by `npm run app:dev` to load the Vite dev server instead of the built files.
const devUrl = process.env.ELECTRON_START_URL;

function isAppUrl(url) {
  return devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
}

function openExternally(url) {
  if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 400,
    minHeight: 640,
    title: 'BearRok',
    // macOS: no title bar. The page runs to the top edge and the window buttons float over it;
    // the page leaves room for them and marks its top strip as the place to drag the window.
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 26, y: 26 } } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0b0f' : '#f3f7fc',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  window.once('ready-to-show', () => window.show());
  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return window;
}

// ---- macOS permissions, for the Settings page -------------------------------------------
// The app can only read what macOS has granted and open System Settings; granting is the user's
// own click there.
const PERMISSION_PANES = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  disk: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  control: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

function permissionStatus() {
  if (process.platform !== 'darwin') return { screen: 'unknown', disk: 'unknown', control: 'unknown' };
  const screen = systemPreferences.getMediaAccessStatus('screen') === 'granted' ? 'granted' : 'denied';
  const control = systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied';
  // macOS has no call for Full Disk Access; a folder only readable with it is the usual test.
  let disk = 'denied';
  try {
    fs.readdirSync(path.join(os.homedir(), 'Library', 'Application Support', 'com.apple.TCC'));
    disk = 'granted';
  } catch {
    // not granted
  }
  return { screen, disk, control };
}

ipcMain.handle('permissions:status', () => permissionStatus());
ipcMain.handle('permissions:open', (_event, kind) => {
  const pane = PERMISSION_PANES[kind];
  if (!pane) return false;
  shell.openExternal(pane);
  return true;
});

// Clicking a deadline notification: the page's own window.focus() is not relied on to raise or
// un-minimize the window, so the page asks the shell to bring it to the front.
ipcMain.on('window:focus', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (process.platform === 'darwin') app.focus({ steal: true });
});

backend.mount();

app.whenReady().then(async () => {
  // The page needs the backend from its first request, so it is started before the window opens.
  await backend.startBackend().catch((e) => console.error('backend did not start:', e));
  // The packaged app carries its own icon; this covers `npm run app`, which runs inside Electron's.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock.setIcon(path.join(__dirname, 'icon.png'));
  createWindow();
  // The bear in the menu bar at the top of the screen.
  if (process.platform === 'darwin') menuBar.mount({ ipcMain, window: () => mainWindow, create: createWindow });
  // The shortcut panel that drops down from the camera notch.
  if (process.platform === 'darwin') notch.mount({ ipcMain, window: () => mainWindow, create: createWindow, devUrl });
  // The notch panel stays open hidden, so the main window is checked for itself, not by counting windows.
  app.on('activate', () => {
    if (!mainWindow) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
