/**
 * Servicio de Ventas - Circuito VENTAS del SDK de Bejerman
 * Operaciones relacionadas con recibos (RC)
 *
 * Usa SDKWrapper.exe (DLLs directas) en vez de SOAP/WCF.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const dllClient = require('../core/dllClient');
const { validateRecibo } = require('../utils/validators');
const { mapReciboToSDK } = require('../utils/serializers');
// Crear directorio de logs si no existe
const LOG_DIR = 'C:/Dataflow';
const LOG_FILE = path.join(LOG_DIR, 'error.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

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
      console.log('[ventas] Ingresando recibo al SDK de Bejerman via DLLs...');
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
    const numeraEfectivo = numeraFlex || config.DEFAULT_NUMERA_FLEX;
    const reciboSDK = mapReciboToSDK(recibo);
    logToFile(`[ventas] Recibo mapeado a SDK: ${JSON.stringify(reciboSDK)}`);

    // 3. Envolver en array (el SDK espera [{comprobante}])
    const jsonParaSDK = JSON.stringify([reciboSDK]);

    // 4. Ejecutar via SDKWrapper.exe
    const resultado = await dllClient.ejecutar(
      'VENTAS',
      'IngresarComprobanteJSON',
      jsonParaSDK,
      {
        numera: numeraEfectivo,
        emite: emiteReg || config.DEFAULT_EMITE_REG,
      }
    );

    logToFile(`[ventas] Resultado SDK: ${JSON.stringify(resultado)}`);

    if (resultado.success) {
      return {
        success: true,
        message: 'Recibo registrado exitosamente en Bejerman ERP',
        data: reciboSDK,
      };
    }

    return {
      success: false,
      message: resultado.message || 'Error al procesar el recibo',
      errors: resultado.errors ? [resultado.errors] : [],
    };
  } catch (error) {
    logToFile(`[ventas] CATCH error: ${error.message} | Stack: ${error.stack}`);

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
      console.log(`[ventas] Ingresando ${recibos.length} recibos al SDK via DLLs...`);
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

    // 3. JSON como array de comprobantes
    const jsonParaSDK = JSON.stringify(recibosSDK);

    logToFile(`[ventas] Enviando ${recibos.length} recibos al SDK`);

    // 4. Ejecutar via SDKWrapper.exe
    const resultado = await dllClient.ejecutar(
      'VENTAS',
      'IngresarListaComprobantesJSON',
      jsonParaSDK,
      {
        numera: numeraFlex || config.DEFAULT_NUMERA_FLEX,
        emite: emiteReg || config.DEFAULT_EMITE_REG,
      }
    );

    logToFile(`[ventas] Resultado SDK múltiple: ${JSON.stringify(resultado)}`);

    if (resultado.success) {
      return {
        success: true,
        message: `${recibos.length} recibos registrados exitosamente en Bejerman ERP`,
        count: recibos.length,
      };
    }

    return {
      success: false,
      message: resultado.message || 'Error al procesar los recibos',
      errors: resultado.errors ? [resultado.errors] : [],
    };
  } catch (error) {
    if (config.LOG_ENABLED) {
      console.error('[ventas] Error al ingresar recibos:', error.message);
    }

    return {
      success: false,
      message: error.message || 'Error desconocido al conectar con el SDK',
      error,
    };
  }
}

module.exports = {
  ingresarRecibo,
  ingresarRecibosMultiples,
};
