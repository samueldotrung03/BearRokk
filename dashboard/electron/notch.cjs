// The notch panel: when the cursor reaches the camera notch at the top centre of the main screen, a
// small shortcut panel drops down below it, and it goes away when the cursor moves off. The panel
// shows the app's /quick page; what the student picks there is passed to the main window the same
// way the menu bar icon does it. Electron is only loaded inside mount, so the helpers can be tested
// in plain Node.
const path = require('node:path');

/** The hot zone: the top few pixels of the main screen, this far either side of its centre. */
const HOT_DEPTH = 6;
const HOT_HALF_WIDTH = 130;
/** Height of the macOS menu bar on a Mac with a notch, for when the screen reports no work area. */
const MENU_BAR = 38;
const POLL_MS = 120;
/** Polls in a row the cursor must spend in the hot zone, so passing through it does not open the panel. */
const HITS_TO_SHOW = 2;
const HIDE_AFTER_MS = 450;
/** Room around the panel the cursor may stray into without it closing. */
const MARGIN = 12;
const WIDTH = 420;
const HEIGHT = 600;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 640;

/** True when the cursor is in the hot zone of this display (the main screen is the one passed in). */
function inNotch(point, display) {
  const b = display?.bounds;
  if (!b || typeof point?.x !== 'number' || typeof point?.y !== 'number') return false;
  const centre = b.x + b.width / 2;
  return point.y >= b.y && point.y < b.y + HOT_DEPTH && Math.abs(point.x - centre) <= HOT_HALF_WIDTH;
}

/** Where the panel goes: centred on the display, its top just under the menu bar. */
function panelBounds(display, size) {
  const b = display.bounds;
  const area = display.workArea;
  // An auto-hidden menu bar gives a work area that starts at the very top, behind the notch.
  const top = area && area.y > b.y ? area.y : b.y + MENU_BAR;
  return { x: Math.round(b.x + (b.width - size.width) / 2), y: top, width: size.width, height: size.height };
}

/** True when the point is inside the rectangle grown by `margin` on every side. */
function within(point, rect, margin = 0) {
  return (
    point.x >= rect.x - margin &&
    point.x <= rect.x + rect.width + margin &&
    point.y >= rect.y - margin &&
    point.y <= rect.y + rect.height + margin
  );
}

/** Only run, stop, and opening a path inside the app are taken from the panel's page. */
function cleanAction(action) {
  if (action?.type === 'run' || action?.type === 'stop') return { type: action.type };
  if (action?.type === 'open' && typeof action.path === 'string' && action.path.startsWith('/') && !action.path.startsWith('//')) {
    return { type: 'open', path: action.path };
  }
  return null;
}

/** The panel's height, kept between the smallest and largest it may be; null for anything not a number. */
function clampHeight(height) {
  if (typeof height !== 'number' || !Number.isFinite(height)) return null;
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)));
}

function mount({ ipcMain, window, create, devUrl }) {
  if (process.platform !== 'darwin') return;
  const { app, BrowserWindow, screen, shell } = require('electron');

  let panel = null;
  let ready = false;
  /** The panel was asked to show before its page had loaded. */
  let pending = false;
  let height = HEIGHT;
  let hits = 0;
  let outsideSince = 0;
  /** After the panel hides, the cursor has to leave the hot zone before it can open again. */
  let armed = true;

  const alive = () => panel && !panel.isDestroyed();
  const isAppUrl = (url) => (devUrl ? url.startsWith(devUrl) : url.startsWith('file://'));
  const openExternally = (url) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
  };

  function makePanel() {
    const made = new BrowserWindow({
      width: WIDTH,
      height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    // Above the menu bar and other apps' windows, on every desktop. The dock icon is left alone.
    made.setAlwaysOnTop(true, 'pop-up-menu');
    made.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true });
    // Once the student has clicked into it, clicking anywhere else closes it.
    made.on('blur', () => hide());
    made.on('closed', () => {
      if (panel === made) {
        panel = null;
        ready = false;
        pending = false;
      }
    });
    made.webContents.setWindowOpenHandler(({ url }) => {
      openExternally(url);
      return { action: 'deny' };
    });
    made.webContents.on('will-navigate', (event, url) => {
      if (isAppUrl(url)) return;
      event.preventDefault();
      openExternally(url);
    });
    made.webContents.once('did-finish-load', () => {
      ready = true;
      if (pending) reveal();
    });
    if (devUrl) made.loadURL(`${devUrl}/quick`);
    else made.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: '/quick' });
    return made;
  }

  function place() {
    if (alive()) panel.setBounds(panelBounds(screen.getPrimaryDisplay(), { width: WIDTH, height }));
  }

  function reveal() {
    pending = false;
    if (!alive()) return;
    place();
    // Shown without taking focus, so whatever the student was typing in keeps the keyboard.
    panel.showInactive();
  }

  function show() {
    if (!alive()) panel = makePanel();
    if (ready) reveal();
    else pending = true;
  }

  function hide() {
    pending = false;
    outsideSince = 0;
    hits = 0;
    armed = false;
    if (alive() && panel.isVisible()) panel.hide();
  }

  /** The main window, made again if it was closed and brought to the front; as menuBar.cjs does it. */
  function withWindow(then) {
    let target = window();
    const fresh = !target;
    if (!target) target = create();
    if (!target) return;
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
    app.focus({ steal: true });
    // A page still loading has no listener yet.
    if (fresh || target.webContents.isLoading()) target.webContents.once('did-finish-load', () => setTimeout(() => then(target), 400));
    else then(target);
  }

  function deliver(action) {
    const target = window();
    // Starting or stopping a search does not need the main window in front, only a page to hear it.
    if (action.type !== 'open' && target && !target.webContents.isLoading()) {
      target.webContents.send('menubar:action', action);
      return;
    }
    withWindow((w) => w.webContents.send('menubar:action', action));
  }

  function tick() {
    let point;
    let primary;
    try {
      point = screen.getCursorScreenPoint();
      primary = screen.getPrimaryDisplay();
    } catch {
      return;
    }
    const hot = inNotch(point, primary);
    if (!hot) armed = true;
    hits = hot ? hits + 1 : 0;

    if (!alive() || !panel.isVisible()) {
      outsideSince = 0;
      if (armed && hits >= HITS_TO_SHOW) show();
      return;
    }
    // While the student is typing in it, only blur, Escape or an action closes it.
    if (panel.isFocused() || hot || within(point, panel.getBounds(), MARGIN)) {
      outsideSince = 0;
      return;
    }
    if (!outsideSince) outsideSince = Date.now();
    else if (Date.now() - outsideSince >= HIDE_AFTER_MS) hide();
  }

  ipcMain.on('quick:action', (_event, action) => {
    const clean = cleanAction(action);
    if (!clean) return;
    try {
      deliver(clean);
    } catch (e) {
      console.error('notch panel action failed:', e);
    }
    hide();
  });
  ipcMain.on('quick:hide', () => hide());
  ipcMain.on('quick:resize', (_event, next) => {
    const clamped = clampHeight(next);
    if (clamped === null) return;
    height = clamped;
    place();
  });

  const timer = setInterval(tick, POLL_MS);
  app.on('will-quit', () => clearInterval(timer));
}

module.exports = { mount, inNotch, panelBounds, cleanAction, clampHeight, within };
