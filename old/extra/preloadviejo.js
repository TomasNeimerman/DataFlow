const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
getEmpresas: () => ipcRenderer.invoke('get-empresas'),
loadCheques: () => ipcRenderer.invoke('load-cheques'),
checkTableExists: (empresa) => ipcRenderer.invoke('check-table-exists', empresa),
verifyCheques: (cheques,empresa) => ipcRenderer.invoke('verify-cheques', cheques, empresa),
updateCheques: (cheques, empresa) => ipcRenderer.invoke('update-cheques', cheques, empresa),
});