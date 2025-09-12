// electron/helpers/autoResume.js
async function tryAutoResume({
  store,
  getDeviceId,
  verificarSesionActiva,
  registrarSesionActiva,
  obtenerModulos,
  buildAppMenu,
  startSessionHeartbeat, // función que recibe { usuario, deviceId }
  writeToLog
}) {
  try {
    const usuario   = store?.get?.('user');
    const idCliente = store?.get?.('idCliente');
    const token     = store?.get?.('jwtToken');
    const deviceId  = getDeviceId?.();

    if (!usuario || !idCliente || !token || !deviceId) {
      return { startPath: '/Login', active: false, modulos: [] };
    }

    // Estado de sesión en DB
    let chk;
    try { chk = await verificarSesionActiva({ usuario, deviceId }); }
    catch (e) {
      writeToLog?.(`[AutoResume] Error verificando sesión: ${e.message}`);
      return { startPath: '/Login', active: false, modulos: [] };
    }

    if (!chk?.success) {
      writeToLog?.(`[AutoResume] verificarSesionActiva -> success=false`);
      return { startPath: '/Login', active: false, modulos: [] };
    }

    if (chk.code === 'ACTIVE_OTHER_DEVICE') {
      writeToLog?.('[AutoResume] Sesión activa en OTRO device. Mostrando Login.');
      return { startPath: '/Login', active: false, modulos: [] };
    }

    // Si NO_ACTIVE, la activamos acá
    if (chk.code === 'NO_ACTIVE') {
      try {
        let storeBlob = null;
        try {
          const snapshot = {
            user: usuario,
            idCliente,
            deviceId,
            jwtToken: token,
            fechaInicio: new Date().toISOString()
          };
          storeBlob = Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64');
        } catch {}
        await registrarSesionActiva({ usuario, deviceId, token, storeBlob });
        writeToLog?.('[AutoResume] No había sesión activa. Registrada en este device.');
      } catch (e) {
        writeToLog?.(`[AutoResume] Error registrando sesión: ${e.message}`);
      }
    }

    // Menú
    let modulos = [];
    try {
      const modulesResult = await obtenerModulos(idCliente);
      if (modulesResult?.success && Array.isArray(modulesResult.modulos)) {
        modulos = modulesResult.modulos.map(m => ({
          id: m.id, nombre: m.nombre, texto: m.texto, icono: m.icono,
          link: m.link, pathExcel: m.pathExcel, countClientesPorModulo: m.countClientesPorModulo
        }));
        buildAppMenu(modulos);
      }
    } catch (e) {
      writeToLog?.(`[AutoResume] Error cargando módulos: ${e.message}`);
    }

    // Heartbeat
    try { startSessionHeartbeat({ usuario, deviceId }); }
    catch (e) { writeToLog?.(`[AutoResume] Error iniciando heartbeat: ${e.message}`); }

    writeToLog?.(`[AutoResume] OK para usuario: ${usuario}`);
    return { startPath: '/Index', active: { usuario, deviceId, token }, modulos };
  } catch (e) {
    writeToLog?.(`[AutoResume] Fatal: ${e.message}`);
    return { startPath: '/Login', active: false, modulos: [] };
  }
}

module.exports = { tryAutoResume };
