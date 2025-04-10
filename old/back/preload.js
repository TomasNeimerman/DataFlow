const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (usuario, contraseña) => ipcRenderer.send('login', { usuario, contraseña }),
    onLoginSuccess: (callback) => ipcRenderer.on('login-success', (event, data) => callback(data)),
    onLoginFailed: (callback) => ipcRenderer.on('login-failed', (event, message) => callback(message)),
});
