/**
 * Utilidades para parsear y manipular XML de respuestas SOAP
 */

/**
 * Verifica si el resultado de una operación fue exitoso
 * @param {string} resultado - Resultado retornado por el SDK
 * @returns {boolean} - true si es "OK", false en caso contrario
 */
function isOK(resultado) {
  if (!resultado) return false;
  return resultado.toString().trim().toUpperCase() === 'OK';
}

/**
 * Parsea errores del resultado del SDK
 * @param {string} resultado - Resultado retornado por el SDK (cuando no es "OK")
 * @returns {Array<string>} - Array de mensajes de error
 */
function parseErrors(resultado) {
  if (!resultado) return ['Error desconocido'];

  const resultStr = resultado.toString().trim();

  // Si es "OK", no hay errores
  if (resultStr.toUpperCase() === 'OK') return [];

  // Si contiene saltos de línea, separar por línea
  if (resultStr.includes('\n') || resultStr.includes('\r\n')) {
    return resultStr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // Si contiene punto y coma, separar por ;
  if (resultStr.includes(';')) {
    return resultStr
      .split(';')
      .map((err) => err.trim())
      .filter((err) => err.length > 0);
  }

  // Si es una sola línea, retornarla como único error
  return [resultStr];
}

/**
 * Escapa caracteres especiales para XML
 * @param {string} str - String a escapar
 * @returns {string} - String con caracteres escapados
 */
function escapeXml(str) {
  if (!str) return '';

  return str
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Desescapa caracteres especiales de XML
 * @param {string} str - String a desescapar
 * @returns {string} - String con caracteres desescapados
 */
function unescapeXml(str) {
  if (!str) return '';

  return str
    .toString()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrae el resultado de una respuesta SOAP parseada
 * @param {Object} parsedXml - Objeto XML parseado por xml2js
 * @param {string} operacion - Nombre de la operación ejecutada
 * @returns {string|null} - Resultado extraído o null si no se encuentra
 */
function extractResult(parsedXml, operacion) {
  try {
    const envelope = parsedXml['s:Envelope'] || parsedXml['soap:Envelope'];
    if (!envelope) return null;

    const body = envelope['s:Body'] || envelope['soap:Body'];
    if (!body || !body[0]) return null;

    // Buscar la respuesta de la operación
    const responseKey = `${operacion}Response`;
    const response = body[0][responseKey];
    if (!response || !response[0]) return null;

    // Buscar el resultado
    const resultKey = `${operacion}Result`;
    const result = response[0][resultKey];

    return result || null;
  } catch (error) {
    console.error('[xmlParser] Error extracting result:', error.message);
    return null;
  }
}

module.exports = {
  isOK,
  parseErrors,
  escapeXml,
  unescapeXml,
  extractResult,
};
