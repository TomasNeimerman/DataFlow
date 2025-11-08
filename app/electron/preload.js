// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// ⚡️ canales que el main emite (whitelist)
const allowedIpcEvents = [
  'store:any-change',
  'menu:modules-updated',
  'session:state',
  'empresa:selected',
  'cheques:updated',
  'precios:updated',
];

// Para poder desuscribir correctamente
const _listenerMap = new WeakMap();

contextBridge.exposeInMainWorld('api', {
  // ======================
  // 🔔 Suscripción a eventos push del main (y desuscripción)
  // ======================
  on(channel, fn) {
    if (!allowedIpcEvents.includes(channel)) return;
    const wrapped = (_e, data) => { try { fn(data); } catch {} };
    _listenerMap.set(fn, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off(channel, fn) {
    if (!allowedIpcEvents.includes(channel)) return;
    const wrapped = _listenerMap.get(fn);
    if (wrapped) ipcRenderer.removeListener(channel, wrapped);
  },

  // ======================
  // Auth / sesión
  // ======================
  login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
  whoami: () => ipcRenderer.invoke('whoami'),
  odbcConnectAndSave: (payload) => ipcRenderer.invoke('odbc:connect-and-save', payload),
  // Navegación (si lo usás)
  onNavigate: (callback) => ipcRenderer.on('navigate-to', (_event, path) => callback(path)),

  // ======================
  // Empresa / módulos
  // ======================
  hasManager: () => ipcRenderer.invoke('local:has-manager'),
  listEmpresasLocal: () => ipcRenderer.invoke('empresas:list-manager-emp'),
  // Verifica habilitación y, si OK, guarda instancia en store + emite 'empresa:selected'
  verifyEmpresaForUser: (payload) => ipcRenderer.invoke('empresa:verify-and-save', payload),

  getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
  getModulosXCliente: (idCliente) => ipcRenderer.invoke('get-modulos-x-cliente', idCliente),
  buildMenu: (modulos) => ipcRenderer.invoke('menu:set-modules', modulos),

  // ======================
  // Cheques
  // ======================
  obtenerCheques: (id) => ipcRenderer.invoke('obtener-cheques', id),
  updateCheques: (cheque) => ipcRenderer.invoke('update-cheques', cheque),
  chequespPreview: () => ipcRenderer.invoke('chequesp:preview'),
  updateCheque3: (IDCheque, sit) => ipcRenderer.invoke('update-cheque3', { IDCheque, sit }),
  getSituacion: () => ipcRenderer.invoke('cheque3-situacion'),
  setRegistro: (emp, suc, IDCheque, sit, sitAnt) => ipcRenderer.invoke('registro-cheque3-sit', { emp, suc, IDCheque, sit, sitAnt }),
  obtenerCheque3Rechazado: () => ipcRenderer.invoke('cheque3-rechazado'),
  updateCheque3Field: (IDCheque, campo, valor) => ipcRenderer.invoke('cheque3-update-field', { IDCheque, campo, valor }),

  // ======================
  // Artículos / catálogos
  // ======================
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

  // ======================
  // Precios
  // ======================
  getPrecios: () => ipcRenderer.invoke('get-precios'),
  // ⚠️ Ojo: 'precios:actualizar' no existe en el main provisto; dejalo sólo si tenés ese IPC.
  actualizarPrecios: (opts) => ipcRenderer.invoke('precios:actualizar', opts),
  
  onPreciosProgress: (cb) => {
    const handler = (_evt, payload) => { try { cb && cb(payload); } catch {} };
    ipcRenderer.on('precios:update-progress', handler);
    return () => ipcRenderer.removeListener('precios:update-progress', handler);
  },

  getPreciosActualizados: () => ipcRenderer.invoke('get-precios-actualizados'),
  previewLista: (listaCod, limit) => ipcRenderer.invoke('precios:preview-lista', { listaCod, limit }),
  // --- nuevos bridges de Precios ---
  getCodigosLista: () => ipcRenderer.invoke('precios:codigos-lista'),
  // Genera Excel usando /public/templates/precios.xlsx y datos de la lista elegida
  descargarListaXlsx: (listaCod) => ipcRenderer.invoke('descargar-lista-xlsx', listaCod),
  openPath:  (p) => ipcRenderer.invoke('open-path', p),
  revealPath:(p) => ipcRenderer.invoke('reveal-path', p),

  // Actualización por Excel
  actualizarPreciosExcel: (items) => ipcRenderer.invoke('precios:actualizar-excel', items),
  getPreciosExcelUltimos: () => ipcRenderer.invoke('precios:excel-ultimos'),

  // ===== Clientes =====
getListasClientes: () => ipcRenderer.invoke('clientes:listas-habilitadas'),
clientesListar: (payload) => ipcRenderer.invoke('clientes:listar', payload),              
clientesActualizarFiltrado: (payload) => ipcRenderer.invoke('clientes:actualizar-filtrado', payload), 
getOrdenamientos: () => ipcRenderer.invoke('paramgen:get-ordenamientos'),

clientesForm: {
    traerTodos:        () => ipcRenderer.invoke('clientesForm:traerTodos'),
    traerCodigosLista: () => ipcRenderer.invoke('clientesForm:traerCodigosLista'),
    // payload: { fromCod, toCod, cliCods: string[] }
    actualizarLista:   (payload) => ipcRenderer.invoke('clientesForm:actualizarLista', payload),
    getCatalogos:      () => ipcRenderer.invoke('clientesForm:getCatalogos'),
  actualizarCampos:  (payload) => ipcRenderer.invoke('clientesForm:actualizarCampos', payload),
  },
  // ======================
  // Store
  // ======================
  getStoreValue: (key) => ipcRenderer.invoke('electron-store-get', key),

  // acepta ("key", value) o ({ key, value })
  setStoreValue: (keyOrObj, value) => {
    const payload = (keyOrObj && typeof keyOrObj === 'object' && !Array.isArray(keyOrObj))
      ? keyOrObj
      : { key: keyOrObj, value };
    return ipcRenderer.invoke('electron-store-set', payload);
  },

  // ======================
  // UI / App
  // ======================
  showHamburger: (coords) => ipcRenderer.invoke('ui:show-hamburger', coords),
  openHamburger: (coords) => ipcRenderer.invoke('hamburger:open', coords),
  isDev: () => ipcRenderer.invoke('env:is-dev'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'),
  reload: () => ipcRenderer.invoke('app:reload'),
  quit: () => ipcRenderer.invoke('app:quit'),
  logout: () => ipcRenderer.invoke('logout'),

  // Descargas
  downloadAndOpenExcel: (relativePath) => ipcRenderer.invoke('download-and-open-excel', relativePath),

  // BD Comparación
  chequespDescargarPlanilla: () => ipcRenderer.invoke('chequesp:descargar-planilla'),

  // Otros
  getUpdatedFecha: () => ipcRenderer.invoke('get-updated-fecha'),
  
});

// ======================
// Espejo como CustomEvent del DOM (fallback para el front)
// ======================
allowedIpcEvents.forEach((ch) => {
  ipcRenderer.on(ch, (_e, data) => {
    try { window.dispatchEvent(new CustomEvent(ch, { detail: data })); } catch {}
  });
});

// ======================
// Hotkeys globales del renderer (fuera de inputs)
// ======================
document.addEventListener('keydown', (e) => {
  // Evitar que se dispare mientras escribís en inputs/textarea
  const el = document.activeElement;
  const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  if (editing) return;

  const safeInvoke = async (channel, payload) => {
    try { await ipcRenderer.invoke(channel, payload); }
    catch (err) { console.warn(`[hotkey] ${channel} fallo:`, err?.message || err); }
  };

  if (e.key === 'F12') { e.preventDefault(); safeInvoke('app:toggle-devtools'); }
  if (e.key === 'F5')  { e.preventDefault(); safeInvoke('app:reload'); }
  if (e.key === 'Escape') { e.preventDefault(); safeInvoke('app:quit'); }
});
