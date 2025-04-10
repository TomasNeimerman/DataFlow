// electron/main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,  
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://localhost:3000/Login');

  const template = [
    {
      label: 'Menú',
      submenu: [{ role: 'quit', label: 'Salir' }]
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

ipcMain.handle('login', async (event, { usuario, contraseña }) => {
  try {
    // 🔹 1. Hacer login
    const loginResponse = await fetch('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contraseña }),
    });

    const loginData = await loginResponse.json();
    if (!loginData.success) throw new Error(loginData.message);

    const { idCliente } = loginData.user;

    // 🔹 2. Obtener módulos con el IdCliente
    const modulesResponse = await fetch(`http://localhost:3000/api/modules/?idCliente=${idCliente}`);
    const modulesData = await modulesResponse.json();

    if (!modulesData.success) throw new Error(modulesData.message);

    // 🔹 3. Crear menú dinámico en Electron
    const template = [
      {
        label: 'Menú',
        submenu: modulesData.modulos.map(modulo => ({
          label: modulo.nombre,
          click: () => {
            mainWindow.loadURL(modulo.link);
          }
        }))
      },
      { role: 'quit', label: 'Salir' }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return { success: true, user: loginData.user, modulos: modulesData.modulos };

  } catch (error) {
    return { success: false, message: error.message };
  }
});

