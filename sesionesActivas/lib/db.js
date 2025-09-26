// lib/db.js
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { getDbConfig } = require('../dbconfig');

function logLine(msg) {
  try {
    const dir = require('electron')?.app
      ? require('electron').app.getPath('documents')
      : process.env.USERPROFILE || process.env.HOME;
    const folder = path.join(dir, 'PanelSesiones');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.appendFileSync(path.join(folder, 'log.txt'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

function mask(v, keep = 2) {
  if (!v) return '(empty)';
  return v.length <= keep ? '*'.repeat(v.length) : v.slice(0, keep) + '***';
}

const DB = (() => {
  const cfg = getDbConfig();
  if (!cfg || !cfg.server || !cfg.user || !cfg.database) {
    const msg = 'DB config inválida (falta host/user/database).';
    logLine(msg + ' cfg=' + JSON.stringify({
      host: cfg?.server, user: mask(cfg?.user), db: cfg?.database
    }));
    throw new Error(msg);
  }

  logLine(`Conectando MySQL host=${cfg.server} port=${cfg.port} user=${mask(cfg.user)} db=${cfg.database}`);

  const pool = mysql.createPool({
    host: cfg.server,
    port: cfg.port || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
    // ssl: { rejectUnauthorized: true } // habilitar si tu proveedor exige TLS
  });

  async function query(sql, params = []) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (e) {
      logLine(`DB ERROR: ${e.code || ''} ${e.message}\nSQL: ${sql}`);
      throw e;
    }
  }

  async function ping() {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  }

  return { query, pool, ping };
})();

module.exports = DB;
