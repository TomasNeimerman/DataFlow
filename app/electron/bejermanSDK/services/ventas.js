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
const Recibos = require('../../modulesService/Local/Recibos');
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

    // 2. Si hay facturas aplicadas: predecir número/PtoVenta y forzar numera='N'
    //    numera='N' garantiza que el RC se guarda con EXACTAMENTE los valores
    //    que ponemos en RelacionComprobante. Con numera='S' el talonario falla
    //    y Bejerman guarda el RC con metadata que no coincide con la relación.
    const tieneAplicaciones = recibo.aplicaciones && recibo.aplicaciones.length > 0;
    if (tieneAplicaciones) {
      try {
        const prediccion = await Recibos.getProximoNumeroRC();
        recibo.numeroPredicado   = prediccion.numero;
        recibo.ptoVentaPredicado = prediccion.ptoVenta;
        logToFile(`[ventas] RC predicho: numero=${recibo.numeroPredicado} ptoVenta=${recibo.ptoVentaPredicado}`);
      } catch (e) {
        logToFile(`[ventas] Warning: no se pudo predecir número RC: ${e.message}`);
      }
    }

    // 3. Mapear recibo a formato SDK
    // Con aplicaciones usamos numera='N' (número explícito) para garantizar que el RC
    // se crea con exactamente el número predicho, que usaremos después para aplicar
    // las relaciones via SQL directo (el SDK no procesa RelacionComprobante con FCs preexistentes).
    const numeraEfectivo = tieneAplicaciones ? 'N' : (numeraFlex || config.DEFAULT_NUMERA_FLEX);
    const reciboSDK = mapReciboToSDK(recibo);

    // 4. Serializar — siempre objeto simple (IngresarComprobanteJSON).
    // Enviar RelacionComprobante vacía: el SDK no puede aplicar FCs preexistentes,
    // lo haremos nosotros via SQL después de que el RC se cree exitosamente.
    const reciboSDKsinRelacion = Object.assign({}, reciboSDK, { Comprobante_RelacionComprobante: [] });
    logToFile(`[ventas] numera=${numeraEfectivo} | Recibo mapeado: ${JSON.stringify(reciboSDKsinRelacion)}`);
    const jsonParaSDK = JSON.stringify(reciboSDKsinRelacion);

    // 5. Ejecutar via SDKWrapper.exe
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
      // Con numera='N' Bejerman no actualiza Talonar — lo hacemos nosotros
      if (numeraEfectivo === 'N' && recibo.numeroPredicado) {
        try {
          await Recibos.actualizarTalonarRC(recibo.numeroPredicado);
          logToFile(`[ventas] Talonar actualizado a ${recibo.numeroPredicado}`);
        } catch (e) {
          logToFile(`[ventas] Warning: no se pudo actualizar Talonar: ${e.message}`);
        }
      }

      // Aplicar relaciones RC→FC via SQL directo (el SDK no lo hace con FCs preexistentes)
      if (tieneAplicaciones) {
        try {
          const rcData = await Recibos.getCveIDRC(recibo.numeroPredicado, recibo.ptoVentaPredicado);
          if (rcData) {
            await Recibos.aplicarRelacionComprobante(rcData.cve_ID, recibo.aplicaciones);
            logToFile(`[ventas] RelacionComprobante aplicada via SQL para RC cve_ID=${rcData.cve_ID}`);
          } else {
            logToFile(`[ventas] Warning: no se encontró RC en CabVenta para aplicar relaciones (numero=${recibo.numeroPredicado} pto=${recibo.ptoVentaPredicado})`);
          }
        } catch (e) {
          logToFile(`[ventas] Warning: error aplicando RelacionComprobante SQL: ${e.message} | Stack: ${e.stack}`);
        }
      }

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
