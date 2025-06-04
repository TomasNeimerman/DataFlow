// back/main.js
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const sql = require('mssql'); // Importar sql si se usa directamente en main.js (aunque no es el caso aquí)
const fs = require('fs');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { obtenerCheque3Actualizado: obtenerCheque3Service, actualizarCheque3: actualizarCheque3Service, obtenerCheque3Rechazado: cheque3R, getSituacion: situacion } = require('./modulesService/Cheques3'); // <--- Asegúrate de que esta línea exista y esté correcta

// IMPORTAR TODAS LAS FUNCIONES DE Articulos.js
const {
    getArticulos,
    getClases, // Ya estaba, pero lo incluyo para que veas que se mantiene
    getProveedores,
    getRubros,
    getTasasIVA,
    getArticuloDetailsById,
    claseExiste,
    rubroExiste,
    getProveedorDetails,
    getTasaIVADetails
} = require('./modulesService/Articulos'); // <-- Asegúrate de que esta ruta sea correcta

const logger = require('./logger'); // Asegúrate de que logger esté correctamente configurado si lo usas.
const { get } = require('http'); // Esta importación de 'http' no parece usarse, puedes quitarla si no es necesaria.

let mainWindow;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 920,
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL('http://localhost:3000/Login');

    const template = [
        {
            label: 'Menú',
            submenu: [
                {
                    label: 'Toggle DevTools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                {
                    label: 'Salir',
                    role: 'quit',
                    accelerator: 'Esc'
                },
                {
                    label: 'Reload',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.reload();
                    }
                }
            ],
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

ipcMain.on('abrir-dev-tools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
    }
});

ipcMain.handle('login', async (event, { usuario, contraseña }) => {
    const result = await iniciarSesionService({ usuario, contraseña });
    if (result.success && result.user && result.token && result.user.IdCliente) {
        mainWindow.webContents.executeJavaScript(
            `localStorage.setItem("idCliente", "${result.user.IdCliente}");`
        );

        const modulesResult = await obtenerModulosService(result.user.IdCliente);

        if (modulesResult.success) {
            const modulos = modulesResult.modulos.map(modulo => ({
                id: modulo.id,
                nombre: modulo.nombre,
                texto: modulo.texto,
                icono: modulo.icono,
                link: modulo.link,
                path: modulo.pathExcel,
                countClientesPorModulo: modulo.countClientesPorModulo
            }));
            console.log(modulos)
            const template = [
                {
                    label: 'Menú',
                    submenu: [
                        ...modulos.map(modulo => ({
                            label: modulo.nombre,
                            click: () => {
                                mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}`);
                            }
                        })),
                        {
                            type: 'separator'
                        },
                        {
                            label: 'Toggle DevTools',
                            accelerator: 'F12',
                            click: () => {
                                mainWindow.webContents.toggleDevTools();
                            }
                        },

                        {
                            label: 'Actualizar',
                            accelerator: 'F5',
                            click: () => {
                                mainWindow.reload();
                            },

                        },
                        {
                            role: 'quit',
                            label: 'Salir',
                            accelerator: 'Esc'
                        },
                    ]
                }
            ];

            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
            return { success: true, user: result.user, modulos, token: result.token };
        } else {
            return { success: false, message: modulesResult.message };
        }
    }
    return result;
});

ipcMain.handle('get-modules', async (event, idCliente) => {
    return await obtenerModulosService(idCliente);
});

ipcMain.handle('obtener-cheques', async (event, id) => {
    return await obtenerChequeService(id);
});

ipcMain.handle('update-cheques', async (event, cheque) => {
    
    return await actualizarChequeService(cheque);
});

ipcMain.handle('obtener-cheque3-act', async (event, id) => {
    return await obtenerCheque3Service(id);
});

ipcMain.handle('update-cheque3', async (event, {IDCheque,sit}) => {
    console.log(`Actualizando cheque con ID: ${IDCheque} y situación: ${sit} EN MAIN`);
    return await actualizarCheque3Service(IDCheque, sit);
});

// --- IPC HANDLERS PARA FUNCIONES DE ARTÍCULOS ---
ipcMain.handle('get-articulos', async (event) => {
    return await getArticulos();
});

ipcMain.handle('get-clases', async (event) => { // Ya existía, se mantiene
    return await getClases();
});

ipcMain.handle('get-proveedores', async (event) => {
    return await getProveedores();
});

ipcMain.handle('get-rubros', async (event) => {
    return await getRubros();
});

ipcMain.handle('get-tasas-iva', async (event) => {
    return await getTasasIVA();
});

ipcMain.handle('get-articulo-details-by-id', async (event, codGenArticulo) => {
    return await getArticuloDetailsById(codGenArticulo);
});

ipcMain.handle('clase-existe', async (event, codigoClase) => {
    return await claseExiste(codigoClase);
});

ipcMain.handle('rubro-existe', async (event, codigoRubro) => {
    return await rubroExiste(codigoRubro);
});

ipcMain.handle('get-proveedor-details', async (event, codigoProveedor) => {
    return await getProveedorDetails(codigoProveedor);
});

ipcMain.handle('get-tasa-iva-details', async (event, codigoTasaIVA) => {
    return await getTasaIVADetails(codigoTasaIVA);
});
// --- FIN IPC HANDLERS PARA FUNCIONES DE ARTÍCULOS ---
ipcMain.handle('cheque3-rechazado', async (event) => {
    return await cheque3R();
})
ipcMain.handle('cheque3-situacion', async (event) => {
    return await situacion();
})
ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
    try {
        if (!relativeFilePath) {
            throw new Error("No se proporcionó una ruta de archivo relativa.");
        }

        const appBasePath = app.getAppPath();
        const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);

        console.log(`Intentando abrir archivo en ruta absoluta: ${absoluteFilePath}`);

        if (!fs.existsSync(absoluteFilePath)) {
            throw new Error(`El archivo no se encontró en la ruta: ${absoluteFilePath}`);
        }

        const result = await shell.openPath(absoluteFilePath);

        if (result) {
            throw new Error(`Fallo al abrir el archivo: ${result}`);
        }

        console.log(`Archivo abierto exitosamente: ${absoluteFilePath}`);

        return { success: true, message: "Plantilla abierta automáticamente." };
    } catch (error) {
        console.error('Error en download-and-open-excel:', error);
        console.error('Ruta de entrada que causó el error (relativeFilePath):', relativeFilePath);
        return { success: false, message: `Error al abrir la plantilla: ${error.message}` };
    }
});