/**
 * Servicio de Ventas - Circuito VENTAS del SDK de Bejerman
 * Operaciones relacionadas con recibos (RC)
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const soapClient = require('../core/soapClient');
const tokenManager = require('../core/tokenManager');
const { isOK, parseErrors } = require('../core/xmlParser');
const { validateRecibo } = require('../utils/validators');
const { mapReciboToSDK } = require('../utils/serializers');

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
 * Ingresa un recibo en el SDK de Bejerman (Circuito VENTAS)
 * @param {Object} params - Parámetros
 * @param {Object} params.recibo - Objeto recibo en formato DataFlow
 * @param {string} params.numeraFlex - "S" (auto) o "N" (manual) - opcional
 * @param {string} params.emiteReg - "E" (emitido) o "R" (registrado) - opcional
 * @returns {Promise<Object>} - { success: boolean, message: string, errors?: Array }
 */
async function ingresarRecibo({ recibo, numeraFlex, emiteReg }) {
  try {
    if (config.LOG_ENABLED) {
      console.log('[ventas] Ingresando recibo al SDK de Bejerman...');
    }

    // 1. Validar estructura del recibo
    const validation = validateRecibo(recibo);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Error de validación del recibo',
        errors: validation.errors,
      };
    }

    // 2. Mapear recibo a formato SDK
    const reciboSDK = mapReciboToSDK(recibo);

    if (config.LOG_ENABLED && config.LOG_REQUESTS) {
      console.log('[ventas] Recibo mapeado a SDK:', JSON.stringify(reciboSDK, null, 2));
    }

    // 3. Obtener token válido (forzar renovación para asegurar token fresco)
    tokenManager.clearToken(); // Limpiar cache para obtener token nuevo
    const token = await tokenManager.getToken();
    logToFile(`[ventas] Token obtenido: ${token}`);

    // 4. Preparar parámetros para el SDK
    // IMPORTANTE: xComprobante debe ser el OBJETO, no el string JSON
    // El soapClient se encargará de la serialización correcta
    const parametros = {
      xComprobante: reciboSDK,
      xNumeraFlex: numeraFlex || config.DEFAULT_NUMERA_FLEX,
      xEmiteReg: emiteReg || config.DEFAULT_EMITE_REG,
      Token: token,
    };

    // 5. Ejecutar llamada SOAP
    logToFile(`[ventas] Enviando a SDK - reciboSDK: ${JSON.stringify(reciboSDK)}`);
    logToFile(`[ventas] Token que se envía: ${parametros.Token}`);
    logToFile(`[ventas] xNumeraFlex: ${parametros.xNumeraFlex}, xEmiteReg: ${parametros.xEmiteReg}`);

    // IMPORTANTE: Sin reintentos para evitar duplicación (operación no-idempotente)
    const resultado = await soapClient.ejecutarSinReintentos(
      'VENTAS',
      'IngresarComprobanteJSON',
      parametros
    );

    logToFile(`[ventas] Resultado crudo del SDK (type=${typeof resultado}): ${JSON.stringify(resultado)}`);

    // 6. Procesar respuesta del ingreso
    if (!isOK(resultado)) {
      const errors = parseErrors(resultado);
      logToFile(`[ventas] Error al ingresar recibo - errors: ${JSON.stringify(errors)}`);

      return {
        success: false,
        message: 'El SDK retornó errores al procesar el recibo',
        errors,
        rawResponse: resultado,
      };
    }

    // 7. Cerrar proceso para completar la importación al ERP
    // CRÍTICO: Sin el cierre, el recibo queda en archivos TXT y no impacta en el ERP
    logToFile('[ventas] Cerrando proceso SDK para impactar en ERP...');
    try {
      const cierreResultado = await soapClient.cierreProceso('VENTAS', 'IngresarComprobanteJSON', token);
      logToFile(`[ventas] Cierre proceso resultado: ${cierreResultado}`);

      if (!isOK(cierreResultado)) {
        const cierreErrors = parseErrors(cierreResultado);
        logToFile(`[ventas] ERROR: El cierre de proceso falló - errors: ${JSON.stringify(cierreErrors)}`);

        return {
          success: false,
          message: 'El recibo se procesó pero no se pudo cerrar el proceso. Los datos quedaron en archivos TXT.',
          errors: cierreErrors,
        };
      }

      // Todo OK: recibo ingresado Y proceso cerrado
      logToFile('[ventas] Recibo ingresado Y cerrado exitosamente - impactó en ERP');
      return {
        success: true,
        message: 'Recibo registrado exitosamente en Bejerman ERP',
        data: reciboSDK,
      };

    } catch (cierreError) {
      logToFile(`[ventas] EXCEPCIÓN en cierre proceso: ${cierreError.message}`);

      return {
        success: false,
        message: `El recibo se procesó pero falló el cierre: ${cierreError.message}. Los datos quedaron en archivos TXT.`,
        error: cierreError,
      };
    }
  } catch (error) {
    logToFile(`[ventas] CATCH error: ${error.message} | Stack: ${error.stack}`);

    // NO reintentar automáticamente para evitar duplicación de recibos
    // Si hay error de token, el usuario debe corregir credenciales y reintentar manualmente
    if (error.message && error.message.toLowerCase().includes('token')) {
      logToFile('[ventas] Error de token detectado - requiere corrección manual');
      tokenManager.clearToken();
    }

    return {
      success: false,
      message: error.message || 'Error desconocido al conectar con el SDK',
      error,
    };
  }
}

/**
 * Ingresa múltiples recibos en una sola operación
 * @param {Object} params - Parámetros
 * @param {Array<Object>} params.recibos - Array de recibos en formato DataFlow
 * @param {string} params.numeraFlex - "S" (auto) o "N" (manual) - opcional
 * @param {string} params.emiteReg - "E" (emitido) o "R" (registrado) - opcional
 * @returns {Promise<Object>} - { success: boolean, message: string, errors?: Array }
 */
async function ingresarRecibosMultiples({ recibos, numeraFlex, emiteReg }) {
  try {
    if (config.LOG_ENABLED) {
      console.log(`[ventas] Ingresando ${recibos.length} recibos al SDK...`);
    }

    // 1. Validar todos los recibos
    const validations = recibos.map((r) => validateRecibo(r));
    const invalidos = validations.filter((v) => !v.valid);

    if (invalidos.length > 0) {
      const allErrors = invalidos.flatMap((v) => v.errors);
      return {
        success: false,
        message: `${invalidos.length} recibos con errores de validación`,
        errors: allErrors,
      };
    }

    // 2. Mapear todos los recibos a formato SDK
    const recibosSDK = recibos.map((r) => mapReciboToSDK(r));

    // 3. Obtener token válido
    const token = await tokenManager.getToken();

    // 4. Preparar parámetros - el array de comprobantes (soapClient serializa)
    const parametros = {
      xComprobante: recibosSDK,  // Array de objetos, soapClient serializa
      xNumeraFlex: numeraFlex || config.DEFAULT_NUMERA_FLEX,
      xEmiteReg: emiteReg || config.DEFAULT_EMITE_REG,
      Token: token,
    };

    logToFile(`[ventas] Enviando ${recibos.length} recibos al SDK`);

    // 5. Ejecutar llamada SOAP (IngresarComprobanteJSON también acepta múltiples)
    const resultado = await soapClient.ejecutar(
      'VENTAS',
      'IngresarComprobanteJSON',
      parametros
    );

    // 6. Procesar respuesta del ingreso
    if (!isOK(resultado)) {
      const errors = parseErrors(resultado);
      logToFile(`[ventas] Error al ingresar recibos múltiples - errors: ${JSON.stringify(errors)}`);

      return {
        success: false,
        message: 'El SDK retornó errores al procesar los recibos',
        errors,
        rawResponse: resultado,
      };
    }

    // 7. Cerrar proceso para completar la importación al ERP
    logToFile('[ventas] Cerrando proceso SDK para impactar recibos en ERP...');
    try {
      const cierreResultado = await soapClient.cierreProceso('VENTAS', 'IngresarComprobanteJSON', token);
      logToFile(`[ventas] Cierre proceso resultado: ${cierreResultado}`);

      if (!isOK(cierreResultado)) {
        const cierreErrors = parseErrors(cierreResultado);
        logToFile(`[ventas] ERROR: El cierre de proceso falló - errors: ${JSON.stringify(cierreErrors)}`);

        return {
          success: false,
          message: `Los ${recibos.length} recibos se procesaron pero no se pudo cerrar el proceso. Los datos quedaron en archivos TXT.`,
          errors: cierreErrors,
        };
      }

      // Todo OK: recibos ingresados Y proceso cerrado
      logToFile(`[ventas] ${recibos.length} recibos ingresados Y cerrados exitosamente - impactaron en ERP`);
      return {
        success: true,
        message: `${recibos.length} recibos registrados exitosamente en Bejerman ERP`,
        count: recibos.length,
      };

    } catch (cierreError) {
      logToFile(`[ventas] EXCEPCIÓN en cierre proceso múltiple: ${cierreError.message}`);

      return {
        success: false,
        message: `Los ${recibos.length} recibos se procesaron pero falló el cierre: ${cierreError.message}. Los datos quedaron en archivos TXT.`,
        error: cierreError,
      };
    }
  } catch (error) {
    // Si es error de token, reintentar
    if (error.message && error.message.toLowerCase().includes('token')) {
      tokenManager.clearToken();

      try {
        return await ingresarRecibosMultiples({ recibos, numeraFlex, emiteReg });
      } catch (retryError) {
        return {
          success: false,
          message: `Error después de reintentar: ${retryError.message}`,
          error: retryError,
        };
      }
    }

    if (config.LOG_ENABLED) {
      console.error('[ventas] Error al ingresar recibos:', error.message);
      console.error('[ventas] Stack:', error.stack);
    }

    return {
      success: false,
      message: error.message || 'Error desconocido al conectar con el SDK',
      error,
    };
  }
}

/**
 * Lista recibos con filtros (si el SDK lo soporta)
 * @param {Object} params - Parámetros de filtro
 * @param {string} params.fechaDesde - Fecha desde (DD/MM/YYYY o YYYY-MM-DD) - opcional
 * @param {string} params.fechaHasta - Fecha hasta (DD/MM/YYYY o YYYY-MM-DD) - opcional
 * @param {string} params.cliente - Código de cliente - opcional
 * @returns {Promise<Object>} - { success: boolean, data?: Array, message?: string }
 */
async function listarRecibos({ fechaDesde, fechaHasta, cliente }) {
  try {
    if (config.LOG_ENABLED) {
      console.log('[ventas] Listando recibos del SDK...');
    }

    // Obtener token
    const token = await tokenManager.getToken();

    // Preparar filtros
    const parametros = {
      Token: token,
    };

    if (fechaDesde) parametros.xFechaDesde = fechaDesde;
    if (fechaHasta) parametros.xFechaHasta = fechaHasta;
    if (cliente) parametros.xCliente = cliente;

    // Ejecutar operación
    const resultado = await soapClient.ejecutar(
      'VENTAS',
      'ListarComprobantesJSON',
      parametros
    );

    // El resultado debería ser un JSON con la lista de recibos
    try {
      const recibos = JSON.parse(resultado);
      return {
        success: true,
        data: recibos,
        count: Array.isArray(recibos) ? recibos.length : 0,
      };
    } catch (parseError) {
      return {
        success: false,
        message: 'Error al parsear respuesta del SDK',
        error: parseError,
        rawResponse: resultado,
      };
    }
  } catch (error) {
    if (config.LOG_ENABLED) {
      console.error('[ventas] Error al listar recibos:', error.message);
    }

    return {
      success: false,
      message: `Error al listar recibos: ${error.message}`,
      error,
    };
  }
}

module.exports = {
  ingresarRecibo,
  ingresarRecibosMultiples,
  listarRecibos,
};
