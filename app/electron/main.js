// electron/main.js
// ✅ Node/Electron CJS

const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const XLSX = require('xlsx');
const url  = require('url');
const Store = require('electron-store');
const sql = require('mssql');
const { initializeConfig } = require('./userDbConfig.js');

// Helpers (existentes)
const { tryAutoResume } = require('./helpers/autoResume');
const { getDeviceId } = require('./helpers/device');
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

process.on('uncaughtException', async (err) => {
  writeToLog(`Uncaught: ${err?.message}\n${err?.stack}`);
  await finalizeActiveSession('uncaughtException');
  setTimeout(() => app.quit(), 250);
});

process.on('unhandledRejection', async (reason, p) => {
  writeToLog(`Rejection: ${reason}`);
  await finalizeActiveSession('unhandledRejection');
});
process.on('SIGINT', async () => {
  await finalizeActiveSession('SIGINT');
  app.quit();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await finalizeActiveSession('SIGTERM');
  app.quit();
  process.exit(0);
});
process.on('SIGHUP', async () => {
  await finalizeActiveSession('SIGHUP');
  app.quit();
  process.exit(0);
});


// AL PRINCIPIO (junto a otros requires)
const {
  hasManagerDb,
  getEmpresasHabilitadas,
  verifyEmpresaHabilitadaYGuardar:verifyEmpresaHabilitada
} = require('./modulesService/Empresa');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService,ChequesPExcel  } = require('./modulesService/ChequesP');
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

// ⬇️ SOLO estas tres funciones de precios (como pediste)
const {
  obtenerPrecios: obtenerPreciosService,
  actualizarListaDePrecios: actualizarPreciosService,
  obtenerPreciosActualizados: obtenerPreciosActualizadosService,
} = require('./modulesService/GeneradorPrecios.js');
const ActualizadorPrecios = require("./modulesService/ActualizadorPrecios.js");

// --- Estado global ---
const isDev = !app.isPackaged;
let mainWindow;
let store;
let activeSession = null; // { usuario, deviceId, token }
let modulosCache = [];    // cache de módulos para el menú hamburguesa


let isFinalizing = false;
async function finalizeActiveSession(reason = 'unknown') {
  if (isFinalizing) return;
  isFinalizing = true;
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      writeToLog(`finalizeActiveSession[${reason}] ${activeSession.usuario}@${activeSession.deviceId}`);
      await finalizarSesionActivaService({
        usuario: activeSession.usuario,
        deviceId: activeSession.deviceId
      });
    }
  } catch (e) {
    writeToLog(`finalizeActiveSession error: ${e?.message}`);
  } finally {
    stopSessionHeartbeat();
  }
}

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

function clearStoreForLogin() {
  if (!store) return;
  const keep = { deviceId: store.get('deviceId') };
  try {
    store.clear();
    if (keep.deviceId) store.set('deviceId', keep.deviceId);
    writeToLog('electron-store limpiado por navegación a /Login');
  } catch (e) {
    writeToLog(`Error limpiando store: ${e.message}`);
  }
}

function getBaseOrigin() {
  try {
    if (isDev) return 'http://localhost:3000';
    const current = mainWindow?.webContents?.getURL();
    if (current && current.startsWith('http')) {
      const { origin } = new URL(current);
      return origin;
    }
  } catch {}
  return 'http://localhost:3000';
}

function navigateTo(pathname) {
  try {
    const base = getBaseOrigin();
    const target = `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
    if (target.endsWith('/Login')) clearStoreForLogin();
    writeToLog(`Navegando a: ${target}`);
    mainWindow?.loadURL(target);
  } catch (e) {
    writeToLog(`navigateTo error: ${e.message}`);
  }
}

async function refreshModulosCache() {
  try {
    const idCliente = store?.get('idCliente');
    if (!idCliente) { modulosCache = []; return; }
    const res = await obtenerModulosService(idCliente);
    if (res?.success) {
      modulosCache = (res.modulos || []).map(m => ({
        id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
        link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
      }));
    } else {
      modulosCache = [];
    }
  } catch (e) {
    writeToLog(`refreshModulosCache error: ${e.message}`);
    modulosCache = [];
  }
}

const FORCE_LOGIN_ON_START = true;

async function loadLoginOnly(base) {
  const target = `${base}/Login`;
  clearStoreForLogin();     // deja deviceId
  modulosCache = [];
  activeSession = null;
  stopSessionHeartbeat();
  writeToLog(`Navegando a (forzado): ${target}`);
  await mainWindow.loadURL(target);
}
// --- Ventana principal ---
async function createMainWindow() {
  writeToLog('createMainWindow...');
  store = new Store();

  // fuerza login siempre al iniciar
  const FORCE_LOGIN_ON_START = true;

  const preloadPath = path.join(__dirname, 'preload.js');
  const hasPreload = fs.existsSync(preloadPath);

  const windowOptions = {
    width: 1280,
    height: 920,
    show: true,
    webPreferences: {
      preload: hasPreload ? preloadPath : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
      experimentalFeatures: false,
      enableRemoteModule: false,
    },
  };

  mainWindow = new BrowserWindow(windowOptions);
mainWindow.setMenuBarVisibility(false);
mainWindow.removeMenu();
try { Menu.setApplicationMenu(null); } catch {}
  // abrir links externos en el navegador del SO
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });

  // seguridad de navegación básica (mismo origen)
  mainWindow.webContents.on('will-navigate', (e, navUrl) => {
    const base = getBaseOrigin();
    if (base && !navUrl.startsWith(base)) {
      e.preventDefault();
      try { shell.openExternal(navUrl); } catch {}
    }
  });

  // Al cerrar la ventana, marcar sesión inactiva y parar heartbeat
  mainWindow.on('close', async () => {
    try {
      if (activeSession?.usuario && activeSession?.deviceId) {
        await finalizarSesionActivaService({
          usuario: activeSession.usuario,
          deviceId: activeSession.deviceId,
        });
      }
    } catch (e) {
      writeToLog(`finalizarSesion (window.close) error: ${e?.message}`);
    } finally {
      stopSessionHeartbeat();
    }
  });

  // ------- Carga de la app (DEV/PROD) --------
  if (isDev) {
    const DEV_BASE = 'http://localhost:3000';
    try {
      // limpiar .next/trace corrupto (si pasa)
      try {
        const projectRoot = path.resolve(__dirname, '..');
        const tracePath = path.join(projectRoot, '.next', 'trace');
        if (fs.existsSync(tracePath) && fs.statSync(tracePath).isDirectory()) {
          fs.rmSync(tracePath, { recursive: true, force: true });
          writeToLog('DEV: borrado .next/trace corrupto');
        }
      } catch {}

      await waitForUrl(DEV_BASE, 30000, 500);

      if (FORCE_LOGIN_ON_START) {
        // limpiar store (dejando deviceId) y navegar a /Login
        clearStoreForLogin();
        modulosCache = [];
        activeSession = null;
        stopSessionHeartbeat();
        await mainWindow.loadURL(`${DEV_BASE}/Login`);
      } else {
        await loadWithAutoResume(DEV_BASE);
      }

      try { mainWindow.webContents.openDevTools(); } catch {}
    } catch (e) {
      writeToLog(`DEV load error: ${e.message}`);
      await mainWindow.loadURL(
        'data:text/html,<h1>No se pudo conectar a Next (DEV)</h1><p>Reintenta con F5</p>'
      );
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
      for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        try {
          server = createServer((req, res) => handle(req, res));
          await new Promise((resolve, reject) => {
            server.listen(currentPort, () => {
              ok = true;
              writeToLog(`Servidor en http://localhost:${currentPort}`);
              resolve();
            });
            server.once('error', (err) => {
              if (err && err.code === 'EADDRINUSE') {
                currentPort++;
                try { server.close(); } catch {}
                reject(err);
              } else reject(err);
            });
          });
          if (ok) break;
        } catch (e) {
          if (!e || e.code !== 'EADDRINUSE' || i === MAX_PORT_ATTEMPTS - 1) throw e;
        }
      }

      const BASE = `http://localhost:${currentPort}`;
      if (FORCE_LOGIN_ON_START) {
        clearStoreForLogin();
        modulosCache = [];
        activeSession = null;
        stopSessionHeartbeat();
        await mainWindow.loadURL(`${BASE}/Login`);
      } else {
        await loadWithAutoResume(BASE);
      }
    } catch (e) {
      writeToLog(`PROD prepare error: ${e.message}`);
      await mainWindow.loadURL('data:text/html,<h1>Error iniciando servidor interno</h1>');
      setTimeout(() => app.quit(), 1500);
      return;
    }
  }
}


// --- Ciclo de vida ---
app.whenReady().then(async () => {
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { if (!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath); } catch {}
  createMainWindow().catch(e => writeToLog(`createMainWindow error: ${e.message}`));
});

app.on('before-quit', (e) => {
  if (isFinalizing) return;        // ya estamos cerrando, no loops
  e.preventDefault();              // detenemos el cierre mientras limpiamos
  (async () => {
    await finalizeActiveSession('before-quit');
    app.exit(0);                   // cerrar de verdad (evita volver a disparar before-quit)
  })();
});
app.on('will-quit', async () => {
  await finalizeActiveSession('will-quit');
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
  deviceId: store?.get('deviceId') || null
}));
// …en electron/main.js, junto con otros ipcMain.handle
ipcMain.handle('hamburger:open', async (_e, coords) => {
  try {
    await showHamburgerMenu(coords || {});
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// --- IPC: menú hamburguesa ---
ipcMain.handle('ui:show-hamburger', async (_e, coords) => {
  try { await showHamburgerMenu(coords || {}); return { success: true }; }
  catch (e) { writeToLog(`ui:show-hamburger error: ${e.message}`); return { success: false, message: e.message }; }
});

// --- IPC: construir/actualizar cache de módulos (opcional) ---
ipcMain.handle('menu:set-modules', async (_e, modulos) => {
  modulosCache = Array.isArray(modulos) ? modulos : [];
  return { success: true };
});

// --- IPC: logout directo ---
ipcMain.handle('logout', async () => {
  try {
    if (activeSession?.usuario && activeSession?.deviceId) {
      await finalizarSesionActivaService({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
    }
    stopSessionHeartbeat();
    activeSession = null;
    if (store) {
      const did = store.get('deviceId');
      store.clear(); if (did) store.set('deviceId', did);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});
function toDMY(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (isNaN(d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
ipcMain.handle('chequesp:descargar-planilla', async () => {
  try {
    return await ChequesPExcel();
  } catch (e) {
    return { success: false, message: e?.message || 'No se pudo generar la planilla.' };
  }
});

// ✅ IPC: ¿existe la BD local "manager"?
ipcMain.handle('local:has-manager', async () => {
  try {
    const ok = await hasManagerDb();
    return { success: true, ok };
  } catch (e) {
    writeToLog?.(`has-manager IPC error: ${e?.message}`);
    return { success: false, ok: false, message: e?.message || 'Error verificando BD local.' };
  }
});

// (Opcional) IPC para listar empresas locales habilitadas
ipcMain.handle('empresas:list-manager-emp', async () => {
  try {
    const data = await getEmpresasHabilitadas();
    return { success: true, data };
  } catch (e) {
    writeToLog?.(`list-manager-emp IPC error: ${e?.message}`);
    return { success: false, message: e?.message || 'No se pudieron leer empresas locales.' };
  }
});
ipcMain.handle('empresa:verify-and-save', async (_e, { idCliente, empCodigo }) => {
  try {
    const r = await verifyEmpresaHabilitada(idCliente, empCodigo);
    if (!r.success) return r;

    // Persistimos la DB activa en electron-store
    try { store?.set('selectedInstanciaBD', r.data.instanciaBD); } catch {}
    return { success: true, data: r.data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error verificando empresa.' };
  }
});
// --- IPC: Login (sin menú de app; sólo cache y popup) ---
ipcMain.handle('login', async (_event, { usuario, contraseña }) => {
  writeToLog(`Login intento: ${usuario}`);
  try {
    const deviceId = getDeviceId(store); // hostname o huella
    const result = await iniciarSesionService({ usuario, contraseña, deviceId });

    if (!(result?.success && result.user && result.token && result.user.IdCliente)) {
      return { success: false, message: result?.message || 'Credenciales inválidas' };
    }

    // Sesión única / Activa
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

    // Decodificar StoreData si existe
    try {
      const ses = await obtenerSesionPorDeviceService({ usuario, deviceId });
      if (ses?.success && ses.row?.StoreData) {
        const decoded = decodeStoreBlobService(ses.row.StoreData);
        if (decoded && typeof decoded === 'object') {
          Object.entries(decoded).forEach(([k,v]) => { try { store.set(k, v); } catch {} });
          writeToLog('StoreData decodificado y aplicado.');
        }
      }
    } catch (e) { writeToLog(`decode StoreData error (no bloqueante): ${e.message}`); }

    // Heartbeat
    activeSession = { usuario, deviceId, token: result.token };
    stopSessionHeartbeat();
    startSessionHeartbeat(heartbeatSesionActivaService, { usuario, deviceId }, 30_000);

    // Módulos → cache para el popup
    const modulesResult = await obtenerModulosService(result.user.IdCliente);
    if (!modulesResult?.success) {
      try { await finalizarSesionActivaService({ usuario, deviceId }); } catch {}
      stopSessionHeartbeat();
      activeSession = null;
      return { success: false, message: modulesResult?.message || 'No se pudo cargar módulos.' };
    }
    modulosCache = modulesResult.modulos.map(m => ({
      id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
      link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
    }));

    return { success: true, user: result.user, modulos: modulosCache, token: result.token };
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

// 🧩 PRECIOS: lectura simple
ipcMain.handle('get-precios', async () => {
  writeToLog('[IPC] get-precios');
  return obtenerPreciosService();
});

// 🧩 PRECIOS: última corrida/auditoría
ipcMain.handle('get-precios-actualizados', async () => {
  writeToLog('[IPC] get-precios-actualizados');
  return obtenerPreciosActualizadosService();
});

// 🧩 PRECIOS: actualización masiva con progreso
ipcMain.handle('precios:codigos-lista', async () => {
  const { obtenerCodigoLista } = require('./modulesService/ActualizadorPrecios');
  return await obtenerCodigoLista();
});

// Utilidades de archivos / descargas
function resolveTemplatePath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', 'precios.xlsx'),
    path.join(app.getAppPath(), 'public', 'templates', 'precios.xlsx'),
    path.join(app.getAppPath(), '..', 'public', 'templates', 'precios.xlsx'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

function findHeaderRow(ws) {
  if (!ws || !ws['!ref']) return { row: 0, startCol: 0 };
  const range = XLSX.utils.decode_range(ws['!ref']);

  const known = new Set([
    'lprdlp_Cod','dlp_Desc','lprart_CodGen','lprart_CodEle1','lprart_CodEle2','lprart_CodEle3',
    'art_DescGen','art_CodEle1','art_CodEle2','art_CodEle3','lpr_Precio'
  ].map(s => s.toLowerCase()));

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const v = cell ? String(cell.v).trim().toLowerCase() : '';
      if (v && known.has(v)) {
        return { row: r, startCol: range.s.c };
      }
    }
  }
  for (let r = range.s.r; r <= range.e.r; r++) {
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v).trim() !== '') { hasValue = true; break; }
    }
    if (hasValue) return { row: r, startCol: range.s.c };
  }
  return { row: range.s.r, startCol: range.s.c };
}

ipcMain.handle("descargar-lista-xlsx", async (_e, listaCod) => {
  try {
    const res = await ActualizadorPrecios.descargarListaXlsx(listaCod);
    return res;
  } catch (err) {
    console.error("[descargar-lista-xlsx]", err);
    return { success: false, message: err?.message || "Error al descargar la lista." };
  }
});

ipcMain.handle("open-path", async (_e, p) => {
  try {
    if (!p) return { success: false, message: "Ruta vacía" };
    const r = await shell.openPath(p);
    return { success: !r, message: r || "" };
  } catch (e) {
    return { success: false, message: e?.message || "No se pudo abrir el archivo." };
  }
});

ipcMain.handle("reveal-path", async (_e, p) => {
  try {
    if (!p) return { success: false, message: "Ruta vacía" };
    await shell.showItemInFolder(p);
    return { success: true };
  } catch (e) {
    return { success: false, message: e?.message || "No se pudo mostrar el archivo." };
  }
});

ipcMain.handle('precios:actualizar-excel', async (_evt, items) => {
  try {
    const { actualizarPreciosExcel } = require('./modulesService/ActualizadorPrecios');
    const res = await actualizarPreciosExcel(items);
    return res;
  } catch (e) {
    console.error('IPC precios:actualizar-excel', e);
    return { success: false, message: e?.message || 'Error en actualización.' };
  }
});

ipcMain.handle("precios:excel-ultimos", async () => {
  try { return await ActualizadorPrecios.obtenerPreciosExcelActualizados(); }
  catch (e) { return { success: false, message: e?.message || "Error obteniendo últimos actualizados" }; }
});

ipcMain.handle('env:is-dev', () => isDev);
ipcMain.handle('app:toggle-devtools', () => {
  try {
    (BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0])?.webContents.toggleDevTools();
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('app:reload', () => {
  try { (BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0])?.reload(); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});

ipcMain.handle('app:quit', () => {
  try { app.quit(); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
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
