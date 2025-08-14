// electron/main.js
// ✅ Node 14 / Electron 13 friendly (CJS only)

const { app, BrowserWindow, ipcMain, Menu, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const Store = require('electron-store'); // ✅ único import
const { initializeConfig } = require('./userDbConfig.js');

// --- Detección de Windows Server 2012 o anteriores ---
const isLegacyWindows =
  process.platform === 'win32' &&
  (os.release().startsWith('6.2') || os.release().startsWith('6.1') || os.release().startsWith('6.0'));

// --- Configuración temprana ---
initializeConfig();
app.disableHardwareAcceleration();

if (isLegacyWindows) {
  app.commandLine.appendSwitch('--disable-gpu');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-webassembly');
  app.commandLine.appendSwitch('--no-proxy-server');
  app.commandLine.appendSwitch('--ignore-certificate-errors');
}

// --- Logging ---
const userDataPath = app.getPath('userData');
const logFilePath = path.join(userDataPath, 'app_error.log');

function writeToLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logMessage);
  } catch (logError) {
    console.error(`Error al escribir en el log: ${logError.message}`);
  }
}

writeToLog(`Sistema operativo: ${os.platform()} ${os.release()}`);
writeToLog(`Arquitectura: ${os.arch()}`);
writeToLog(`Node.js: ${process.version}, Electron: ${process.versions.electron}`);
writeToLog(`Windows Server 2012 detectado: ${isLegacyWindows}`);

process.on('uncaughtException', (error) => {
  writeToLog(`Uncaught Exception: ${error.message}\n${error.stack}`);
  setTimeout(() => app.quit(), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  writeToLog(`Unhandled Rejection: ${reason}\n${promise}`);
});

// --- Importación de servicios (tal cual los tenías) ---
const { getDatosEmpresaById, obtenerListadoEmpresas, guardarDatosEmpresaConfig } = require('./modulesService/Empresa');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { registroCheq3Sit: registro, actualizarCheque3: actualizarCheque3Service, obtenerCheque3Rechazado: cheque3R, getSituacion: situacion, getUpdatedbyRegistro: getupdreg } = require('./modulesService/Cheques3');
const { getArticulos, getClases, getProveedores, getRubros, getTasasIVA, getArticuloDetailsById, claseExiste, rubroExiste, getProveedorDetails, getTasaIVADetails } = require('./modulesService/Articulos');
const { obtenerPrecios: obtenerPreciosService, actualizarListaDePrecios: actualizarPreciosService, obtenerPreciosActualizados: obtenerPreciosActualizadosService } = require('./modulesService/Precios');

// --- Estado global mínimo ---
const isDev = !app.isPackaged;
let mainWindow;
let store;

// --- Helper: esperar a que Next dev responda ---
function waitForUrl(urlToPing, timeoutMs = 30000, intervalMs = 500) {
  const http = require('http');
  const u = new URL(urlToPing);
  const opts = { method: 'GET', hostname: u.hostname, port: u.port, path: '/' };

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.request(opts, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Dev server no respondió a tiempo'));
        setTimeout(tick, intervalMs);
      });
      req.end();
    };
    tick();
  });
}

async function createMainWindow() {
  writeToLog('Iniciando createMainWindow...');
  store = new Store(); // ✅ un solo Store
  store.clear();
  // 🔒 (Opcional) Single instance lock - descomentar si querés evitar dobles instancias
  // const gotLock = app.requestSingleInstanceLock();
  // if (!gotLock) return app.quit();
  // app.on('second-instance', () => {
  //   if (mainWindow) {
  //     if (mainWindow.isMinimized()) mainWindow.restore();
  //     mainWindow.focus();
  //   }
  // });

  // Preload opcional (no rompas si no existe)
  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  if (!preloadExists) {
    writeToLog(`PRELOAD no encontrado: ${preloadPath}. Continuo sin preload.`);
  }

  const windowOptions = {
    width: 1280,
    height: 920,
    show: true, // 👈 mostrar de una en DEV para evitar que quede "invisible"
    webPreferences: {
      preload: preloadExists ? preloadPath : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      experimentalFeatures: false,
      enableRemoteModule: false,
    },
  };

  if (isLegacyWindows) {
    windowOptions.webPreferences.enableBlinkFeatures = '';
    windowOptions.webPreferences.disableBlinkFeatures = 'Auxclick';
    windowOptions.resizable = true;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isLegacyWindows && !isDev) mainWindow.maximize();
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc, theUrl, isMainFrame) => {
    writeToLog(`Carga fallida: ${theUrl} (${code}): ${desc} (mainFrame=${isMainFrame})`);
    console.error('[Electron] did-fail-load', code, desc, theUrl);
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    writeToLog(`Render terminado: ${details.reason}, Código: ${details.exitCode}`);
    console.error('[Electron] render-process-gone', details);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    writeToLog('Carga web finalizada.');
  });

  // --- DEV: NO embebemos Next. Usamos el next dev externo en :3000 ---
  if (isDev) {
    const DEV_BASE = 'http://localhost:3000';
    const DEV_URL = DEV_BASE + '/Login';

    // Extra: si ".next/trace" quedó mal tipado como carpeta, limpiarlo
    try {
      const projectRoot = path.resolve(__dirname, '..');
      const tracePath = path.join(projectRoot, '.next', 'trace');
      if (fs.existsSync(tracePath)) {
        const st = fs.statSync(tracePath);
        if (st.isDirectory()) {
          fs.rmSync(tracePath, { recursive: true, force: true });
          writeToLog('DEV: se removió carpeta .next/trace inválida');
        }
      }
    } catch (_) {}

    try {
      writeToLog('DEV: esperando http://localhost:3000 ...');
      await waitForUrl(DEV_BASE, 30000, 500);
      writeToLog('DEV: dev server OK, cargando /Login');
      await mainWindow.loadURL(DEV_URL);
    } catch (e) {
      writeToLog(`ERROR cargando DEV URL: ${e.message}\n${e.stack}`);
      await mainWindow.loadURL('data:text/html,<h1>No se pudo conectar a Next (DEV)</h1><p>Reintenta con F5</p>');
    }

    // DevTools en dev
    try { mainWindow.webContents.openDevTools(); } catch (_) {}
  } else {
    // --- PROD: Embebemos Next + servidor interno ---
    const { createServer } = require('http');
    const next = require('next');

    const MAX_PORT_ATTEMPTS = 10;
    let currentPort = 3000;

    try {
      const nextApp = next({ dev: false, dir: app.getAppPath() });
      await nextApp.prepare();
      writeToLog('Next.js listo (PROD).');

      const handle = nextApp.getRequestHandler();

      let server;
      let portFound = false;

      for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        try {
          server = createServer((req, res) => handle(req, res));
          await new Promise((resolve, reject) => {
            server.listen(currentPort, () => {
              writeToLog(`Servidor en http://localhost:${currentPort}`);
              portFound = true;
              resolve();
            });
            server.once('error', (err) => {
              if (err && err.code === 'EADDRINUSE') {
                writeToLog(`Puerto ${currentPort} en uso`);
                currentPort++;
                try { server.close(); } catch (_) {}
                reject(err);
              } else {
                reject(err);
              }
            });
          });
          if (portFound) break;
        } catch (error) {
          if (!error || error.code !== 'EADDRINUSE' || i === MAX_PORT_ATTEMPTS - 1) {
            writeToLog(`Error crítico de servidor: ${error ? error.message : 'desconocido'}`);
            throw error;
          }
        }
      }

      const PROD_URL = `http://localhost:${currentPort}/Login`;
      await mainWindow.loadURL(PROD_URL);
    } catch (error) {
      writeToLog(`Error al preparar Next (PROD): ${error.message}\n${error.stack}`);
      await mainWindow.loadURL('data:text/html,<h1>Error iniciando servidor interno</h1>');
      setTimeout(() => app.quit(), 1500);
      return;
    }
  }

  // Menú base
  const template = [{
    label: 'Menú',
    submenu: [
      {
        label: 'Toggle DevTools',
        accelerator: 'F12',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.toggleDevTools();
            writeToLog('DevTools toggled.');
          }
        }
      },
      {
        label: 'Reload',
        accelerator: 'F5',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
            writeToLog('Ventana recargada.');
          }
        }
      },
      { type: 'separator' },
      { label: 'Salir', role: 'quit', accelerator: 'Esc' },
    ]
  }];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Ciclo de vida de la app ---
app.whenReady().then(() => {
  writeToLog('App lista.');

  // Crear carpeta temporal
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  if (!fs.existsSync(tempFolderPath)) {
    try {
      fs.mkdirSync(tempFolderPath);
      writeToLog(`Carpeta temporal creada: ${tempFolderPath}`);
    } catch (e) {
      writeToLog(`Error creando carpeta temporal: ${e.message}`);
    }
  }

  setTimeout(() => {
    try {
      createMainWindow();
    } catch (e) {
      writeToLog(`Error en createMainWindow: ${e.message}\n${e.stack}`);
    }
  }, isLegacyWindows ? 2000 : 0);
});

app.on('window-all-closed', () => {
  writeToLog('Cerrando ventanas...');
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try {
    fs.rmSync(tempFolderPath, { recursive: true, force: true });
    writeToLog(`Carpeta temporal eliminada: ${tempFolderPath}`);
  } catch (e) {
    writeToLog(`Error eliminando temp: ${e.message}`);
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// --- Electron Store IPC ---
ipcMain.handle('electron-store-get', (event, key) => {
  return store ? store.get(key) : undefined;
});
ipcMain.handle('electron-store-set', (event, { key, value }) => {
  if (store) store.set(key, value);
});

// --- Login e inyección de menú dinámico ---
ipcMain.handle('login', async (event, { usuario, contraseña }) => {
  writeToLog(`IPC: Intento de login para usuario: ${usuario}`);
  try {
    const result = await iniciarSesionService({ usuario, contraseña });

    if (result.success && result.user && result.token && result.user.IdCliente) {
      writeToLog(`Login exitoso para IdCliente: ${result.user.IdCliente}`);

      store.set("idCliente", result.user.IdCliente);
      store.set("jwtToken", result.token);
      store.set("fechaInicio", new Date().toISOString());

      const modulesResult = await obtenerModulosService(result.user.IdCliente);
      if (!modulesResult.success) {
        writeToLog(`Error al obtener módulos después del login: ${modulesResult.message}`);
        return { success: false, message: modulesResult.message };
      }

      const modulos = modulesResult.modulos.map(modulo => ({
        id: modulo.id,
        nombre: modulo.nombre,
        texto: modulo.texto,
        icono: modulo.icono,
        link: modulo.link,
        path: modulo.pathExcel,
        countClientesPorModulo: modulo.countClientesPorModulo,
      }));

      const currentPort = (isDev ? 3000 : (new URL(mainWindow.webContents.getURL()).port)) || 3000;

      const template = [
        {
          label: 'Menú',
          submenu: [
            ...modulos.map(modulo => ({
              label: modulo.nombre,
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  const base = isDev ? `http://localhost:3000` : `http://localhost:${currentPort}`;
                  mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}`);
                  writeToLog(`Navegando a módulo: ${modulo.link}`);
                }
              },
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
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.toggleDevTools();
                  writeToLog('DevTools toggled via menu.');
                }
              },
            },
            {
              label: 'Actualizar',
              accelerator: 'F5',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.reload();
                  writeToLog('Window reloaded via menu.');
                }
              },
            },
            { role: 'quit', label: 'Salir', accelerator: 'Esc' },
          ],
        },
      ];

      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
      writeToLog('Menú de la aplicación actualizado con módulos.');

      return { success: true, user: result.user, modulos, token: result.token };
    }

    writeToLog(`Login fallido: ${result.message || 'Credenciales inválidas'}`);
    return result;
  } catch (error) {
    const errorMessage = `Error en IPC login handler: ${error.message}\n${error.stack}`;
    writeToLog(errorMessage);
    console.error(errorMessage);
    return { success: false, message: `Error interno al intentar iniciar sesión: ${error.message}` };
  }
});

// --- Helper para registrar handlers con try/catch ---
const createIpcHandler = (name, handler) => {
  ipcMain.handle(name, async (event, ...args) => {
    try {
      const result = await handler(...args);
      return result;
    } catch (error) {
      const errorMessage = `Error en IPC ${name}: ${error.message}\n${error.stack}`;
      writeToLog(errorMessage);
      console.error(errorMessage);
      return { success: false, message: `Error en ${name}: ${error.message}` };
    }
  });
};

// --- Otros IPC HANDLERS (tus servicios) ---
ipcMain.handle('get-list-empresas', async (event, idCliente) => {
  try {
    const empresas = await obtenerListadoEmpresas(idCliente);
    return { success: true, data: empresas };
  } catch (error) {
    writeToLog(`Error en IPC get-list-empresas: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-empresa-by-id', async (event, idEmpresa) => {
  try {
    const datosEmpresa = await getDatosEmpresaById(idEmpresa);
    return { success: true, data: datosEmpresa };
  } catch (error) {
    writeToLog(`Error en IPC get-empresa-by-id: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-empresa-config', async (event, empresaData) => {
  try {
    await guardarDatosEmpresaConfig(empresaData);
    return { success: true, message: 'Configuración guardada exitosamente.' };
  } catch (error) {
    writeToLog(`Error en IPC get-empresa-config: ${error.message}`);
    return { success: false, message: error.message };
  }
});

createIpcHandler('get-modules', obtenerModulosService);
createIpcHandler('obtener-cheques', obtenerChequeService);
createIpcHandler('update-cheques', actualizarChequeService);
createIpcHandler('update-cheque3', ({ IDCheque, sit }) => actualizarCheque3Service(IDCheque, sit));
createIpcHandler('cheque3-rechazado', cheque3R);
createIpcHandler('cheque3-situacion', situacion);
createIpcHandler('registro-cheque3-sit', ({ emp, suc, IDCheque, sit, sitAnt }) => registro(emp, suc, IDCheque, sit, sitAnt));
createIpcHandler('get-articulos', getArticulos);
createIpcHandler('get-clases', getClases);
createIpcHandler('get-proveedores', getProveedores);
createIpcHandler('get-rubros', getRubros);
createIpcHandler('get-tasas-iva', getTasasIVA);
createIpcHandler('get-articulo-details-by-id', getArticuloDetailsById);
createIpcHandler('clase-existe', claseExiste);
createIpcHandler('rubro-existe', rubroExiste);
createIpcHandler('get-proveedor-details', getProveedorDetails);
createIpcHandler('get-tasa-iva-details', getTasaIVADetails);
createIpcHandler('get-updated-fecha', getupdreg);
createIpcHandler('get-precios', obtenerPreciosService);
createIpcHandler('actualizar-precios', actualizarPreciosService);
createIpcHandler('get-precios-actualizados', obtenerPreciosActualizadosService);

ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
  try {
    if (!relativeFilePath) throw new Error("No se proporcionó ruta.");
    const appBasePath = app.getAppPath();
    const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);
    writeToLog(`Abriendo archivo: ${absoluteFilePath}`);

    if (!fs.existsSync(absoluteFilePath)) throw new Error("Archivo no encontrado.");

    if (isLegacyWindows) {
      const { exec } = require('child_process');
      exec(`start "" "${absoluteFilePath}"`, (error) => {
        if (error) writeToLog(`exec error: ${error.message}`);
        else writeToLog("Archivo abierto con exec.");
      });
      return { success: true, message: "Plantilla abierta." };
    } else {
      const result = await shell.openPath(absoluteFilePath);
      if (result) {
        const { exec } = require('child_process');
        exec(`start "" "${absoluteFilePath}"`, (error) => {
          if (error) writeToLog(`Fallback exec error: ${error.message}`);
          else writeToLog("Fallback Excel abierto.");
        });
        return { success: true, message: "Plantilla abierta con fallback." };
      }
      return { success: true, message: "Plantilla abierta automáticamente." };
    }
  } catch (error) {
    writeToLog(`download-and-open-excel error: ${error.message}`);
    return { success: false, message: error.message };
  }
});
