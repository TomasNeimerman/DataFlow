// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
  getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
  importarCheques: (cheques) => ipcRenderer.invoke('importar-cheques', cheques),
  obtenerCheques: (ids) => ipcRenderer.invoke('obtener-cheques', ids),
  updateCheques: (cheques) => ipcRenderer.invoke('update-cheques', cheques),
  abrirDevTools: () => ipcRenderer.send('abrir-dev-tools'),
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') {
    window.electronAPI.abrirDevTools();
  }
});