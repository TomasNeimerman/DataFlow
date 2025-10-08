// electron/main.js
const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const next = require('next');

const isDev = !app.isPackaged;

async function createWindow() {
  try {
    // En prod: __dirname -> .../resources/app.asar/electron
    const appDir = path.resolve(__dirname, '..');

    // ✅ Config inline: Next NO busca next.config.js
    const nextApp = next({
      dev: isDev,
      dir: appDir,
      conf: {
        reactStrictMode: true,
        distDir: '.next'
        // Si tenías algo en next.config.js (headers/rewrites), copialo acá
      }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    const server = http.createServer((req, res) => handle(req, res));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.panel.sesiones');

    const iconPath = isDev
      ? path.join(appDir, 'build', 'app-icon.ico')
      : path.join(process.resourcesPath, 'app-icon.ico'); // lo copiamos con extraResources

    const win = new BrowserWindow({
      width: 1100,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#FFE3E3',
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.on('ready-to-show', () => win.show());
    win.on('closed', () => server.close());

    await win.loadURL(`http://127.0.0.1:${port}`);
  } catch (err) {
    dialog.showErrorBox('Error al iniciar', String(err?.stack || err));
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
