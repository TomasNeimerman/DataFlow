/**
 * Módulo SDK de Bejerman - Punto de entrada
 *
 * Este módulo proporciona una interfaz modular para interactuar con el
 * SDK de Bejerman (Web Service SOAP) desde DataFlow.
 *
 * Arquitectura:
 * - config/     : Configuración centralizada
 * - core/       : Cliente SOAP, autenticación, parsing XML
 * - services/   : Servicios por circuito (FINANZAS, VENTAS, etc.)
 * - utils/      : Validadores, serializers, reintentos
 *
 * Uso:
 *   const bejermanSDK = require('./bejermanSDK');
 *
 *   const result = await bejermanSDK.finanzas.ingresarRecibo({ recibo });
 */

module.exports = {
  // Configuración
  config: require('./config'),

  // Servicios por circuito
  finanzas: require('./services/finanzas'),
  // Futuros circuitos:
  // ventas: require('./services/ventas'),
  // compras: require('./services/compras'),
  // stock: require('./services/stock'),
  // tablas: require('./services/tablas'),

  // Core (acceso directo para casos avanzados)
  core: {
    soapClient: require('./core/soapClient'),
    tokenManager: require('./core/tokenManager'),
    xmlParser: require('./core/xmlParser'),
  },

  // Utils (acceso directo para casos avanzados)
  utils: {
    validators: require('./utils/validators'),
    serializers: require('./utils/serializers'),
    retry: require('./utils/retry'),
  },
};
