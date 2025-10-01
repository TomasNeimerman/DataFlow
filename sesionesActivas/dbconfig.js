// dbconfig.js
const fs = require('fs');
const path = require('path');

function getResourcesPath() {
  // En Electron empaquetado existe process.resourcesPath.
  if (process.resourcesPath) return process.resourcesPath;
  // Fallback por si el proceso no lo expone
  try {
    const execDir = path.dirname(process.execPath);
    const guess = path.join(execDir, 'resources');
    if (fs.existsSync(guess)) return guess;
  } catch {}
  return null;
}

function resolvePropsPath() {
  // 1) Producción: dentro de resources/
  const res = getResourcesPath();
  if (res) {
    const p = path.join(res, 'fileConfigUpdater', 'dbConfig.properties');
    if (fs.existsSync(p)) return { path: p, source: 'resources' };
  }
  // 2) Dev: carpeta del proyecto
  const dev = path.join(__dirname, 'fileConfigUpdater', 'dbConfig.properties');
  if (fs.existsSync(dev)) return { path: dev, source: 'dev' };

  return { path: null, source: 'env' };
}

function parseProperties(text) {
  const obj = {};
  text.split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    const i = s.indexOf('=');
    if (i === -1) return;
    obj[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  });
  return obj;
}

function getDbConfig() {
  const { path: p } = resolvePropsPath();
  if (p) {
    const cfg = parseProperties(fs.readFileSync(p, 'utf-8'));
    return {
      user:     cfg.DB_USER,
      password: cfg.DB_PASSWORD,
      server:   cfg.DB_SERVER || cfg.DB_HOST,
      port:     parseInt(cfg.DB_PORT || '3306', 10),
      database: cfg.DB_DATABASE,
    };
  }
  // Fallback a ENV (por si preferís no usar properties)
  return {
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server:   process.env.DB_HOST || process.env.DB_SERVER,
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_DATABASE,
  };
}

function getDbConfigMeta() {
  return resolvePropsPath(); // { source, path }
}

module.exports = { getDbConfig, getDbConfigMeta };
