// electron/modulesService/Modules.js
const { withAdminPool } = require('./adminPool');

// Lista de módulos disponibles (catálogo)
async function obtenerModulos() {
  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(`
      SELECT
        Id     AS ModuloId,
        Nombre AS ModuloNombre,
        Texto,
        Icono,
        Link,
        PathExcelModelo,
        Video
      FROM Modulos
      WHERE Activa = 1
      ORDER BY Nombre
    `);

    const modulos = rows.map(m => ({
      id: m.ModuloId,
      nombre: m.ModuloNombre,
      texto: m.Texto,
      icono: m.Icono,
      link: m.Link,
      pathExcel: m.PathExcelModelo,
      video: m.Video,
    }));
    return { success: true, modulos };
  });
}

// Relación módulos habilitados para un cliente
async function obtenerModulosXCliente(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT IdCliente, IdModulo
         FROM ModulosXCliente
        WHERE IdCliente = ?`,
      [idCliente]
    );
    const idsHabilitados = rows.map(r => r.IdModulo);
    return { success: true, modulosXCliente: rows, idsHabilitados };
  });
}

module.exports = { obtenerModulos, obtenerModulosXCliente };
