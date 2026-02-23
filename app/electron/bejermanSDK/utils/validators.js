/**
 * Validadores de datos para el SDK de Bejerman (Circuito VENTAS)
 */

/**
 * Valida la estructura de un recibo antes de enviarlo al SDK
 * @param {Object} recibo - Objeto recibo a validar
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateRecibo(recibo) {
  const errors = [];

  // Validar campos básicos requeridos
  if (!recibo) {
    return { valid: false, errors: ['Recibo es requerido'] };
  }

  // Código de cliente es requerido
  if (!recibo.codigoCliente || recibo.codigoCliente.toString().trim() === '') {
    errors.push('Código de cliente es requerido');
  }

  // Fecha es requerida
  if (!recibo.fecha || recibo.fecha.toString().trim() === '') {
    errors.push('Fecha es requerida');
  } else {
    if (!isValidFecha(recibo.fecha)) {
      errors.push('Fecha debe estar en formato DD/MM/YYYY o YYYY-MM-DD');
    }
  }

  // Punto de venta - opcional pero si se provee debe ser válido
  if (recibo.puntoVenta) {
    const pv = recibo.puntoVenta.toString().trim();
    if (!/^\d+$/.test(pv)) {
      errors.push('Punto de venta debe ser numérico');
    }
  }

  // Número de comprobante - opcional (puede usar autonumeración)
  if (recibo.numero) {
    const num = recibo.numero.toString().trim();
    if (!/^\d+$/.test(num)) {
      errors.push('Número de comprobante debe ser numérico');
    }
  }

  // Validar valores (medios de pago)
  if (!recibo.valores || !Array.isArray(recibo.valores)) {
    errors.push('Debe incluir al menos un valor (medio de pago)');
  } else if (recibo.valores.length === 0) {
    errors.push('Debe haber al menos un valor (medio de pago)');
  } else {
    // Validar cada valor
    recibo.valores.forEach((valor, index) => {
      const valorErrors = validateValor(valor, index);
      errors.push(...valorErrors);
    });

    // Validar que el total de valores sea mayor a cero
    const totalValores = recibo.valores.reduce(
      (sum, v) => sum + (parseFloat(v.importe) || 0),
      0
    );

    if (totalValores <= 0) {
      errors.push('El total de valores debe ser mayor a cero');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida un valor (medio de pago)
 * @param {Object} valor - Objeto valor
 * @param {number} index - Índice en el array (para mensajes de error)
 * @returns {Array<string>} - Array de errores
 */
function validateValor(valor, index) {
  const errors = [];
  const prefix = `Valor[${index}]`;

  // Tipo de valor - opcional, default a EFE (efectivo)
  if (valor.tipo) {
    const tiposValidos = ['EFE', 'CHE', 'ECH', 'TRF', 'TAR', 'DEP', 'RET'];
    const tipoUpper = valor.tipo.toString().toUpperCase();
    if (!tiposValidos.includes(tipoUpper)) {
      errors.push(`${prefix}: Tipo de valor inválido. Valores permitidos: ${tiposValidos.join(', ')}`);
    }
  }

  // Importe es requerido
  if (valor.importe === undefined || valor.importe === null || valor.importe === '') {
    errors.push(`${prefix}: Importe es requerido`);
  } else {
    const importe = parseFloat(valor.importe);
    if (isNaN(importe)) {
      errors.push(`${prefix}: Importe debe ser un número válido`);
    } else if (importe <= 0) {
      errors.push(`${prefix}: Importe debe ser mayor a 0`);
    }
  }

  // Validaciones específicas por tipo
  const tipo = (valor.tipo || 'EFE').toString().toUpperCase();

  if (tipo === 'CHE' || tipo === 'ECH') {
    // Cheques pueden requerir banco y número, pero lo hacemos opcional
    // ya que algunos sistemas permiten cheques sin estos datos
    if (valor.fechaCobro && !isValidFecha(valor.fechaCobro)) {
      errors.push(`${prefix}: Fecha de cobro debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }

    if (valor.fechaEmision && !isValidFecha(valor.fechaEmision)) {
      errors.push(`${prefix}: Fecha de emisión debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }
  }

  if (tipo === 'TRF') {
    if (valor.fechaTransferencia && !isValidFecha(valor.fechaTransferencia)) {
      errors.push(`${prefix}: Fecha de transferencia debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }
  }

  return errors;
}

/**
 * Valida formato de fecha
 * @param {string} fecha - Fecha a validar
 * @returns {boolean} - true si es válida
 */
function isValidFecha(fecha) {
  if (!fecha) return false;

  const fechaStr = fecha.toString().trim();

  // Formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
    const [dd, mm, yyyy] = fechaStr.split('/').map(Number);
    return isValidDate(dd, mm, yyyy);
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [yyyy, mm, dd] = fechaStr.split('-').map(Number);
    return isValidDate(dd, mm, yyyy);
  }

  // Formato ISO YYYY-MM-DDTHH:MM:SS
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fechaStr)) {
    const datePart = fechaStr.substring(0, 10);
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    return isValidDate(dd, mm, yyyy);
  }

  return false;
}

/**
 * Valida una fecha
 * @param {number} day - Día
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año
 * @returns {boolean} - true si es válida
 */
function isValidDate(day, month, year) {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  // Validar días por mes
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Año bisiesto
  if (month === 2 && isLeapYear(year)) {
    return day <= 29;
  }

  return day <= daysInMonth[month - 1];
}

/**
 * Verifica si un año es bisiesto
 * @param {number} year - Año
 * @returns {boolean} - true si es bisiesto
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

module.exports = {
  validateRecibo,
  validateValor,
  isValidFecha,
};
