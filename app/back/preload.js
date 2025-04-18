// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
  getclientesmodules: (module) => ipcRenderer.invoke('get-clientes-module', {module})
});
