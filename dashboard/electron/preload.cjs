// The only bridge between the page and the desktop shell: asking macOS which permissions the app
// has, opening the matching pane of System Settings, choosing how the agents reach Grok, and
// bringing the window to the front. The page gets no other access, and can never read a stored
// key back.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bearrokDesktop', {
  platform: process.platform,
  /** { screen, disk, control }, each 'granted' | 'denied' | 'unknown'. */
  permissions: () => ipcRenderer.invoke('permissions:status'),
  /** kind: 'screen' | 'disk' | 'control'. Opens System Settings at that permission. */
  openPermission: (kind) => ipcRenderer.invoke('permissions:open', kind),
  grok: {
    /** { managed, mode: 'cli' | 'api' | 'claude' | null, cliFound, claudeFound, canStoreKey }. claude is a temporary test set-up. */
    status: () => ipcRenderer.invoke('grok:status'),
    /** { mode: 'cli' }, { mode: 'api', key } or { mode: 'claude' }. Restarts the agents on the new connection. */
    connect: (choice) => ipcRenderer.invoke('grok:connect', choice),
    disconnect: () => ipcRenderer.invoke('grok:disconnect'),
  },
  /** Brings the app window to the front, for example after a notification is clicked. */
  focusWindow: () => ipcRenderer.send('window:focus'),
});
