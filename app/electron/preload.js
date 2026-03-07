// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

/* ============================================================================
   🔔 Eventos que el proceso main puede emitir al renderer (whitelist)
   ========================================================================== */
const allowedIpcEvents = [
  'store:any-change',
  'menu:modules-updated',
  'session:state',
  'empresa:selected',
  'cheques:updated',
  'precios:updated',
  'navigate-to',
];

/* ============================================================================
   Utils para suscripción segura
   ========================================================================== */
const _listenerMap = new WeakMap();
const safeOn = (channel, fn) => {
  if (!allowedIpcEvents.includes(channel) || typeof fn !== 'function') return;
  const wrapped = (_e, data) => { try { fn(data); } catch {} };
  _listenerMap.set(fn, wrapped);
  ipcRenderer.on(channel, wrapped);
};
const safeOff = (channel, fn) => {
  if (!allowedIpcEvents.includes(channel) || typeof fn !== 'function') return;
  const wrapped = _listenerMap.get(fn);
  if (wrapped) {
    ipcRenderer.removeListener(channel, wrapped);
    _listenerMap.delete(fn);
  }
};

/* ============================================================================
   Bridges específicos (Clientes / Proveedores / etc.)
   ========================================================================== */
const clientesForm = {
  traerTodos:              () => ipcRenderer.invoke('clientesForm:traerTodos'),
  traerCodigosLista:       () => ipcRenderer.invoke('clientesForm:traerCodigosLista'),
  getCatalogos:            () => ipcRenderer.invoke('clientesForm:getCatalogos'),
  getCatalogosGeneral:     () => ipcRenderer.invoke('clientesForm:getCatalogosGeneral'),
  getCatalogosImpositivos: () => ipcRenderer.invoke('clientesForm:getCatalogosImpositivos'),
  getCatalogosOtros:       () => ipcRenderer.invoke('clientesForm:getCatalogosOtros'),
  actualizarLista:         (payload) => ipcRenderer.invoke('clientesForm:actualizarLista', payload),
  actualizarCampos:        (payload) => ipcRenderer.invoke('clientesForm:actualizarCampos', payload),
};

const proveedoresForm = {
  traerTodos:              () => ipcRenderer.invoke('proveedoresForm:traerTodos'),
  traerCodigosLista:       () => ipcRenderer.invoke('proveedoresForm:traerCodigosLista'),
  getCatalogos:            () => ipcRenderer.invoke('proveedoresForm:getCatalogos'),
  getCatalogosGeneral:     () => ipcRenderer.invoke('proveedoresForm:getCatalogosGeneral'),
  getCatalogosImpositivos: () => ipcRenderer.invoke('proveedoresForm:getCatalogosImpositivos'),
  getCatalogosOtros:       () => ipcRenderer.invoke('proveedoresForm:getCatalogosOtros'),
  actualizarLista:         (payload) => ipcRenderer.invoke('proveedoresForm:actualizarLista', payload),
  actualizarCampos:        (payload) => ipcRenderer.invoke('proveedoresForm:actualizarCampos', payload),
};

/* ============================================================================
   Exposición al renderer
   ========================================================================== */
contextBridge.exposeInMainWorld('api', {
  /* ======================
     Event Bus
     ====================== */
  on:  (channel, fn) => safeOn(channel, fn),
  off: (channel, fn) => safeOff(channel, fn),

  /* ======================
     Auth / Sesión
     ====================== */
  // payload: { usuario, contraseña, remember? }
  login: (payload) => ipcRenderer.invoke('login', payload),
  attemptAutoLogin: () => ipcRenderer.invoke('attempt-auto-login'),
  logout: () => ipcRenderer.invoke('logout'),
  forceLogout: (reason = 'renderer') => ipcRenderer.invoke('force-logout', { reason }),
  whoami: () => ipcRenderer.invoke('whoami'),

  /* ======================
     ODBC (canales según tu main actual)
     ====================== */
  // 1) Determinar server para el usuario que inicia
  getServerForLogin: (usuario, contraseña) =>
    ipcRenderer.invoke('odbc:get-server', { usuario, contraseña }),
  // 2) Persistir server elegido (para helper ODBC)
  saveServerForOdbc: (server) =>
    ipcRenderer.invoke('admin:save-server', { server }),
  // 3) Conectar y persistir DSN/props (devuelve debug detallado)
  odbcConnectAndSave: () =>
    ipcRenderer.invoke('odbc:connect-and-save', {}),

  // Navegación disparada desde main (si lo usás)
  onNavigate: (callback) =>
    ipcRenderer.on('navigate-to', (_event, path) => { try { callback(path); } catch {} }),

  /* ======================
     Empresa / Módulos
     ====================== */
  listEmpresasLocal: () => ipcRenderer.invoke('empresas:list-manager-emp'),
  verifyEmpresaForUser: (payload) => ipcRenderer.invoke('empresa:verify-and-save', payload),
  getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
  getModulosXCliente: (idCliente) => ipcRenderer.invoke('get-modulos-x-cliente', idCliente),
  buildMenu: (modulos) => ipcRenderer.invoke('menu:set-modules', modulos),

  /* ======================
     Cheques
     ====================== */
  obtenerCheques: (id) => ipcRenderer.invoke('obtener-cheques', id),
  updateCheques: (cheque) => ipcRenderer.invoke('update-cheques', cheque),
  chequespPreview: () => ipcRenderer.invoke('chequesp:preview'),
  updateCheque3: (IDCheque, sit) => ipcRenderer.invoke('update-cheque3', { IDCheque, sit }),
  getSituacion: () => ipcRenderer.invoke('cheque3-situacion'),
  setRegistro: (emp, suc, IDCheque, sit, sitAnt) =>
    ipcRenderer.invoke('registro-cheque3-sit', { emp, suc, IDCheque, sit, sitAnt }),
  obtenerCheque3Rechazado: () => ipcRenderer.invoke('cheque3-rechazado'),
  updateCheque3Field: (IDCheque, campo, valor) =>
    ipcRenderer.invoke('cheque3-update-field', { IDCheque, campo, valor }),
  exportCheques3Xlsx: (rows) => ipcRenderer.invoke('cheques3:export-xlsx', rows),
  obtenerCheque3RechazadoPaged: (payload) => ipcRenderer.invoke('cheque3-rechazado-paged', payload),
  obtenerCheques3Filtrado: (payload) => ipcRenderer.invoke("obtenerCheques3Filtrado", payload),

  /* ======================
     Artículos / catálogos
     ====================== */
  getArticulos: () => ipcRenderer.invoke('get-articulos'),
  getClases: () => ipcRenderer.invoke('get-clases'),
  getProveedores: () => ipcRenderer.invoke('get-proveedores'),
  getRubros: () => ipcRenderer.invoke('get-rubros'),
  getTasasIVA: () => ipcRenderer.invoke('get-tasas-iva'),
  getArticuloDetailsById: (codGenArticulo) =>
    ipcRenderer.invoke('get-articulo-details-by-id', codGenArticulo),
  claseExiste: (codigoClase) => ipcRenderer.invoke('clase-existe', codigoClase),
  rubroExiste: (codigoRubro) => ipcRenderer.invoke('rubro-existe', codigoRubro),
  getProveedorDetails: (codigoProveedor) =>
    ipcRenderer.invoke('get-proveedor-details', codigoProveedor),
  getTasaIVADetails: (codigoTasaIVA) =>
    ipcRenderer.invoke('get-tasa-iva-details', codigoTasaIVA),

  /* ======================
     Precios
     ====================== */
     getPreciosScriptInfo: () => ipcRenderer.invoke('precios:get-script-info'),
  getPrecios: () => ipcRenderer.invoke('get-precios'),
  actualizarPrecios: (opts) => ipcRenderer.invoke('precios:actualizar', opts),
  onPreciosProgress: (cb) => {
    const handler = (_evt, payload) => { try { cb && cb(payload); } catch {} };
    ipcRenderer.on('precios:update-progress', handler);
    return () => ipcRenderer.removeListener('precios:update-progress', handler);
  },
  getPreciosActualizados: () => ipcRenderer.invoke('get-precios-actualizados'),
  previewLista: (listaCod, limit) =>
    ipcRenderer.invoke('precios:preview-lista', { listaCod, limit }),
  getCodigosLista: () => ipcRenderer.invoke('precios:codigos-lista'),
  descargarListaXlsx: (listaCod) => ipcRenderer.invoke('descargar-lista-xlsx', listaCod),
  openPath:  (p) => ipcRenderer.invoke('open-path', p),
  revealPath:(p) => ipcRenderer.invoke('reveal-path', p),
  actualizarPreciosExcel: (items) => ipcRenderer.invoke('precios:actualizar-excel', items),
  getPreciosExcelUltimos: () => ipcRenderer.invoke('precios:excel-ultimos'),

  /* ======================
     Clientes
     ====================== */
  getListasClientes: () => ipcRenderer.invoke('clientes:listas-habilitadas'),
  clientesListar: (payload) => ipcRenderer.invoke('clientes:listar', payload),
  clientesActualizarFiltrado: (payload) => ipcRenderer.invoke('clientes:actualizar-filtrado', payload),
  getOrdenamientos: () => ipcRenderer.invoke('paramgen:get-ordenamientos'),
  clientesForm,
  

  /* ======================
     Proveedores
     ====================== */
  proveedoresForm,

  /* ======================
     Recibos
     ====================== */
  recibos: {
    getTiposComprobante: (params) => ipcRenderer.invoke('recibos:getTiposComprobante', params),
    getMonedas:          ()       => ipcRenderer.invoke('recibos:getMonedas'),
    getTipoCambio:       (params) => ipcRenderer.invoke('recibos:getTipoCambio', params),
    getFacturas:         (p)      => ipcRenderer.invoke('recibos:getFacturas', p),
    getMonedasTcEditables: ()     => ipcRenderer.invoke('recibos:get-monedas-tc-editables'),
    getSaldoCliente:     (payload)=> ipcRenderer.invoke('recibos:get-saldo-cliente', payload),
    getTransferencias:   ()       => ipcRenderer.invoke("recibos:getTransferencias"),
    getCajas:            ()       => ipcRenderer.invoke("recibos:getCajas"),
    getAplicaciones:     ()       => ipcRenderer.invoke("recibos:getAplicaciones"),
  },
  // ======================
  // SDK Bejerman
  // ======================
  sdk: {
    ventas: {
      ingresarRecibo: (params) => ipcRenderer.invoke('sdk:ventas:ingresar-recibo', params),
      ingresarRecibosMultiples: (params) => ipcRenderer.invoke('sdk:ventas:ingresar-recibos-multiples', params),
      listarRecibos: (params) => ipcRenderer.invoke('sdk:ventas:listar-recibos', params),
    },
  },

  /* ======================
     Store (electron-store en main)
     ====================== */
  getStoreValue: (key) => ipcRenderer.invoke('electron-store-get', key),
  setStoreValue: (keyOrObj, value) => {
    const payload = (keyOrObj && typeof keyOrObj === 'object' && !Array.isArray(keyOrObj))
      ? keyOrObj
      : { key: keyOrObj, value };
    return ipcRenderer.invoke('electron-store-set', payload);
  },
  deleteStoreKey: (key) => ipcRenderer.invoke('electron-store-delete', key),

  /* ======================
     UI / App
     ====================== */
  showHamburger: (coords) => ipcRenderer.invoke('ui:show-hamburger', coords),
  openHamburger: (coords) => ipcRenderer.invoke('hamburger:open', coords),
  isDev: () => ipcRenderer.invoke('env:is-dev'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'),
  reload: () => ipcRenderer.invoke('app:reload'),
  quit: () => ipcRenderer.invoke('app:quit'),
  downloadAndOpenExcel: (relativePath) => ipcRenderer.invoke('download-and-open-excel', relativePath),
  chequespDescargarPlanilla: () => ipcRenderer.invoke('chequesp:descargar-planilla'),
  getUpdatedFecha: () => ipcRenderer.invoke('get-updated-fecha'),
});

/* ============================================================================
   Espejo como CustomEvent del DOM (fallback para el front)
   ========================================================================== */
allowedIpcEvents.forEach((ch) => {
  ipcRenderer.on(ch, (_e, data) => {
    try { window.dispatchEvent(new CustomEvent(ch, { detail: data })); } catch {}
  });
});

/* ============================================================================
   Hotkeys globales del renderer (fuera de inputs)
   ========================================================================== */
document.addEventListener('keydown', (e) => {
  const el = document.activeElement;
  const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  if (editing) return;

  const run = async (channel, payload) => {
    try { await ipcRenderer.invoke(channel, payload); }
    catch (err) { console.warn(`[hotkey] ${channel} fallo:`, err?.message || err); }
  };

  if (e.key === 'F12')    { e.preventDefault(); run('app:toggle-devtools'); }
  if (e.key === 'F5')     { e.preventDefault(); run('app:reload'); }
  if (e.key === 'Escape') { e.preventDefault(); run('app:quit'); }
});
