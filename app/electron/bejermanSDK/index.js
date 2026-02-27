/**
 * Módulo SDK de Bejerman - Punto de entrada
 *
 * Usa SDKWrapper.exe para llamar a las DLLs del SDK directamente,
 * eliminando la dependencia del Web Service WCF/SOAP.
 *
 * Arquitectura:
 * - config/     : Configuración (ruta al wrapper, credenciales, empresa)
 * - core/       : dllClient (invoca SDKWrapper.exe via child_process)
 * - services/   : Servicios por circuito (VENTAS, COMPRAS)
 * - utils/      : Validadores, serializers
 * - wrapper/    : Código fuente C# del SDKWrapper.exe
 *
 * Uso:
 *   const bejermanSDK = require('./bejermanSDK');
 *   const result = await bejermanSDK.ventas.ingresarRecibo({ recibo });
 */

module.exports = {
  // Configuración
  config: require('./config'),

  // Servicios por circuito
  ventas: require('./services/ventas'),

  // Core (acceso directo para casos avanzados)
  core: {
    dllClient: require('./core/dllClient'),
  },

  // Utils
  utils: {
    validators: require('./utils/validators'),
    serializers: require('./utils/serializers'),
  },
};
