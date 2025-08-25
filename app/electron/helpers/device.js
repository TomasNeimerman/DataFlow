// electron/helpers/device.js
const os = require('os');
const crypto = require('crypto');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function computeDeviceId() {
  try {
    const ifaces = os.networkInterfaces();
    const macs = Object.keys(ifaces)
      .map(k => ifaces[k])
      .reduce((acc, arr) => acc.concat(arr || []), [])
      .filter(Boolean)
      .map(n => n.mac)
      .filter(m => m && m !== '00:00:00:00:00:00');
    const raw = [os.hostname(), os.platform(), os.arch(), macs.sort().join('|')].join('#');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  } catch {
    return null;
  }
}

/** Obtiene (y persiste si no existe) el deviceId en electron-store */
function getDeviceId(store) {
  let id = store?.get?.('deviceId');
  if (!id) {
    id = computeDeviceId() || uuidv4();
    try { store?.set?.('deviceId', id); } catch {}
  }
  return id;
}

/** Vincula esta instalación a un solo usuario */
function bindUserLocally(store, usuario) {
  const boundUser = store?.get?.('boundUser');
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

module.exports = {
  getDeviceId,
  bindUserLocally,
};
