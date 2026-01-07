// electron/main.js
// ✅ Node/Electron (CommonJS)

/* ────────────────────────────────────────────────────────────────────────────
 *  IMPORTS
 * ──────────────────────────────────────────────────────────────────────────── */
const { app, BrowserWindow, ipcMain, Menu, shell, session, dialog } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const url  = require('url');           // (keep: may be used by other parts)
const XLSX = require('xlsx');
const Store = require('electron-store');
const mssql = require('mssql')
const mysql = require('mysql2/promise');
const { execFile } = require('child_process');
const ZongJi = require('zongji');
const { getDbConfig, onDbConfigChange } = require('./dbConfig');         // (keep: referenced by modules/services)
const { initializeConfig,getAdminDbConfig, writeAdminDbConfig } = require('./userDbConfig.js');
let odbc;



// Helpers
const { tryAutoResume } = require('./helpers/autoResume');     // (keep: external flow)
const { getDeviceId } = require('./helpers/device');
const { startSessionHeartbeat, stopSessionHeartbeat } = require('./helpers/session');
const { odbcConnectAndSave, getServerForLogin, saveServerForOdbc } =require('./helpers/ODBCConnection.js');
let __adminPool = null;

/* ────────────────────────────────────────────────────────────────────────────
 *  OS / RUNTIME SAFETY FLAGS
 * ──────────────────────────────────────────────────────────────────────────── */
const isLegacyWindows =
  process.platform === 'win32' &&
  (os.release().startsWith('6.2') || os.release().startsWith('6.1') || os.release().startsWith('6.0'));

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

/* ────────────────────────────────────────────────────────────────────────────
 *  LOGGING
 * ──────────────────────────────────────────────────────────────────────────── */
const userDataPath = app.getPath('userData');
const logFilePath  = path.join(userDataPath, 'app_error.log');
function writeToLog(message) {
  const timestamp = new Date().toISOString();
  try { fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`); }
  catch (e) { console.error('log error:', e.message); }
}
writeToLog(`SO: ${os.platform()} ${os.release()} | Node ${process.version} | Electron ${process.versions.electron}`);

/* ────────────────────────────────────────────────────────────────────────────
 *  GLOBAL STATE / CONSTANTS
 * ──────────────────────────────────────────────────────────────────────────── */
const isDev = !app.isPackaged;
const RELEASE_SESSION_ON_EXIT = false;    // ⚠️ no liberar lock en cierre (requisito del negocio)
const FORCE_LOGIN_ON_START     = true;     // login forzado en cada inicio

const STORE_BROADCAST_WHITELIST = new Set([
  'idCliente',
  'user',
  'selectedInstanciaBD',
  'selectedEmpresaNombre',
]);

let mainWindow;         // BrowserWindow principal
let store;              // electron-store
let activeSession = null; // { usuario, deviceId, token }
let modulosCache  = [];   // cache para menú hamburguesa
let isFinalizing  = false;
let sessionWatchdogTimer = null; // 🔭 watchdog polling timer
let sessionRealtimeWatcher = null;
let logoutInFlight = false;

/* ────────────────────────────────────────────────────────────────────────────
 *  BROADCAST & STORE HELPERS
 * ──────────────────────────────────────────────────────────────────────────── */
function broadcast(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    try { w.webContents.send(channel, payload); } catch {}
  }
}

function storeSet(key, value) {
  if (!store) return;
  try {
    const prev = { ...store.store };
    store.set(key, value);
    const next = { ...store.store };
    const delta = pickWhitelistedDelta(next, prev);
    if (Object.keys(delta).length) broadcast('store:any-change', delta);
  } catch {}
}

function pickWhitelistedDelta(nextObj = {}, prevObj = {}) {
  const delta = {};
  for (const k of STORE_BROADCAST_WHITELIST) {
    const a = nextObj?.[k] ?? null;
    const b = prevObj?.[k] ?? null;
    if (a !== b) delta[k] = a;
  }
  return delta;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  PROCESS SIGNALS (defensive cleanup)
 * ──────────────────────────────────────────────────────────────────────────── */
process.on('uncaughtException', async (err) => {
  writeToLog(`Uncaught: ${err?.message}\n${err?.stack}`);
  await finalizeActiveSession('uncaughtException');
  setTimeout(() => app.quit(), 250);
});

process.on('unhandledRejection', async (reason) => {
  writeToLog(`Rejection: ${reason}`);
  await finalizeActiveSession('unhandledRejection');
});

process.on('SIGINT',  async () => { await finalizeActiveSession('SIGINT',  { releaseLock: RELEASE_SESSION_ON_EXIT }); app.exit(0); process.exit(0); });
process.on('SIGTERM', async () => { await finalizeActiveSession('SIGTERM', { releaseLock: RELEASE_SESSION_ON_EXIT }); app.exit(0); process.exit(0); });
process.on('SIGHUP',  async () => { await finalizeActiveSession('SIGHUP',  { releaseLock: RELEASE_SESSION_ON_EXIT }); app.exit(0); process.exit(0); });

/* ────────────────────────────────────────────────────────────────────────────
 *  SESSION WATCHDOG / HEARTBEAT
 * ──────────────────────────────────────────────────────────────────────────── */
function stopSessionWatchdog() {
  if (sessionWatchdogTimer) { clearInterval(sessionWatchdogTimer); sessionWatchdogTimer = null; }
}
function startSessionWatchdog({ usuario, deviceId, intervalMs = 500 }) { // 500ms = veloz
  stopSessionWatchdog();
  sessionWatchdogTimer = setInterval(() => {
    checkSelfSessionAndLogoutIfInactive({ usuario, deviceId, reason: 'polling' }).catch(() => {});
  }, intervalMs);
}
function stopSessionRealtimeWatcher() {
  try {
    if (sessionRealtimeWatcher) {
      sessionRealtimeWatcher.stop();
      sessionRealtimeWatcher = null;
      writeToLog('Realtime watcher detenido.');
    }
  } catch (e) {
    writeToLog(`Error deteniendo realtime watcher: ${e.message}`);
  }
}
function startSessionRealtimeWatcher({ usuario, deviceId }) {
  stopSessionRealtimeWatcher(); // evita duplicados

  try {
    const cfg = getDbConfig(); // admin DB (la que tiene SesionesActivas)
    sessionRealtimeWatcher = new ZongJi({
      host: cfg.server,
      port: cfg.port || 3306,
      user: cfg.user,
      password: cfg.password,
    });

    const database = cfg.database;

    sessionRealtimeWatcher.on('binlog', (evt) => {
      const eventName = evt.getEventName();
      if (!['writerows', 'updaterows', 'deleterows'].includes(eventName)) return;

      const tmap = evt.tableMap?.[evt.tableId];
      if (!tmap) return;
      if (tmap.parentSchema !== database) return;
      if (tmap.tableName !== 'SesionesActivas') return;

      try {
        if (eventName === 'updaterows') {
          for (const { before, after } of evt.rows || []) {
            const match = String(after.Usuario) === String(usuario) &&
                          String(after.DeviceId) === String(deviceId);
            if (!match) continue;
            const activa = Number(after.Activa ?? 0);
            if (activa !== 1) {
              writeToLog('Realtime: Activa cambió != 1 → logout inmediato');
              forceLogout('realtime-activa-0-or-changed').catch(() => {});
            }
          }
        } else if (eventName === 'deleterows') {
          for (const row of evt.rows || []) {
            const match = String(row.Usuario) === String(usuario) &&
                          String(row.DeviceId) === String(deviceId);
            if (!match) continue;
            writeToLog('Realtime: Fila SesionesActivas eliminada → logout inmediato');
            forceLogout('realtime-row-deleted').catch(() => {});
          }
        }
        // writerows (INSERT) no requiere acción para logout.
      } catch (err) {
        writeToLog(`Realtime handler error: ${err.message}`);
      }
    });

    // Empezar desde el final (solo cambios nuevos)
    sessionRealtimeWatcher.start({
      includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
      startAtEnd: true,
      serverId: 1337, // cualquier número único para este cliente
    });

    sessionRealtimeWatcher.on('error', (err) => {
      writeToLog(`Realtime watcher error: ${err && err.message ? err.message : err}`);
      // Fallback automático: si el watcher falla, aseguramos el watchdog por polling
      if (!activeSession?.isAdmin) {
        stopSessionWatchdog?.();
        startSessionWatchdog({
          usuario,
          deviceId,
          intervalMs: 10_000,
          isAdmin: !!activeSession?.isAdmin,
        });
      }
    });

    writeToLog('Realtime watcher iniciado (binlog).');
  } catch (e) {
    writeToLog(`No se pudo iniciar realtime watcher (binlog no disponible o sin permisos): ${e.message}`);
    // Fallback polling si no hay binlog
    if (!activeSession?.isAdmin) {
      stopSessionWatchdog?.();
      startSessionWatchdog({
        usuario,
        deviceId,
        intervalMs: 10_000,
        isAdmin: !!activeSession?.isAdmin,
      });
    }
  }
}

async function runSessionWatchdogOnce({ usuario, deviceId, isAdmin = false }) {
  if (isAdmin) return; // << NUEVO: admins no se expulsan por Activa
  try {
    const r = await obtenerSesionPorDeviceService({ usuario, deviceId });
    const activa = r?.success ? Number(r.row?.Activa ?? 0) : 0;
    if (activa !== 1) {
      writeToLog(`watchdog: Activa=${activa} → LOGOUT`);
      await forceLogout('activa-0-or-missing');
      return;
    }
    const check = await verificarSesionActivaService({ usuario, deviceId });
    if (!check?.success || check.code === 'ACTIVE_OTHER_DEVICE') {
      writeToLog(`watchdog: ACTIVE_OTHER_DEVICE=${check?.deviceId || 'unknown'} → LOGOUT`);
      await forceLogout('active-on-other-device');
      return;
    }
  } catch (e) {
    writeToLog(`watchdog check error: ${e.message}`);
  }
}
async function forceLogout(reason = 'remote-inactive') {
  if (logoutInFlight) return;
  logoutInFlight = true;
  try {
    const usuario  = activeSession?.usuario;
    const deviceId = activeSession?.deviceId;

    try { await finalizarSesionActivaService({ usuario, deviceId }); } catch {}
    stopSessionHeartbeat();
    stopSessionWatchdog();
    stopSessionRealtimeWatcher(); // << NUEVO

    activeSession = null;
    modulosCache = [];
    clearStoreForLogin();

    const base = getBaseOrigin();
    await mainWindow?.loadURL(`${base}/Login`);
    writeToLog(`Sesión finalizada por ${reason}.`);
  } catch (e) {
    writeToLog(`forceLogout error: ${e.message}`);
  } finally {
    logoutInFlight = false;
  }
}

/**
 * Inicia un polling que revisa SesionesActivas cada X ms.
 * Si la fila del usuario+deviceId no existe o Activa != 1 ⇒ logout local.
 */
function startSessionWatchdog({ usuario, deviceId, intervalMs = 10_000, isAdmin = false }) {
  stopSessionWatchdog();
  if (isAdmin) return; // << NUEVO: no iniciar watchdog para admins

  // primer chequeo inmediato
  runSessionWatchdogOnce({ usuario, deviceId, isAdmin }).catch(() => {});

  // chequeos periódicos
  sessionWatchdogTimer = setInterval(() => {
    runSessionWatchdogOnce({ usuario, deviceId, isAdmin }).catch(() => {});
  }, intervalMs);
}

async function finalizeActiveSession(reason = 'unknown', { releaseLock = RELEASE_SESSION_ON_EXIT } = {}) {
  if (isFinalizing) return;
  isFinalizing = true;
  try {
    const usuario  = activeSession?.usuario;
    const deviceId = activeSession?.deviceId;
    writeToLog(`finalizeActiveSession [${reason}] releaseLock=${releaseLock} user=${usuario || '-'} device=${deviceId || '-'}`);

    try { stopSessionHeartbeat?.(); } catch {}
    try { stopSessionWatchdog?.(); } catch {}
    try { stopSessionRealtimeWatcher?.(); } catch {}   // << NUEVO

    if (releaseLock && usuario && deviceId) {
      try { await finalizarSesionActivaService({ usuario, deviceId }); } catch (e) { writeToLog(`finalizarSesionActiva error: ${e.message}`); }
    }
  } finally {
    isFinalizing = false;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  NAV & STORE UTILITIES
 * ──────────────────────────────────────────────────────────────────────────── */
function clearStoreForLogin() {
  if (!store) return;
  const keep = { deviceId: store.get('deviceId') };
  try {
    const prev = { ...store.store };
    store.clear();
    if (keep.deviceId) store.set('deviceId', keep.deviceId);
    writeToLog('electron-store limpiado por navegación a /Login');

    const next = { ...store.store };
    const delta = pickWhitelistedDelta(next, prev);
    if (Object.keys(delta).length) broadcast('store:any-change', delta);
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
    if (!idCliente) {
      modulosCache = [];
      broadcast('menu:modules-updated', { modulos: [] });
      return;
    }
    const allRes = await obtenerModulosService(idCliente);         // 1) Todos (con Video)
    const refRes = await obtenerModulosXClienteService(idCliente);  // 2) Ids habilitados

    if (allRes?.success) {
      const idsHabilitados =
        (refRes && refRes.success && Array.isArray(refRes.idsHabilitados))
          ? new Set(refRes.idsHabilitados)
          : (refRes?.modulosXCliente ? new Set(refRes.modulosXCliente.map(r => r.IdModulo)) : new Set());

      modulosCache = (allRes.modulos || []).map(m => ({
        id: m.id,
        nombre: m.nombre,
        texto: m.texto,
        icono: m.icono,
        link: m.link,
        pathExcel: m.pathExcel,
        video: m.video || null,
        habilitado: idsHabilitados.has(m.id),
        countClientesPorModulo: m.countClientesPorModulo
      }));
      broadcast('menu:modules-updated', { modulos: modulosCache });
    } else {
      modulosCache = [];
      broadcast('menu:modules-updated', { modulos: [] });
    }
  } catch (e) {
    writeToLog(`refreshModulosCache error: ${e.message}`);
    modulosCache = [];
    broadcast('menu:modules-updated', { modulos: [] });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  SERVICES (require después de helpers para evitar hoisting raro)
 * ──────────────────────────────────────────────────────────────────────────── */
const {
  hasManagerDb,
  getEmpresasHabilitadas,
  verifyEmpresaHabilitadaYGuardar: verifyEmpresaHabilitada
} = require('./modulesService/Cloud/Empresa');

const {
  obtenerCheque: obtenerChequeService,
  actualizarCheque: actualizarChequeService,
  ChequesPExcel: ChequesPExcel,
  obtenerChequesPreview: obtenerChequesPreviewService,
  chequeExists: chequeExistsService
} = require('./modulesService/Local/ChequesP');

const {
  iniciarSesion: iniciarSesionService,
  verificarSesionActiva: verificarSesionActivaService,
  registrarSesionActiva: registrarSesionActivaService,
  obtenerSesionPorDevice: obtenerSesionPorDeviceService,
  heartbeatSesionActiva: heartbeatSesionActivaService,
  finalizarSesionActiva: finalizarSesionActivaService,
  decodeStoreBlob: decodeStoreBlobService
} = require('./modulesService/Cloud/Login');

const {
  obtenerModulos: obtenerModulosService,
  obtenerModulosXCliente: obtenerModulosXClienteService
} = require('./modulesService/Cloud/Modules');

const {
  registroCheq3Sit: registro,
  actualizarCheque3: actualizarCheque3Service,
  actualizarCheque3Campo: actualizarCheque3CampoService,
  obtenerCheque3Rechazado: cheque3R,
  getSituacion: situacion,
  getUpdatedbyRegistro: getupdreg
} = require('./modulesService/Local/Cheques3');

const {
  getArticulos, getClases, getProveedores, getRubros,
  getTasasIVA, getArticuloDetailsById, claseExiste, rubroExiste,
  getProveedorDetails, getTasaIVADetails
} = require('./modulesService/Local/Articulos');

// Generador de Precios / Actualizador
const {
  obtenerPrecios: obtenerPreciosService,
  actualizarListaDePrecios: actualizarPreciosService,
  obtenerPreciosActualizados: obtenerPreciosActualizadosService,
} = require('./modulesService/Local/GeneradorPrecios.js');
const ActualizadorPrecios = require('./modulesService/Local/ActualizadorPrecios.js');
const ClientesSvc = require('./modulesService/Local/ListaPrecClientes');

const ClientesService = require('./modulesService/Local/Clientes');
const Recibos = require('./modulesService/Local/Recibos');
/* ────────────────────────────────────────────────────────────────────────────
 *  MAIN WINDOW
 * ──────────────────────────────────────────────────────────────────────────── */
async function loadLoginOnly(base) {
  const target = `${base}/Login`;
  clearStoreForLogin();     // deja deviceId
  modulosCache = [];
  activeSession = null;
  stopSessionHeartbeat();
  writeToLog(`Navegando a (forzado): ${target}`);
  await mainWindow.loadURL(target);
}

async function waitForUrl(urlToPing, timeoutMs = 30000, intervalMs = 500) {
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

async function createMainWindow() {
  writeToLog('createMainWindow...');
  store = new Store();

  // 🔔 Broadcast de cambios del store (whitelist)
  try {
    if (typeof store.onDidAnyChange === 'function') {
      store.onDidAnyChange((newValue, oldValue) => {
        const delta = pickWhitelistedDelta(newValue, oldValue);
        if (Object.keys(delta).length) broadcast('store:any-change', delta);
      });
    } else {
      // Fallback: polling liviano
      let prevSnap = { ...store.store };
      setInterval(() => {
        try {
          const nextSnap = { ...store.store };
          const delta = pickWhitelistedDelta(nextSnap, prevSnap);
          if (Object.keys(delta).length) broadcast('store:any-change', delta);
          prevSnap = nextSnap;
        } catch {}
      }, 1000);
    }
  } catch {}

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

  // Al cerrar la ventana, marcar sesión inactiva y parar heartbeat/watchdog
  mainWindow?.on('close', async () => {
    await finalizeActiveSession('window-close', { releaseLock: RELEASE_SESSION_ON_EXIT });
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
        clearStoreForLogin();
        modulosCache = [];
        activeSession = null;
        stopSessionHeartbeat();
        await mainWindow.loadURL(`${DEV_BASE}/Login`);
      } else {
        await loadLoginOnly(DEV_BASE);
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
        await loadLoginOnly(BASE);
      }
    } catch (e) {
      writeToLog(`PROD prepare error: ${e.message}`);
      await mainWindow.loadURL('data:text/html,<h1>Error iniciando servidor interno</h1>');
      setTimeout(() => app.quit(), 1500);
      return;
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  APP LIFECYCLE
 * ──────────────────────────────────────────────────────────────────────────── */
app.whenReady().then(async () => {
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { if (!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath); } catch {}
  createMainWindow().catch(e => writeToLog(`createMainWindow error: ${e.message}`));
});

app.on('before-quit', (e) => {
  if (isFinalizing) return;
  e.preventDefault();
  (async () => {
    await finalizeActiveSession('before-quit', { releaseLock: RELEASE_SESSION_ON_EXIT });
    app.exit(0);
  })();
});

// Red de seguridad adicional
app.on('will-quit', async () => {
  await finalizeActiveSession('will-quit', { releaseLock: RELEASE_SESSION_ON_EXIT });
});

app.on('window-all-closed', () => {
  const tempFolderPath = path.join(app.getPath('temp'), 'BejermanErpTemp');
  try { fs.rmSync(tempFolderPath, { recursive: true, force: true }); } catch {}
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: STORE / APP ENV
 * ──────────────────────────────────────────────────────────────────────────── */
ipcMain.handle('electron-store-get', (_e, key) => store ? store.get(key) : undefined);
ipcMain.handle('electron-store-set', (_e, ...args) => {
  let key, value;
  if (args.length === 2) { key = args[0]; value = args[1]; }
  else if (args[0] && typeof args[0] === 'object') { key = args[0].key; value = args[0].value; }
  if (!key) return;
  storeSet(key, value);
  return true;
});

ipcMain.handle('whoami', () => ({
  user: store?.get('user') || null,
  deviceId: store?.get('deviceId') || null
}));

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

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: HAMBURGER MENU / MODULES
 * ──────────────────────────────────────────────────────────────────────────── */
// Legacy alias
ipcMain.handle('hamburger:open', async (_e, coords) => {
  try {
    await showHamburgerMenu(coords || {});
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('ui:show-hamburger', async (_e, coords) => {
  try { await showHamburgerMenu(coords || {}); return { success: true }; }
  catch (e) { writeToLog(`ui:show-hamburger error: ${e.message}`); return { success: false, message: e.message }; }
});

ipcMain.handle('menu:set-modules', async (_e, modulos) => {
  modulosCache = Array.isArray(modulos) ? modulos : [];
  broadcast('menu:modules-updated', { modulos: modulosCache });
  return { success: true };
});

const safeIpc = (name, handler) => {
  ipcMain.handle(name, async (_e, ...args) => {
    try { return await handler(...args); }
    catch (error) { writeToLog(`IPC ${name} error: ${error.message}`); return { success: false, message: error.message }; }
  });
};


// 1) Obtener server desde credenciales del usuario (no toca ODBC aún)
ipcMain.handle('odbc:get-server', async (_evt, { usuario, contraseña }) => {
  try {
    return await getServerForLogin({ user: usuario, password: contraseña });
  } catch (e) {
    return {
      ok: false,
      code: 'GET_SERVER_ERR',
      message: e?.message || String(e),
    };
  }
});

// 2) Guardar server para que luego lo use el helper ODBC
ipcMain.handle('admin:save-server', async (_evt, { server }) => {
  try {
    return await saveServerForOdbc(server); // { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: 'SAVE_SERVER_ERR',
      message: e?.message || String(e),
    };
  }
});

// 3) Conexión ODBC (sólo hace cosas "reales" en producción)
ipcMain.handle('odbc:connect-and-save', async () => {
  try {
    const isDev =
      !!process.env.ELECTRON_START_URL ||
      process.env.NODE_ENV === 'development';

    return await odbcConnectAndSave({ isDev });
  } catch (error) {
    return {
      success: false,
      code: 'IPC_ODBC_ERROR',
      message: 'Error inesperado en la conexión ODBC',
      debug: {
        step: 'ipc-catch',
        error: error?.message,
        stack: error?.stack?.split('\n').slice(0, 8).join('\n'),
      },
    };
  }
});
// get-modules → módulos con `habilitado` y `video`
safeIpc('get-modules', async (idCliente) => {
  try {
    if (!idCliente) return { success: false, message: 'Falta idCliente' };
    const allRes = await obtenerModulosService(idCliente);
    const refRes = await obtenerModulosXClienteService(idCliente);

    if (!allRes?.success) return allRes;

    const idsHabilitados =
      (refRes && refRes.success && Array.isArray(refRes.idsHabilitados))
        ? new Set(refRes.idsHabilitados)
        : (refRes?.modulosXCliente ? new Set(refRes.modulosXCliente.map(r => r.IdModulo)) : new Set());

    const modulos = (allRes.modulos || []).map(m => ({
      id: m.id,
      nombre: m.nombre,
      texto: m.texto,
      icono: m.icono,
      link: m.link,
      pathExcel: m.pathExcel,
      video: m.video || null,
      habilitado: idsHabilitados.has(m.id),
      countClientesPorModulo: m.countClientesPorModulo
    }));

    return { success: true, modulos };
  } catch (e) {
    return { success: false, message: e?.message || 'Error combinando módulos.' };
  }
});

// (opcional) referencias crudas
safeIpc('get-modulos-x-cliente', obtenerModulosXClienteService);

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: LOGIN / SESSION
 * ──────────────────────────────────────────────────────────────────────────── */

ipcMain.handle('logout', async () => {
  try {
    const usuario  = activeSession?.usuario || store.get('user');
    const deviceId = activeSession?.deviceId || getDeviceId(store);
    if (usuario && deviceId) {
      await finalizarSesionActivaService({ usuario, deviceId }); // ← libera lock manual
    }
  } catch (e) {
    writeToLog(`logout error: ${e.message}`);
  } finally {
    try { stopSessionHeartbeat?.(); } catch {}
    try { stopSessionWatchdog?.(); } catch {}
    activeSession = null;
    modulosCache = [];
    clearStoreForLogin?.();
    const base = getBaseOrigin?.();
    if (base && mainWindow) await mainWindow.loadURL(`${base}/Login`);
  }
  broadcast('session:state', { status: 'logged-out', reason: 'manual', at: Date.now() });
  return { success: true };
});
function buildSessionStoreBlob({ userObj, deviceId }) {
  const payload = {
    // datos del usuario
    usuario: userObj?.Usuario || store.get('user') || null,
    idCliente: userObj?.IdCliente ?? store.get('idCliente') ?? null,

    // equipo / app
    deviceId,
    platform: process.platform,
    arch: process.arch,
    appVersion: (typeof app?.getVersion === 'function') ? app.getVersion() : null,

    // store útil (agregá lo que quieras persistir)
    jwtToken: store.get('jwtToken') || null,
    fechaInicio: store.get('fechaInicio') || new Date().toISOString(),

    // marca de tiempo
    snapshotAt: new Date().toISOString(),
  };

  try {
    const json = JSON.stringify(payload);
    return Buffer.from(json, 'utf8').toString('base64');
  } catch {
    return null;
  }
}

ipcMain.handle('login', async (_event, { usuario, contraseña }) => {
  writeToLog(`Login intento: ${usuario}`);
  try {
    // 0) DeviceId normalizado (evita duplicados por mayúsculas/minúsculas)
    const rawDeviceId = getDeviceId(store);
    const deviceId    = String(rawDeviceId || '').trim().toUpperCase();

    // 1) Autenticación (trae user.admin, IdCliente y token)
    const auth = await iniciarSesionService({ usuario, contraseña, deviceId });
    if (!(auth?.success && auth.user && auth.token && auth.user.IdCliente)) {
      return {
        success: false,
        code: auth?.code || 'BAD_CREDENTIALS',
        message: auth?.message || 'Credenciales inválidas.'
      };
    }
    const isAdmin = !!auth.user.admin;

    // 2) Lock por device (solo NO-admin). Admin tiene bypass.
    const check = await verificarSesionActivaService({ usuario, deviceId, isAdmin });
    if (!check?.success) {
      const dev = check?.deviceId ? ` ("${check.deviceId}")` : '';
      return {
        success: false,
        code: check?.code || 'ACTIVE_OTHER_DEVICE',
        message: check?.message || `Usuario activo en otra máquina${dev}.`
      };
    }

    // 3) Persistencia local mínima (antes del snapshot)
    store.set('idCliente', auth.user.IdCliente);
    store.set('user', usuario);
    store.set('jwtToken', auth.token);
    store.set('fechaInicio', new Date().toISOString());
    store.set('deviceId', deviceId);
    store.set('isAdmin', isAdmin ? 1 : 0);

    // 4) Snapshot StoreData (base64) para SesionesActivas.StoreData
    const storeBlob = buildSessionStoreBlob({ userObj: auth.user, deviceId });

    // 5) Registrar/activar ESTA máquina (el servicio aplica las reglas del diagrama)
    const lock = await registrarSesionActivaService({
      usuario,
      deviceId,
      token: auth.token,
      storeBlob,
      isAdmin, // <- MUY importante para multi-device admin
    });
    if (!lock?.success) {
      return {
        success: false,
        code: lock?.code || 'SESSION_LOCK_FAILED',
        message: lock?.message || 'No se pudo registrar/activar la sesión.'
      };
    }

    // 6) (opcional) aplicar StoreData previo si existía algo guardado para este device
    try {
      const ses = await obtenerSesionPorDeviceService({ usuario, deviceId });
      if (ses?.success && ses.row?.StoreData) {
        const decoded = decodeStoreBlobService(ses.row.StoreData);
        if (decoded && typeof decoded === 'object') {
          Object.entries(decoded).forEach(([k, v]) => { try { store.set(k, v); } catch {} });
          writeToLog('StoreData decodificado y aplicado.');
        }
      }
    } catch (e) {
      writeToLog(`decode StoreData error (no bloqueante): ${e.message}`);
    }

    // 7) Heartbeat (refresca LastSeen mientras la sesión esté activa)
    activeSession = { usuario, deviceId, token: auth.token, isAdmin };
    stopSessionHeartbeat?.();
    startSessionHeartbeat({
      usuario,
      deviceId,
      onTick: async ({ usuario, deviceId }) => {
        try { await heartbeatSesionActivaService({ usuario, deviceId }); } catch {}
      }
    });

    // 8) Monitores de sesión:
    //    - realtime con ZongJi (UPDATE/DELETE en SesionesActivas)
    //    - fallback polling rápido (250ms) para entorno sin binlog
    stopSessionWatchdog?.();
    stopSessionRealtimeWatcher?.();
    startSessionRealtimeWatcher({ usuario, deviceId });
    startSessionWatchdog({ usuario, deviceId, intervalMs: 250 });

    // 9) Cargar módulos (cache para el popup / home)
    const modulesResult = await obtenerModulosService(auth.user.IdCliente);
    if (!modulesResult?.success) {
      try { await finalizarSesionActivaService({ usuario, deviceId }); } catch {}
      stopSessionHeartbeat?.();
      stopSessionWatchdog?.();
      stopSessionRealtimeWatcher?.();
      activeSession = null;
      return {
        success: false,
        code: 'MODULES_FAIL',
        message: modulesResult?.message || 'No se pudieron cargar los módulos.'
      };
    }
    modulosCache = modulesResult.modulos.map(m => ({
      id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
      link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
    }));

    writeToLog(`Login OK: ${usuario} @ ${deviceId} ${isAdmin ? '(admin)' : ''}`);
    return { success: true, user: auth.user, modulos: modulosCache, token: auth.token };
  } catch (e) {
    writeToLog(`login IPC error: ${e.message}`);
    try {
      if (activeSession?.usuario && activeSession?.deviceId) {
        await finalizarSesionActivaService({ usuario: activeSession.usuario, deviceId: activeSession.deviceId });
      }
    } catch {}
    stopSessionHeartbeat?.();
    stopSessionWatchdog?.();
    stopSessionRealtimeWatcher?.();
    activeSession = null;
    return { success: false, code: 'INTERNAL', message: `Error interno al iniciar sesión: ${e.message}` };
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: EMPRESAS
 * ──────────────────────────────────────────────────────────────────────────── */

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

    // Avísale al front
    broadcast('empresa:selected', {
      idCliente,
      empCodigo,
      instanciaBD: r?.data?.instanciaBD ?? null,
      nombre: r?.data?.emp_razsoc ?? r?.data?.empNombre ?? null,
    });

    return { success: true, data: r.data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error verificando empresa.' };
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: CHEQUES P / CHEQUES3
 * ──────────────────────────────────────────────────────────────────────────── */
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
  try { return await ChequesPExcel(); }
  catch (e) { return { success: false, message: e?.message || 'No se pudo generar la planilla.' }; }
});

safeIpc('obtener-cheques', obtenerChequeService);
safeIpc('update-cheques', async (payload) => {
  const res = await actualizarChequeService({
    ...payload,
    usuario: (store && store.get?.('user')) || payload?.usuario || 'desconocido'
  });
  if (res?.success) broadcast('cheques:updated', { at: Date.now(), info: res });
  return res;
});

safeIpc('update-cheque3', ({ IDCheque, sit }) => actualizarCheque3Service(IDCheque, sit));
safeIpc('cheque3-rechazado', cheque3R);
safeIpc('cheque3-situacion', situacion);
safeIpc('registro-cheque3-sit', ({ emp, suc, IDCheque, sit, sitAnt }) => registro(emp, suc, IDCheque, sit, sitAnt));
safeIpc('cheque3-update-field', (payload) => actualizarCheque3CampoService(payload));
safeIpc('get-updated-fecha', getupdreg);

ipcMain.handle('chequesp:preview', async () => {
  try { return await obtenerChequesPreviewService(); }
  catch (e) { return { success: false, message: e?.message || 'No se pudo obtener la vista previa.' }; }
});
function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.cheques)) return payload.cheques;
  if (Array.isArray(payload.cheque)) return payload.cheque;
  return [];
}

// Helper para leer claves variantes
const pick = (o, keys, def = '') => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return def;
};
ipcMain.handle('cheques3:export-xlsx', async (_e, payload) => {
  try {
    const rowsIn = normalizeRows(payload);
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const fname = `cheques_de_terceros_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.xlsx`;
    if (!rowsIn.length) {
      return { success: false, message: 'No hay datos para exportar.' };
    }

    // Armamos columnas pedidas: sin “nueva situación”, sin fecha vto si no querés,
    // y con Cliente + Nro de Cheque.
    const rowsOut = rowsIn.map(r => ({
      Empresa      : pick(r, ['emp','Empresa','ch3emp_Codigo']),
      idCheque     : pick(r, ['idCheque','ch3_ID','IDCheque','id']),
      Cliente      : pick(r, ['cliente','Cliente','cli_RazSoc','cli_RazSoc.','cl_RazSoc']),
      NroCheque    : String(pick(r, ['nroDefinitivo','NroCheque','ch3_NroCheq','numero','Numero'])),
      Importe      : pick(r, ['importeRaw','Importe','ch3_Importe','importe']),
      Estado       : pick(r, ['estado','Estado','ch3_Edo']),
      FechaVenc: pick(r, ['fVto','FecVto','FechaVencimiento','ch3_FVenc','fvto']),
      FechaModif: pick(r, ['fMod', 'FecMod', 'FechaModificacion', 'ch3_FCmbio'])

    }));

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar cheques',
      defaultPath: fname,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { success: false, message: 'Exportación cancelada.' };

    if (XLSX) {
      const ws = XLSX.utils.json_to_sheet(rowsOut);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cheques');
      XLSX.writeFile(wb, filePath);
    } else {
      // Fallback CSV (por si aún no instalaron `xlsx`)
      const headers = Object.keys(rowsOut[0]);
      const csv = [
        headers.join(','), 
        ...rowsOut.map(o => headers.map(h => {
          const cell = o[h] ?? '';
          const s = String(cell).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(','))
      ].join('\n');
      fs.writeFileSync(filePath.replace(/\.xlsx$/i, '.csv'), csv, 'utf8');
    }

    return { success: true, path: filePath, count: rowsOut.length };
  } catch (err) {
    return { success: false, message: err?.message || 'Error exportando XLSX' };
  }
});


/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: ARTÍCULOS
 * ──────────────────────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: PRECIOS (Generador / Actualizador)
 * ──────────────────────────────────────────────────────────────────────────── */
ipcMain.handle('get-precios', async () => {
  writeToLog('[IPC] get-precios');
  return obtenerPreciosService();
});

ipcMain.handle('precios:actualizar', async ( payload) => {
  try {
    return await actualizarPreciosService(payload);
  } catch (error) {
    return { success: false, message: error?.message || 'Error en actualización de precios.' };
  }
});
ipcMain.handle('precios:preview-lista', async (_e, { listaCod, limit }) => {
  try {
    const res = await ActualizadorPrecios.obtenerPreviewLista(listaCod, limit || 15);
    return res;
  } catch (e) {
    return { success: false, message: e?.message || 'Error en preview de lista.' };
  }
});

ipcMain.handle('get-precios-actualizados', async () => {
  writeToLog('[IPC] get-precios-actualizados');
  return obtenerPreciosActualizadosService();
});

ipcMain.handle('precios:codigos-lista', async () => {
  const { obtenerCodigoLista } = require('./modulesService/Local/ActualizadorPrecios');
  return await obtenerCodigoLista();
});

ipcMain.handle('precios:actualizar-excel', async (_evt, items) => {
  try {
    const { actualizarPreciosExcel } = require('./modulesService/Local/ActualizadorPrecios');
    const res = await actualizarPreciosExcel(items);
    if (res?.success) broadcast('precios:updated', { at: Date.now(), info: res });
    return res;
  } catch (e) {
    console.error('IPC precios:actualizar-excel', e);
    return { success: false, message: e?.message || 'Error en actualización.' };
  }
});

ipcMain.handle('precios:excel-ultimos', async () => {
  try { return await ActualizadorPrecios.obtenerPreciosExcelActualizados(); }
  catch (e) { return { success: false, message: e?.message || 'Error obteniendo últimos actualizados' }; }
});

ipcMain.handle('clientes:listas-habilitadas', async () => {
  if (typeof ClientesSvc.getListasHabilitadas === 'function') {
    return ClientesSvc.getListasHabilitadas();
  }
  // Si lo resolvés desde otro service centralizado, redireccioná acá.
  return { success: false, message: 'getListasHabilitadas no disponible en ClientesSvc.' };
});

// Traer clientes habilitados (opcionalmente filtrado por lista ORIGEN)
ipcMain.handle('clientes:listar', async (_e, payload) => {
  // payload: { listaCod?: string }
  return ClientesSvc.listarClientesHabilitados(payload || {});
});

// Reemplazar lista ORIGEN por DESTINO
ipcMain.handle('clientes:actualizar-filtrado', async (_e, payload) => {
  // payload: { fromCod: string, toCod: string }
  return ClientesSvc.actualizarListaPorFiltros(payload || {});
});

// (Opcional) nombres de definiciones desde ParamGen, si tu front lo usa
ipcMain.handle('paramgen:get-ordenamientos', async () => {
  if (typeof ClientesSvc.getOrdenamientos === 'function') {
    return ClientesSvc.getOrdenamientos();
  }
  return { success: true, data: { pge_NomDefi1Cli: '', pge_NomDefi2Cli: '' } };
});

// Usa un único import para todo el back de Clientes
const Clientes = require('./modulesService/Local/Clientes'); // ajustá la ruta si difiere

// ⚠️ Registrá los handlers una sola vez (sin duplicados)
ipcMain.handle('clientesForm:traerTodos', async () => {
  return await Clientes.traerTodos();
});

ipcMain.handle('clientesForm:getCatalogos', async () => {
  return await Clientes.getCatalogos();
});

// Catálogos por solapa
ipcMain.handle('clientesForm:getCatalogosGeneral', async () => {
  return await Clientes.getCatalogosGeneral();
});

ipcMain.handle('clientesForm:getCatalogosImpositivos', async () => {
  return await Clientes.getCatalogosImpositivos();
});

ipcMain.handle('clientesForm:getCatalogosOtros', async () => {
  return await Clientes.getCatalogosOtros();
});

// Listas habilitadas (legacy)
ipcMain.handle('clientesForm:traerCodigosLista', async () => {
  return await Clientes.traerCodigosLista();
});

// Updates
ipcMain.handle('clientesForm:actualizarLista', async (_e, payload) => {
  return await Clientes.actualizarLista(payload);
});

ipcMain.handle('clientesForm:actualizarCampos', async (_e, payload) => {
  return await Clientes.actualizarCampos(payload);
});

// Recibos
// Tipos de Comprobante (RC/V)
ipcMain.handle('recibos:getTiposComprobante', async (event, payload = {}) => {
  try {
    const data = await Recibos.getTiposComprobante({
      tipoFijo: payload.tipoFijo || 'RC',
      circuito: payload.circuito || 'V',
    });
    return { ok: true, data };
  } catch (e) {
    console.error('[IPC recibos:getTiposComprobante]', e);
    return { ok: false, error: e.message };
  }
});

// Monedas + Tipos de Cambio por moneda
ipcMain.handle('recibos:getMonedas', async () => {
  try {
    const data = await Recibos.getMonedas();
    // data: [{ mon_codigo, mon_descrip, mtca_codigo, mtca_descrip }, ...]
    return { ok: true, data };
  } catch (e) {
    console.error('[IPC recibos:getMonedas]', e);
    return { ok: false, error: e.message };
  }
});

// Tipo de Cambio (moneda + tipo cambio + fecha)
ipcMain.handle('recibos:getTipoCambio', async (event, payload = {}) => {
  try {
    const { mon_codigo, mtca_codigo, fecha } = payload;
    const cotizacion = await Recibos.getTipoCambio({ mon_codigo, mtca_codigo, fecha });
    return { ok: true, cotizacion };
  } catch (e) {
    console.error('[IPC recibos:getTipoCambio]', e);
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('recibos:getFacturas', async (event, payload = {}) => {
  try {
    const { codcli, mon_codigo, mtca_codigo } = payload;
    const data = await Recibos.getFacturas({ codcli, mon_codigo, mtca_codigo });
    return { ok: true, data };
  } catch (e) {
    console.error('[IPC recibos:getFacturas]', e);
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('recibos:get-monedas-tc-editables', async () => {
  return await Recibos.getMonedasTcEditables();
});
ipcMain.handle('recibos:get-saldo-cliente', async (_evt, payload) => {
  return await Recibos.getSaldoCliente(payload);
});

ipcMain.handle("recibos:getTransferencias", () => Recibos.getTransferencias());
ipcMain.handle("recibos:getCajas",          () => Recibos.getCajas());
ipcMain.handle("recibos:getAplicaciones",   () => Recibos.getAplicaciones());
/* ────────────────────────────────────────────────────────────────────────────
 *  IPC: FILE / DOWNLOAD HELPERS
 * ──────────────────────────────────────────────────────────────────────────── */
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

ipcMain.handle('descargar-lista-xlsx', async (_e, listaCod) => {
  try {
    const res = await ActualizadorPrecios.descargarListaXlsx(listaCod);
    return res;
  } catch (err) {
    console.error('[descargar-lista-xlsx]', err);
    return { success: false, message: err?.message || 'Error al descargar la lista.' };
  }
});

ipcMain.handle('open-path', async (_e, p) => {
  try {
    if (!p) return { success: false, message: 'Ruta vacía' };
    const r = await shell.openPath(p);
    return { success: !r, message: r || '' };
  } catch (e) {
    return { success: false, message: e?.message || 'No se pudo abrir el archivo.' };
  }
});

ipcMain.handle('reveal-path', async (_e, p) => {
  try {
    if (!p) return { success: false, message: 'Ruta vacía' };
    await shell.showItemInFolder(p);
    return { success: true };
  } catch (e) {
    return { success: false, message: e?.message || 'No se pudo mostrar el archivo.' };
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
