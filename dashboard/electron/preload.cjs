// The only bridge between the page and the desktop shell: asking macOS which permissions the app
// has, opening the matching pane of System Settings, bringing the window to the front, the menu bar
// icon and notch panel, and choosing how the agents reach Grok. The page gets no other access, and can never read a stored
// key back.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bearrokDesktop', {
  platform: process.platform,
  /** { screen, disk, control }, each 'granted' | 'denied' | 'unknown'. */
  permissions: () => ipcRenderer.invoke('permissions:status'),
  /** kind: 'screen' | 'disk' | 'control'. Opens System Settings at that permission. */
  openPermission: (kind) => ipcRenderer.invoke('permissions:open', kind),
  /** Brings the app window to the front, for example after a notification is clicked. */
  focusWindow: () => ipcRenderer.send('window:focus'),
  /** The menu bar icon: what it shows, and what the student picked from it. */
  menuBar: {
    /** { signedIn, searching, deadlines: [{ label, path }], top: { label, path } | null } */
    update: (data) => ipcRenderer.send('menubar:update', data),
    /** Calls back with { type: 'run' | 'stop' } or { type: 'open', path }. Returns a function that stops listening. */
    onAction: (callback) => {
      const listener = (_event, action) => callback(action);
      ipcRenderer.on('menubar:action', listener);
      // The shell holds a picked action until the page is listening.
      ipcRenderer.send('menubar:ready', true);
      return () => {
        ipcRenderer.removeListener('menubar:action', listener);
        ipcRenderer.send('menubar:ready', false);
      };
    },
  },
  /** The notch panel's page: pass a pick to the main window, close the panel, or fit it to its content. */
  quick: {
    /** { type: 'run' | 'stop' } or { type: 'open', path }. The panel closes after sending it. */
    action: (a) => ipcRenderer.send('quick:action', a),
    hide: () => ipcRenderer.send('quick:hide'),
    /** Height in pixels, kept between 200 and 640. */
    resize: (h) => ipcRenderer.send('quick:resize', h),
  },
  grok: {
    /** { managed, mode: 'cli' | 'api' | 'claude' | null, cliFound, claudeFound, canStoreKey }. claude is a temporary test set-up. */
    status: () => ipcRenderer.invoke('grok:status'),
    /** { mode: 'cli' }, { mode: 'api', key } or { mode: 'claude' }. Restarts the agents on the new connection. */
    connect: (choice) => ipcRenderer.invoke('grok:connect', choice),
    disconnect: () => ipcRenderer.invoke('grok:disconnect'),
  },
});
