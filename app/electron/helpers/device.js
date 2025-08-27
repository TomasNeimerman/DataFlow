// electron/helpers/device.js
const os = require('os');

/** Devuelve un ID de dispositivo basado en el nombre de la máquina */
function getDeviceId(/* store no se usa más */) {
  let name =
    (typeof os.hostname === 'function' ? os.hostname() : '') ||
    process.env.COMPUTERNAME ||
    process.env.HOSTNAME ||
    'UNKNOWN_HOST';

  name = String(name).trim();
  // Normalización: MAYÚSCULAS, reemplaza caracteres raros por "_"
  name = name.replace(/[^\w.\-]/g, '_').toUpperCase();

  // Por seguridad de longitud (evitar overflow en la DB)
  if (name.length > 100) name = name.slice(0, 100);

  return name;
}

/** Vincula la instalación a un único usuario (igual que antes) */
function bindUserLocally(store, usuario) {
  const boundUser = store && store.get && store.get('boundUser');
  if (!boundUser) {
    try { store?.set?.('boundUser', usuario); } catch {}
    return { ok: true };
  }
  if (boundUser !== usuario) {
    return {
      ok: false,
      message: `Esta instalación ya está vinculada al usuario "${boundUser}". Pedí al admin un reseteo si querés cambiar.`
    };
  }
  return { ok: true };
}

module.exports = { getDeviceId, bindUserLocally };
