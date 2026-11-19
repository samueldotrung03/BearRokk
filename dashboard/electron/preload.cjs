// The only bridge between the page and the desktop shell: asking macOS which permissions the app
// has, opening the matching pane of System Settings, and bringing the window to the front. The
// page gets no other access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bearrokDesktop', {
  platform: process.platform,
  /** { screen, disk, control }, each 'granted' | 'denied' | 'unknown'. */
  permissions: () => ipcRenderer.invoke('permissions:status'),
  /** kind: 'screen' | 'disk' | 'control'. Opens System Settings at that permission. */
  openPermission: (kind) => ipcRenderer.invoke('permissions:open', kind),
  /** Brings the app window to the front, for example after a notification is clicked. */
  focusWindow: () => ipcRenderer.send('window:focus'),
});
