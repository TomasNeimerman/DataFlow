/**
 * Configuración del SDK de Bejerman
 *
 * SDK_WRAPPER_PATH debe apuntar al SDKWrapper.exe que se encuentra
 * junto a las DLLs del SDK de Bejerman en cada servidor.
 */

module.exports = {
  // Ruta al SDKWrapper.exe (junto a las DLLs del SDK)
  // Configurar según cada servidor donde estén instaladas las DLLs
  SDK_WRAPPER_PATH: 'C:\\Bejerman\\Instalación\\Tester\\SDKWrapper.exe',

  // Credenciales de autenticación
  SDK_USER: 'ADMIN',
  SDK_PASSWORD: 'sb',

  // Empresa en Bejerman
  SDK_EMPRESA: 'MODE',

  // Punto de trabajo
  SDK_PTO_TRABAJO: '1',

  // Timeout para ejecución del wrapper (ms)
  SDK_TIMEOUT: 120000,       // 120 segundos

  // Parámetros por defecto para operaciones
  DEFAULT_NUMERA_FLEX: 'S',  // S = autonumera (ERP asigna número), N = número manual
  DEFAULT_EMITE_REG: 'E',    // E = emitido (inserción directa al ERP), R = registrado

  // Configuración de logs
  LOG_ENABLED: true,
};
