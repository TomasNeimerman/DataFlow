// electron/adminPool.js
const mysql = require('mysql2/promise');
const { getDbConfig, onDbConfigChange } = require('../../dbConfig');

let pool = null;

function buildPoolFromConfig(cfg) {
  return mysql.createPool({
    host: cfg.server,
    port: cfg.port || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
  });
}

function getAdminPool() {
  if (!pool) pool = buildPoolFromConfig(getDbConfig());
  return pool;
}

async function withAdminPool(fn) {
  const p = getAdminPool();
  return fn(p);
}

// Si cambia dbConfig.properties → recreamos el pool sin cortar en caliente
onDbConfigChange((cfg) => {
  const old = pool;
  pool = buildPoolFromConfig(cfg);
  setTimeout(() => { try { old?.end(); } catch {} }, 250);
});

process.on('exit', () => { try { pool?.end(); } catch {} });

module.exports = { getAdminPool, withAdminPool };
