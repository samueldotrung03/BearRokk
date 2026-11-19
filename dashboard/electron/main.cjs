// Desktop shell for the dashboard. It only hosts the built web app: no Node access is given to
// the page, and links to outside sites open in the system browser instead of inside the app.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

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
    backgroundColor: '#f3f7fc',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

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
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
