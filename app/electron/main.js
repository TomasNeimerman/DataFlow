// electron/main.js
// ✅ Node/Electron CJS

const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const url  = require('url'); // por si lo necesitás en el futuro
const Store = require('electron-store');
const { initializeConfig } = require('./userDbConfig.js');

// Helpers
const { buildAppMenu } = require('./helpers/menu');
const { tryAutoResume } = require('./helpers/autoResume');
const { getDeviceId, bindUserLocally } = require('./helpers/device');
const { startSessionHeartbeat, stopSessionHeartbeat } = require('./helpers/session');

// --- Detección de Windows legacy ---
const isLegacyWindows =
  process.platform === 'win32' &&
  (os.release().startsWith('6.2') || os.release().startsWith('6.1') || os.release().startsWith('6.0'));

// --- Config temprana ---
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
const logFilePath  = path.join(userDataPath, 'app_error.log');
function writeToLog(message) {
  const timestamp = new Date().toISOString();
  try { fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`); }
  catch (e) { console.error('log error:', e.message); }
}
writeToLog(`SO: ${os.platform()} ${os.release()} | Node ${process.version} | Electron ${process.versions.electron}`);

process.on('uncaughtException', (err) => { writeToLog(`Uncaught: ${err.message}\n${err.stack}`); setTimeout(() => app.quit(), 1000); });
process.on('unhandledRejection', (r,p) => { writeToLog(`Rejection: ${r}`); });

// --- Servicios ---
const { getDatosEmpresaById, obtenerListadoEmpresas, guardarDatosEmpresaConfig } = require('./modulesService/Empresa');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');

const {
  iniciarSesion: iniciarSesionService,
  obtenerModulos: obtenerModulosService,
  verificarSesionActiva: verificarSesionActivaService,
  registrarSesionActiva: registrarSesionActivaService,
  obtenerSesionPorDevice: obtenerSesionPorDeviceService,
  heartbeatSesionActiva: heartbeatSesionActivaService,
  finalizarSesionActiva: finalizarSesionActivaService,
  decodeStoreBlob: decodeStoreBlobService
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
  updatePrecioActualizador:   updatePrecioActualizadorService,
} = require('./modulesService/Precios');

// --- Estado global ---
const isDev = !app.isPackaged;
let mainWindow;
let store;
let activeSession = null; // { usuario, deviceId, token }
let menuWasSet = false;

// --- Utils ---
function waitForUrl(urlToPing, timeoutMs = 30000, intervalMs = 500) {
  const http = require('http');
  const u = new URL(urlToPing);
  const opts = { method: 'GET', hostname: u.hostname, port: u.port, path: '/' };
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryPing = () => {
      const req = http.request(opts, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Dev server no respondió a tiempo'));
        setTimeout(tryPing, intervalMs);
      });
      req.end();
    };
    tryPing();
  });
}

function applyDynamicMenu(modulos) {
  try {
    buildAppMenu(mainWindow, isDev, modulos || []);
    menuWasSet = true;
    writeToLog(`Menú dinámico aplicado (${(modulos || []).length} módulos)`);
  } catch (e) {
    writeToLog(`Error aplicando menú: ${e.message}`);
  }
}

function clearStoreForLogin() {
  if (!store) return;
  const keep = { deviceId: store.get('deviceId'), boundUser: store.get('boundUser') };
  try {
    store.clear();
    if (keep.deviceId) store.set('deviceId', keep.deviceId);
    if (keep.boundUser) store.set('boundUser', keep.boundUser);
    writeToLog('electron-store limpiado por navegación a /Login');
  } catch (e) {
    writeToLog(`Error limpiando store: ${e.message}`);
  }
}

async function createMainWindow() {
  writeToLog('createMainWindow...');
  store = new Store();

  const preloadPath = path.join(__dirname, 'preload.js');
  const hasPreload = fs.existsSync(preloadPath);

  const windowOptions = {
    width: 1280, height: 920, show: true,
    webPreferences: {
      preload: hasPreload ? preloadPath : undefined,
      contextIsolation: true, nodeIntegration: false, webSecurity: true,
      experimentalFeatures: false, enableRemoteModule: false,
    }
  };
  if (isLegacyWindows) {
    windowOptions.webPreferences.enableBlinkFeatures = '';
    windowOptions.webPreferences.disableBlinkFeatures = 'Auxclick';
    windowOptions.resizable = true;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); if (!isLegacyWindows && !isDev) mainWindow.maximize(); });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, theUrl, isMainFrame) => writeToLog(`did-fail-load ${theUrl} (${code}) ${desc} MF=${isMainFrame}`));
  mainWindow.webContents.on('render-process-gone', (_ , details) => writeToLog(`render gone: ${details.reason} (${details.exitCode})`));

  const loadWithAutoResume = async (base) => {
    const { startPath, active, modulos } = await tryAutoResume({
      store,
      getDeviceId: () => getDeviceId(store),
      verificarSesionActiva: (payload) => verificarSesionActivaService(payload),
      registrarSesionActiva: (payload) => registrarSesionActivaService(payload),
      obtenerModulos: (idCliente) => obtenerModulosService(idCliente),
      buildAppMenu: (mods) => applyDynamicMenu(mods),
      startSessionHeartbeat: ({ usuario, deviceId }) => {
        // inicia heartbeat con nuestro helper (limpia anterior si existiera)
        stopSessionHeartbeat();
        startSessionHeartbeat(
          heartbeatSesionActivaService,
          { usuario, deviceId },
          30_000
        );
      },
      writeToLog
    });

    const target = `${base}${startPath || '/Login'}`;

    // Si vamos a /Login limpiamos el store antes
    if (target.endsWith('/Login')) clearStoreForLogin();

    writeToLog(`Navegando a: ${target}`);
    await mainWindow.loadURL(target);

    if (active) {
      activeSession = active; // para cerrar sesión bien en before-quit
    }

    if (Array.isArray(modulos) && modulos.length && !menuWasSet) {
      applyDynamicMenu(modulos);
    }
  };

  if (isDev) {
    const DEV_BASE = 'http://localhost:3000';
    try {
      try {
        const projectRoot = path.resolve(__dirname, '..');
        const tracePath   = path.join(projectRoot, '.next', 'trace');
        if (fs.existsSync(tracePath) && fs.statSync(tracePath).isDirectory()) {
          fs.rmSync(tracePath, { recursive: true, force: true });
          writeToLog('DEV: borrado .next/trace corrupto');
        }
      } catch {}
      await waitForUrl(DEV_BASE, 30000, 500);
      await loadWithAutoResume(DEV_BASE);
      try { mainWindow.webContents.openDevTools(); } catch {}
    } catch (e) {
      writeToLog(`DEV load error: ${e.message}`);
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

      let server, ok = false;
      for (let i=0;i<MAX_PORT_ATTEMPTS;i++){
        try {
          server = createServer((req,res)=>handle(req,res));
          await new Promise((resolve,reject)=>{
            server.listen(currentPort, () => { ok = true; writeToLog(`Servidor en http://localhost:${currentPort}`); resolve(); });
            server.once('error', (err)=> {
              if (err && err.code === 'EADDRINUSE') { currentPort++; try{ server.close(); }catch{}; reject(err); }
              else reject(err);
            });
          });
          if (ok) break;
        } catch (e) {
          if (!e || e.code !== 'EADDRINUSE' || i === MAX_PORT_ATTEMPTS - 1) throw e;
        }
      }
      await loadWithAutoResume(`http://localhost:${currentPort}`);
    } catch (e) {
      writeToLog(`PROD prepare error: ${e.message}`);
      await mainWindow.loadURL('data:text/html,<h1>Error iniciando servidor interno</h1>');
      setTimeout(()=> app.quit(), 1500);
      return;
    }
  }

  // Menú base (si no hubo dinámico)
  if (!menuWasSet) {
    const baseTemplate = [{
      label: 'Menú',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        { label: 'Reload', accelerator: 'F5',  click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Salir', role: 'quit', accelerator: 'Esc' },
      ]
    }];
    Menu.setApplicationMenu(Menu.buildFromTemplate(baseTemplate));
  }
}

// --- Ciclo de vida ---
app.whenReady().then(() => {
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { if (!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath); } catch {}
  createMainWindow().catch(e => writeToLog(`createMainWindow error: ${e.message}`));
});

app.on('before-quit', async () => {
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      await finalizarSesionActivaService({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
    }
  } catch (e) { writeToLog(`finalizarSesionActiva on quit: ${e?.message}`); }
  finally { stopSessionHeartbeat(); }
});

app.on('window-all-closed', () => {
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { fs.rmSync(tempFolderPath, { recursive: true, force: true }); } catch {}
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });

// --- IPC: electron-store helpers ---
ipcMain.handle('electron-store-get', (_e, key) => store ? store.get(key) : undefined);
ipcMain.handle('electron-store-set', (_e, { key, value }) => { if (store) store.set(key, value); });
ipcMain.handle('whoami', () => ({
  user: store?.get('user') || null,
  boundUser: store?.get('boundUser') || null,
  deviceId: store?.get('deviceId') || null
}));

// Alias por si algún front llama a 'build-menu'
ipcMain.handle('build-menu', (_e, modulos) => { applyDynamicMenu(Array.isArray(modulos) ? modulos : []); return { success: true }; });
ipcMain.handle('menu:set-modules', (_e, modulos) => { applyDynamicMenu(Array.isArray(modulos) ? modulos : []); return { success: true }; });

ipcMain.handle('logout', async () => {
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      await finalizarSesionActivaService({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
    }
    stopSessionHeartbeat();
    activeSession = null;
    if (store) {
      const did = store.get('deviceId'); const bound = store.get('boundUser');
      store.clear(); if (did) store.set('deviceId', did); if (bound) store.set('boundUser', bound);
    }
    menuWasSet = false;
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// --- IPC: Login + menú dinámico ---
ipcMain.handle('login', async (_event, { usuario, contraseña }) => {
  writeToLog(`Login intento: ${usuario}`);
  try {
    const bind = bindUserLocally(store, usuario);
    if (!bind.ok) return { success: false, message: bind.message };

    const deviceId = getDeviceId(store); // 👈 primero el device
    const result = await iniciarSesionService({ usuario, contraseña, deviceId }); // 👈 pasar deviceId

    if (!(result?.success && result.user && result.token && result.user.IdCliente)) {
      return { success: false, message: result?.message || 'Credenciales inválidas' };
    }

    // Política de sesión única
    // Política de sesión única
const check = await verificarSesionActivaService({ usuario, deviceId });
if (!check?.success || check.code === 'ACTIVE_OTHER_DEVICE') {
  const dev = check?.deviceId ? ` ("${check.deviceId}")` : '';
  return {
    success: false,
    message: check?.message || `Usuario activo. Intente en el dispositivo que está en uso${dev}.`,
    code: 'ACTIVE_OTHER_DEVICE'
  };
}


    const lock = await registrarSesionActivaService({ usuario, deviceId, token: result.token });
    if (!lock?.success) {
      return { success: false, message: lock?.message || 'No se pudo registrar la sesión', code: 'SESSION_LOCK_FAILED' };
    }

    // Persistencia local mínima
    store.set('idCliente', result.user.IdCliente);
    store.set('user', usuario);
    store.set('jwtToken', result.token);
    store.set('fechaInicio', new Date().toISOString());
    store.set('deviceId', deviceId);
    store.set('boundUser', usuario);

    // 🔓 Decodificar StoreData de la sesión (si existe) y guardar en store
    try {
      const ses = await obtenerSesionPorDeviceService({ usuario, deviceId });
      if (ses?.success && ses.row?.StoreData) {                     // 👈 row, no data
        const decoded = decodeStoreBlobService(ses.row.StoreData);  // 👈 row.StoreData
        if (decoded && typeof decoded === 'object') {
          Object.entries(decoded).forEach(([k,v]) => { try { store.set(k, v); } catch {} });
          writeToLog('StoreData decodificado y aplicado.');
        }
      }
    } catch (e) {
      writeToLog(`decode StoreData error (no bloqueante): ${e.message}`);
    }

    // Heartbeat
    activeSession = { usuario, deviceId, token: result.token };
    stopSessionHeartbeat();
    startSessionHeartbeat(heartbeatSesionActivaService, { usuario, deviceId }, 30_000);

    // Menú + módulos
    const modulesResult = await obtenerModulosService(result.user.IdCliente);
    if (!modulesResult?.success) {
      try { await finalizarSesionActivaService({ usuario, deviceId }); } catch {}
      stopSessionHeartbeat();
      activeSession = null;
      return { success: false, message: modulesResult?.message || 'No se pudo cargar módulos.' };
    }

    const modulos = modulesResult.modulos.map(m => ({
      id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
      link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
    }));
    applyDynamicMenu(modulos);

    return { success: true, user: result.user, modulos, token: result.token };
  } catch (e) {
    writeToLog(`login IPC error: ${e.message}`);
    try {
      if (activeSession?.usuario && activeSession?.deviceId) {
        await finalizarSesionActivaService({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
      }
    } catch {}
    stopSessionHeartbeat();
    activeSession = null;
    return { success: false, message: `Error interno al intentar iniciar sesión: ${e.message}` };
  }
});

// --- Otros IPC (igual que tenías) ---
const safeIpc = (name, handler) => {
  ipcMain.handle(name, async (_e, ...args) => {
    try { return await handler(...args); }
    catch (error) { writeToLog(`IPC ${name} error: ${error.message}`); return { success: false, message: error.message }; }
  });
};

ipcMain.handle('get-list-empresas', async (_e, idCliente) => {
  try { const empresas = await obtenerListadoEmpresas(idCliente); return { success: true, data: empresas }; }
  catch (e) { writeToLog(`get-list-empresas: ${e.message}`); return { success: false, message: e.message }; }
});
ipcMain.handle('get-empresa-by-id', async (_e, idEmpresa) => {
  try { const datos = await getDatosEmpresaById(idEmpresa); return { success: true, data: datos }; }
  catch (e) { writeToLog(`get-empresa-by-id: ${e.message}`); return { success: false, message: e.message }; }
});
ipcMain.handle('get-empresa-config', async (_e, empresaData) => {
  try { await guardarDatosEmpresaConfig(empresaData); return { success: true, message: 'Configuración guardada exitosamente.' }; }
  catch (e) { writeToLog(`get-empresa-config: ${e.message}`); return { success: false, message: e.message }; }
});

safeIpc('get-modules', obtenerModulosService);
safeIpc('obtener-cheques', obtenerChequeService);
safeIpc('update-cheques', (payload) =>
  actualizarChequeService({
    ...payload,
    usuario: (store && store.get?.('user')) || payload?.usuario || 'desconocido'
  })
);
safeIpc('update-cheque3', ({ IDCheque, sit }) => actualizarCheque3Service(IDCheque, sit));
safeIpc('cheque3-rechazado', cheque3R);
safeIpc('cheque3-situacion', situacion);
safeIpc('registro-cheque3-sit', ({ emp, suc, IDCheque, sit, sitAnt }) => registro(emp, suc, IDCheque, sit, sitAnt));
safeIpc('get-articulos', getArticulos);
safeIpc('get-clases', getClases);
safeIpc('get-proveedores', getProveedores);
safeIpc('get-rubros', getRubros);
safeIpc('get-tasas-iva', getTasasIVA);
safeIpc('get-articulo-details-by-id', getArticuloDetailsById);
safeIpc('clase-existe', claseExiste);
safeIpc('rubro-existe', rubroExiste);
safeIpc('get-proveedor-details', getProveedorDetails);
safeIpc('get-tasa-iva-details', getTasaIVADetails);
safeIpc('get-updated-fecha', getupdreg);

ipcMain.handle('get-precios',            () => obtenerPreciosService());
ipcMain.handle('get-precios-actualizados', () => obtenerPreciosActualizadosService());

ipcMain.handle('precios-actualizador-get', async (_e, keys) => {
  try { return await obtenerPrecioActualizadorService(keys); }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('precios-actualizador-update', async (_e, payload) => {
  try { return await updatePrecioActualizadorService(payload); }
  catch (e) { return { success: false, message: e.message }; }
});

ipcMain.handle('actualizar-precios', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const send = (percent, stage, message) => {
    try {
      event.sender.send('precios:update-progress', { percent, stage, message });
      if (win && !win.isDestroyed()) win.setProgressBar(Math.max(0, Math.min(100, percent))/100);
    } catch {}
  };
  try {
    send(3, 'Preparando', 'Iniciando actualización…');
    const result = await actualizarPreciosService({ onProgress: send });
    send(100, 'Finalizado', 'Completado');
    setTimeout(()=> { try { win?.setProgressBar(-1); } catch {} }, 500);
    return result;
  } catch (e) {
    send(100, 'Error', e.message || 'Error');
    try { win?.setProgressBar(-1); } catch {}
    return { success: false, message: e.message || 'Error al actualizar precios' };
  }
});

ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
  try {
    if (!relativeFilePath) throw new Error('No se proporcionó ruta.');
    const appBasePath = app.getAppPath();
    const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);
    if (!fs.existsSync(absoluteFilePath)) throw new Error('Archivo no encontrado.');
    const fileUrl = `file://${absoluteFilePath}`;
    const win = event.sender.getOwnerBrowserWindow();
    win.webContents.downloadURL(fileUrl);
    session.defaultSession.once('will-download', (_ev, item) => {
      const downloadsPath = app.getPath('downloads');
      const savePath = path.join(downloadsPath, item.getFilename());
      item.setSavePath(savePath);
      item.once('done', (_e, state) => { if (state === 'completed') shell.openPath(savePath); });
    });
    return { success: true, message: 'Descarga iniciada automáticamente.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
});
