// electron/modulesService/Empresa.js
const sql = require('mssql');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { getDbConfig } = require('../dbConfig.js');

// ====== MSSQL local (manager) ======
const MSSQL_LOCAL_STATIC = {
  user: 'bejerman',
  password: 'tiMCLmu27qtQwD',
  server: 'localhost',
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};
function mssqlLocalCfg(database = 'master') {
  return { ...MSSQL_LOCAL_STATIC, database, options: { ...MSSQL_LOCAL_STATIC.options, database } };
}

async function hasManagerDb() {
  let pool;
  try {
    pool = await sql.connect(mssqlLocalCfg('master'));
    const rs = await pool.request().query(`SELECT CASE WHEN DB_ID('manager') IS NULL THEN 0 ELSE 1 END AS ok;`);
    return !!(rs?.recordset?.[0]?.ok);
  } finally { try { await pool?.close(); } catch {} }
}

async function getEmpresasHabilitadas() {
  let pool;
  try {
    pool = await sql.connect(mssqlLocalCfg('manager'));
    const rs = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(emp_codigo)) AS Codigo,
        LTRIM(RTRIM(emp_razsoc)) AS RazonSocial,
        LTRIM(RTRIM(emp_cuit))   AS Cuit
      FROM dbo.emp WITH (NOLOCK)
      WHERE emp_habili = 1
        AND emp_codigo IS NOT NULL
        AND LTRIM(RTRIM(emp_codigo)) <> ''
      ORDER BY emp_codigo;
    `);
    return rs.recordset || [];
  } finally { try { await pool?.close(); } catch {} }
}

// ====== MySQL nube (Empresas por cliente) ======
async function getEmpresasNubeByCliente(idCliente) {
  const cfg = getDbConfig();
  const pool = await mysql.createPool({
    host: cfg.server, port: cfg.port, user: cfg.user, password: cfg.password,
    database: cfg.database, waitForConnections: true, connectionLimit: 10, queueLimit: 0
  });
  try {
    const [rows] = await pool.execute(
      `SELECT Nombre, InstanciaBD, RazonSocial FROM Empresa WHERE IdCliente = ?`,
      [idCliente]
    );
    return rows || [];
  } finally { await pool.end(); }
}

// ====== Escribimos userDbConfig.properties ======
async function writeUserDbConfigProperties(dbName) {
  const content =
`DB_USER=${MSSQL_LOCAL_STATIC.user}
DB_PASSWORD=${MSSQL_LOCAL_STATIC.password}
DB_SERVER=${MSSQL_LOCAL_STATIC.server}
DB_PORT=${MSSQL_LOCAL_STATIC.port}
DB_DATABASE=${dbName}
`;
  const dir = path.join(__dirname, '..', 'fileConfigUpdater');
  const filePath = path.join(dir, 'userDbConfig.properties');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

// ====== Verificar habilitación y guardar ======
function norm(s) { return String(s ?? '').trim().toLowerCase(); }

async function verifyEmpresaHabilitadaYGuardar(idCliente, empCodigo) {
  if (!idCliente || !empCodigo) {
    return { success: false, message: 'Faltan parámetros (idCliente/empCodigo).' };
  }

  const empresas = await getEmpresasNubeByCliente(idCliente);
  const match = empresas.find(r => norm(r.Nombre) === norm(empCodigo));
  if (!match) {
    return { success: false, code: 'NOT_ENABLED', message: 'El usuario no esta habilitado para operar esa empresa' };
  }

  const filePath = await writeUserDbConfigProperties(match.InstanciaBD);
  return {
    success: true,
    data: {
      nombre: match.Nombre,
      instanciaBD: match.InstanciaBD,
      razonSocial: match.RazonSocial,
      propertiesPath: filePath
    }
  };
}

module.exports = {
  hasManagerDb,
  getEmpresasHabilitadas,
  getEmpresasNubeByCliente,
  verifyEmpresaHabilitadaYGuardar,
};
