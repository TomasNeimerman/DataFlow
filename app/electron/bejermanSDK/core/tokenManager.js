/**
 * Gestor de autenticación y tokens del SDK de Bejerman
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config');
const { escapeXml } = require('./xmlParser');

// Crear directorio de logs si no existe
const LOG_DIR = 'C:/Dataflow';
const LOG_FILE = path.join(LOG_DIR, 'error.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logging directo al archivo
function logToFile(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
}

// Cache de token en memoria
let tokenCache = null;
let tokenExpiry = null;

/**
 * Obtiene un token válido para autenticación
 * Usa cache si el token aún no expiró, sino renueva
 * @returns {Promise<string>} - Token de autenticación
 */
async function getToken() {
  const now = Date.now();

  // Si hay token en cache y no expiró, retornarlo
  if (tokenCache && tokenExpiry && now < tokenExpiry) {
    // Verificar que el token no sea un objeto (error anterior)
    if (typeof tokenCache !== 'string' || tokenCache === '[object Object]') {
      logToFile('[tokenManager] Token cacheado inválido, forzando renovación');
      tokenCache = null;
      tokenExpiry = null;
    } else {
      logToFile(`[tokenManager] Usando token en cache: ${tokenCache.substring(0, 20)}...`);
      return tokenCache;
    }
  }

  // Token expirado o inexistente, renovar
  logToFile('[tokenManager] Token expirado o inexistente, renovando...');

  return await renewToken();
}

/**
 * Renueva el token llamando a EFlexSDK_WSRegistro
 * @returns {Promise<string>} - Nuevo token de autenticación
 */
async function renewToken() {
  try {
    // Validar credenciales configuradas
    if (!config.SDK_USER || !config.SDK_PASSWORD) {
      throw new Error(
        'SDK_USER y SDK_PASSWORD no configurados. ' +
        'Edite app/electron/bejermanSDK/config/index.js'
      );
    }

    // Log de credenciales que se van a enviar
    logToFile(`[tokenManager] Intentando autenticar con:`);
    logToFile(`  - URL: ${config.SDK_URL}`);
    logToFile(`  - Usuario: ${config.SDK_USER}`);
    logToFile(`  - Password: "${config.SDK_PASSWORD}" (largo: ${config.SDK_PASSWORD ? config.SDK_PASSWORD.length : 0})`);
    logToFile(`  - Empresa: ${config.SDK_EMPRESA}`);
    logToFile(`  - PtoTrabajo: ${config.SDK_PTO_TRABAJO}`);
    logToFile(`  - Sucursal: ${config.SDK_SUCURSAL || '(vacío)'}`);

    // Construir request SOAP para autenticación
    const soapRequest = buildAuthRequest(
      config.SDK_USER,
      config.SDK_PASSWORD,
      config.SDK_EMPRESA,
      config.SDK_PTO_TRABAJO,
      config.SDK_SUCURSAL
    );

    // Log del request SOAP completo
    logToFile(`[tokenManager] SOAP Request:\n${soapRequest}`);

    // Llamar al Web Service
    const response = await axios.post(config.SDK_URL, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://localhost:57213/IEFlexSDK_Service/EFlexSDK_WSRegistro',
      },
      timeout: config.SDK_TIMEOUT,
    });

    // Parsear respuesta
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    // Extraer token
    const envelope = result['s:Envelope'] || result['soap:Envelope'] || result['soapenv:Envelope'];
    if (!envelope) throw new Error('Respuesta SOAP inválida: no se encontró Envelope');

    const body = envelope['s:Body'] || envelope['soap:Body'] || envelope['soapenv:Body'];
    if (!body) throw new Error('Respuesta SOAP inválida: no se encontró Body');

    const registroResponse = body['EFlexSDK_WSRegistroResponse'];
    if (!registroResponse) {
      throw new Error('Respuesta SOAP inválida: no se encontró EFlexSDK_WSRegistroResponse');
    }

    const tokenRaw = registroResponse['EFlexSDK_WSRegistroResult'];
    logToFile(`[tokenManager] tokenRaw type=${typeof tokenRaw}, value=${JSON.stringify(tokenRaw)}`);

    // Verificar si la respuesta es un objeto con campos del SDK
    if (tokenRaw && typeof tokenRaw === 'object') {
      // Buscar campos en la respuesta
      const errorMsgRaw = tokenRaw['a:ErrorMsg'] || tokenRaw['ErrorMsg'];
      const resultado = tokenRaw['a:Resultado'] || tokenRaw['Resultado'];
      const tokenValue = tokenRaw['a:Token'] || tokenRaw['Token'];

      // Extraer errorMsg solo si es un string real (no un objeto nil)
      const errorMsg = (typeof errorMsgRaw === 'string') ? errorMsgRaw : null;

      logToFile(`[tokenManager] Resultado: ${resultado}, Token: ${tokenValue ? 'presente' : 'ausente'}, ErrorMsg: ${errorMsg || '(vacío)'}`);

      // Si resultado es OK y hay token, éxito
      if (resultado === 'OK' && tokenValue && typeof tokenValue === 'string') {
        logToFile(`[tokenManager] Token extraído: ${tokenValue.substring(0, 20)}...`);
        tokenCache = tokenValue;
        tokenExpiry = Date.now() + config.SDK_TOKEN_TTL;
        return tokenCache;
      }

      // Si hay error, falló la autenticación
      if (resultado === 'ERR' || errorMsg) {
        const errText = errorMsg || 'Error desconocido';
        logToFile(`[tokenManager] Error de autenticación SDK: ${errText}`);
        throw new Error(`Error de autenticación SDK: ${errText}`);
      }
    }

    // Extraer el string del token (puede venir como string directamente)
    let token;
    if (typeof tokenRaw === 'string') {
      token = tokenRaw;
    } else {
      token = tokenRaw ? String(tokenRaw) : '';
    }

    logToFile(`[tokenManager] token extraído: ${token}`);

    if (!token || token === '' || token.toUpperCase() === 'ERROR') {
      throw new Error(
        `Autenticación fallida. Verifique credenciales en config/index.js. Resultado: ${token || 'vacío'}`
      );
    }

    // Cachear token
    tokenCache = token;
    tokenExpiry = Date.now() + config.SDK_TOKEN_TTL;

    if (config.LOG_ENABLED) {
      const ttlMinutes = Math.floor(config.SDK_TOKEN_TTL / 60000);
      console.log(`[tokenManager] Token renovado exitosamente (válido por ${ttlMinutes} min)`);
    }

    return tokenCache;
  } catch (error) {
    // Limpiar cache en caso de error
    tokenCache = null;
    tokenExpiry = null;

    // Transformar errores de axios
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error('Timeout al autenticar con el SDK. Verifique conectividad.');
    }

    if (error.code === 'ECONNREFUSED') {
      throw new Error(`SDK no disponible en ${config.SDK_URL}. Verifique que el servicio esté corriendo.`);
    }

    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      
      if (config.LOG_ENABLED && config.LOG_RESPONSES) {
        console.error('[tokenManager] Respuesta de error:', error.response.data);
      }
      
      throw new Error(
        `Error del servidor al autenticar (${status} ${statusText}).\n` +
        `Verifique:\n` +
        `- Usuario: ${config.SDK_USER}\n` +
        `- Empresa: ${config.SDK_EMPRESA}\n` +
        `- URL: ${config.SDK_URL}`
      );
    }

    throw error;
  }
}

/**
 * Limpia el cache de token (útil en caso de error de autenticación)
 */
function clearToken() {
  if (config.LOG_ENABLED) {
    console.log('[tokenManager] Limpiando cache de token');
  }
  tokenCache = null;
  tokenExpiry = null;
}

/**
 * Construye el request SOAP para autenticación
 * @param {string} usuario - Usuario de Bejerman
 * @param {string} clave - Contraseña
 * @param {string} empresa - Código de empresa (opcional)
 * @param {string} ptoTrabajo - Punto de trabajo (opcional)
 * @param {string} sucursal - Código de sucursal (opcional)
 * @returns {string} - XML SOAP request
 */
function buildAuthRequest(usuario, clave, empresa = '', ptoTrabajo = '', sucursal = '') {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:loc="http://localhost:57213/">
   <soapenv:Header/>
   <soapenv:Body>
      <loc:EFlexSDK_WSRegistro>
         <loc:xUsuario>${escapeXml(usuario)}</loc:xUsuario>
         <loc:xClave>${escapeXml(clave)}</loc:xClave>
         <loc:xCodEmpresa>${escapeXml(empresa)}</loc:xCodEmpresa>
         <loc:xPtoTrabajo>${escapeXml(ptoTrabajo)}</loc:xPtoTrabajo>
         <loc:xCodSucursal>${escapeXml(sucursal)}</loc:xCodSucursal>
      </loc:EFlexSDK_WSRegistro>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Obtiene información del token en cache (para debugging)
 * @returns {Object} - Información del token
 */
function getTokenInfo() {
  if (!tokenCache) {
    return { cached: false, token: null, expiresIn: null };
  }

  const now = Date.now();
  const expiresInMs = tokenExpiry - now;
  const expiresInMin = Math.floor(expiresInMs / 60000);

  return {
    cached: true,
    token: tokenCache.substring(0, 10) + '...', // Mostrar solo inicio del token
    expiresIn: expiresInMin > 0 ? `${expiresInMin} minutos` : 'Expirado',
    expiresAt: new Date(tokenExpiry).toISOString(),
  };
}

module.exports = {
  getToken,
  renewToken,
  clearToken,
  getTokenInfo,
};
