const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Window control
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Auto-update listeners
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, percent) => callback(percent));
  },

  // Autopilot trigger from tray
  onTriggerAutopilot: (callback) => {
    ipcRenderer.on('trigger-autopilot', () => callback());
  }
});