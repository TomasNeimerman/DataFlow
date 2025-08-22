// electron/modulesService/Login.js
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { generarToken } = require('../jwtService');

const SESSION_TTL_SECONDS = 300; // 5 min

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
  try { return await fn(pool); } finally { await pool.end(); }
}

async function ensureSessionsTable(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS SesionesActivas (
      Usuario    VARCHAR(190) NOT NULL PRIMARY KEY,
      DeviceId   VARCHAR(64)  NOT NULL,
      Token      VARCHAR(255) NULL,
      LastSeen   DATETIME     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/* ========= Config de conexión empresa ========= */
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
    if (poolAdmin) await poolAdmin.end();
  }
}

/* ========= Login con control de expiración ========= */
function toYMD(dateObj) {
  // normaliza a AAAA-MM-DD en local
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function iniciarSesion({ usuario, contraseña }) {
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

    // Traigo el usuario por nombre (para poder chequear expiración/estado)
    const [usrRows] = await poolAdmin.execute(`
      SELECT Id, Nombre, Apellido, Email, IdCliente, Usuario, Contraseña,
             FechaExpiracionClave, Estado
      FROM Usuarios
      WHERE Usuario = ?
      LIMIT 1
    `, [usuario]);

    if (!usrRows.length) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    const row = usrRows[0];

    // 1) ¿Contraseña expirada?
    // La regla: si HOY >= FechaExpiracionClave → expirada
    let expired = false;
    if (row.FechaExpiracionClave) {
      const hoyLocal = new Date(); hoyLocal.setHours(0,0,0,0);
      const exp = new Date(row.FechaExpiracionClave); exp.setHours(0,0,0,0);
      expired = (hoyLocal.getTime() >= exp.getTime());
    }

    if (expired) {
      // Deshabilito la cuenta (Estado = 0) y NO dejo continuar
      await poolAdmin.execute(
        'UPDATE Usuarios SET Estado = 0 WHERE Usuario = ?',
        [usuario]
      );
      const expStr = toYMD(new Date(row.FechaExpiracionClave));
      return { success: false, message: `Tu contraseña expiró el ${expStr}. Contactá al admin para renovarla.` };
    }

    // 2) ¿Usuario habilitado?
    if (row.Estado !== 1) {
      return { success: false, message: 'Usuario deshabilitado. Contactá al admin.' };
    }

    // 3) Password check (sin hash en este esquema)
    if (String(row.Contraseña) !== String(contraseña)) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    const idCliente = row.IdCliente;
    const empresaConfig = await obtenerConfiguracionEmpresa(idCliente);
    if (!empresaConfig) {
      return { success: false, message: 'No se encontró la configuración de la base de datos para su empresa.' };
    }

    // Fecha último acceso (ajuste TZ si lo venías usando)
    let fechaActual = new Date();
    fechaActual.setHours(fechaActual.getHours() - 3);
    await poolAdmin.execute(
      'UPDATE Usuarios SET FechaUltAcceso = ? WHERE Usuario = ?',
      [fechaActual, usuario]
    );

    const user = {
      Id: row.Id,
      Nombre: row.Nombre,
      Apellido: row.Apellido,
      Email: row.Email,
      IdCliente: row.IdCliente,
      Usuario: row.Usuario,
      FechaExpiracionClave: row.FechaExpiracionClave,
      Estado: row.Estado
    };

    const token = generarToken(user);
    return { success: true, user, token, empresaConfig };
  } catch (error) {
    console.error('Error en iniciarSesion:', error);
    return { success: false, message: error.message };
  } finally {
    if (poolAdmin) await poolAdmin.end();
  }
}

/* ========= Módulos ========= */
async function obtenerModulos(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };
  const dbConfigAdmin = require('../dbConfig').getDbConfig();
  if (!dbConfigAdmin) return { success: false, message: 'No se pudo obtener la configuración de la base de datos.' };

  let poolEmpresa;
  try {
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
    poolEmpresa = await mysql.createPool(mysqlConfigAdmin);

    const [rows] = await poolEmpresa.execute(`
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

    const modulos = rows.map(modulo => ({
      id: modulo.ModuloId,
      nombre: modulo.ModuloNombre,
      texto: modulo.Texto,
      icono: modulo.Icono,
      link: modulo.Link,
      pathExcel: modulo.PathExcelModelo,
      countClientesPorModulo: modulo.countClientesPorModulo
    }));
    return { success: true, modulos };
  } catch (error) {
    console.error('Error en obtenerModulos:', error);
    return { success: false, message: 'Error en la base de datos de la empresa.' };
  } finally {
    if (poolEmpresa) await poolEmpresa.end();
  }
}

/* ========= Control de sesión única ========= */
async function verificarSesionActiva({ usuario, deviceId }) {
  try {
    return await withAdminPool(async (pool) => {
      await ensureSessionsTable(pool);
      const [rows] = await pool.execute(
        `SELECT DeviceId, TIMESTAMPDIFF(SECOND, LastSeen, NOW()) AS Age
         FROM SesionesActivas WHERE Usuario = ?`,
        [usuario]
      );
      if (rows.length === 0) return { success: true }; // sin lock
      const { DeviceId, Age } = rows[0];
      const expired = Age > SESSION_TTL_SECONDS;
      if (expired) return { success: true };
      if (DeviceId !== deviceId) {
        return { success: false, message: 'La cuenta ya está en uso en otro equipo.' };
      }
      return { success: true };
    });
  } catch (_) {
    // ante cualquier error de DB, no bloquear
    return { success: true };
  }
}

async function registrarSesionActiva({ usuario, deviceId, token }) {
  return withAdminPool(async (pool) => {
    await ensureSessionsTable(pool);
    const [rows] = await pool.execute(
      `SELECT DeviceId, TIMESTAMPDIFF(SECOND, LastSeen, NOW()) AS Age
       FROM SesionesActivas WHERE Usuario = ?`,
      [usuario]
    );
    if (rows.length) {
      const { DeviceId, Age } = rows[0];
      const expired = Age > SESSION_TTL_SECONDS;
      if (!expired && DeviceId !== deviceId) {
        return { success: false, message: 'Sesión activa en otro equipo.' };
      }
    }
    await pool.execute(
      `INSERT INTO SesionesActivas (Usuario, DeviceId, Token, LastSeen)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE DeviceId = VALUES(DeviceId), Token = VALUES(Token), LastSeen = NOW()`,
      [usuario, deviceId, token || null]
    );
    return { success: true };
  });
}
async function heartbeatSesionActiva({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    await ensureSessionsTable(pool);
    await pool.execute(
      `UPDATE SesionesActivas SET LastSeen = NOW() WHERE Usuario = ? AND DeviceId = ?`,
      [usuario, deviceId]
    );
    return { success: true };
  });
}
async function finalizarSesionActiva({ usuario, deviceId }) {
  return withAdminPool(async (pool) => {
    await ensureSessionsTable(pool);
    await pool.execute(
      `DELETE FROM SesionesActivas WHERE Usuario = ? AND DeviceId = ?`,
      [usuario, deviceId]
    );
    return { success: true };
  });
}

/* ========= Bloqueo explícito por expiración (usado desde main en runtime) ========= */
async function deshabilitarUsuario(usuario) {
  return withAdminPool(async (pool) => {
    await pool.execute('UPDATE Usuarios SET Estado = 0 WHERE Usuario = ?', [usuario]);
    return { success: true };
  });
}

module.exports = {
  iniciarSesion,
  obtenerModulos,
  verificarSesionActiva,
  registrarSesionActiva,
  heartbeatSesionActiva,
  finalizarSesionActiva,
  deshabilitarUsuario
};
