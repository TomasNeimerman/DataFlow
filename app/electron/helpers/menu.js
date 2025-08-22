// electron/helpers/menu.js
const { Menu } = require('electron');

function buildAppMenu(mainWindow, isDev, modulos) {
  const currentPort = (isDev ? 3000 : (new URL(mainWindow.webContents.getURL()).port)) || 3000;

  const template = [
    {
      label: 'Menú',
      submenu: [
        ...modulos.map(m => ({
          label: m.nombre,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const base = isDev ? `http://localhost:3000` : `http://localhost:${currentPort}`;
              mainWindow.loadURL(`${m.link}?modulo=${encodeURIComponent(m.nombre)}`);
            }
          }
        })),
        { type: 'separator' },
        {
          label: 'Inicio',
          accelerator: 'Home',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const base = isDev ? `http://localhost:3000` : new URL(mainWindow.webContents.getURL()).origin;
              mainWindow.loadURL(`${base}/Index`);
            }
          }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => { try { mainWindow.webContents.toggleDevTools(); } catch (_) {} }
        },
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => { try { mainWindow.reload(); } catch (_) {} }
        },
        { role: 'quit', label: 'Salir', accelerator: 'Esc' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildAppMenu };
