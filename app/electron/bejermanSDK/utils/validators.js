/**
 * Validadores de datos para el SDK de Bejerman
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

  if (!recibo.codigoCliente || recibo.codigoCliente.toString().trim() === '') {
    errors.push('Código de cliente es requerido');
  }

  if (!recibo.fecha || recibo.fecha.toString().trim() === '') {
    errors.push('Fecha es requerida');
  } else {
    // Validar formato de fecha
    if (!isValidFecha(recibo.fecha)) {
      errors.push('Fecha debe estar en formato DD/MM/YYYY o YYYY-MM-DD');
    }
  }

  if (!recibo.moneda || recibo.moneda.toString().trim() === '') {
    errors.push('Moneda es requerida');
  }

  if (!recibo.tipoCambio) {
    errors.push('Tipo de cambio es requerido');
  } else {
    const tc = parseFloat(recibo.tipoCambio);
    if (isNaN(tc) || tc <= 0) {
      errors.push('Tipo de cambio debe ser un número mayor a 0');
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
  }

  // Validar aplicaciones (facturas) si existen
  if (recibo.aplicaciones && Array.isArray(recibo.aplicaciones)) {
    recibo.aplicaciones.forEach((aplicacion, index) => {
      const aplicacionErrors = validateAplicacion(aplicacion, index);
      errors.push(...aplicacionErrors);
    });

    // Validar que el total de valores >= total de aplicaciones
    const totalValores = recibo.valores.reduce(
      (sum, v) => sum + parseFloat(v.importe || 0),
      0
    );
    const totalAplicaciones = recibo.aplicaciones.reduce(
      (sum, a) => sum + parseFloat(a.importe || 0),
      0
    );

    if (totalAplicaciones > totalValores) {
      errors.push(
        `Total aplicado (${totalAplicaciones.toFixed(2)}) excede total de valores (${totalValores.toFixed(2)})`
      );
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

  if (!valor.tipo || valor.tipo.toString().trim() === '') {
    errors.push(`${prefix}: Tipo de valor es requerido (CHE, ECH, TRF, EFE, etc.)`);
  }

  if (!valor.importe) {
    errors.push(`${prefix}: Importe es requerido`);
  } else {
    const importe = parseFloat(valor.importe);
    if (isNaN(importe) || importe <= 0) {
      errors.push(`${prefix}: Importe debe ser un número mayor a 0`);
    }
  }

  // Validaciones específicas por tipo
  const tipo = (valor.tipo || '').toString().toUpperCase();

  if (tipo === 'CHE' || tipo === 'ECH') {
    // Cheques requieren banco y número
    if (!valor.codigoBanco || valor.codigoBanco.toString().trim() === '') {
      errors.push(`${prefix}: Código de banco es requerido para cheques`);
    }

    if (!valor.numeroCheque || valor.numeroCheque.toString().trim() === '') {
      errors.push(`${prefix}: Número de cheque es requerido`);
    }

    if (valor.fechaCobro && !isValidFecha(valor.fechaCobro)) {
      errors.push(`${prefix}: Fecha de cobro debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }

    if (valor.fechaEmision && !isValidFecha(valor.fechaEmision)) {
      errors.push(`${prefix}: Fecha de emisión debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }
  }

  if (tipo === 'TRF') {
    // Transferencias
    if (valor.fechaTransferencia && !isValidFecha(valor.fechaTransferencia)) {
      errors.push(`${prefix}: Fecha de transferencia debe estar en formato DD/MM/YYYY o YYYY-MM-DD`);
    }
  }

  return errors;
}

/**
 * Valida una aplicación (factura a cancelar)
 * @param {Object} aplicacion - Objeto aplicación
 * @param {number} index - Índice en el array
 * @returns {Array<string>} - Array de errores
 */
function validateAplicacion(aplicacion, index) {
  const errors = [];
  const prefix = `Aplicación[${index}]`;

  if (!aplicacion.tipoComprobante || aplicacion.tipoComprobante.toString().trim() === '') {
    errors.push(`${prefix}: Tipo de comprobante es requerido (FA, FB, FC, etc.)`);
  }

  if (!aplicacion.puntoVenta || aplicacion.puntoVenta.toString().trim() === '') {
    errors.push(`${prefix}: Punto de venta es requerido`);
  }

  if (!aplicacion.numeroComprobante || aplicacion.numeroComprobante.toString().trim() === '') {
    errors.push(`${prefix}: Número de comprobante es requerido`);
  }

  if (!aplicacion.importe) {
    errors.push(`${prefix}: Importe es requerido`);
  } else {
    const importe = parseFloat(aplicacion.importe);
    if (isNaN(importe) || importe <= 0) {
      errors.push(`${prefix}: Importe debe ser un número mayor a 0`);
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
  validateAplicacion,
  isValidFecha,
};
