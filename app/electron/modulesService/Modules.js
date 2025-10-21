const mysql = require('mysql2/promise');

async function withAdminPool(fn) {
  const dbConfigAdmin = require('../dbConfig').getDbConfig();
  const mysqlConfigAdmin = {
    host: dbConfigAdmin.server,
    port: dbConfigAdmin.port || 3306,
    user: dbConfigAdmin.user,
    password: dbConfigAdmin.password,
    database: dbConfigAdmin.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  const pool = await mysql.createPool(mysqlConfigAdmin);
  try { return await fn(pool); } finally { try { await pool.end(); } catch {} }
}

async function obtenerModulos(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(`
      SELECT
        Id AS ModuloId,
        Nombre AS ModuloNombre,
        Texto,
        Icono,
        Link,
        PathExcelModelo,
        Video
      FROM Modulos 
      Where Activa = 1
    `, [idCliente]);

    const modulos = rows.map(m => ({
      id: m.ModuloId,
      nombre: m.ModuloNombre,
      texto: m.Texto,
      icono: m.Icono,
      link: m.Link,
      pathExcel: m.PathExcelModelo,
      video: m.Video
    }));
    return { success: true, modulos };
  });
}

/**
 * Nueva función: trae las referencias de módulos del cliente
 * SELECT * FROM ModulosXCliente WHERE IdCliente = ?
 */
async function obtenerModulosXCliente(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT * FROM ModulosXCliente WHERE IdCliente = ?`,
      [idCliente]
    );

    // opcional: ids habilitados (útil para el front/main)
    const idsHabilitados = rows.map(r => r.IdModulo);

    return { success: true, modulosXCliente: rows, idsHabilitados };
  });
}

module.exports = {
  obtenerModulos,
  obtenerModulosXCliente
};
