// The only bridge between the page and the desktop shell: asking macOS which permissions the app
// has, and opening the matching pane of System Settings. The page gets no other access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bearrokDesktop', {
  platform: process.platform,
  /** { screen, disk, control }, each 'granted' | 'denied' | 'unknown'. */
  permissions: () => ipcRenderer.invoke('permissions:status'),
  /** kind: 'screen' | 'disk' | 'control'. Opens System Settings at that permission. */
  openPermission: (kind) => ipcRenderer.invoke('permissions:open', kind),
});
