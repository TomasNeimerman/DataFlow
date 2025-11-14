// electron/helpers/ODBCConnection.js
// - Crea / reutiliza DSN de USUARIO "DataFlow" (HKCU)
// - Sólo drivers permitidos: "SQL Server" y "SQL Server Native Client 11.0"
// - Conecta vía ODBC a la BD "manager"
// - Verifica que exista la BD "manager" (DB_ID)
// - Persiste server/port en userDbConfig

const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { getClientServer } = require('../modulesService/Cloud/Empresa.js');

let cachedServer = null;

/* ─────────────────────────────── Utilidades básicas ─────────────────────────────── */
function logDiag(line) {
  try {
    fs.appendFileSync(
      path.join(process.cwd(), 'odbc-diag.log'),
      `[${new Date().toISOString()}] ${line}\n`
    );
  } catch {}
}

function mask(str, secret) {
  return !str || !secret ? (str || '') : String(str).replaceAll(secret, '***');
}

function errInfo(e) {
  return {
    message: e?.message || String(e),
    odbcErrors: e?.odbcErrors || [],
    stack: (e?.stack || '').split('\n').slice(0, 10).join('\n'),
  };
}

function tick(debug, step, t0) {
  (debug.timings ||= []).push({ step, ms: Date.now() - t0 });
}

const SYSROOT = process.env.SystemRoot || 'C:\\Windows';
const REG64   = path.join(SYSROOT, 'System32',  'reg.exe');
const REG32   = path.join(SYSROOT, 'SysWOW64', 'reg.exe');

const HIVE = { USER: 'HKCU', SYSTEM: 'HKLM' };

/* ─────────────────────────────── REG helpers ─────────────────────────────── */
function regQueryRawHive(hive, key, use64) {
  try {
    const regExe  = use64 ? REG64 : REG32;
    const fullKey = `${hive}\\${key}`;

    const out = execFileSync(
      regExe,
      ['QUERY', fullKey, '/s'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'], // ignorar stderr
      }
    );

    logDiag(`REG OK: ${hive}\\${key}`);
    return out || '';
  } catch (e) {
    logDiag(`REG error (${hive}\\${key}): ${e.message}`);
    return '';
  }
}

function regAddRawHive(hive, key, name, type, data, use64) {
  const regExe  = use64 ? REG64 : REG32;
  const fullKey = `${hive}\\${key}`;
  const args = ['ADD', fullKey, '/v', name, '/t', type, '/d', String(data), '/f'];

  try {
    execFileSync(regExe, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    logDiag(`REG ADD OK: ${hive}\\${key} /v ${name} = ${data}`);
  } catch (e) {
    logDiag(`REG ADD error (${hive}\\${key} /v ${name}): ${e.message}`);
    throw e;
  }
}

/* ─────────────────────────────── Drivers ─────────────────────────────── */
function regQueryRaw(key, use64) {
  return regQueryRawHive(HIVE.SYSTEM, key, use64);
}

function detectDriversList64() {
  const out = regQueryRaw('SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers', true);
  return out.split(/\r?\n/).reduce((acc, ln) => {
    const m = ln.match(/^\s*(.+?)\s+REG_SZ\s+Installed/i);
    if (m) acc.push(m[1].trim());
    return acc;
  }, []);
}

/**
 * Devuelve SOLO:
 *  - "SQL Server Native Client 11.0" o
 *  - "SQL Server"
 * en ese orden de preferencia.
 */
function detectAllowedDriver() {
  const baseKey = 'SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers';
  const out64 = regQueryRaw(baseKey, true);
  const out32 = regQueryRaw(baseKey, false);
  const lines = (out64 + '\n' + out32).split(/\r?\n/).filter(Boolean);

  const has = (name) =>
    lines.some((l) =>
      new RegExp(`^\\s*${name}\\s+REG_SZ\\s+Installed\\s*$`, 'i').test(l)
    );

  if (has('SQL Server Native Client 11.0')) return 'SQL Server Native Client 11.0';
  if (has('SQL Server')) return 'SQL Server';
  return null;
}

function getDriverPath(driverName) {
  if (!driverName) return '';
  const key   = `SOFTWARE\\ODBC\\ODBCINST.INI\\${driverName}`;
  const out64 = regQueryRaw(key, true);
  const out32 = regQueryRaw(key, false);

  const find = (txt) => {
    const m = txt.match(/\sDriver\s+REG_SZ\s+(.+)$/mi);
    return m ? m[1].trim() : null;
  };

  let p = find(out64) || find(out32) || '';
  if (!p) {
    const win = process.env.SystemRoot || 'C:\\Windows';
    if (/^SQL\s*Server\s*$/i.test(driverName)) {
      p = path.join(win, 'System32', 'SQLSRV32.DLL');
    } else if (/SQL\s*Server\s*Native\s*Client\s*11\.0/i.test(driverName)) {
      p = path.join(win, 'System32', 'SQLNCLI11.DLL');
    }
  }
  return p;
}

/* ─────────────────────────────── DSN de usuario (HKCU) ─────────────────────────────── */
function readDsnInfoFromRegistry(name, hive) {
  const out64 = regQueryRawHive(hive, `SOFTWARE\\ODBC\\ODBC.INI\\${name}`, true);
  const out32 = regQueryRawHive(hive, `SOFTWARE\\ODBC\\ODBC.INI\\${name}`, false);
  const out   = `${out64}\n${out32}`.trim();
  if (!out) return { exists: false };

  const pick = (k) => {
    const m = out.match(new RegExp(`\\s${k}\\s+REG_\\w+\\s+(.+)$`, 'mi'));
    return m ? m[1].trim() : null;
  };

  return {
    exists: true,
    server:     pick('Server'),
    driverPath: pick('Driver'),
    database:   pick('Database'),
  };
}

function ensureDataFlowDSN({ server, lastUser, debug }) {
  const database   = 'manager';
  const driverName = detectAllowedDriver();
  debug.driverChosen = driverName || '(none)';

  if (!driverName) {
    return {
      ok:   false,
      code: 'NO_ODBC_DRIVER',
      error: 'No hay driver permitido (SQL Server / SQL Server Native Client 11.0)',
    };
  }

  const dsnUser = readDsnInfoFromRegistry('DataFlow', HIVE.USER);
  debug.dsn64 = dsnUser;
  debug.dsn32 = dsnUser;
  const already = !!dsnUser.exists;

  if (already) {
    logDiag('DSN "DataFlow" ya existe; se reutiliza sin recrearlo.');
    return {
      ok:      true,
      reused:  true,
      driver:  driverName,
      server:  dsnUser.server || server,
      database,
    };
  }

  try {
    const driverPath = getDriverPath(driverName);
    if (!driverPath) {
      return {
        ok:   false,
        code: 'NO_DRIVER_PATH',
        error: `No se halló DriverPath de ${driverName}`,
      };
    }

    const dsnKey  = 'SOFTWARE\\ODBC\\ODBC.INI\\DataFlow';
    const listKey = 'SOFTWARE\\ODBC\\ODBC.INI\\ODBC Data Sources';

    for (const use64 of [true, false]) {
      regAddRawHive(HIVE.USER, dsnKey,  'Driver',             'REG_SZ', driverPath, use64);
      regAddRawHive(HIVE.USER, dsnKey,  'Server',             'REG_SZ', server,     use64);
      regAddRawHive(HIVE.USER, dsnKey,  'Database',           'REG_SZ', database,   use64);
      regAddRawHive(HIVE.USER, dsnKey,  'Trusted_Connection', 'REG_SZ', 'No',       use64);
      regAddRawHive(HIVE.USER, dsnKey,  'LastUser',           'REG_SZ', lastUser || '', use64);
      regAddRawHive(HIVE.USER, listKey, 'DataFlow',           'REG_SZ', driverName, use64);
    }

    const dsnOK = readDsnInfoFromRegistry('DataFlow', HIVE.USER);
    debug.dsn64 = dsnOK;
    debug.dsn32 = dsnOK;

    if (!dsnOK.exists) {
      return {
        ok:   false,
        code: 'DSN_NOT_VISIBLE',
        error: 'El DSN (usuario) no aparece tras crearlo.',
      };
    }

    logDiag(`DSN "DataFlow" creado (HKCU, DB=manager, Driver=${driverName}, Server=${server}).`);
    return { ok: true, created: true, driver: driverName, server, database };
  } catch (e) {
    logDiag(`ensureDataFlowDSN HKCU error: ${e.message}`);
    return { ok: false, code: 'DSN_REG_ERROR', error: e.message };
  }
}

/* ─────────────────────────────── API para el login ─────────────────────────────── */
// 1) Cloud → traer server según usuario/contraseña
async function getServerForLogin({ user, password }) {
  try {
    const server = await getClientServer(user, password);
    if (!server) {
      return {
        ok: false,
        code: 'NO_SERVER_FOUND',
        message: 'No se pudo determinar el servidor del cliente',
      };
    }
    return { ok: true, server };
  } catch (e) {
    logDiag(`getServerForLogin error: ${e.message}`);
    return { ok: false, code: 'GET_SERVER_ERR', message: e?.message || String(e) };
  }
}

// 2) Guardar server en memoria para que lo use odbcConnectAndSave
async function saveServerForOdbc(server) {
  cachedServer = server;
  logDiag(`saveServerForOdbc: server=${server}`);
  return { ok: true };
}

/* ─────────────────────────────── ODBC principal ─────────────────────────────── */
async function odbcConnectAndSave({ isDev = false } = {}) {
  const t0 = Date.now();
  const debug = { step: 'start', timings: [], drivers: [] };

  try {
    tick(debug, 'entered', t0);
    if (isDev) {
      debug.step = 'dev-skip';
      return { success: true, skipped: true, debug };
    }

    // 1) Config / credenciales
    tick(debug, 'read-config', t0);
    const { getAdminDbConfig, writeAdminDbConfig } = require('../userDbConfig.js');
    const base   = getAdminDbConfig?.() || {};
    const user   = base.user     || 'bejerman';
    const pass   = base.password || 'tiMCLmu27qtQwD';
    const server = cachedServer  || base.server || 'localhost';
    const database = 'manager';

    debug.creds = {
      userPreview: user ? 'bejerman' : '(vacío)',
      server,
      database,
    };

    // 2) Drivers instalados
    tick(debug, 'drivers-64', t0);
    debug.drivers = detectDriversList64();

    // 3) DSN usuario DataFlow → manager
    tick(debug, 'ensure-dsn', t0);
    const dsnRes = ensureDataFlowDSN({ server, lastUser: user, debug });
    if (!dsnRes.ok) {
      debug.step = 'dsn-failed';
      return {
        success: false,
        code: 'DSN_CREATE_FAIL',
        message: `No se pudo preparar el DSN DataFlow: ${dsnRes.error}`,
        debug,
      };
    }

    // 4) Módulo ODBC
    tick(debug, 'require-odbc', t0);
    let odbc;
    try {
      odbc = require('odbc');
    } catch (e) {
      debug.step  = 'require-odbc-failed';
      debug.error = errInfo(e);
      return {
        success: false,
        code: 'ODBC_MOD_FAIL',
        message: 'No se pudo cargar el módulo ODBC.',
        debug,
      };
    }

    // 5) Conexión por DSN
    tick(debug, 'connect', t0);
    const connStr =
      `DSN=DataFlow;UID=${user};PWD=${pass};Encrypt=No;` +
      `TrustServerCertificate=Yes;Connection Timeout=8;`;

    debug.connStrPreview = mask(connStr, pass);
    debug.usedVariant = { server, database, encrypt: 'No', trust: 'Yes' };

    let cn;
    try {
      cn = await odbc.connect(connStr);
    } catch (e) {
      debug.step  = 'connect-failed';
      debug.error = errInfo(e);
      logDiag(`ODBC connect fail: ${debug.error.message}`);
      return {
        success: false,
        code: 'ODBC_CONNECT_FAIL',
        message: 'No se pudo conectar al servidor (ODBC).',
        debug,
      };
    }

    // 6) Puerto TCP
    tick(debug, 'connprops', t0);
    let port = 1433;
    try {
      const rs = await cn.query(`
        SELECT
          CONVERT(varchar(128), CONNECTIONPROPERTY('local_net_address')) AS addr,
          CONVERT(varchar(32),  CONNECTIONPROPERTY('local_tcp_port'))    AS port;
      `);
      const p = Number(rs?.[0]?.port || 0);
      if (p) port = p;
    } catch (e) {
      debug.connPropsError = e?.message;
      logDiag(`WARN connprops: ${e?.message || e}`);
    }

    // 7) Verificar que exista la BD "manager" (DB_ID) usando la misma conexión ODBC
    tick(debug, 'check-manager-db', t0);
    let managerExists = false;
    try {
      const rs = await cn.query(`
        SELECT CASE WHEN DB_ID('manager') IS NULL THEN 0 ELSE 1 END AS ok;
      `);
      managerExists = !!(rs?.[0]?.ok);
      debug.managerDbExists = managerExists;
    } catch (e) {
      debug.managerCheckError = errInfo(e);
      logDiag(`Error verificando BD manager vía ODBC: ${e.message}`);
    }

    if (!managerExists) {
      debug.step = 'no-manager-db';
      try { await cn.close(); } catch {}
      return {
        success: false,
        code: 'NO_MANAGER_DB',
        message: 'Bejerman ERP no se encuentra instalado (BD "manager" no encontrada).',
        debug,
      };
    }

    // 8) Cerrar conexión ODBC
    try { await cn.close(); } catch {}

    // 9) Persistir server/port
    tick(debug, 'persist', t0);
    try {
      writeAdminDbConfig?.({ ...base, server, port });
    } catch (e) {
      debug.persistError = e?.message;
      logDiag(`WARN persist: ${e?.message || e}`);
    }

    // 10) OK final
    debug.step = 'ok';
    tick(debug, 'done', t0);
    return { success: true, server, port, debug };
  } catch (e) {
    const info = errInfo(e);
    logDiag(`ODBC fatal: ${info.message}`);
    return {
      success: false,
      code: 'EXCEPTION',
      message: 'Error en conexión ODBC',
      debug: { ...debug, step: 'exception', ...info },
    };
  }
}

module.exports = {
  getServerForLogin,
  saveServerForOdbc,
  odbcConnectAndSave,
};
