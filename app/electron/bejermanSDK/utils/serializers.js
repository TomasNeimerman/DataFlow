/**
 * Serializers - Mapeo de datos DataFlow → formato SDK Bejerman
 */

/**
 * Mapea un recibo de DataFlow al formato del SDK de Bejerman
 * @param {Object} recibo - Recibo en formato DataFlow
 * @returns {Object} - Recibo en formato EFlexSDK_ComprobanteFinanzas
 */
function mapReciboToSDK(recibo) {
  return {
    TipoComprobante: 'RC', // Recibo (fijo)
    Fecha: convertirFechaToSDK(recibo.fecha),
    Moneda: recibo.moneda || 'ARS',
    TipoCambio: formatTipoCambio(recibo.tipoCambio),
    CodigoCliente: recibo.codigoCliente?.toString() || '',
    NombreCliente: recibo.nombreCliente || '',
    Observaciones: recibo.observaciones || 'Recibo generado desde DataFlow',
    Valores: mapValores(recibo.valores || []),
    Aplicaciones: mapAplicaciones(recibo.aplicaciones || []),
  };
}

/**
 * Mapea valores (medios de pago) al formato del SDK
 * @param {Array<Object>} valores - Array de valores
 * @returns {Array<Object>} - Array de valores en formato SDK
 */
function mapValores(valores) {
  if (!valores || !Array.isArray(valores)) return [];

  return valores.map((valor) => {
    const base = {
      TipoValor: (valor.tipo || '').toString().toUpperCase(),
      Importe: formatImporte(valor.importe),
      Observaciones: valor.observaciones || '',
    };

    const tipo = (valor.tipo || '').toString().toUpperCase();

    // Cheques (CHE, ECH)
    if (tipo === 'CHE' || tipo === 'ECH') {
      return {
        ...base,
        CodigoBanco: (valor.codigoBanco || '').toString(),
        NumeroCheque: (valor.numeroCheque || '').toString(),
        FechaEmision: convertirFechaToSDK(valor.fechaEmision),
        FechaCobro: convertirFechaToSDK(valor.fechaCobro),
        CUIT: valor.cuit || '',
        Librador: valor.librador || '',
        NumeroCuenta: valor.numeroCuenta || '',
        CMC7: valor.cmc7 || '',
      };
    }

    // Transferencias (TRF)
    if (tipo === 'TRF') {
      return {
        ...base,
        CodigoBanco: valor.codigoBanco || '',
        NumeroCuenta: valor.numeroCuenta || '',
        FechaTransferencia: convertirFechaToSDK(valor.fechaTransferencia || valor.fecha),
      };
    }

    // Efectivo (EFE) solo necesita campos base
    return base;
  });
}

/**
 * Mapea aplicaciones (facturas a cancelar) de DataFlow a formato SDK
 * @param {Array<Object>} aplicaciones - Array de aplicaciones
 * @returns {Array<Object>} - Array de aplicaciones en formato SDK
 */
function mapAplicaciones(aplicaciones) {
  if (!aplicaciones || !Array.isArray(aplicaciones)) {
    return [];
  }

  return aplicaciones.map((aplicacion) => ({
    TipoComprobanteAplicado: (aplicacion.tipoComprobante || 'FA').toString().toUpperCase(),
    PuntoVenta: formatPuntoVenta(aplicacion.puntoVenta),
    NumeroComprobante: formatNumeroComprobante(aplicacion.numeroComprobante),
    ImporteAplicado: formatImporte(aplicacion.importe),
    Observaciones: aplicacion.observaciones || '',
  }));
}

/**
 * Convierte fecha a formato DD/MM/YYYY (requerido por SDK)
 * @param {string} fecha - Fecha en formato DD/MM/YYYY o YYYY-MM-DD
 * @returns {string} - Fecha en formato DD/MM/YYYY
 */
function convertirFechaToSDK(fecha) {
  if (!fecha) return '';

  const fechaStr = fecha.toString().trim();

  // Ya está en formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
    return fechaStr;
  }

  // Convertir de YYYY-MM-DD a DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [yyyy, mm, dd] = fechaStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  // Si es un objeto Date
  if (fechaStr instanceof Date) {
    const dd = String(fechaStr.getDate()).padStart(2, '0');
    const mm = String(fechaStr.getMonth() + 1).padStart(2, '0');
    const yyyy = fechaStr.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Si no se reconoce el formato, devolver como está
  return fechaStr;
}

/**
 * Formatea un importe a string con 2 decimales
 * @param {number|string} importe - Importe a formatear
 * @returns {string} - Importe formateado (ej: "1234.50")
 */
function formatImporte(importe) {
  if (!importe) return '0.00';

  const num = parseFloat(importe);
  if (isNaN(num)) return '0.00';

  return num.toFixed(2);
}

/**
 * Formatea tipo de cambio con 4 decimales
 * @param {number|string} tipoCambio - Tipo de cambio a formatear
 * @returns {string} - TC formateado (ej: "1050.0000")
 */
function formatTipoCambio(tipoCambio) {
  if (!tipoCambio) return '1.0000';

  const num = parseFloat(tipoCambio);
  if (isNaN(num)) return '1.0000';

  return num.toFixed(4);
}

/**
 * Formatea punto de venta a 4 dígitos con ceros a la izquierda
 * @param {number|string} puntoVenta - Punto de venta
 * @returns {string} - Punto de venta formateado (ej: "0001")
 */
function formatPuntoVenta(puntoVenta) {
  if (!puntoVenta) return '0001';

  const pv = puntoVenta.toString().trim();
  return pv.padStart(4, '0');
}

/**
 * Formatea número de comprobante a 8 dígitos con ceros a la izquierda
 * @param {number|string} numeroComprobante - Número de comprobante
 * @returns {string} - Número formateado (ej: "00001234")
 */
function formatNumeroComprobante(numeroComprobante) {
  if (!numeroComprobante) return '00000000';

  const num = numeroComprobante.toString().trim();
  return num.padStart(8, '0');
}

module.exports = {
  mapReciboToSDK,
  mapValores,
  mapAplicaciones,
  convertirFechaToSDK,
  formatImporte,
  formatTipoCambio,
  formatPuntoVenta,
  formatNumeroComprobante,
};
