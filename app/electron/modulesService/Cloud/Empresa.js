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
 * ✅ MODIFICADO: Empresas habilitadas en manager.dbo.emp
 * Ahora con JOIN a bas tabla para filtrar por ssis_codigo = 'WFLEX'
 * SELECT emp_codigo, emp_razsoc, emp_cuit WHERE emp_habili=1 AND ssis_codigo='WFLEX'
 */
async function getEmpresasHabilitadas() {
  let pool;
  try {
    pool = await sql.connect(mssqlCfg('manager'));
    const rs = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(emp.emp_codigo)) AS Codigo,
        LTRIM(RTRIM(emp.emp_razsoc)) AS RazonSocial,
        LTRIM(RTRIM(emp.emp_cuit))   AS Cuit
      FROM dbo.emp WITH (NOLOCK)
      INNER JOIN dbo.bas WITH (NOLOCK) 
        ON emp.emp_codigo = bas.emp_codigo
          OR emp.emp_codigo = bas.emp_codigo
          OR LTRIM(RTRIM(emp.emp_codigo)) = LTRIM(RTRIM(bas.emp_codigo))
      WHERE emp.emp_habili = 1
        AND bas.ssis_codigo = 'WFLEX'
        AND emp.emp_codigo IS NOT NULL
        AND LTRIM(RTRIM(emp.emp_codigo)) <> ''
      ORDER BY emp.emp_codigo;
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

async function getClientServer(user, pass) {
  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT c.Server FROM Cliente c
      INNER JOIN Usuarios u ON c.Id = u.IdCliente
      WHERE u.Usuario = ? and u.Contraseña = ?`,
      [user, pass]
    );
    return rows?.[0]?.Server;
  });
}

/**
 * Verifica que el usuario tenga habilitada la empresa (Nombre == emp_codigo).
 * Si matchea, escribe userDbConfig.properties con SOLO DB_DATABASE = InstanciaBD.
 */
async function verifyEmpresaHabilitadaYGuardar(idCliente, empCodigo) {
  if (!idCliente || !empCodigo) {
    return { success: false, message: 'Faltan parámetros (idCliente/empCodigo).'};
  }

  // 1) Traer la empresa del listado habilitado
  const habilitadas = await getEmpresasHabilitadas();
  const match = habilitadas.find(e => norm(e.Codigo) === norm(empCodigo));
  if (!match) {
    return { success: false, message: `La empresa '${empCodigo}' no está habilitada o no existe en el sistema.` };
  }

  // 2) Traer la empresa de la nube (para obtener InstanciaBD)
  const nubes = await getEmpresasNubeByCliente(idCliente);
  const nube = nubes.find(e => norm(e.Nombre) === norm(empCodigo));
  if (!nube || !nube.InstanciaBD) {
    return { success: false, message: `No se encontró la instancia de BD para la empresa '${empCodigo}'.` };
  }

  // 3) Escribe en userDbConfig.properties
  await writeAdminDbConfig({ database: nube.InstanciaBD });

  return {
    success: true,
    data: {
      emp_codigo: match.Codigo,
      emp_razsoc: match.RazonSocial,
      emp_cuit: match.Cuit,
      instanciaBD: nube.InstanciaBD,
    },
  };
}

async function verifyEmpresaHabilitada(idCliente, empCodigo) {
  // Vía cloud: get empresa + set InstanciaBD
  const habilitadas = await getEmpresasHabilitadas();
  const match = habilitadas.find(e => norm(e.Codigo) === norm(empCodigo));
  if (!match) return { success: false, message: `Empresa '${empCodigo}' no habilitada.` };

  const nubes = await getEmpresasNubeByCliente(idCliente);
  const nube = nubes.find(e => norm(e.Nombre) === norm(empCodigo));
  if (!nube?.InstanciaBD) return { success: false, message: `InstanciaBD no encontrada.` };

  await writeAdminDbConfig({ database: nube.InstanciaBD });
  return {
    success: true,
    data: {
      emp_codigo: match.Codigo,
      emp_razsoc: match.RazonSocial,
      emp_cuit: match.Cuit,
      instanciaBD: nube.InstanciaBD,
    },
  };
}

module.exports = {
  hasManagerDb,
  getEmpresasHabilitadas,
  getEmpresasNubeByCliente,
  getClientServer,
  verifyEmpresaHabilitada,
  verifyEmpresaHabilitadaYGuardar,
};