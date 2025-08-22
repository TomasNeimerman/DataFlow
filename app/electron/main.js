// electron/main.js
// ✅ Node 14 / Electron 13 friendly (CJS only)

const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const Store = require('electron-store');
const { initializeConfig } = require('./userDbConfig.js');

// Helpers (carpeta electron/helpers)
const { buildAppMenu } = require('./helpers/menu');
const { tryAutoResume } = require('./helpers/autoResume');
const { getDeviceId, bindUserLocally } = require('./helpers/device');
const { startSessionHeartbeat, stopSessionHeartbeat } = require('./helpers/session');

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
  try { fs.appendFileSync(logFilePath, logMessage); } catch (logError) {
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

// --- Servicios ---
const { getDatosEmpresaById, obtenerListadoEmpresas, guardarDatosEmpresaConfig } = require('./modulesService/Empresa');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const {
  iniciarSesion: iniciarSesionService,
  obtenerModulos: obtenerModulosService,
  verificarSesionActiva: verificarSesionActivaService,
  registrarSesionActiva: registrarSesionActivaService,
  finalizarSesionActiva: finalizarSesionActivaService,
  heartbeatSesionActiva: heartbeatSesionActivaService
} = require('./modulesService/Login');
const {
  registroCheq3Sit: registro,
  actualizarCheque3: actualizarCheque3Service,
  obtenerCheque3Rechazado: cheque3R,
  getSituacion: situacion,
  getUpdatedbyRegistro: getupdreg
} = require('./modulesService/Cheques3');
const {
  getArticulos, getClases, getProveedores, getRubros,
  getTasasIVA, getArticuloDetailsById, claseExiste, rubroExiste,
  getProveedorDetails, getTasaIVADetails
} = require('./modulesService/Articulos');
const {
  obtenerPrecios: obtenerPreciosService,
  actualizarListaDePrecios: actualizarPreciosService,
  obtenerPreciosActualizados: obtenerPreciosActualizadosService,
  obtenerPrecioActualizador: obtenerPrecioActualizadorService,
  updatePrecioActualizador: updatePrecioActualizadorService,
} = require('./modulesService/Precios');

// --- Estado global ---
const isDev = !app.isPackaged;
let mainWindow;
let store;
let activeSession = null;  // { usuario, deviceId, token }
let menuWasSet = false;    // 👈 para no pisar el menú dinámico
let stopHeartbeatFn = null;

// --- Helpers locales ---
function waitForUrl(urlToPing, timeoutMs = 30000, intervalMs = 500) {
  const http = require('http');
  const u = new URL(urlToPing);
  const opts = { method: 'GET', hostname: u.hostname, port: u.port, path: '/' };

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.request(opts, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Dev server no respondió a tiempo'));
        setTimeout(tick, intervalMs);
      });
      req.end();
    };
    tick();
  });
}

// Aplica menú dinámico y marca bandera (para no pisarlo luego)
function applyDynamicMenu(modulos) {
  try {
    buildAppMenu(mainWindow, isDev, modulos || []);
    menuWasSet = true;
    writeToLog(`Menú dinámico aplicado (${(modulos || []).length} módulos).`);
  } catch (e) {
    writeToLog(`Error al aplicar menú dinámico: ${e.message}`);
  }
}

async function createMainWindow() {
  writeToLog('Iniciando createMainWindow...');
  store = new Store(); // NO hacer store.clear()

  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  if (!preloadExists) writeToLog(`PRELOAD no encontrado: ${preloadPath}. Continuo sin preload.`);

  const windowOptions = {
    width: 1280,
    height: 920,
    show: true,
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
  });
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    writeToLog(`Render terminado: ${details.reason}, Código: ${details.exitCode}`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    writeToLog('Carga web finalizada.');
  });

  // --- DEV / PROD + Auto-Resume ---
  const loadStartUrl = async (base) => {
    // intentamos auto-resume y construimos menú dinámico si corresponde
    const { startPath, active, modulos } = await tryAutoResume({
      store,
      getDeviceId: () => getDeviceId(store),
      verificarSesionActiva: (payload) => verificarSesionActivaService(payload),
      registrarSesionActiva: (payload) => registrarSesionActivaService(payload),
      obtenerModulos: (idCliente) => obtenerModulosService(idCliente),
      buildAppMenu: (mods) => applyDynamicMenu(mods),
      startSessionHeartbeat: ({ usuario, deviceId }) => {
        stopHeartbeatFn?.(); // cancela si hubiera uno corriendo
        stopHeartbeatFn = startSessionHeartbeat({ usuario, deviceId, onTick: heartbeatSesionActivaService });
      },
      writeToLog
    });

    const target = `${base}${startPath || '/Login'}`;
    writeToLog(`Navegando a: ${target} (autoResume=${active ? 'sí' : 'no'})`);
    await mainWindow.loadURL(target);
  };

  if (isDev) {
    const DEV_BASE = 'http://localhost:3000';
    try {
      // sanity fix para .next/trace corrupto
      try {
        const projectRoot = path.resolve(__dirname, '..');
        const tracePath = path.join(projectRoot, '.next', 'trace');
        if (fs.existsSync(tracePath) && fs.statSync(tracePath).isDirectory()) {
          fs.rmSync(tracePath, { recursive: true, force: true });
          writeToLog('DEV: se removió carpeta .next/trace inválida');
        }
      } catch {}

      writeToLog('DEV: esperando http://localhost:3000 ...');
      await waitForUrl(DEV_BASE, 30000, 500);
      await loadStartUrl(DEV_BASE);
      try { mainWindow.webContents.openDevTools(); } catch {}
    } catch (e) {
      writeToLog(`ERROR cargando DEV URL: ${e.message}\n${e.stack}`);
      await mainWindow.loadURL('data:text/html,<h1>No se pudo conectar a Next (DEV)</h1><p>Reintenta con F5</p>');
    }
  } else {
    const { createServer } = require('http');
    const next = require('next');

    const MAX_PORT_ATTEMPTS = 10;
    let currentPort = 3000;

    try {
      const nextApp = next({ dev: false, dir: app.getAppPath() });
      await nextApp.prepare();
      const handle = nextApp.getRequestHandler();

      let server, portFound = false;
      for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        try {
          server = createServer((req, res) => handle(req, res));
          await new Promise((resolve, reject) => {
            server.listen(currentPort, () => { writeToLog(`Servidor en http://localhost:${currentPort}`); portFound = true; resolve(); });
            server.once('error', (err) => {
              if (err && err.code === 'EADDRINUSE') { writeToLog(`Puerto ${currentPort} en uso`); currentPort++; try { server.close(); } catch {} reject(err); }
              else reject(err);
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

      const PROD_BASE = `http://localhost:${currentPort}`;
      await loadStartUrl(PROD_BASE);
    } catch (error) {
      writeToLog(`Error al preparar Next (PROD): ${error.message}\n${error.stack}`);
      await mainWindow.loadURL('data:text/html,<h1>Error iniciando servidor interno</h1>');
      setTimeout(() => app.quit(), 1500);
      return;
    }
  }

  // Menú base: solo si NO se aplicó el dinámico antes
  const baseTemplate = [{
    label: 'Menú',
    submenu: [
      { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
      { label: 'Reload', accelerator: 'F5', click: () => mainWindow?.reload() },
      { type: 'separator' },
      { label: 'Salir', role: 'quit', accelerator: 'Esc' },
    ]
  }];
  if (!menuWasSet) {
    Menu.setApplicationMenu(Menu.buildFromTemplate(baseTemplate));
    writeToLog('Menú base aplicado (no había menú dinámico).');
  }
}

// --- Ciclo de vida ---
app.whenReady().then(() => {
  writeToLog('App lista.');
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  if (!fs.existsSync(tempFolderPath)) {
    try { fs.mkdirSync(tempFolderPath); writeToLog(`Carpeta temporal creada: ${tempFolderPath}`); }
    catch (e) { writeToLog(`Error creando carpeta temporal: ${e.message}`); }
  }
  setTimeout(() => { try { createMainWindow(); } catch (e) { writeToLog(`Error en createMainWindow: ${e.message}\n${e.stack}`); } }, isLegacyWindows ? 2000 : 0);
});

app.on('before-quit', async () => {
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      await finalizarSesionActivaService?.({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
    }
  } catch (e) {
    writeToLog(`finalizarSesionActiva on quit: ${e?.message}`);
  } finally {
    try { stopHeartbeatFn?.(); } catch {}
  }
});

app.on('window-all-closed', () => {
  writeToLog('Cerrando ventanas...');
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { fs.rmSync(tempFolderPath, { recursive: true, force: true }); writeToLog(`Carpeta temporal eliminada: ${tempFolderPath}`); }
  catch (e) { writeToLog(`Error eliminando temp: ${e.message}`); }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// --- Electron Store IPC ---
ipcMain.handle('electron-store-get', (event, key) => store ? store.get(key) : undefined);
ipcMain.handle('electron-store-set', (event, { key, value }) => { if (store) store.set(key, value); });
ipcMain.handle('whoami', () => ({
  user: store?.get('user') || null,
  boundUser: store?.get('boundUser') || null,
  deviceId: store?.get('deviceId') || null
}));

// (Opcional) refrescar menú dinámico desde el renderer
ipcMain.handle('menu:set-modules', (event, modulos) => {
  applyDynamicMenu(Array.isArray(modulos) ? modulos : []);
  return { success: true };
});

ipcMain.handle('logout', async () => {
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      await finalizarSesionActivaService?.({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
    }
    try { stopHeartbeatFn?.(); } catch {}
    activeSession = null;
    store.delete('jwtToken');
    // si querés permitir cambiar de usuario en esta máquina:
    // store.delete('boundUser');
    menuWasSet = false; // el próximo arranque aplicará base o lo que corresponda
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// --- Login + menú dinámico ---
ipcMain.handle('login', async (event, { usuario, contraseña }) => {
  writeToLog(`IPC: Intento de login para usuario: ${usuario}`);
  try {
    // (A) Binding local
    const bind = bindUserLocally(store, usuario);
    if (!bind.ok) {
      writeToLog(`Login bloqueado por vinculación local: ${bind.message}`);
      return { success: false, message: bind.message };
    }

    // (B) Autenticación
    const result = await iniciarSesionService({ usuario, contraseña });
    if (!(result?.success && result.user && result.token && result.user.IdCliente)) {
      const msg = result?.message || 'Credenciales inválidas';
      writeToLog(`Login fallido: ${msg}`);
      return { success: false, message: msg };
    }

    // (C) Sesión única global (otra máquina)
    const deviceId = getDeviceId(store);
    const check = await verificarSesionActivaService?.({ usuario, deviceId });
    if (check && check.success === false) {
      const msg = check.message || 'Esta cuenta ya tiene una sesión activa en otro equipo.';
      writeToLog(`Login bloqueado por sesión activa: ${msg}`);
      return { success: false, message: msg, code: 'SESSION_ACTIVE_ELSEWHERE' };
    }
    const lock = await registrarSesionActivaService?.({ usuario, deviceId, token: result.token });
    if (lock && lock.success === false) {
      const msg = lock.message || 'No fue posible registrar la sesión (ya activa en otro equipo).';
      writeToLog(`No se pudo registrar sesión: ${msg}`);
      return { success: false, message: msg, code: 'SESSION_LOCK_FAILED' };
    }

    // (D) Persistencia local
    store.set("idCliente", result.user.IdCliente);
    store.set("user", usuario);
    store.set("jwtToken", result.token);
    store.set("fechaInicio", new Date().toISOString());
    store.set("deviceId", deviceId);
    store.set("boundUser", usuario);

    // Heartbeat
    activeSession = { usuario, deviceId, token: result.token };
    try { stopHeartbeatFn?.(); } catch {}
    stopHeartbeatFn = startSessionHeartbeat({ usuario, deviceId, onTick: heartbeatSesionActivaService });

    // (E) Módulos + menú
    const modulesResult = await obtenerModulosService(result.user.IdCliente);
    if (!modulesResult?.success) {
      writeToLog(`Error al obtener módulos después del login: ${modulesResult?.message}`);
      try { await finalizarSesionActivaService?.({ usuario, deviceId }); } catch {}
      try { stopHeartbeatFn?.(); } catch {}
      activeSession = null;
      return { success: false, message: modulesResult?.message || 'No se pudo cargar módulos.' };
    }

    const modulos = modulesResult.modulos.map(m => ({
      id: m.id,
      nombre: m.nombre,
      texto: m.texto,
      icono: m.icono,
      link: m.link,
      pathExcel: m.pathExcel,
      countClientesPorModulo: m.countClientesPorModulo,
    }));

    applyDynamicMenu(modulos);

    return { success: true, user: result.user, modulos, token: result.token };
  } catch (error) {
    const errorMessage = `Error en IPC login handler: ${error.message}\n${error.stack}`;
    writeToLog(errorMessage);
    try {
      if (activeSession?.usuario && activeSession?.deviceId) {
        await finalizarSesionActivaService?.({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
      }
    } catch {}
    try { stopHeartbeatFn?.(); } catch {}
    activeSession = null;
    return { success: false, message: `Error interno al intentar iniciar sesión: ${error.message}` };
  }
});

// --- Otros IPC HANDLERS ---
const createIpcHandler = (name, handler) => {
  ipcMain.handle(name, async (event, ...args) => {
    try { return await handler(...args); }
    catch (error) {
      const errorMessage = `Error en IPC ${name}: ${error.message}\n${error.stack}`;
      writeToLog(errorMessage);
      return { success: false, message: `Error en ${name}: ${error.message}` };
    }
  });
};

ipcMain.handle('get-list-empresas', async (event, idCliente) => {
  try { const empresas = await obtenerListadoEmpresas(idCliente); return { success: true, data: empresas }; }
  catch (error) { writeToLog(`Error en IPC get-list-empresas: ${error.message}`); return { success: false, message: error.message }; }
});
ipcMain.handle('get-empresa-by-id', async (event, idEmpresa) => {
  try { const datosEmpresa = await getDatosEmpresaById(idEmpresa); return { success: true, data: datosEmpresa }; }
  catch (error) { writeToLog(`Error en IPC get-empresa-by-id: ${error.message}`); return { success: false, message: error.message }; }
});
ipcMain.handle('get-empresa-config', async (event, empresaData) => {
  try { await guardarDatosEmpresaConfig(empresaData); return { success: true, message: 'Configuración guardada exitosamente.' }; }
  catch (error) { writeToLog(`Error en IPC get-empresa-config: ${error.message}`); return { success: false, message: error.message }; }
});

createIpcHandler('get-modules', obtenerModulosService);
createIpcHandler('obtener-cheques', obtenerChequeService);
createIpcHandler('update-cheques', (payload) =>
  actualizarChequeService({
    ...payload,
    usuario: (store && store.get?.('user')) || payload?.usuario || 'desconocido'
  })
);

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
createIpcHandler('get-precios-actualizados', obtenerPreciosActualizadosService);
ipcMain.handle('precios-actualizador-get', async (_event, keys) => {
  try {
    return await obtenerPrecioActualizadorService(keys);
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('precios-actualizador-update', async (_event, payload) => {
  try {
    return await updatePrecioActualizadorService(payload);
  } catch (e) {
    return { success: false, message: e.message };
  }
});


ipcMain.handle('actualizar-precios', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const send = (percent, stage, message) => {
    try {
      event.sender.send('precios:update-progress', { percent, stage, message });
      if (win && !win.isDestroyed()) {
        const clamped = Math.max(0, Math.min(100, percent)) / 100;
        win.setProgressBar(clamped);
      }
    } catch {}
  };

  try {
    send(3, 'Preparando', 'Iniciando actualización…');
    const result = await actualizarPreciosService({ onProgress: send });
    send(100, 'Finalizado', 'Completado');
    setTimeout(() => { try { win?.setProgressBar(-1); } catch {} }, 500);
    return result;
  } catch (e) {
    send(100, 'Error', e.message || 'Error');
    try { win?.setProgressBar(-1); } catch {}
    return { success: false, message: e.message || 'Error al actualizar precios' };
  }
});

ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
  try {
    if (!relativeFilePath) throw new Error("No se proporcionó ruta.");
    const appBasePath = app.getAppPath();
    const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);
    if (!fs.existsSync(absoluteFilePath)) throw new Error("Archivo no encontrado.");

    const fileUrl = `file://${absoluteFilePath}`;
    const win = event.sender.getOwnerBrowserWindow();
    win.webContents.downloadURL(fileUrl);

    session.defaultSession.once('will-download', (event, item) => {
      const fileName = item.getFilename();
      const downloadsPath = app.getPath('downloads');
      const savePath = path.join(downloadsPath, fileName);
      item.setSavePath(savePath);
      item.once('done', (e, state) => {
        if (state === 'completed') shell.openPath(savePath);
        else console.error(`Descarga fallida: ${state}`);
      });
    });

    return { success: true, message: "Descarga iniciada automáticamente." };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
