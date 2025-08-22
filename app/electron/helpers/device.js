// electron/helpers/device.js
const os = require('os');
const crypto = require('crypto');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function computeDeviceId() {
  try {
    const ifaces = os.networkInterfaces();
    const macs = Object.values(ifaces)
      .flat()
      .filter(Boolean)
      .map(n => n.mac)
      .filter(m => m && m !== '00:00:00:00:00:00');
    const raw = [os.hostname(), os.platform(), os.arch(), macs.sort().join('|')].join('#');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  } catch {
    return null;
  }
}

// Usa SIEMPRE el mismo store que te pasan (no instancies otro).
function getDeviceId(store) {
  let id = store && store.get('deviceId');
  if (!id) {
    id = computeDeviceId() || uuidv4();
    if (store) store.set('deviceId', id);
  }
  return id;
}

module.exports = { uuidv4, computeDeviceId, getDeviceId };
