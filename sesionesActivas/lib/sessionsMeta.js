const DB = require('./db');

async function guessSessionsTable() {
  const sql = `
    SELECT TABLE_NAME,
           SUM(CASE WHEN COLUMN_NAME='Usuario'  THEN 1 ELSE 0 END) +
           SUM(CASE WHEN COLUMN_NAME='DeviceId' THEN 1 ELSE 0 END) +
           SUM(CASE WHEN COLUMN_NAME='Activa'   THEN 1 ELSE 0 END) +
           SUM(CASE WHEN COLUMN_NAME='LastSeen' THEN 1 ELSE 0 END) AS score
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME IN ('Usuario','DeviceId','Activa','LastSeen')
    GROUP BY TABLE_NAME
    ORDER BY score DESC, TABLE_NAME ASC
    LIMIT 1`;
  const rows = await DB.query(sql);
  return rows[0]?.TABLE_NAME || null;
}

async function getSessionsTable() {
  if (process.env.SESSIONS_TABLE) return process.env.SESSIONS_TABLE;
  const t = await guessSessionsTable();
  if (!t) throw new Error('No encontré la tabla de sesiones. Definí SESSIONS_TABLE en .env.local');
  return t;
}

module.exports = { getSessionsTable };
