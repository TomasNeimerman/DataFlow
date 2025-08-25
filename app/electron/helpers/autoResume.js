// electron/helpers/autoResume.js
async function tryAutoResume({
  store,
  getDeviceId,
  verificarSesionActiva,
  registrarSesionActiva,
  obtenerModulos,
  buildAppMenu,
  startSessionHeartbeat, // en main se pasa una función que recibe { usuario, deviceId }
  writeToLog
}) {
  const usuario   = store?.get?.('user');
  const idCliente = store?.get?.('idCliente');
  const token     = store?.get?.('jwtToken');
  const deviceId  = getDeviceId?.(store);

  // Si falta info básica -> ir a Login
  if (!usuario || !idCliente || !token || !deviceId) {
    return { startPath: '/Login', active: false, modulos: [] };
  }

  // Respetar boundUser
  const bound = store?.get?.('boundUser');
  if (bound && bound !== usuario) {
    return { startPath: '/Login', active: false, modulos: [] };
  }

  // 1) Estado de sesión en DB
  let chk;
  try {
    chk = await verificarSesionActiva({ usuario, deviceId });
  } catch (e) {
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

  // 2) Si NO_ACTIVE, activamos acá mismo en este device
  if (chk.code === 'NO_ACTIVE') {
    try {
      // guardamos un snapshot del store en StoreData (base64)
      let storeBlob = null;
      try {
        const snapshot = {
          user: usuario,
          idCliente,
          deviceId,
          jwtToken: token,
          fechaInicio: new Date().toISOString(),
          boundUser: bound || null
        };
        storeBlob = Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64');
      } catch {}

      await registrarSesionActiva({
        usuario,
        deviceId,
        token,
        storeBlob    // 👈 nombre correcto esperado por el servicio
      });
      writeToLog?.('[AutoResume] No había sesión activa. Registrada en este device.');
    } catch (e) {
      writeToLog?.(`[AutoResume] Error registrando sesión: ${e.message}`);
      // No bloqueamos el auto-login por esto
    }
  }
  // Si era ACTIVE_SAME_DEVICE seguimos de largo.

  // 3) Cargar módulos y armar menú
  let modulos = [];
  try {
    const modulesResult = await obtenerModulos(idCliente);
    if (modulesResult?.success && Array.isArray(modulesResult.modulos)) {
      modulos = modulesResult.modulos.map(m => ({
        id: m.id,
        nombre: m.nombre,
        texto: m.texto,
        icono: m.icono,
        link: m.link,
        pathExcel: m.pathExcel,
        countClientesPorModulo: m.countClientesPorModulo
      }));
      buildAppMenu(modulos);
    }
  } catch (e) {
    writeToLog?.(`[AutoResume] Error cargando módulos: ${e.message}`);
  }

  // 4) Heartbeat (usa la firma que pasás desde main)
  try {
    startSessionHeartbeat({ usuario, deviceId }); // 👈 tu main espera solo el payload
  } catch (e) {
    writeToLog?.(`[AutoResume] Error iniciando heartbeat: ${e.message}`);
  }

  writeToLog?.(`[AutoResume] OK para usuario: ${usuario}`);
  return { startPath: '/Index', active: { usuario, deviceId, token }, modulos };
}

module.exports = { tryAutoResume };
