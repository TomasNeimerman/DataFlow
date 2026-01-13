/**
 * Cliente SOAP genérico para comunicación con el SDK de Bejerman
 */

const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config');
const { escapeXml } = require('./xmlParser');
const { retryWithBackoff } = require('../utils/retry');

/**
 * Ejecuta una operación en el SDK de Bejerman
 * @param {string} circuito - Circuito del SDK (FINANZAS, VENTAS, COMPRAS, etc.)
 * @param {string} operacion - Operación a ejecutar
 * @param {Object} parametros - Parámetros de la operación
 * @returns {Promise<string>} - Resultado de la operación ("OK" o errores)
 */
async function ejecutar(circuito, operacion, parametros) {
  const soapRequest = buildSOAPRequest(circuito, operacion, parametros);

  if (config.LOG_ENABLED && config.LOG_REQUESTS) {
    console.log('[soapClient] Request:', soapRequest);
  }

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
 * Construye el request SOAP XML para EFlexSDK_WSEjecutar
 * @param {string} circuito - Circuito del SDK
 * @param {string} operacion - Operación a ejecutar
 * @param {Object} parametros - Parámetros de la operación
 * @returns {string} - XML SOAP request
 */
function buildSOAPRequest(circuito, operacion, parametros) {
  // Construir elementos de parámetros
  const paramsXML = Object.entries(parametros)
    .map(([key, value]) => {
      const escapedValue = escapeXml(String(value));
      return `            <tem:${key}>${escapedValue}</tem:${key}>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:EFlexSDK_WSEjecutar>
         <tem:Circuito>${escapeXml(circuito)}</tem:Circuito>
         <tem:Operacion>${escapeXml(operacion)}</tem:Operacion>
         <tem:Parametros>
${paramsXML}
         </tem:Parametros>
      </tem:EFlexSDK_WSEjecutar>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Realiza la llamada HTTP SOAP al Web Service
 * @param {string} soapRequest - XML SOAP request
 * @param {number} timeout - Timeout en milisegundos
 * @returns {Promise<string>} - Resultado parseado
 */
async function callSOAP(soapRequest, timeout = 30000) {
  try {
    const response = await axios.post(config.SDK_URL, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/EFlexSDK_WSEjecutar',
      },
      timeout,
    });

    // Parsear respuesta XML
    return await parseResponse(response.data);
  } catch (error) {
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
 * @returns {Promise<string>} - Resultado extraído
 */
async function parseResponse(xmlData) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);

    // Navegar por la estructura SOAP para encontrar el resultado
    const envelope = result['s:Envelope'] || result['soap:Envelope'] || result['soapenv:Envelope'];
    if (!envelope) {
      throw new Error('Respuesta SOAP inválida: no se encontró Envelope');
    }

    const body = envelope['s:Body'] || envelope['soap:Body'] || envelope['soapenv:Body'];
    if (!body) {
      throw new Error('Respuesta SOAP inválida: no se encontró Body');
    }

    const executeResponse = body['EFlexSDK_WSEjecutarResponse'];
    if (!executeResponse) {
      throw new Error('Respuesta SOAP inválida: no se encontró EFlexSDK_WSEjecutarResponse');
    }

    const resultado = executeResponse['EFlexSDK_WSEjecutarResult'];
    if (resultado === undefined || resultado === null) {
      throw new Error('Respuesta SOAP inválida: no se encontró EFlexSDK_WSEjecutarResult');
    }

    return resultado.toString();
  } catch (error) {
    if (error.message.includes('Respuesta SOAP inválida')) {
      throw error;
    }
    throw new Error(`Error parseando respuesta SOAP: ${error.message}`);
  }
}

module.exports = {
  ejecutar,
  callSOAP,
  buildSOAPRequest,
  parseResponse,
};
