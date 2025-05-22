// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
  getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
  obtenerCheques: (id) => ipcRenderer.invoke('obtener-cheques', id),
  updateCheques: (cheque) => ipcRenderer.invoke('update-cheques', cheque),
  obtenerCheque3: (id) => ipcRenderer.invoke('obtener-cheque3', id),
  updateCheque3: (cheque) => ipcRenderer.invoke('update-cheque3', cheque),
  abrirDevTools: () => ipcRenderer.send('abrir-dev-tools'),
  downloadAndOpenExcel: (url) => ipcRenderer.invoke('download-and-open-excel', url),
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') {
    window.api.abrirDevTools(); // Usa 'window.api' en lugar de 'window.electronAPI'
  }
});