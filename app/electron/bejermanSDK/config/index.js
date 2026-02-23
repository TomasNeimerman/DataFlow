/**
 * Configuración del SDK de Bejerman
 *
 * Configuración hardcodeada según preferencias del usuario.
 * URL y credenciales fijas ya que DataFlow y SDK corren en el mismo servidor.
 */

module.exports = {
  // URL del Web Service SOAP de Bejerman
  SDK_URL: 'http://localhost/Bejerman-SDK-WS/EFlexSDK_Service.svc',

  // Credenciales de autenticación
  SDK_USER: 'ADMIN',
  SDK_PASSWORD: 'sb',  // TODO: Configurar según entorno

  // Empresa en Bejerman
  SDK_EMPRESA: 'MODE',

  // Punto de trabajo y sucursal (opcionales para autenticación)
  SDK_PTO_TRABAJO: '1',
  SDK_SUCURSAL: '',

  // Timeouts y reintentos
  SDK_TIMEOUT: 120000,       // 120 segundos (2 minutos) - Bejerman puede tardar en procesar
  SDK_TOKEN_TTL: 3600000,    // 1 hora (tiempo de vida del token en cache)
  SDK_MAX_RETRIES: 3,        // Número máximo de reintentos
  SDK_RETRY_DELAY: 1000,     // Delay base para backoff (1 segundo)

  // Parámetros por defecto para operaciones
  DEFAULT_NUMERA_FLEX: 'S',  // S = autonumera (ERP asigna número), N = número manual
  DEFAULT_EMITE_REG: 'E',    // Emitido (inserción directa al ERP)

  // Configuración de logs
  LOG_ENABLED: true,         // Habilitar logging
  LOG_REQUESTS: true,        // Log de requests SOAP (verbose)
  LOG_RESPONSES: true,       // Log de responses SOAP (verbose)
};
