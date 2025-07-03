// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('api', {
    login: (usuario, contraseña) => ipcRenderer.invoke('login', { usuario, contraseña }),
    getModules: (idCliente) => ipcRenderer.invoke('get-modules', idCliente),
    obtenerCheques: (id) => ipcRenderer.invoke('obtener-cheques', id),
    updateCheques: (cheque) => ipcRenderer.invoke('update-cheques', cheque),

    updateCheque3: (IDCheque,sit) => ipcRenderer.invoke('update-cheque3', {IDCheque, sit}),
    abrirDevTools: () => ipcRenderer.send('abrir-dev-tools'),
    downloadAndOpenExcel: (url) => ipcRenderer.invoke('download-and-open-excel', url),
    getArticulos: () => ipcRenderer.invoke('get-articulos'),
    getClases: () => ipcRenderer.invoke('get-clases'), // Ya existía, se mantiene
    getProveedores: () => ipcRenderer.invoke('get-proveedores'),
    getRubros: () => ipcRenderer.invoke('get-rubros'),
    getTasasIVA: () => ipcRenderer.invoke('get-tasas-iva'),
    getArticuloDetailsById: (codGenArticulo) => ipcRenderer.invoke('get-articulo-details-by-id', codGenArticulo),
    claseExiste: (codigoClase) => ipcRenderer.invoke('clase-existe', codigoClase),
    rubroExiste: (codigoRubro) => ipcRenderer.invoke('rubro-existe', codigoRubro),
    getProveedorDetails: (codigoProveedor) => ipcRenderer.invoke('get-proveedor-details', codigoProveedor),
    getTasaIVADetails: (codigoTasaIVA) => ipcRenderer.invoke('get-tasa-iva-details', codigoTasaIVA),
    getSituacion: () => ipcRenderer.invoke('cheque3-situacion'),
    setRegistro: (emp, suc, IDCheque, sit, sitAnt) => ipcRenderer.invoke('registro-cheque3-sit', { emp, suc, IDCheque, sit, sitAnt }),
    obtenerCheque3Rechazado: () => ipcRenderer.invoke('cheque3-rechazado'),
    getUpdatedFecha: () => ipcRenderer.invoke('get-updated-fecha'),
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
        window.api.abrirDevTools();
    }
});