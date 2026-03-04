/**
 * DLL Client - Ejecuta operaciones del SDK de Bejerman via SDKWrapper.exe
 *
 * Reemplaza a soapClient.js eliminando la dependencia del Web Service WCF.
 * Usa child_process para invocar SDKWrapper.exe que llama a las DLLs directamente.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');

// Directorio para archivos JSON temporales
const TEMP_DIR = path.join(os.tmpdir(), 'DataFlow-SDK');

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Log
const LOG_DIR = 'C:/Dataflow';
const LOG_FILE = path.join(LOG_DIR, 'sdk-dll.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logToFile(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
}

/**
 * Ejecuta una operación en el SDK de Bejerman via SDKWrapper.exe
 * @param {string} circuito - Circuito del SDK (VENTAS, COMPRAS)
 * @param {string} operacion - Operación a ejecutar (IngresarComprobanteJSON, etc.)
 * @param {string|Object} jsonData - JSON del comprobante (string o objeto)
 * @param {Object} opciones - Opciones adicionales
 * @param {string} opciones.numera - "S" (autonumera) o "N" (manual)
 * @param {string} opciones.emite - "E" (emitido) o "R" (registrado)
 * @returns {Promise<Object>} - { success: boolean, message: string, errors?: string }
 */
async function ejecutar(circuito, operacion, jsonData, opciones = {}) {
  const numera = opciones.numera || config.DEFAULT_NUMERA_FLEX;
  const emite = opciones.emite || config.DEFAULT_EMITE_REG;

  // Convertir objeto a string si es necesario
  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);

  // Escribir JSON a archivo temporal
  const tempFile = path.join(TEMP_DIR, `sdk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.json`);

  try {
    fs.writeFileSync(tempFile, jsonString, 'utf8');
    logToFile(`[dllClient] JSON temporal escrito en: ${tempFile}`);
    logToFile(`[dllClient] JSON enviado: ${jsonString}`);
    logToFile(`[dllClient] Ejecutando: ${circuito}/${operacion} (numera=${numera}, emite=${emite})`);

    // Construir argumentos
    const args = [
      '--empresa', config.SDK_EMPRESA,
      '--usuario', config.SDK_USER,
      '--clave', config.SDK_PASSWORD,
      '--pto-trabajo', config.SDK_PTO_TRABAJO,
      '--circuito', circuito,
      '--operacion', operacion,
      '--numera', numera,
      '--emite', emite,
      '--json-file', tempFile,
    ];

    // Ejecutar SDKWrapper.exe
    const resultado = await ejecutarWrapper(config.SDK_WRAPPER_PATH, args);

    logToFile(`[dllClient] Resultado: ${JSON.stringify(resultado)}`);

    return resultado;
  } catch (error) {
    logToFile(`[dllClient] ERROR: ${error.message}`);
    return {
      success: false,
      message: error.message || 'Error desconocido al ejecutar SDKWrapper',
      errors: error.stack || null,
    };
  } finally {
    // Limpiar archivo temporal
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        logToFile(`[dllClient] Archivo temporal eliminado: ${tempFile}`);
      }
    } catch (cleanupErr) {
      logToFile(`[dllClient] Error limpiando temporal: ${cleanupErr.message}`);
    }
  }
}

/**
 * Ejecuta SDKWrapper.exe y parsea el resultado
 * @param {string} wrapperPath - Ruta completa al SDKWrapper.exe
 * @param {Array<string>} args - Argumentos de línea de comandos
 * @returns {Promise<Object>} - Resultado parseado
 */
function ejecutarWrapper(wrapperPath, args) {
  return new Promise((resolve, reject) => {
    // Validar que el wrapper existe
    if (!fs.existsSync(wrapperPath)) {
      reject(new Error(
        `SDKWrapper.exe no encontrado en: ${wrapperPath}\n` +
        'Verifique SDK_WRAPPER_PATH en la configuración.'
      ));
      return;
    }

    logToFile(`[dllClient] Ejecutando: ${wrapperPath} ${args.join(' ')}`);

    const options = {
      timeout: config.SDK_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB
      windowsHide: true,
    };

    execFile(wrapperPath, args, options, (error, stdout, stderr) => {
      // Log de debug (stderr del wrapper)
      if (stderr) {
        logToFile(`[dllClient] SDKWrapper stderr:\n${stderr}`);
      }

      // Parsear stdout como JSON
      const stdoutTrimmed = (stdout || '').trim();

      if (stdoutTrimmed) {
        try {
          const result = JSON.parse(stdoutTrimmed);
          resolve(result);
          return;
        } catch (parseErr) {
          logToFile(`[dllClient] Error parseando stdout: ${parseErr.message}`);
          logToFile(`[dllClient] stdout raw: ${stdoutTrimmed}`);
        }
      }

      // Si no hay stdout parseable, usar el error del proceso
      if (error) {
        // Timeout
        if (error.killed) {
          reject(new Error(`SDKWrapper.exe excedió el timeout de ${config.SDK_TIMEOUT}ms`));
          return;
        }

        reject(new Error(
          `SDKWrapper.exe terminó con código ${error.code || 'desconocido'}. ` +
          (stderr || error.message)
        ));
        return;
      }

      // Sin stdout y sin error = respuesta vacía
      reject(new Error('SDKWrapper.exe no produjo salida'));
    });
  });
}

module.exports = {
  ejecutar,
};
