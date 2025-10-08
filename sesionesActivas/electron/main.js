// electron/main.js
const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const next = require('next');

const conf = require(path.join(process.resourcesPath, 'next.config.js'));
const isDev = !app.isPackaged;

async function createWindow() {
  try {
    // Cuando está empaquetado, __dirname = ".../resources/app.asar/electron"
    // dir -> raíz del proyecto (dentro del asar)
    const dir = path.resolve(__dirname, '..');

    // ✅ Pasamos la config inline -> Next NO busca next.config.js
    const nextApp = next({
      dev: isDev,
      dir,
      conf: {
        reactStrictMode: true,
        distDir: '.next'    // lo que ya tenés en build
        // agrega aquí cualquier ajuste que tuvieses en tu next.config.js
      }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    const server = http.createServer((req, res) => handle(req, res));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.panel.sesiones');
    


    const win = new BrowserWindow({
      width: 1100,
      height: 800,
      backgroundColor: '#FFE3E3',
      autoHideMenuBar: true,
      show: false,
      icon: isDev
        ? path.join(dir, 'build', 'app-icon.ico')
        : path.join(process.resourcesPath, 'app-icon.ico'), // ver nota abajo
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
