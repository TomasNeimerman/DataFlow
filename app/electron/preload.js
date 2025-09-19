// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth / sesión
  login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
  whoami: () => ipcRenderer.invoke('whoami'),

  // Navegación (si lo usás)
  onNavigate: (callback) => ipcRenderer.on('navigate-to', (_event, path) => callback(path)),

  // Empresa / módulos
  getListadoEmpresas: (idCliente) => ipcRenderer.invoke('get-list-empresas', idCliente),
  getDatosEmpresaById: (idEmpresa) => ipcRenderer.invoke('get-empresa-by-id', idEmpresa),
  guardarConfiguracion: (empresaData) => ipcRenderer.invoke('get-empresa-config', empresaData),
  getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
  buildMenu: (modulos) => ipcRenderer.invoke('menu:set-modules', modulos),

  // Cheques (sin cambios)
  obtenerCheques: (id) => ipcRenderer.invoke('obtener-cheques', id),
  updateCheques: (cheque) => ipcRenderer.invoke('update-cheques', cheque),
  updateCheque3: (IDCheque, sit) => ipcRenderer.invoke('update-cheque3', { IDCheque, sit }),
  getSituacion: () => ipcRenderer.invoke('cheque3-situacion'),
  setRegistro: (emp, suc, IDCheque, sit, sitAnt) =>
    ipcRenderer.invoke('registro-cheque3-sit', { emp, suc, IDCheque, sit, sitAnt }),
  obtenerCheque3Rechazado: () => ipcRenderer.invoke('cheque3-rechazado'),

  // Artículos / catálogos
  getArticulos: () => ipcRenderer.invoke('get-articulos'),
  getClases: () => ipcRenderer.invoke('get-clases'),
  getProveedores: () => ipcRenderer.invoke('get-proveedores'),
  getRubros: () => ipcRenderer.invoke('get-rubros'),
  getTasasIVA: () => ipcRenderer.invoke('get-tasas-iva'),
  getArticuloDetailsById: (codGenArticulo) => ipcRenderer.invoke('get-articulo-details-by-id', codGenArticulo),
  claseExiste: (codigoClase) => ipcRenderer.invoke('clase-existe', codigoClase),
  rubroExiste: (codigoRubro) => ipcRenderer.invoke('rubro-existe', codigoRubro),
  getProveedorDetails: (codigoProveedor) => ipcRenderer.invoke('get-proveedor-details', codigoProveedor),
  getTasaIVADetails: (codigoTasaIVA) => ipcRenderer.invoke('get-tasa-iva-details', codigoTasaIVA),

  // Precios (preview / masivo / últimos)
  getPrecios: () => ipcRenderer.invoke('get-precios'),
actualizarPrecios: (opts) => ipcRenderer.invoke('precios:actualizar', opts),
onPreciosProgress: (cb) => {
  const handler = (_evt, payload) => { try { cb && cb(payload); } catch {} };
  ipcRenderer.on('precios:update-progress', handler);
  return () => ipcRenderer.removeListener('precios:update-progress', handler);
},
getPreciosActualizados: () => ipcRenderer.invoke('get-precios-actualizados'),
  // Generador Precios (unitarios Excel) — SIEMPRE objetos:
  obtenerPrecioActualizador: (keys) => ipcRenderer.invoke('precios-actualizador-get', keys),
  updatePrecioActualizador: (payload) => ipcRenderer.invoke('precios-actualizador-update', payload),
  //Actualizador Precios
  // --- nuevos bridges de Precios ---
getCodigosLista: () => ipcRenderer.invoke("precios:codigos-lista"),

  // Genera Excel usando /public/templates/precios.xlsx y datos de la lista elegida
descargarListaXlsx: (codLista) => ipcRenderer.invoke("precios:descargar-lista-xlsx", { codLista }),

  // Abre el archivo generado con la app por defecto del SO
openPath: (p) => ipcRenderer.invoke("os:open-path", p),

  // Actualización por Excel (si ya la usás)
actualizarPreciosExcel: (items) =>ipcRenderer.invoke("precios:actualizar-excel", items),

getPreciosExcelUltimos: () =>ipcRenderer.invoke("precios:excel-ultimos"),

  // Store
  getStoreValue: (key) => ipcRenderer.invoke('electron-store-get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('electron-store-set', { key, value }),

  // UI / App
  showHamburger: (coords) => ipcRenderer.invoke('ui:show-hamburger', coords),
  openHamburger: (coords) => ipcRenderer.invoke('hamburger:open', coords),
  isDev: () => ipcRenderer.invoke('env:is-dev'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'), // gateado en main
  reload: () => ipcRenderer.invoke('app:reload'),
  quit: () => ipcRenderer.invoke('app:quit'),
  logout: () => ipcRenderer.invoke('logout'),

  // Descargas
  downloadAndOpenExcel: (relativePath) => ipcRenderer.invoke('download-and-open-excel', relativePath),

  // BD Comparacion
  filterEmpresasByLocal: (idCliente) => ipcRenderer.invoke('filter-empresas-by-local', idCliente),
  
  // Otros
  getUpdatedFecha: () => ipcRenderer.invoke('get-updated-fecha'),
});

// Hotkeys globales del renderer (fuera de inputs)
// ⬇️ Reemplazá TODO el bloque viejo de keydown por este
document.addEventListener('keydown', (e) => {
  // Evitar que se dispare mientras escribís en inputs/textarea
  const el = document.activeElement;
  const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  if (editing) return;

  const safeInvoke = async (channel, payload) => {
    try {
      await ipcRenderer.invoke(channel, payload);
    } catch (err) {
      // No rompas la UI por errores en hotkeys
      console.warn(`[hotkey] ${channel} fallo:`, err?.message || err);
    }
  };

  if (e.key === 'F12') {
    e.preventDefault();
    // En prod, el main ya lo bloquea y devuelve error controlado
    safeInvoke('app:toggle-devtools');
  }
  if (e.key === 'F5') {
    e.preventDefault();
    safeInvoke('app:reload');
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    safeInvoke('app:quit');
  }
});