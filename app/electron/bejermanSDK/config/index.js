/**
 * Configuración del SDK de Bejerman
 *
 * Configuración hardcodeada según preferencias del usuario.
 * URL y credenciales fijas ya que DataFlow y SDK corren en el mismo servidor.
 */

module.exports = {
  // URL del Web Service SOAP de Bejerman
  SDK_URL: 'http://localhost/BejermanSDK/EFlexSDK.asmx',

  // Credenciales de autenticación
  SDK_USER: 'admin',
  SDK_PASSWORD: '',  // TODO: Configurar según entorno

  // Empresa en Bejerman
  SDK_EMPRESA: '',   // TODO: Código de empresa en Bejerman (ej: 'SBDAMODE')

  // Punto de trabajo y sucursal (opcionales para autenticación)
  SDK_PTO_TRABAJO: '',
  SDK_SUCURSAL: '',

  // Timeouts y reintentos
  SDK_TIMEOUT: 30000,        // 30 segundos
  SDK_TOKEN_TTL: 3600000,    // 1 hora (tiempo de vida del token en cache)
  SDK_MAX_RETRIES: 3,        // Número máximo de reintentos
  SDK_RETRY_DELAY: 1000,     // Delay base para backoff (1 segundo)

  // Parámetros por defecto para operaciones
  DEFAULT_NUMERA_FLEX: 'S',  // Bejerman asigna número automáticamente
  DEFAULT_EMITE_REG: 'R',    // Registrado (borrador editable)

  // Configuración de logs
  LOG_ENABLED: true,         // Habilitar logging
  LOG_REQUESTS: false,       // Log de requests SOAP (verbose)
  LOG_RESPONSES: false,      // Log de responses SOAP (verbose)
};
