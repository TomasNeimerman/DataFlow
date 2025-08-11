// electron/main.js
const { app, BrowserWindow, ipcMain, Menu, shell, nativeImage } = require('electron');
const { createServer } = require('http');
const next = require('next');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Store = require('electron-store');
const { initializeConfig } = require('./userDbConfig.js');

// --- Detección de Windows Server 2012 o versiones anteriores ---
const isLegacyWindows = process.platform === 'win32' &&
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

// --- Importación de servicios ---
const { getDatosEmpresaById, obtenerListadoEmpresas, guardarDatosEmpresaConfig } = require('./modulesService/Empresa');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { registroCheq3Sit: registro, actualizarCheque3: actualizarCheque3Service, obtenerCheque3Rechazado: cheque3R, getSituacion: situacion, getUpdatedbyRegistro: getupdreg } = require('./modulesService/Cheques3');
const { getArticulos, getClases, getProveedores, getRubros, getTasasIVA, getArticuloDetailsById, claseExiste, rubroExiste, getProveedorDetails, getTasaIVADetails } = require('./modulesService/Articulos');
const { obtenerPrecios: obtenerPreciosService, actualizarListaDePrecios: actualizarPreciosService, obtenerPreciosActualizados: obtenerPreciosActualizadosService } = require('./modulesService/Precios');

// --- Next.js + Electron ---
const isDev = !app.isPackaged;
let currentPort = 3000;
const MAX_PORT_ATTEMPTS = 10;
const nextApp = next({ dev: isDev, dir: isDev ? path.join(__dirname, '..') : app.getAppPath() });
const handle = nextApp.getRequestHandler();

let mainWindow;

async function createMainWindow() {
  const { default: Store } = await import('electron-store');
    store = new Store();  
    store.clear()
  writeToLog('Iniciando createMainWindow...');
  try {
    await nextApp.prepare();
    writeToLog('Next.js listo.');
  } catch (error) {
    writeToLog(`Error al preparar Next.js: ${error.message}\n${error.stack}`);
    return app.quit();
  }

  let server, portFound = false;
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
          if (err.code === 'EADDRINUSE') {
            writeToLog(`Puerto ${currentPort} en uso`);
            currentPort++;
            server.close();
            reject(err);
          } else reject(err);
        });
      });
      if (portFound) break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || i === MAX_PORT_ATTEMPTS - 1) {
        writeToLog(`Error crítico de servidor: ${error.message}`);
        return app.quit();
      }
    }
  }

  const windowOptions = {
    width: 1280,
    height: 920,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      experimentalFeatures: false,
      enableRemoteModule: false,
    },
    show: false,
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

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    writeToLog(`Carga fallida: ${url} (${code}): ${desc}`);
    if (isLegacyWindows && isMainFrame) {
      setTimeout(() => {
        writeToLog('Recargando después de fallo...');
        mainWindow.loadURL(`http://localhost:${currentPort}/Login`);
      }, 2000);
    }
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    writeToLog(`Render terminado: ${details.reason}, Código: ${details.exitCode}`);
    if (isLegacyWindows) {
      setTimeout(() => {
        writeToLog('Intentando recuperar proceso...');
        if (!mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${currentPort}/Login`);
        }
      }, 3000);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    writeToLog('Carga web finalizada.');
  });

  mainWindow.loadURL(`http://localhost:${currentPort}/Login`);
  setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
      writeToLog('Página cargada a tiempo.');
    }
  }, isLegacyWindows ? 30000 : 15000);

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
      { label: 'Salir', role: 'quit', accelerator: 'Esc' },
      {
        label: 'Reload',
        accelerator: 'F5',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
            writeToLog('Ventana recargada.');
          }
        }
      }
    ]
  }];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  writeToLog('App lista.');

  // Crear carpeta temporal
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  if (!fs.existsSync(tempFolderPath)) {
    fs.mkdirSync(tempFolderPath);
    writeToLog(`Carpeta temporal creada: ${tempFolderPath}`);
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
ipcMain.handle('electron-store-get', (event, key) => {
    return store.get(key);
});
ipcMain.handle('electron-store-set', (event, { key, value }) => {
    store.set(key, value);
});
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

      // Reconstruir el menú después del login
      const template = [
        {
          label: 'Menú',
          submenu: [
            ...modulos.map(modulo => ({
              label: modulo.nombre,
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}&idModulo=${modulo.id}`);
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
                  mainWindow.loadURL(`http://localhost:${currentPort}/Index`);
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
            {
              role: 'quit',
              label: 'Salir',
              accelerator: 'Esc',
            },
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

// --- Otros IPC HANDLERS con manejo de errores mejorado ---
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

// Registrar todos los handlers con manejo de errores
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
