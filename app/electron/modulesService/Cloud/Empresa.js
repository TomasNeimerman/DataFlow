// electron/modulesService/Cloud/Empresa.js
// ✅ Usa userDbConfig como única fuente (server/user/pass/port fijos), y solo cambia DB_DATABASE.
// ✅ No duplica plantillas ni rutas: escribe siempre en userData via writeAdminDbConfig({ database }).

const sql = require('mssql');
const mysql = require('mysql2/promise');
const { withAdminPool } = require('./adminPool');
const { getAdminDbConfig, writeAdminDbConfig } = require('../../userDbConfig.js'); // MSSQL local (solo DB cambia)

function norm(s) {
  return String(s ?? '').trim().toLowerCase();
}

function mssqlCfg(database) {
  const base = getAdminDbConfig();
  return {
    ...base,
    database,
    options: { ...(base.options || {}), database },
  };
}

/**
 * ¿Existe la BD local "manager"?
 */
async function hasManagerDb() {
  let pool;
  try {
    pool = await sql.connect(mssqlCfg('master'));
    const rs = await pool.request().query(
      `SELECT CASE WHEN DB_ID('manager') IS NULL THEN 0 ELSE 1 END AS ok;`
    );
    return !!(rs?.recordset?.[0]?.ok);
  } finally {
    try { await pool?.close(); } catch {}
  }
}

/**
 * Empresas habilitadas en manager.dbo.emp
 * SELECT emp_codigo, emp_razsoc, emp_cuit WHERE emp_habili=1
 */
async function getEmpresasHabilitadas() {
  let pool;
  try {
    pool = await sql.connect(mssqlCfg('manager'));
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
  } finally {
    try { await pool?.close(); } catch {}
  }
}

/**
 * Empresas de la nube por cliente
 * SELECT Nombre, InstanciaBD, RazonSocial FROM Empresas WHERE IdCliente = ?
 */
async function getEmpresasNubeByCliente(idCliente) {
  if (!idCliente) return [];
  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT
         Nombre,
         InstanciaBD,
         RazonSocial
       FROM Empresa
       WHERE IdCliente = ?`,
      [idCliente]
    );
    return rows || [];
  });
}


/**
 * Verifica que el usuario tenga habilitada la empresa (Nombre == emp_codigo).
 * Si matchea, escribe userDbConfig.properties con SOLO DB_DATABASE = InstanciaBD.
 */
async function verifyEmpresaHabilitadaYGuardar(idCliente, empCodigo) {
  if (!idCliente || !empCodigo) {
    return { success: false, message: 'Faltan parámetros (idCliente/empCodigo).' };
  }

  // 1) Buscar en la nube si el usuario tiene esa empresa
  const empresas = await getEmpresasNubeByCliente(idCliente);
  const match = empresas.find((r) => norm(r.Nombre) === norm(empCodigo));

  if (!match) {
    return {
      success: false,
      code: 'NOT_ENABLED',
      message: 'El usuario no esta habilitado para operar esa empresa',
    };
  }

  // 2) Persistir SOLO la DB en el properties (server/user/pass/port son fijos en userDbConfig)
  const propertiesPath = writeAdminDbConfig({ database: match.InstanciaBD });

  // 3) (Opcional) Confirmar qué DB quedó activa
  const effective = getAdminDbConfig();
  const effectiveDb = effective?.database;

  return {
    success: true,
    data: {
      nombre: match.Nombre,
      instanciaBD: match.InstanciaBD,
      razonSocial: match.RazonSocial,
      propertiesPath,
      effectiveDatabase: effectiveDb,
    },
  };
}

module.exports = {
  hasManagerDb,
  getEmpresasHabilitadas,
  getEmpresasNubeByCliente,
  verifyEmpresaHabilitadaYGuardar,
};
