// lib/db.js
const mysql = require('mysql2/promise');
const { getDbConfig } = require('../dbconfig');

const cfg = getDbConfig();
if (!cfg?.server || !cfg?.user || !cfg?.database) {
  throw new Error('Config DB inválida: faltan DB_SERVER/DB_USER/DB_DATABASE');
}

// SSL opcional: DB_SSL=disable | require | no-verify
const mode = (process.env.DB_SSL || 'disable').toLowerCase();
let ssl = undefined;
if (mode === 'require') ssl = { minVersion: 'TLSv1.2' };
if (mode === 'no-verify') ssl = { rejectUnauthorized: false };

const pool = mysql.createPool({
  host: cfg.server,
  port: cfg.port || 3306,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl,
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
async function ping() {
  const [rows] = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

module.exports = { query, ping, pool };
