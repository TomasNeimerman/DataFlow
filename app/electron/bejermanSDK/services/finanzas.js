/**
 * Servicio de Finanzas - Circuito FINANZAS del SDK de Bejerman
 * Operaciones relacionadas con recibos
 */

const config = require('../config');
const soapClient = require('../core/soapClient');
const tokenManager = require('../core/tokenManager');
const { isOK, parseErrors } = require('../core/xmlParser');
const { validateRecibo } = require('../utils/validators');
const { mapReciboToSDK } = require('../utils/serializers');

/**
 * Ingresa un recibo en el SDK de Bejerman
 * @param {Object} params - Parámetros
 * @param {Object} params.recibo - Objeto recibo en formato DataFlow
 * @param {string} params.numeraFlex - "S" (auto) o "N" (manual) - opcional
 * @param {string} params.emiteReg - "E" (emitido) o "R" (registrado) - opcional
 * @returns {Promise<Object>} - { success: boolean, message: string, errors?: Array }
 */
async function ingresarRecibo({ recibo, numeraFlex, emiteReg }) {
  try {
    if (config.LOG_ENABLED) {
      console.log('[finanzas] Ingresando recibo al SDK de Bejerman...');
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
      console.log('[finanzas] Recibo mapeado a SDK:', JSON.stringify(reciboSDK, null, 2));
    }

    // 3. Obtener token válido
    const token = await tokenManager.getToken();

    // 4. Preparar parámetros para el SDK
    const parametros = {
      xComprobante: JSON.stringify(reciboSDK),
      xNumeraFlex: numeraFlex || config.DEFAULT_NUMERA_FLEX,
      xEmiteReg: emiteReg || config.DEFAULT_EMITE_REG,
      Token: token,
    };

    // 5. Ejecutar llamada SOAP
    const resultado = await soapClient.ejecutar(
      'FINANZAS',
      'IngresarComprobantesJSON',
      parametros
    );

    // 6. Procesar respuesta
    if (isOK(resultado)) {
      if (config.LOG_ENABLED) {
        console.log('[finanzas] Recibo ingresado exitosamente');
      }

      return {
        success: true,
        message: 'Recibo registrado exitosamente en Bejerman ERP',
        data: reciboSDK,
      };
    } else {
      const errors = parseErrors(resultado);

      if (config.LOG_ENABLED) {
        console.error('[finanzas] Error al ingresar recibo:', errors);
      }

      return {
        success: false,
        message: 'El SDK retornó errores al procesar el recibo',
        errors,
      };
    }
  } catch (error) {
    // Si es error de token, limpiar cache y reintentar UNA vez
    if (error.message && error.message.toLowerCase().includes('token')) {
      if (config.LOG_ENABLED) {
        console.log('[finanzas] Error de token, limpiando cache y reintentando...');
      }

      tokenManager.clearToken();

      // Reintentar solo una vez
      try {
        return await ingresarRecibo({ recibo, numeraFlex, emiteReg });
      } catch (retryError) {
        return {
          success: false,
          message: `Error después de reintentar: ${retryError.message}`,
          error: retryError,
        };
      }
    }

    // Otros errores
    if (config.LOG_ENABLED) {
      console.error('[finanzas] Error al ingresar recibo:', error.message);
    }

    return {
      success: false,
      message: `Error al conectar con el SDK: ${error.message}`,
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
      console.log(`[finanzas] Ingresando ${recibos.length} recibos al SDK...`);
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

    // 4. Preparar parámetros
    const parametros = {
      xComprobante: JSON.stringify(recibosSDK),
      xNumeraFlex: numeraFlex || config.DEFAULT_NUMERA_FLEX,
      xEmiteReg: emiteReg || config.DEFAULT_EMITE_REG,
      Token: token,
    };

    // 5. Ejecutar llamada SOAP (IngresarListaComprobantesJSON)
    const resultado = await soapClient.ejecutar(
      'FINANZAS',
      'IngresarListaComprobantesJSON',
      parametros
    );

    // 6. Procesar respuesta
    if (isOK(resultado)) {
      if (config.LOG_ENABLED) {
        console.log(`[finanzas] ${recibos.length} recibos ingresados exitosamente`);
      }

      return {
        success: true,
        message: `${recibos.length} recibos registrados exitosamente en Bejerman ERP`,
        count: recibos.length,
      };
    } else {
      const errors = parseErrors(resultado);

      if (config.LOG_ENABLED) {
        console.error('[finanzas] Errores al ingresar recibos:', errors);
      }

      return {
        success: false,
        message: 'El SDK retornó errores al procesar los recibos',
        errors,
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
      console.error('[finanzas] Error al ingresar recibos:', error.message);
    }

    return {
      success: false,
      message: `Error al conectar con el SDK: ${error.message}`,
      error,
    };
  }
}

/**
 * Lista recibos con filtros
 * @param {Object} params - Parámetros de filtro
 * @param {string} params.fechaDesde - Fecha desde (DD/MM/YYYY o YYYY-MM-DD) - opcional
 * @param {string} params.fechaHasta - Fecha hasta (DD/MM/YYYY o YYYY-MM-DD) - opcional
 * @param {string} params.cliente - Código de cliente - opcional
 * @returns {Promise<Object>} - { success: boolean, data?: Array, message?: string }
 */
async function listarRecibos({ fechaDesde, fechaHasta, cliente }) {
  try {
    if (config.LOG_ENABLED) {
      console.log('[finanzas] Listando recibos del SDK...');
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
      'FINANZAS',
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
      };
    }
  } catch (error) {
    if (config.LOG_ENABLED) {
      console.error('[finanzas] Error al listar recibos:', error.message);
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
