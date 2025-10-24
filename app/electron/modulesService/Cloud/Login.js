// electron/modulesService/Login.js
const fs = require('fs').promises;
const path = require('path');
const { withAdminPool } = require('./adminPool');
const { generarToken } = require('../../jwtService');

/*==============================================================================
=            Cache de configuración por empresa (evita I/O en cada login)     =
==============================================================================*/
const empresaCache = new Map();

async function obtenerConfiguracionEmpresa(idCliente) {
  if (!idCliente) return null;
  if (empresaCache.has(idCliente)) return empresaCache.get(idCliente);

  return withAdminPool(async (poolAdmin) => {
    const [rows] = await poolAdmin.execute(
      `SELECT Server, Port, InstanciaBD, Usuario, Contraseña
         FROM Empresa
        WHERE IdCliente = ?
        LIMIT 1`,
      [idCliente]
    );

    if (!rows.length) { empresaCache.set(idCliente, null); return null; }

    const r = rows[0];
    const cfg = {
      server: r.Server,
      port: r.Port ? parseInt(r.Port, 10) : 3306,
      database: r.InstanciaBD,
      user: r.Usuario,
      password: r.Contraseña,
    };
    empresaCache.set(idCliente, cfg);

    // Escribir userDbConfig.properties SOLO si cambió
    try {
      const configPath = path.join(__dirname, '../fileConfigUpdater/userDbConfig.properties');
      const content = `DB_USER=${r.Usuario}
DB_PASSWORD=${r.Contraseña}
DB_SERVER=${r.Server}
DB_PORT=${r.Port || 3306}
DB_DATABASE=${r.InstanciaBD}
`;
      let prev = null;
      try { prev = await fs.readFile(configPath, 'utf8'); } catch {}
      if (prev !== content) {
        await fs.writeFile(configPath, content, 'utf-8');
      }
    } catch {}

    return cfg;
  });
}

/*==============================================================================
=            Login (admin multi-device; no auto-deshabilita por expiración)    =
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
      SELECT Id, IdCliente, Nombre, Apellido, Email, Usuario, Contraseña,
             FechaExpiracionClave, COALESCE(Estado, 1) AS Estado,
             COALESCE(admin, 0) AS AdminFlag
      FROM Usuarios
      WHERE Usuario = ?
      LIMIT 1
    `, [usuario]);

    if (!usrRows.length) {
      return { success: false, code: 'BAD_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' };
    }

    const row = usrRows[0];

    const estado = Number(row.Estado ?? 1);
    if (estado !== 1) {
      return { success: false, code: 'USER_DISABLED', message: 'Usuario deshabilitado.' };
    }

    if (row.FechaExpiracionClave) {
      const now = new Date();
      const exp = new Date(row.FechaExpiracionClave);
      if (now.getTime() > exp.getTime()) {
        return {
          success: false,
          code: 'PASS_EXPIRED',
          message: `Tu contraseña expiró el ${toYMD(exp)}. Contactá al admin.`
        };
      }
    }

    if (String(row.Contraseña) !== String(contraseña)) {
      return { success: false, code: 'BAD_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' };
    }

    const empresaConfig = await obtenerConfiguracionEmpresa(row.IdCliente);
    if (!empresaConfig) {
      return { success: false, code: 'NO_COMPANY_CONFIG', message: 'No se encontró la configuración de la base de datos para su empresa.' };
    }

    // Fecha último acceso (best-effort, -3h)
    try {
      const fechaActual = new Date(); fechaActual.setHours(fechaActual.getHours() - 3);
      await poolAdmin.execute('UPDATE Usuarios SET FechaUltAcceso = ? WHERE Usuario = ?', [fechaActual, usuario]);
    } catch {}

    const isAdmin = Number(row.AdminFlag || 0) === 1;

    const user = {
      Id: row.Id,
      IdCliente: row.IdCliente,
      Nombre: row.Nombre,
      Apellido: row.Apellido,
      Email: row.Email,
      Usuario: row.Usuario,
      FechaExpiracionClave: row.FechaExpiracionClave,
      Estado: estado,
      admin: isAdmin
    };

    const token = generarToken(user);
    return { success: true, user, token, empresaConfig };
  });
}

/*==============================================================================
=            Módulos (fallback; algunos proyectos lo llaman desde aquí)        =
==============================================================================*/
async function obtenerModulos(idCliente) {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  return withAdminPool(async (pool) => {
    const [rows] = await pool.execute(`
      SELECT
        m.Id     AS ModuloId,
        m.Nombre AS ModuloNombre,
        m.Texto,
        m.Icono,
        m.Link,
        m.PathExcelModelo
      FROM ModulosXCliente mx
      JOIN Modulos m ON mx.IdModulo = m.Id
      WHERE mx.IdCliente = ?
      ORDER BY m.Nombre
    `, [idCliente]);

    const modulos = rows.map(m => ({
      id: m.ModuloId,
      nombre: m.ModuloNombre,
      texto: m.Texto,
      icono: m.Icono,
      link: m.Link,
      pathExcel: m.PathExcelModelo,
    }));
    return { success: true, modulos };
  });
}

/*==============================================================================
=            SesionesActivas (lock por usuario+device, admin ignora lock)      =
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
    // Requiere UNIQUE (Usuario, DeviceId)
    await pool.execute(
      `INSERT INTO SesionesActivas (Usuario, DeviceId, Token, StoreData, LastSeen, Activa)
       VALUES (?, ?, ?, ?, NOW(), 1)
       ON DUPLICATE KEY UPDATE
         Token=VALUES(Token),
         StoreData=VALUES(StoreData),
         LastSeen=NOW(),
         Activa=1`,
      [usuario, deviceId, token || null, storeBlob || null]
    );
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
      `UPDATE SesionesActivas
          SET Activa = 0, LastSeen = NOW()
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
  decodeStoreBlob,
  obtenerConfiguracionEmpresa,
};
