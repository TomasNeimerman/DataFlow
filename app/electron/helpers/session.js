let timer = null;

/**
 * heartbeatFn: función async({usuario, deviceId}) que mantiene viva la sesión en backend
 * ctx: { usuario, deviceId }
 */
function startSessionHeartbeat(heartbeatFn, ctx, intervalMs = 30_000) {
  stopSessionHeartbeat();
  timer = setInterval(() => {
    Promise.resolve()
      .then(() => heartbeatFn && heartbeatFn(ctx))
      .catch(() => {}); // silencioso
  }, intervalMs);
}

function stopSessionHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startSessionHeartbeat, stopSessionHeartbeat };
