// electron/helpers/device.js
const os = require('os');

/** Devuelve un ID de dispositivo basado en el nombre de la máquina (hostname) */
function getDeviceId() {
  let name =
    (typeof os.hostname === 'function' ? os.hostname() : '') ||
    process.env.COMPUTERNAME ||
    process.env.HOSTNAME ||
    'UNKNOWN_HOST';

  name = String(name).trim().replace(/[^\w.\-]/g, '_').toUpperCase();
  if (name.length > 100) name = name.slice(0, 100);
  return name;
}

module.exports = { getDeviceId };
