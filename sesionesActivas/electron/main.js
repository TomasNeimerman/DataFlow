// electron/main.js
const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const next = require('next');

const isDev = !app.isPackaged;

// ===== logger a archivo (Documents/PanelSesiones/log.txt) =====
function logLine(msg) {
  try {
    const dir = path.join(app.getPath('documents'), 'PanelSesiones');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'log.txt'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

let win;

async function createWindow() {
  try {
    // ——— Directorio de la app Next (dentro de app.asar en prod) ———
    const appDir = path.resolve(__dirname, '..'); // ✅ funciona empaquetado y en dev
    logLine(`appDir: ${appDir}`);

    const nextApp = next({ dev: isDev, dir: appDir });
    await nextApp.prepare();
    logLine('nextApp.prepare OK');

    const handle = nextApp.getRequestHandler();
    const server = http.createServer((req, res) => handle(req, res));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    logLine(`Next server on 127.0.0.1:${port}`);

    // ——— Menú fuera y AppUserModelId para icono ———
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.tomi.sesiones'); // ✅ necesitado para icono en Windows

    // En prod, el icono se copia a resources (ver build config abajo)
    const runtimeIcon = isDev
      ? path.join(appDir, 'assets', 'icon', 'icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'); // buildResources

    win = new BrowserWindow({
      width: 1100,
      height: 800,
      useContentSize: true,
      autoHideMenuBar: true,
      backgroundColor: '#FFE3E3',
      show: false, // mostramos cuando cargó
      icon: runtimeIcon,
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
    logLine(`FATAL: ${err && err.stack ? err.stack : err}`);
    dialog.showErrorBox('Error al iniciar', String(err?.message || err));
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
