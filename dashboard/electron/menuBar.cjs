// BearRok in the Mac menu bar: a bear icon at the top of the screen with a menu to start a search,
// see the key deadlines, open the top recommendation, and open the feed. The page sends what to
// show (it holds the signed-in student's data); the shell sends back what was picked, after
// bringing the window to the front. Nothing about the student is stored here.
const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');

let tray = null;
let latest = { searching: false, deadlines: [], top: null, signedIn: false };
let getWindow = () => null;
let makeWindow = () => null;

/** Whether the page in the window is listening, and an action picked before it was. */
let ready = false;
let pending = null;
const watched = new WeakSet();

/** The window, made again if it was closed, shown and in front. */
function showWindow() {
  let window = getWindow();
  if (!window || window.isDestroyed()) window = makeWindow();
  if (!window) return null;
  if (!watched.has(window.webContents)) {
    watched.add(window.webContents);
    // A page that starts loading again is not listening until it says so.
    window.webContents.on('did-start-loading', () => {
      ready = false;
    });
    window.on('closed', () => {
      ready = false;
    });
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (process.platform === 'darwin') app.focus({ steal: true });
  return window;
}

function deliver() {
  const window = getWindow();
  if (!pending || !ready || !window || window.isDestroyed()) return;
  window.webContents.send('menubar:action', pending);
  pending = null;
}

function send(action) {
  pending = action;
  if (showWindow()) deliver();
}

function build() {
  const items = [];
  if (!latest.signedIn) {
    items.push({ label: 'Open BearRok to sign in', click: () => send({ type: 'open', path: '/' }) });
  } else {
    items.push(
      latest.searching
        ? { label: 'Searching… (stop)', click: () => send({ type: 'stop' }) }
        : { label: 'Run search', click: () => send({ type: 'run' }) },
    );
    items.push({ type: 'separator' }, { label: 'Key deadlines', enabled: false });
    if (latest.deadlines.length === 0) items.push({ label: 'Nothing due soon', enabled: false });
    for (const d of latest.deadlines) {
      const path = d.path;
      items.push({ label: d.label, click: () => send({ type: 'open', path }) });
    }
    items.push({ type: 'separator' }, { label: 'Top recommendation', enabled: false });
    // Kept as it is now: an update while the menu is open must not change what a click opens.
    const top = latest.top;
    items.push(top ? { label: top.label, click: () => send({ type: 'open', path: top.path }) } : { label: 'Nothing in your feed yet', enabled: false });
  }
  items.push({ type: 'separator' }, { label: 'Open feed', click: () => send({ type: 'open', path: '/' }) });
  items.push({ type: 'separator' }, { label: 'Quit BearRok', click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(latest.searching ? 'BearRok: searching' : 'BearRok');
}

/** Long titles are cut so the menu stays narrow. */
const clip = (text, n = 60) => (typeof text === 'string' ? (text.length > n ? `${text.slice(0, n - 1)}…` : text) : '');

/** Only plain fields, and only paths inside the app, are taken from the page. */
function clean(data) {
  const inApp = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\');
  return {
    signedIn: data?.signedIn === true,
    searching: data?.searching === true,
    deadlines: (Array.isArray(data?.deadlines) ? data.deadlines : []).filter((d) => inApp(d?.path)).slice(0, 6).map((d) => ({ label: clip(d.label, 70), path: d.path })),
    top: data?.top && inApp(data.top.path) ? { label: clip(data.top.label, 70), path: data.top.path } : null,
  };
}

function mount({ ipcMain, window, create }) {
  getWindow = window;
  makeWindow = create;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  build();
  ipcMain.on('menubar:ready', (_event, on) => {
    ready = on === true;
    deliver();
  });
  ipcMain.on('menubar:update', (_event, data) => {
    latest = clean(data);
    build();
  });
}

module.exports = { mount, clean };
