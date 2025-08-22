// electron/helpers/sessionHeartbeat.js
let sessionHeartbeatTimer = null;

function startSessionHeartbeat({ usuario, deviceId, onTick }) {
  stopSessionHeartbeat();
  sessionHeartbeatTimer = setInterval(async () => {
    try {
      await onTick?.({ usuario, deviceId });
    } catch (_) {
      // silenciar errores de latido
    }
  }, 30_000);
}

function stopSessionHeartbeat() {
  if (sessionHeartbeatTimer) {
    clearInterval(sessionHeartbeatTimer);
    sessionHeartbeatTimer = null;
  }
}

module.exports = { startSessionHeartbeat, stopSessionHeartbeat };
