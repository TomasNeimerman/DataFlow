// dbconfig.js
const fs = require('fs');
const path = require('path');

// Busca el archivo properties en dev y en producción (packaged)
function resolvePropsPath() {
  // 1) Dev: carpeta del proyecto
  const devPath = path.join(__dirname, 'fileConfigUpdater', 'dbConfig.properties');
  if (fs.existsSync(devPath)) return devPath;

  // 2) Prod (empaquetado): dentro de resources
  const resPath = path.join(process.resourcesPath || '', 'fileConfigUpdater', 'dbConfig.properties');
  if (process.resourcesPath && fs.existsSync(resPath)) return resPath;

  return null;
}

function parseProperties(text) {
  const obj = {};
  text.split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    const i = s.indexOf('=');
    if (i === -1) return;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    obj[k] = v;
  });
  return obj;
}

function getDbConfig() {
  const p = resolvePropsPath();

  if (p) {
    const raw = fs.readFileSync(p, 'utf-8');
    const cfg = parseProperties(raw);
    return {
      user:     cfg.DB_USER,
      password: cfg.DB_PASSWORD,
      server:   cfg.DB_SERVER || cfg.DB_HOST, // lo mapeamos a host en lib/db.js
      port:     parseInt(cfg.DB_PORT || '3306', 10),
      database: cfg.DB_DATABASE
    };
  }

  // Fallback a variables de entorno si no hay properties
  return {
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server:   process.env.DB_HOST || process.env.DB_SERVER,
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_DATABASE
  };
}

module.exports = { getDbConfig };
