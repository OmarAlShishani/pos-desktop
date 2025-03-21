const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    printOrder: (order) => {
      return new Promise((resolve) => {
        ipcRenderer.send('print-order', order);
        ipcRenderer.once('print-complete', (event, result) => {
          resolve(result);
        });
      });
    },
    getPorts: () => ipcRenderer.invoke('get-ports'),
    connectScale: (portName, baudRate = 9600) => ipcRenderer.invoke('connect-scale', portName, baudRate),
    
    // Scale event handlers
    onScaleData: (callback) => {
      ipcRenderer.on('scale-data', (event, value) => callback(event, value));
    },
    onScaleError: (callback) => {
      ipcRenderer.on('scale-error', (event, value) => callback(event, value));
    },
    onScaleStatus: (callback) => {
      ipcRenderer.on('scale-status', (event, value) => callback(event, value));
    },
    
    // Cleanup functions
    removeScaleListener: () => {
      ipcRenderer.removeAllListeners('scale-data');
    },
    removeScaleErrorListener: () => {
      ipcRenderer.removeAllListeners('scale-error');
    },
    removeScaleStatusListener: () => {
      ipcRenderer.removeAllListeners('scale-status');
    },
    openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),
    exitApplication: () => ipcRenderer.send('exit-application'),
    onCloseAttempted: (callback) => {
      ipcRenderer.on('app-close-attempted', () => callback());
    },
  }
);
