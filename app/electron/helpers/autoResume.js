// electron/helpers/autoResume.js
async function tryAutoResume({
  store,
  getDeviceId,
  verificarSesionActiva,
  registrarSesionActiva,
  obtenerModulos,
  buildAppMenu,
  startSessionHeartbeat,
  writeToLog
}) {
  const usuario   = store?.get('user');
  const idCliente = store?.get('idCliente');
  const token     = store?.get('jwtToken');
  const deviceId  = getDeviceId(store);

  if (!usuario || !idCliente || !token || !deviceId) return { startPath: null, active: null };

  const bound = store.get('boundUser');
  if (bound && bound !== usuario) return { startPath: null, active: null };

  try {
    // nunca bloquear por errores de verificación
    let ok = true;
    try {
      const check = await verificarSesionActiva({ usuario, deviceId });
      if (check && check.success === false) ok = false;
    } catch { ok = true; }
    if (!ok) return { startPath: null, active: null };

    try {
      const reg = await registrarSesionActiva({ usuario, deviceId, token });
      if (reg && reg.success === false) return { startPath: null, active: null };
    } catch { /* seguimos igual */ }

    // menú
    const modulesResult = await obtenerModulos(idCliente);
    if (modulesResult?.success) {
      const modulos = modulesResult.modulos.map(m => ({
        id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
        link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
      }));
      buildAppMenu(modulos);
    }

    startSessionHeartbeat({ usuario, deviceId, onTick: async (payload) => {
      try { await require('../modulesService/Login').heartbeatSesionActiva(payload); } catch (_) {}
    }});

    writeToLog?.(`Auto-resume OK para usuario: ${usuario}`);
    return { startPath: '/Index', active: { usuario, deviceId, token } };
  } catch (e) {
    writeToLog?.(`Auto-resume falló: ${e.message}`);
    return { startPath: null, active: null };
  }
}

module.exports = { tryAutoResume };
