const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { login } = require('./auth/authController');

let mainWindow;


function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1080,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        }
    });
    
    mainWindow.loadFile('./front/login.html');

    const template = [
        {
            label: 'Menu',
            submenu: [                        
                { role: 'quit', label: 'Salir' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

ipcMain.on('login', async (event, { usuario, contraseña }) => {
    const resultado = await login(usuario, contraseña);

    if (resultado.success) {
        event.sender.send('login-success', resultado);
    } else {
        event.sender.send('login-failed', resultado.message);
    }
}); 


