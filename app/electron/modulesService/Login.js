// electron/modulesService/Login.js
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { generarToken } = require('../jwtService');

/*==============================================================================
// Helpers de conexión a la DB “admin”
==============================================================================*/
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

/*==============================================================================
// Config de conexión por empresa (para módulos)
==============================================================================*/
async function obtenerConfiguracionEmpresa(idCliente) {
  let poolAdmin;
  try {
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
    poolAdmin = await mysql.createPool(mysqlConfigAdmin);

    const [rows] = await poolAdmin.execute(`
      SELECT Server, Port, InstanciaBD, Usuario, Contraseña
      FROM Empresa
      WHERE IdCliente = ?
    `, [idCliente]);

    if (!rows.length) return null;

    const empresaData = rows[0];
    const configContent =
`DB_USER=${empresaData.Usuario}
DB_PASSWORD=${empresaData.Contraseña}
DB_SERVER=${empresaData.Server}
DB_PORT=${empresaData.Port || 3306}
DB_DATABASE=${empresaData.InstanciaBD}
`;
    const configPath = path.join(__dirname, '../../fileConfigUpdater/userDbConfig.properties');
    try { await fs.writeFile(configPath, configContent, 'utf-8'); } catch {}

    return {
      server: empresaData.Server,
      port: empresaData.Port ? parseInt(empresaData.Port, 10) : 3306,
      database: empresaData.InstanciaBD,
      user: empresaData.Usuario,
      password: empresaData.Contraseña,
    };
  } catch (error) {
    console.error('Error al obtener configuración de la empresa:', error);
    return null;
  } finally {
    if (poolAdmin) try { await poolAdmin.end(); } catch {}
  }
}

/*==============================================================================
// Login (revisa expiración/estado; no toca SesionesActivas acá)
==============================================================================*/
function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function iniciarSesion({ usuario, contraseña /*, deviceId*/ }) {
  return withAdminPool(async (poolAdmin) => {
    const [usrRows] = await poolAdmin.execute(`
      SELECT Id, Nombre, Apellido, Email, IdCliente, Usuario, Contraseña,
             FechaExpiracionClave, COALESCE(Estado, 1) AS Estado
      FROM Usuarios
      WHERE Usuario = ?
      LIMIT 1
    `, [usuario]);

    if (!usrRows.length) {
      return { success: false, code: 'BAD_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' };
    }

    const row = usrRows[0];

    // Estado (si no es 1, bloquear)
    const estado = Number(row.Estado ?? 1);
    if (estado !== 1) {
      return { success: false, code: 'USER_DISABLED', message: 'Usuario deshabilitado.' };
    }

    // ¿contraseña expirada? -> bloquear sin modificar Estado
    if (row.FechaExpiracionClave) {
      const hoy = new Date();
      const exp = new Date(row.FechaExpiracionClave);
      if (hoy.getTime() > exp.getTime()) {
        return {
          success: false,
          code: 'PASS_EXPIRED',
          message: `Tu contraseña expiró el ${toYMD(exp)}. Contactá al admin.`
        };
      }
    }

    // Password (sin hash en este esquema)
    if (String(row.Contraseña) !== String(contraseña)) {
      return { success: false, code: 'BAD_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' };
    }

    const empresaConfig = await obtenerConfiguracionEmpresa(row.IdCliente);
    if (!empresaConfig) {
      return { success: false, code: 'NO_COMPANY_CONFIG', message: 'No se encontró la configuración de la base de datos para su empresa.' };
    }

    // Fecha último acceso (best-effort, -3h)
    let fechaActual = new Date();
    fechaActual.setHours(fechaActual.getHours() - 3);
    try { await poolAdmin.execute('UPDATE Usuarios SET FechaUltAcceso = ? WHERE Usuario = ?', [fechaActual, usuario]); } catch {}

    const user = {
      Id: row.Id,
      Nombre: row.Nombre,
      Apellido: row.Apellido,
      Email: row.Email,
      IdCliente: row.IdCliente,
      Usuario: row.Usuario,
      FechaExpiracionClave: row.FechaExpiracionClave,
      Estado: estado
    };

    const token = generarToken(user);
    return { success: true, user, token, empresaConfig };
  });
}

/*==============================================================================
// Módulos
==============================================================================*/
async function obtenerModulos(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(`
      SELECT
        m.Id AS ModuloId,
        m.Nombre AS ModuloNombre,
        m.Texto,
        m.Icono,
        m.Link,
        m.PathExcelModelo,
        (SELECT COUNT(*) FROM ModulosXCliente mx2 WHERE mx2.IdModulo = m.Id) AS countClientesPorModulo
      FROM ModulosXCliente mx
      JOIN Modulos m ON mx.IdModulo = m.Id
      WHERE mx.IdCliente = ?
    `, [idCliente]);

    const modulos = rows.map(m => ({
      id: m.ModuloId,
      nombre: m.ModuloNombre,
      texto: m.Texto,
      icono: m.Icono,
      link: m.Link,
      pathExcel: m.PathExcelModelo,
      countClientesPorModulo: m.countClientesPorModulo
    }));
    return { success: true, modulos };
  });
}

/*==============================================================================
// SesionesActivas  — Política: sesión única por usuario en un único DeviceId
// Si hay Activa=1 en OTRO device → bloquear login.
// Si no hay activa o es el mismo device → permitir.
// Al registrar, NO se apagan otras filas (no hacemos UPDATE ... Activa=0 <> device).
==============================================================================*/
async function verificarSesionActiva({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT Usuario, DeviceId, Activa
       FROM SesionesActivas
       WHERE Usuario = ? AND Activa = 1
       LIMIT 1`,
      [usuario]
    );

    if (!rows.length) return { success: true, code: 'NO_ACTIVE' };

    const row = rows[0];
    if (String(row.DeviceId) === String(deviceId)) {
      return { success: true, code: 'ACTIVE_SAME_DEVICE', deviceId: row.DeviceId };
    }

    return {
      success: false,
      code: 'ACTIVE_OTHER_DEVICE',
      deviceId: row.DeviceId,
      message: `Usuario activo. Intente en el dispositivo que está en uso${row.DeviceId ? ` ("${row.DeviceId}")` : ''}.`
    };
  });
}

async function registrarSesionActiva({ usuario, deviceId, token, storeBlob }) {
  return withAdminPool(async (pool) => {
    // ⛔️ No desactivar otros devices aquí.
    const [ex] = await pool.execute(
      `SELECT 1 FROM SesionesActivas WHERE Usuario = ? AND DeviceId = ? LIMIT 1`,
      [usuario, deviceId]
    );

    if (ex.length) {
      await pool.execute(
        `UPDATE SesionesActivas
           SET Token = ?, StoreData = ?, LastSeen = NOW(), Activa = 1
         WHERE Usuario = ? AND DeviceId = ?`,
        [token || null, storeBlob || null, usuario, deviceId]
      );
    } else {
      await pool.execute(
        `INSERT INTO SesionesActivas (Usuario, DeviceId, Token, StoreData, LastSeen, Activa)
         VALUES (?, ?, ?, ?, NOW(), 1)`,
        [usuario, deviceId, token || null, storeBlob || null]
      );
    }

    return { success: true };
  });
}

async function obtenerSesionPorDevice({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(
      `SELECT Usuario, DeviceId, Token, StoreData, LastSeen, Activa
       FROM SesionesActivas
       WHERE Usuario = ? AND DeviceId = ?
       LIMIT 1`,
      [usuario, deviceId]
    );
    if (!rows.length) return { success: false, code: 'NOT_FOUND' };
    return { success: true, row: rows[0] };
  });
}

async function heartbeatSesionActiva({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    await pool.execute(
      `UPDATE SesionesActivas
         SET LastSeen = NOW()
       WHERE Usuario = ? AND DeviceId = ? AND Activa = 1`,
      [usuario, deviceId]
    );
    return { success: true };
  });
}

async function finalizarSesionActiva({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    await pool.execute(
      `UPDATE SesionesActivas SET Activa = 0, LastSeen = NOW()
       WHERE Usuario = ? AND DeviceId = ?`,
      [usuario, deviceId]
    );
    return { success: true };
  });
}

async function deshabilitarUsuario(usuario) {
  return withAdminPool(async (pool) => {
    await pool.execute('UPDATE Usuarios SET Estado = 0 WHERE Usuario = ?', [usuario]);
    return { success: true };
  });
}

function decodeStoreBlob(storeBlob) {
  if (!storeBlob) return null;
  try {
    const json = Buffer.from(String(storeBlob), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

module.exports = {
  iniciarSesion,
  obtenerModulos,
  verificarSesionActiva,
  registrarSesionActiva,
  obtenerSesionPorDevice,
  heartbeatSesionActiva,
  finalizarSesionActiva,
  deshabilitarUsuario,
  decodeStoreBlob
};
