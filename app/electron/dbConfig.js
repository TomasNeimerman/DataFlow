// electron/dbConfig.js
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const emitter = new EventEmitter();
const CONFIG_PATH = path.join(__dirname, './fileConfigUpdater/dbConfig.properties');

let cachedConfig = null;
let cachedRaw = null;

function parseProps(raw) {
  const config = {};
  raw.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const i = line.indexOf('=');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key) config[key] = value;
  });

  return {
    user:     config.DB_USER,
    password: config.DB_PASSWORD,
    server:   config.DB_SERVER,
    port:     parseInt(config.DB_PORT, 10) || 3306,
    database: config.DB_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

function loadConfigSync() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  cachedRaw = raw;
  cachedConfig = parseProps(raw);
  return cachedConfig;
}

function getDbConfig() {
  if (cachedConfig) return cachedConfig;
  return loadConfigSync();
}

function onDbConfigChange(fn) { emitter.on('change', fn); }

// Watch robusto (polling) para detectar cambios en properties
try {
  fs.watchFile(CONFIG_PATH, { interval: 1000 }, () => {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedConfig = parseProps(raw);
        emitter.emit('change', cachedConfig);
      }
    } catch {}
  });
} catch {}

module.exports = { getDbConfig, onDbConfigChange };
