/**
 * Serializers - Mapeo de datos DataFlow → formato SDK Bejerman (Circuito VENTAS)
 *
 * Este módulo mapea los datos de recibos de DataFlow al formato esperado por
 * el SDK de Bejerman para la operación IngresarComprobanteJSON del circuito VENTAS.
 *
 * IMPORTANTE: El orden de los campos debe coincidir exactamente con el esperado por el SDK.
 */

/**
 * Mapea un recibo de DataFlow al formato del SDK de Bejerman (Circuito VENTAS)
 * El orden de los campos es crítico y debe coincidir con el ejemplo de la documentación.
 * @param {Object} recibo - Recibo en formato DataFlow
 * @returns {Object} - Comprobante en formato SDK Bejerman
 */
function mapReciboToSDK(recibo) {
  const fechaEmision = convertirFechaToISO(recibo.fecha);
  const ptoVenta = recibo.ptoVentaPredicado || formatPuntoVenta(recibo.puntoVenta);
  const numero = formatNumeroComprobante(recibo.numeroPredicado || recibo.numero);

  // IMPORTANTE: El orden de los campos debe ser exactamente este
  return {
    Comprobante_Tipo: 'RC',
    Comprobante_Letra: ' ',
    Comprobante_PtoVenta: ptoVenta,
    Comprobante_Numero: numero,
    Comprobante_LoteHasta: ' ',
    Comprobante_FechaEmision: fechaEmision,
    Cliente_Codigo: formatCodigoCliente(recibo.codigoCliente),
    Cliente_RazonSocial: recibo.nombreCliente || recibo.razonSocial || '',
    Cliente_TipoDocumento: recibo.tipoDocumento || 5,
    Cliente_Provincia: formatProvincia(recibo.provincia),
    Cliente_SitIVA: recibo.situacionIVA || '3',
    Cliente_NroDocumento: recibo.cuit || recibo.nroDocumento || '11111111',
    Cliente_NumeroIIBB: recibo.numeroIIBB || '',
    Vendedor_Codigo: recibo.codigoVendedor || '   2',
    Vendedor_CodigoZona: recibo.codigoZona || null,
    Cliente_CodigoClase: recibo.codigoClase || '01',
    Comprobante_CondVenta: recibo.condicionVenta || null, // 1=Contado, 2=Cuenta corriente
    Comprobante_CodigoCausaEmision: recibo.causaEmision || null,
    Comprobante_FechaVencimiento: fechaEmision,
    Comprobante_ImporteTotal: calcularImporteTotal(recibo),
    Comprobante_CodigoDescComercial: recibo.codigoDescComercial || null,
    Comprobante_CodigoDescFinanciero: recibo.codigoDescFinanciero || null,
    Comprobante_CodigoDescGeneral: recibo.codigoDescGeneral || null,
    Comprobante_AperturaContable: recibo.aperturaContable || ' ',
    Cliente_Tipo: recibo.tipoCliente || null,
    Cliente_Direccion: recibo.direccion || '',
    Cliente_CodigoPostal: recibo.codigoPostal || '',
    Cliente_Localidad: recibo.localidad || '',
    Cliente_CodigoClase2: recibo.codigoClase2 || '01',
    Comprobante_Mensaje: recibo.mensaje || null,
    Comprobante_Anulado: '',
    Comprobante_ActualizaStock: 'N',
    Comprobante_DescripClaseAdicional1: recibo.descripClaseAdicional1 || 'Canal Venta',
    Comprobante_DescripClaseAdicional2: recibo.descripClaseAdicional2 || ' ',
    Cliente_DescripTipo: recibo.descripTipoCliente || null,
    Vendedor_DescZona: recibo.descripZona || null,
    Vendedor_Descripcion: recibo.descripVendedor || 'Canal Digital',
    Comprobante_NoDisponible: null,
    Comprobante_TasaDescComercial1: null,
    Comprobante_TasaDescComercial2: null,
    Comprobante_TasaDescComercial3: null,
    Comprobante_TasaDescFinanciero: null,
    Comprobante_TasaDescGeneral: null,
    Comprobante_NumeroCAI: null,
    Comprobante_FechaVencimientoCAI: null,
    Comprobante_ControladorFiscal: null,
    Cliente_Email: recibo.email || ' ',
    Cliente_Telefono: recibo.telefono || ' ',
    Cliente_Fax: recibo.fax || ' ',
    Cliente_ContactoObs: recibo.contactoObs || ' ',
    Comprobante_TipoOperacion: null,
    Comprobante_NumeroCuota: ' ',
    Comprobante_ImporteCuota: 0.0,
    Comprobante_EnCuotas: '',
    Comprobante_Moneda: '',  // Vacío según ejemplo
    Comprobante_TipoCambio: '',
    Comprobante_CotizacionCambio: 0.0,
    Comprobante_FechaEntrega: null,
    Comprobante_Grupo: null,
    Comprobante_Proyecto: null,
    Comprobante_ListaPrecios: null,
    Comprobante_LugarEntrega: null,
    Comprobante_MarcaAutorizacion: null,
    Comprobante_Transporte: null,
    Comprobante_FechaContabilizacion: fechaEmision,
    Comprobante_FechaDDJJ: null,
    Comprobante_Empresa: null,
    Comprobante_Sucursal: null,
    Comprobante_ID: recibo.id || 0,
    Comprobante_IDMediosPago: recibo.idMediosPago || 0,
    Comprobante_Items: [],
    Comprobante_MediosPago: mapMediosPago(recibo),
    Comprobante_RegEspeciales: [],
    Comprobante_DatosAdicionales: [],
    Comprobante_Cuotas: [],
    Comprobante_CentrosCosto: [],
    Comprobante_RelacionComprobante: mapRelacionComprobante(recibo),
  };
}

/**
 * Mapea las facturas canceladas al formato RelacionComprobante del SDK
 */
function mapRelacionComprobante(recibo) {
  const aplicaciones = recibo.aplicaciones || [];
  if (aplicaciones.length === 0) return [];

  const fechaEmision = convertirFechaToISO(recibo.fecha);
  const ptoVenta = recibo.ptoVentaPredicado || formatPuntoVenta(recibo.puntoVenta);
  const numero = formatNumeroComprobante(recibo.numeroPredicado || recibo.numero);

  return aplicaciones.map((ap) => ({
    Comprobante_Cancelatorio_Tipo: 'RC',
    Comprobante_Cancelatorio_Letra: ' ',
    Comprobante_Cancelatorio_PtoVenta: ptoVenta,
    Comprobante_Cancelatorio_Numero: numero,
    Comprobante_Cancelatorio_FechaEmision: fechaEmision,
    Comprobante_Cancelatorio_EnCuotas: ' ',
    Comprobante_Cancelatorio_NumeroCuota: '',
    Comprobante_Cancelatorio_FechaVencimiento: '',
    Cliente_Codigo: formatCodigoCliente(recibo.codigoCliente),
    Comprobante_Cancelado_Tipo: ap.tipoComprobante || 'FC',
    Comprobante_Cancelado_Letra: ap.letra || ' ',
    Comprobante_Cancelado_PtoVenta: formatPuntoVenta(ap.puntoVenta),
    Comprobante_Cancelado_Numero: formatNumeroComprobante(ap.numeroComprobante),
    Comprobante_Cancelado_FechaEmision: convertirFechaToISO(ap.fechaEmision),
    Comprobante_Cancelado_EnCuotas: ' ',
    Comprobante_Cancelado_NumeroCuota: '',
    Comprobante_Canceladoo_FechaVencimiento: '',
    Comprobante_Cancelatorio_ImporteTotal: Math.abs(ap.importe),
  }));
}

/**
 * Mapea los medios de pago al formato del SDK
 * @param {Object} recibo - Recibo con valores (medios de pago)
 * @returns {Array} - Array de medios de pago en formato SDK
 */
function mapMediosPago(recibo) {
  const valores = recibo.valores || [];
  if (valores.length === 0) return [];

  const fechaEmision = convertirFechaToISO(recibo.fecha);
  const ptoVenta = recibo.ptoVentaPredicado || formatPuntoVenta(recibo.puntoVenta);
  const numero = formatNumeroComprobante(recibo.numeroPredicado || recibo.numero);

  return valores.map((valor) => {
    const medioPago = mapTipoValorToMedioPago(valor.tipo);
    const importe = parseFloat(valor.importe) || 0;
    const tipo = (valor.tipo || '').toString().toUpperCase();
    const esCheque = tipo === 'CHE' || tipo === 'ECH';
    const esCuentaBancaria = tipo === 'TRF' || tipo === 'DEP';

    return {
      Comprobante_Tipo: 'RC',
      Comprobante_Letra: recibo.letra || ' ',
      Comprobante_PtoVenta: ptoVenta,
      Comprobante_Numero: numero,
      Comprobante_LoteHasta: ' ',
      Comprobante_FechaEmision: fechaEmision,
      Cliente_Codigo: formatCodigoCliente(recibo.codigoCliente),
      MedioPago: medioPago,
      MedioPago_Moneda: '1',
      MedioPago_TipoCambio: 'UNI',
      MedioPago_CajaOrigen: (esCheque || esCuentaBancaria) ? '' : (valor.cajaOrigen || '1'),
      MedioPago_TipoDocumento: esCheque ? 'DIF' : '',
      MedioPago_FechaVencimiento: valor.fechaCobro ? convertirFechaToISO(valor.fechaCobro) : fechaEmision,
      MedioPago_Importe: importe,
      MedioPago_NumeroCheque: valor.numeroCheque || '',
      MedioPago_CodigoBanco: valor.codigoBanco || '',
      MedioPago_SucursalBanco: valor.sucursalBanco || '',
      MedioPago_Clearing: 0,
      MedioPago_Origen: '',
      MedioPago_CodigoCuenta: esCuentaBancaria ? (valor.numeroCuenta || '').trim() : '',
      MedioPago_NumeroTarjeta: '',
      MedioPago_NumeroAutorizacion: '',
      MedioPago_NombreLibrador: '',
      MedioPago_DireccionLibrador: '',
      MedioPago_CodPostalLibrador: '',
      MedioPago_ProvinciaLibrador: '',
      MedioPago_LocalidadLibrador: '',
      MedioPago_TelefonoLibrador: '',
      MedioPago_ImporteMonedaLocal: importe,
    };
  });
}

/**
 * Mapea el tipo de valor de DataFlow al código de medio de pago de Bejerman
 * Códigos según tabla de medios de pago Bejerman:
 *   1 = Caja (Efectivo), 2 = Cheque / Tarjeta, 4 = Cta. Bancaria, 9 = Documento
 * @param {string} tipo - Tipo de valor (EFE, CHE, ECH, TRF, TAR, DEP, RET)
 * @returns {number} - Código de medio de pago
 */
function mapTipoValorToMedioPago(tipo) {
  const map = {
    EFE: 1,
    CHE: 2,
    ECH: 2,
    TAR: 2,
    TRF: 4,
    DEP: 4,
    RET: 9,
  };
  return map[(tipo || '').toString().toUpperCase()] ?? 1;
}

/**
 * Calcula el importe total del recibo (negativo para RC)
 * @param {Object} recibo - Recibo con valores
 * @returns {number} - Importe total (negativo)
 */
function calcularImporteTotal(recibo) {
  const valores = recibo.valores || [];
  const total = valores.reduce((sum, v) => sum + (parseFloat(v.importe) || 0), 0);
  return -Math.abs(total);
}

/**
 * Formatea código de cliente (6 dígitos con ceros a la izquierda)
 * @param {string} codigo - Código de cliente
 * @returns {string} - Código formateado
 */
function formatCodigoCliente(codigo) {
  if (!codigo) return '      ';
  return codigo.toString().trim().padStart(6, ' ');
}

/**
 * Formatea código de provincia (3 dígitos con ceros a la izquierda)
 * Códigos válidos: 1-25 (según documentación Bejerman)
 * @param {string|number} provincia - Código de provincia
 * @returns {string} - Código formateado (ej: "001", "002")
 */
function formatProvincia(provincia) {
  if (!provincia) return '001'; // Default: Capital Federal
  const num = parseInt(provincia, 10);
  if (isNaN(num) || num < 1 || num > 25) return '001';
  return num.toString().padStart(3, '0');
}

/**
 * Convierte fecha a formato ISO (YYYY-MM-DDTHH:MM:SS)
 * @param {string} fecha - Fecha en formato DD/MM/YYYY o YYYY-MM-DD
 * @returns {string} - Fecha en formato ISO
 */
function convertirFechaToISO(fecha) {
  if (!fecha) return '';

  const fechaStr = fecha.toString().trim();

  // YYYY-MM-DD con o sin hora → devolver solo fecha
  if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
    return fechaStr.substring(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
    const [dd, mm, yyyy] = fechaStr.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  try {
    const d = new Date(fechaStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) { /* ignorar */ }

  return fechaStr;
}

/**
 * Formatea punto de venta a 5 dígitos con ceros a la izquierda
 * @param {number|string} puntoVenta - Punto de venta
 * @returns {string} - Punto de venta formateado (ej: "00001")
 */
function formatPuntoVenta(puntoVenta) {
  if (!puntoVenta) return ' ';
  return puntoVenta.toString().trim(); // sin padding: valor exacto de la DB/Talonar
}

/**
 * Formatea número de comprobante a 8 dígitos con ceros a la izquierda
 * @param {number|string} numeroComprobante - Número de comprobante
 * @returns {string} - Número formateado (ej: "00000001")
 */
function formatNumeroComprobante(numeroComprobante) {
  if (!numeroComprobante) return '00000000';
  return numeroComprobante.toString().trim().padStart(8, '0');
}

module.exports = {
  mapReciboToSDK,
  mapMediosPago,
  mapRelacionComprobante,
  mapTipoValorToMedioPago,
  calcularImporteTotal,
  convertirFechaToISO,
  formatPuntoVenta,
  formatNumeroComprobante,
  formatCodigoCliente,
  formatProvincia,
};
