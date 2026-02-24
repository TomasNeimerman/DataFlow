/**
 * Cliente SOAP genérico para comunicación con el SDK de Bejerman
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
const xml2js = require('xml2js');
const config = require('../config');
const { escapeXml } = require('./xmlParser');
const { retryWithBackoff } = require('../utils/retry');

// Configurar agentes HTTP sin keep-alive para evitar timeouts
const httpAgent = new http.Agent({
  keepAlive: false,
  maxSockets: 5
});
const httpsAgent = new https.Agent({
  keepAlive: false,
  maxSockets: 5,
  rejectUnauthorized: false
});

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

/**
 * Ejecuta una operación en el SDK de Bejerman CON reintentos
 * @param {string} circuito - Circuito del SDK (FINANZAS, VENTAS, COMPRAS, etc.)
 * @param {string} operacion - Operación a ejecutar
 * @param {Object} parametros - Parámetros de la operación
 * @returns {Promise<string>} - Resultado de la operación ("OK" o errores)
 */
async function ejecutar(circuito, operacion, parametros) {
  const soapRequest = buildSOAPRequest(circuito, operacion, parametros);

  // Log del request SOAP
  logToFile(`[soapClient] SOAP Request para ${circuito}/${operacion}:\n${soapRequest}`);

  // Ejecutar con estrategia de reintentos
  const result = await retryWithBackoff(
    async () => await callSOAP(soapRequest, config.SDK_TIMEOUT),
    config.SDK_MAX_RETRIES,
    config.SDK_RETRY_DELAY
  );

  if (config.LOG_ENABLED && config.LOG_RESPONSES) {
    console.log('[soapClient] Response:', result);
  }

  return result;
}

/**
 * Ejecuta una operación en el SDK de Bejerman SIN reintentos
 * Usar para operaciones no-idempotentes (ingresos, altas) que pueden causar duplicación
 * @param {string} circuito - Circuito del SDK
 * @param {string} operacion - Operación a ejecutar
 * @param {Object} parametros - Parámetros de la operación
 * @returns {Promise<string>} - Resultado de la operación ("OK" o errores)
 */
async function ejecutarSinReintentos(circuito, operacion, parametros) {
  const soapRequest = buildSOAPRequest(circuito, operacion, parametros);

  // Log del request SOAP
  logToFile(`[soapClient] SOAP Request (SIN REINTENTOS) para ${circuito}/${operacion}:\n${soapRequest}`);

  // Ejecutar DIRECTAMENTE sin reintentos
  const result = await callSOAP(soapRequest, config.SDK_TIMEOUT);

  if (config.LOG_ENABLED && config.LOG_RESPONSES) {
    console.log('[soapClient] Response:', result);
  }

  return result;
}

/**
 * Cierra un proceso del SDK de Bejerman
 * Debe llamarse después de EFlexSDK_WSEjecutar para completar la operación
 * @param {string} circuito - Circuito del SDK
 * @param {string} operacion - Operación ejecutada
 * @param {string} token - Token de autenticación
 * @returns {Promise<string>} - Resultado ("OK" o errores)
 */
async function cierreProceso(circuito, operacion, token) {
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:loc="http://localhost:57213/"
                  xmlns:sb="http://schemas.datacontract.org/2004/07/SB.NET.eFlex.SDKWS"
                  xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Header/>
   <soapenv:Body>
      <loc:EFlexSDK_WSCierreProceso>
         <loc:xRequest>
            <sb:Circuito>${escapeXml(circuito)}</sb:Circuito>
            <sb:Operacion>${escapeXml(operacion)}</sb:Operacion>
            <sb:Parametros i:nil="true"/>
            <sb:ParametrosJson i:nil="true"/>
            <sb:Token>${escapeXml(token)}</sb:Token>
         </loc:xRequest>
      </loc:EFlexSDK_WSCierreProceso>
   </soapenv:Body>
</soapenv:Envelope>`;

  logToFile(`[soapClient] SOAP CierreProceso para ${circuito}/${operacion}:\n${soapRequest}`);

  // CRÍTICO: El cierre es idempotente y debe usar reintentos + timeout extendido
  const result = await retryWithBackoff(
    async () => await callSOAP(soapRequest, config.SDK_TIMEOUT),
    config.SDK_MAX_RETRIES,
    config.SDK_RETRY_DELAY
  );

  if (config.LOG_ENABLED && config.LOG_RESPONSES) {
    console.log('[soapClient] CierreProceso Response:', result);
  }

  logToFile(`[soapClient] CierreProceso resultado: ${result}`);

  return result;
}

/**
 * Construye el request SOAP XML para EFlexSDK_WSEjecutar
 * @param {string} circuito - Circuito del SDK
 * @param {string} operacion - Operación a ejecutar
 * @param {Object} parametros - Parámetros de la operación (incluye Token)
 * @returns {string} - XML SOAP request
 */
function buildSOAPRequest(circuito, operacion, parametros) {
  // Extraer token de los parámetros
  const token = parametros.Token || '';

  // Extraer parámetros específicos para el array
  // IMPORTANTE: xComprobante debe ser el OBJETO, no un string
  const comprobanteObj = parametros.xComprobante || {};
  const xNumeraFlex = parametros.xNumeraFlex || 'N';
  const xEmiteReg = parametros.xEmiteReg || 'R';

  // FORMATO CORRECTO según documentación SDK:
  // ParametrosJson debe ser: ["[{objeto}]", "N", "E"]
  // El primer parámetro es un STRING que contiene un ARRAY JSON con el objeto
//  const arrayConObjeto = [comprobanteObj];
//  const primerParametro = JSON.stringify(arrayConObjeto);
  const primerParametro = JSON.stringify(comprobanteObj);
  
  const parametrosArray = [primerParametro, xNumeraFlex, xEmiteReg];
  const parametrosJson = JSON.stringify(parametrosArray);

  // El resultado será: ["[{...}]","N","E"]

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:loc="http://localhost:57213/"
                  xmlns:sb="http://schemas.datacontract.org/2004/07/SB.NET.eFlex.SDKWS"
                  xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
   <soapenv:Header/>
   <soapenv:Body>
      <loc:EFlexSDK_WSEjecutar>
         <loc:xRequest>
            <sb:Circuito>${escapeXml(circuito)}</sb:Circuito>
            <sb:Operacion>${escapeXml(operacion)}</sb:Operacion>
            <sb:Parametros>
               <arr:anyType/>
            </sb:Parametros>
            <sb:ParametrosJson>${parametrosJson}</sb:ParametrosJson>
            <sb:Token>${escapeXml(token)}</sb:Token>
         </loc:xRequest>
      </loc:EFlexSDK_WSEjecutar>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Realiza la llamada HTTP SOAP al Web Service
 * @param {string} soapRequest - XML SOAP request
 * @param {number} timeout - Timeout en milisegundos
 * @param {string} soapAction - SOAPAction header (opcional, se detecta automáticamente)
 * @returns {Promise<string>} - Resultado parseado
 */
async function callSOAP(soapRequest, timeout = 30000, soapAction = null) {
  try {
    logToFile(`[soapClient] Enviando request a ${config.SDK_URL}`);

    // Detectar automáticamente el método SOAP del request si no se provee soapAction
    // Usar el namespace exacto del WSDL de Bejerman SDK
    if (!soapAction) {
      if (soapRequest.includes('EFlexSDK_WSRegistro')) {
        soapAction = 'http://localhost:57213/IEFlexSDK_Service/EFlexSDK_WSRegistro';
      } else if (soapRequest.includes('EFlexSDK_WSCierreProceso')) {
        soapAction = 'http://localhost:57213/IEFlexSDK_Service/EFlexSDK_WSCierreProceso';
      } else if (soapRequest.includes('EFlexSDK_WSEjecutar')) {
        soapAction = 'http://localhost:57213/IEFlexSDK_Service/EFlexSDK_WSEjecutar';
      } else {
        // Default
        soapAction = 'http://localhost:57213/IEFlexSDK_Service/EFlexSDK_WSEjecutar';
      }
    }

    logToFile(`[soapClient] SOAPAction: ${soapAction}`);

    const response = await axios.post(config.SDK_URL, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      httpAgent,
      httpsAgent,
      timeout,
    });

    // Log de la respuesta cruda
    logToFile(`[soapClient] Response Status: ${response.status}`);
    logToFile(`[soapClient] Response Headers: ${JSON.stringify(response.headers)}`);
    logToFile(`[soapClient] Response Body (raw XML):\n${response.data}`);

    // Parsear respuesta XML
    const parsed = await parseResponse(response.data);
    logToFile(`[soapClient] Response parseado: ${JSON.stringify(parsed)}`);

    return parsed;
  } catch (error) {
    // Log del error completo
    logToFile(`[soapClient] ERROR: ${error.message}`);
    if (error.response) {
      logToFile(`[soapClient] Error Response Status: ${error.response.status}`);
      logToFile(`[soapClient] Error Response Body: ${error.response.data}`);
    }
    if (error.code) {
      logToFile(`[soapClient] Error Code: ${error.code}`);
    }

    // Transformar errores de axios en mensajes más claros
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Timeout al conectar al SDK (${timeout}ms). Verifique que el servidor esté accesible.`);
    }

    if (error.code === 'ECONNREFUSED') {
      throw new Error(`SDK no disponible en ${config.SDK_URL}. Verifique que el servicio esté corriendo.`);
    }

    if (error.code === 'ENOTFOUND') {
      throw new Error(`No se pudo resolver la URL ${config.SDK_URL}. Verifique la configuración.`);
    }

    if (error.response) {
      // El servidor respondió con un status fuera del rango 2xx
      throw new Error(`Error del servidor: ${error.response.status} - ${error.response.statusText}`);
    }

    // Error desconocido
    throw new Error(`Error en llamada SOAP: ${error.message}`);
  }
}

/**
 * Parsea la respuesta XML SOAP
 * @param {string} xmlData - XML de respuesta
 * @returns {Promise<string|Object>} - Resultado extraído
 */
async function parseResponse(xmlData) {
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,  // Capturar atributos XML
      tagNameProcessors: [xml2js.processors.stripPrefix]  // Ignorar prefijos namespace
    });
    const result = await parser.parseStringPromise(xmlData);

    // Navegar por la estructura SOAP para encontrar el resultado (SIN PREFIJOS gracias a stripPrefix)
    const envelope = result['Envelope'];
    if (!envelope) {
      throw new Error('Respuesta SOAP inválida: no se encontró Envelope');
    }

    const body = envelope['Body'];
    if (!body) {
      throw new Error('Respuesta SOAP inválida: no se encontró Body');
    }

    // Soportar múltiples tipos de respuestas del SDK (SIN PREFIJOS gracias a stripPrefix)
    const executeResponse = body['EFlexSDK_WSEjecutarResponse'];
    const cierreResponse = body['EFlexSDK_WSCierreProcesoResponse'];
    const registroResponse = body['EFlexSDK_WSRegistroResponse'];

    let resultado;

    if (executeResponse) {
      resultado = executeResponse['EFlexSDK_WSEjecutarResult'];
    } else if (cierreResponse) {
      resultado = cierreResponse['EFlexSDK_WSCierreProcesoResult'];
    } else if (registroResponse) {
      resultado = registroResponse['EFlexSDK_WSRegistroResult'];
    } else {
      throw new Error('Respuesta SOAP inválida: no se encontró ninguna respuesta válida del SDK');
    }

    if (resultado === undefined || resultado === null) {
      throw new Error('Respuesta SOAP inválida: no se encontró el resultado');
    }

    // Si es un objeto con campos del SDK, extraer el resultado real
    if (typeof resultado === 'object') {
      const sdkResultado = resultado['Resultado'];
      const sdkErrorMsg = resultado['ErrorMsg'];
      const sdkDatosJSON = resultado['DatosJSON'];

      // Si hay error, retornarlo
      if (sdkResultado === 'ERR' && typeof sdkErrorMsg === 'string') {
        return sdkErrorMsg;
      }

      // Si es OK, retornar "OK" o los datos JSON si existen
      if (sdkResultado === 'OK') {
        if (sdkDatosJSON && typeof sdkDatosJSON === 'string') {
          return sdkDatosJSON;
        }
        return 'OK';
      }

      // Retornar el objeto para análisis
      return JSON.stringify(resultado);
    }

    return String(resultado);
  } catch (error) {
    if (error.message.includes('Respuesta SOAP inválida')) {
      throw error;
    }
    throw new Error(`Error parseando respuesta SOAP: ${error.message}`);
  }
}

module.exports = {
  ejecutar,
  ejecutarSinReintentos,
  cierreProceso,
  callSOAP,
  buildSOAPRequest,
  parseResponse,
};
