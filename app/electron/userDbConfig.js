// electron/userDbConfig.js
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = !app.isPackaged;
const configFilePath = path.join(app.getPath('userData'), 'userDbConfig.properties');

// 🔒 Valores fijos para TODOS los clientes
const STATIC_DEFAULTS = {
  DB_SERVER: 'localhost',
  DB_USER: 'bejerman',
  DB_PASSWORD: 'tiMCLmu27qtQwD',
  DB_PORT: '1433',
  // La DB es la ÚNICA que cambia; default razonable:
  DB_DATABASE: 'master',
};

// --- utils ---
function parsePropsFile(content) {
  const out = {};
  content.split(/\r?\n/).forEach(line => {
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function serializeProps(obj) {
  return [
    `DB_SERVER=${obj.DB_SERVER}`,
    `DB_USER=${obj.DB_USER}`,
    `DB_PASSWORD=${obj.DB_PASSWORD}`,
    `DB_DATABASE=${obj.DB_DATABASE}`,
    `DB_PORT=${obj.DB_PORT}`,
    ''
  ].join('\n');
}

// ------------------------------------------------------------------
// Inicializa el archivo en userData si NO existe. SIN copiar plantillas.
// Siempre escribe los valores fijos y deja DB_DATABASE en 'master'.
// Si existe pero le faltan claves fijas, las repara conservando DB_DATABASE.
// ------------------------------------------------------------------
function initializeConfig() {
  try {
    if (!fs.existsSync(configFilePath)) {
      const content = serializeProps(STATIC_DEFAULTS);
      fs.writeFileSync(configFilePath, content, 'utf-8');
      console.log(`[userDbConfig] creado en ${configFilePath}`);
      return;
    }

    // Si existe: validamos que tenga las claves fijas; si falta algo, reescribimos,
    // preservando sólo DB_DATABASE actual.
    const file = fs.readFileSync(configFilePath, 'utf-8');
    const current = parsePropsFile(file);
    const dbFromFile = current.DB_DATABASE && current.DB_DATABASE.trim()
      ? current.DB_DATABASE.trim()
      : STATIC_DEFAULTS.DB_DATABASE;

    const normalized = {
      ...STATIC_DEFAULTS,
      DB_DATABASE: dbFromFile,
    };

    // ¿Está igual? Si no, reescribimos (para corregir plantillas viejas tipo SBDAMODE)
    const desired = serializeProps(normalized);
    if (file.replace(/\r\n/g, '\n') !== desired.replace(/\r\n/g, '\n')) {
      fs.writeFileSync(configFilePath, desired, 'utf-8');
      console.log('[userDbConfig] normalizado archivo de configuración (valores fijos reparados).');
    } else {
      console.log('[userDbConfig] archivo existente válido; sin cambios.');
    }
  } catch (e) {
    console.error('[userDbConfig] initializeConfig error:', e);
  }
}

// ------------------------------------------------------------------
// Lee SIEMPRE de userData, pero fuerza los valores fijos desde memoria.
// Sólo toma DB_DATABASE del archivo (si no está, usa 'master').
// Devuelve el objeto listo para mssql.
// ------------------------------------------------------------------
function getAdminDbConfig() {
  try {
    let dbName = STATIC_DEFAULTS.DB_DATABASE;

    if (fs.existsSync(configFilePath)) {
      const file = fs.readFileSync(configFilePath, 'utf-8');
      const props = parsePropsFile(file);
      if (props.DB_DATABASE && props.DB_DATABASE.trim()) {
        dbName = props.DB_DATABASE.trim();
      }
    }

    return {
      user: STATIC_DEFAULTS.DB_USER,
      password: STATIC_DEFAULTS.DB_PASSWORD,
      server: STATIC_DEFAULTS.DB_SERVER,
      port: parseInt(STATIC_DEFAULTS.DB_PORT, 10),
      database: dbName,
      options: { encrypt: false, trustServerCertificate: true },
      requestTimeout: 60000,
    };
  } catch (error) {
    console.error('[userDbConfig] getAdminDbConfig error:', error);
    // fallback duro, por si se rompe la lectura
    return {
      user: STATIC_DEFAULTS.DB_USER,
      password: STATIC_DEFAULTS.DB_PASSWORD,
      server: STATIC_DEFAULTS.DB_SERVER,
      port: parseInt(STATIC_DEFAULTS.DB_PORT, 10),
      database: STATIC_DEFAULTS.DB_DATABASE,
      options: { encrypt: false, trustServerCertificate: true },
      requestTimeout: 60000,
    };
  }
}

// ------------------------------------------------------------------
// Escribe el archivo en userData con los valores fijos y la DB indicada.
// ACEPTA:
//   - objeto { database } o { server,user,password,port,database } (pero ignoramos los fijos)
//   - string con el nombre de la DB
// Devuelve la ruta del archivo.
// ------------------------------------------------------------------
function writeAdminDbConfig(empresaData) {
  try {
    const db =
      typeof empresaData === 'string'
        ? empresaData
        : (empresaData && empresaData.database) ? String(empresaData.database) : STATIC_DEFAULTS.DB_DATABASE;

    const content = serializeProps({
      ...STATIC_DEFAULTS,
      DB_DATABASE: db,
    });

    fs.writeFileSync(configFilePath, content, 'utf-8');
    return configFilePath;
  } catch (error) {
    console.error('[userDbConfig] writeAdminDbConfig error:', error);
    throw error;
  }
}

module.exports = {
  initializeConfig,
  getAdminDbConfig,
  writeAdminDbConfig,
};
