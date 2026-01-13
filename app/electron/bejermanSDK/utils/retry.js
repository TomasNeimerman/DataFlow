/**
 * Estrategia de reintentos con backoff exponencial
 */

/**
 * Ejecuta una función con reintentos automáticos en caso de error
 * @param {Function} fn - Función async a ejecutar
 * @param {number} maxRetries - Número máximo de reintentos (default: 3)
 * @param {number} baseDelay - Delay base en ms para backoff (default: 1000)
 * @returns {Promise<any>} - Resultado de la función
 * @throws {Error} - Si falla después de todos los reintentos
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Intentar ejecutar la función
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // Si es un error no reintentable o ya se agotaron los intentos, lanzar error
      if (isNonRetryableError(error)) {
        throw new Error(`Error no reintentable: ${error.message}`);
      }

      if (attempt > maxRetries) {
        break; // Salir del loop, lanzar error después
      }

      // Calcular delay con backoff exponencial: baseDelay * 2^(attempt-1)
      // Intento 1: 1000ms, Intento 2: 2000ms, Intento 3: 4000ms, etc.
      const delay = baseDelay * Math.pow(2, attempt - 1);

      console.log(
        `[retry] Intento ${attempt}/${maxRetries + 1} falló: ${error.message}. ` +
        `Reintentando en ${delay}ms...`
      );

      // Esperar antes del próximo intento
      await sleep(delay);
    }
  }

  // Si llegamos aquí, se agotaron todos los reintentos
  throw new Error(
    `Operación falló después de ${maxRetries + 1} intentos. ` +
    `Último error: ${lastError.message}`
  );
}

/**
 * Determina si un error es reintentable o no
 * @param {Error} error - Error a evaluar
 * @returns {boolean} - true si NO debe reintentarse, false si puede reintentarse
 */
function isNonRetryableError(error) {
  const msg = (error.message || '').toLowerCase();

  // Errores de validación no son reintentables
  if (msg.includes('validación') || msg.includes('validation')) {
    return true;
  }

  if (msg.includes('validar') || msg.includes('validate')) {
    return true;
  }

  if (msg.includes('requerido') || msg.includes('required')) {
    return true;
  }

  if (msg.includes('inválido') || msg.includes('invalid')) {
    return true;
  }

  // Errores de autenticación (excepto token expirado) no son reintentables
  if (msg.includes('autenticación fallida')) {
    return true;
  }

  if (msg.includes('credenciales')) {
    return true;
  }

  if (msg.includes('no configurado')) {
    return true;
  }

  // Errores de datos no encontrados no son reintentables
  if (msg.includes('no existe') || msg.includes('not found')) {
    return true;
  }

  if (msg.includes('no encontrado')) {
    return true;
  }

  // Errores de formato no son reintentables
  if (msg.includes('formato') || msg.includes('format')) {
    return true;
  }

  // Token expirado SÍ es reintentable (se renovará automáticamente)
  if (msg.includes('token')) {
    return false; // Reintentar
  }

  // Errores de red/timeout SON reintentables
  if (msg.includes('timeout')) {
    return false; // Reintentar
  }

  if (msg.includes('econnrefused') || msg.includes('conexión rechazada')) {
    return false; // Reintentar
  }

  if (msg.includes('enotfound')) {
    return false; // Reintentar (podría ser temporal)
  }

  if (msg.includes('network') || msg.includes('red')) {
    return false; // Reintentar
  }

  // Por defecto, considerar reintentable
  return false;
}

/**
 * Utilidad para esperar un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  retryWithBackoff,
  isNonRetryableError,
  sleep,
};
