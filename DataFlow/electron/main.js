//electron/main.js
const { app, BrowserWindow, ipcMain, Menu, shell, nativeImage } = require('electron');
const { createServer } = require('http');
const next = require('next');
const url = require('url');
const fs = require('fs');
const path = require('path');


app.disableHardwareAcceleration();

// <-- MODIFICACIÓN: Inicializar el store para persistencia de datos
let store

const userDataPath = app.getPath('userData');
const logFilePath = path.join(userDataPath, 'app_error.log');

function writeToLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(logFilePath, logMessage);
    } catch (logError) {
        console.error(`Error al escribir en el archivo de log: ${logError.message}`);
    }
}

// Capturar excepciones no controladas en el proceso principal
process.on('uncaughtException', (error) => {
    const errorMessage = `Uncaught Exception in Main Process: ${error.message}\n${error.stack}`;
    writeToLog(errorMessage);
    console.error(errorMessage);
    app.quit(); // Cierra la aplicación después de registrar el error
});

// Capturar promesas rechazadas no controladas
process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = `Unhandled Rejection in Main Process: ${reason}\nPromise: ${promise}`;
    writeToLog(errorMessage);
    console.error(errorMessage);
});

// --- Servicios personalizados ---
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { getDatosEmpresaById: getDatosEmpresaById, obtenerListadoEmpresas: obtenerListadoEmpresas, guardarDatosEmpresaConfig: guardarDatosEmpresaConfig } = require('./modulesService/Empresa');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { registroCheq3Sit: registro, actualizarCheque3: actualizarCheque3Service, obtenerCheque3Rechazado: cheque3R, getSituacion: situacion, getUpdatedbyRegistro: getupdreg } = require('./modulesService/Cheques3');
const {
    getArticulos, getClases, getProveedores, getRubros, getTasasIVA,
    getArticuloDetailsById, claseExiste, rubroExiste, getProveedorDetails, getTasaIVADetails
} = require('./modulesService/Articulos');
const { obtenerPrecios: obtenerPreciosService, actualizarListaDePrecios: actualizarPreciosService, obtenerPreciosActualizados:obtenerPreciosActualizadosService } = require('./modulesService/Precios');

const isDev = !app.isPackaged;
let currentPort = 3000; // Puerto inicial
const MAX_PORT_ATTEMPTS = 10; // Número máximo de intentos para encontrar un puerto

const nextApp = next({ dev: isDev, dir: path.join(__dirname, '..') });
const handle = nextApp.getRequestHandler();

let mainWindow;

async function createMainWindow() {
      const { default: Store } = await import('electron-store');
    store = new Store();  
  writeToLog('Iniciando createMainWindow...');

    try {
        writeToLog('Preparando la aplicación Next.js...');
        await nextApp.prepare();
        writeToLog('Aplicación Next.js preparada.');
    } catch (error) {
        const errorMessage = `Error al preparar Next.js: ${error.message}\n${error.stack}`;
        writeToLog(errorMessage);
        console.error(errorMessage);
        app.quit();
        return;
    }

    let server;
    let portFound = false;

    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        try {
            server = createServer((req, res) => {
                handle(req, res);
            });

            await new Promise((resolve, reject) => {
                server.listen(currentPort, () => {
                    writeToLog(`Servidor Next.js listo en http://localhost:${currentPort}`);
                    console.log(`> Ready on http://localhost:${currentPort}`);
                    portFound = true;
                    resolve();
                });

                server.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        writeToLog(`Puerto ${currentPort} en uso, intentando el siguiente...`);
                        currentPort++;
                        server.close();
                        reject(err);
                    } else {
                        reject(err);
                    }
                });
            });

            if (portFound) break;
        } catch (error) {
            if (error.code !== 'EADDRINUSE' || i === MAX_PORT_ATTEMPTS - 1) {
                const errorMessage = `Error crítico al iniciar el servidor Next.js: ${error.message}\n${error.stack}`;
                writeToLog(errorMessage);
                console.error(errorMessage);
                app.quit();
                return;
            }
        }
    }

    if (!portFound) {
        const errorMessage = `No se pudo encontrar un puerto disponible después de ${MAX_PORT_ATTEMPTS} intentos.`;
        writeToLog(errorMessage);
        console.error(errorMessage);
        app.quit();
        return;
    }

    server.on('error', (error) => {
        const errorMessage = `Error en el servidor HTTP de Next.js (después de iniciar): ${error.message}\n${error.stack}`;
        writeToLog(errorMessage);
        console.error(errorMessage);
        app.quit();
    });

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 920,
        icon: path.join(__dirname, '../public/iconodesktop.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        const errorMessage = `Fallo al cargar URL en la ventana principal: ${validatedURL}, Código: ${errorCode}, Descripción: ${errorDescription}, MainFrame: ${isMainFrame}`;
        writeToLog(errorMessage);
        console.error(errorMessage);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        const errorMessage = `Proceso de renderizado desaparecido. Razón: ${details.reason}, Exit Code: ${details.exitCode}`;
        writeToLog(errorMessage);
        console.error(errorMessage);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        writeToLog('La página web ha terminado de cargar.');
    });

    writeToLog(`Cargando URL: http://localhost:${currentPort}/Login`);
    mainWindow.loadURL(`http://localhost:${currentPort}/Login`);

    const template = [
        {
            label: 'Menú',
            submenu: [
                {
                    label: 'Toggle DevTools',
                    accelerator: 'F12',
                    click: () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.toggleDevTools();
                            writeToLog('DevTools toggled.');
                        }
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
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.reload();
                            writeToLog('Window reloaded.');
                        }
                    }
                }
            ],
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (isDev) {
        writeToLog('DevTools abiertos automáticamente en modo desarrollo.');
    }
}

app.whenReady().then(() => {
    writeToLog('Aplicación Electron lista.');
    createMainWindow();
});

app.on('window-all-closed', () => {
    writeToLog('Todas las ventanas cerradas.');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    writeToLog('Evento "activate" disparado.');
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// --- IPC HANDLERS ---
ipcMain.on('abrir-dev-tools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
        writeToLog('IPC: Abrir DevTools solicitado.');
    }
});

// <-- MODIFICACIÓN: Añadir manejadores para leer y escribir en el store
ipcMain.handle('electron-store-get', async (event, key) => {
    return store.get(key);
});

ipcMain.handle('electron-store-set', async (event, { key, value }) => {
    store.set(key, value);
});

ipcMain.handle('login', async (event, { usuario, contraseña }) => {
    writeToLog(`IPC: Intento de login para usuario: ${usuario}`);
    try {
        const result = await iniciarSesionService({ usuario, contraseña });

        if (result.success && result.user && result.token && result.user.IdCliente) {
            writeToLog(`Login exitoso para IdCliente: ${result.user.IdCliente}`);

            // <-- MODIFICACIÓN: Usar electron-store para guardar datos de sesión
            store.set("idCliente", result.user.IdCliente);
            store.set("jwtToken", result.token);
            store.set("fechaInicio", new Date().toISOString());

            const modulesResult = await obtenerModulosService(result.user.IdCliente);
            if (!modulesResult.success) {
                writeToLog(`Error al obtener módulos después del login: ${modulesResult.message}`);
                return { success: false, message: modulesResult.message };
            }

            const modulos = modulesResult.modulos.map(modulo => ({
                id: modulo.id,
                nombre: modulo.nombre,
                texto: modulo.texto,
                icono: modulo.icono,
                link: modulo.link,
                path: modulo.pathExcel,
                countClientesPorModulo: modulo.countClientesPorModulo,
            }));

            // Reconstruir el menú después del login con los módulos
            const template = [
                {
                    label: 'Menú',
                    submenu: [
            ...modulos.map(modulo => ({
              label: modulo.nombre,
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}`);
                  writeToLog(`Navegando a módulo: ${modulo.link}`);
                }
              },
            })),
                        { type: 'separator' },
                        {
                            label: 'Toggle DevTools',
                            accelerator: 'F12',
                            click: () => {
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.webContents.toggleDevTools();
                                    writeToLog('DevTools toggled via menu.');
                                }
                            },
                        },
                        {
                            label: 'Inicio',
                            accelerator: 'Home',
                            click: () => {
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.loadURL(`http://localhost:${currentPort}/Index`);
                                }
                            }
                        },
                        {
                            label: 'Actualizar',
                            accelerator: 'F5',
                            click: () => {
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.reload();
                                    writeToLog('Window reloaded via menu.');
                                }
                            },
                        },
                        {
                            role: 'quit',
                            label: 'Salir',
                            accelerator: 'Esc',
                        },
                    ],
                },
            ];

            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
            writeToLog('Menú de la aplicación actualizado con módulos.');

            return { success: true, user: result.user, modulos, token: result.token };
        }

        writeToLog(`Login fallido: ${result.message || 'Credenciales inválidas'}`);
        return result;
    } catch (error) {
        const errorMessage = `Error en IPC login handler: ${error.message}\n${error.stack}`;
        writeToLog(errorMessage);
        console.error(errorMessage);
        return { success: false, message: `Error interno al intentar iniciar sesión: ${error.message}` };
    }
});

// --- RESTO DE LOS IPC HANDLERS (sin cambios) ---

ipcMain.handle('get-list-empresas', async (event, idCliente) => {
    try {
        const empresas = await obtenerListadoEmpresas(idCliente);
        return { success: true, data: empresas };
    } catch (error) {
        console.error('Error en main.js al obtener listado de empresas:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-empresa-by-id', async (event, idEmpresa) => {
  try {
    const datosEmpresa = await getDatosEmpresaById(idEmpresa);
    return { success: true, data: datosEmpresa };
  } catch (error) {
    console.error('Error en main.js al obtener datos de empresa por ID:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-empresa-config', async (event, empresaData, idCliente) => {
  try {
    await guardarDatosEmpresaConfig(empresaData, idCliente);
    return { success: true, message: 'Configuración guardada exitosamente.' };
  } catch (error) {
    console.error('Error en main.js al guardar configuración:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-modules', async (event, idCliente) => {
  try {
    return await obtenerModulosService(idCliente);
  } catch (error) {
    writeToLog(`Error en IPC get-modules: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener módulos: ${error.message}` };
  }
});

ipcMain.handle('obtener-cheques', async (event, id) => {
  try {
    return await obtenerChequeService(id);
  } catch (error) {
    writeToLog(`Error en IPC obtener-cheques: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener cheques: ${error.message}` };
  }
});
ipcMain.handle('update-cheques', async (event, cheque) => {
  try {
    return await actualizarChequeService(cheque);
  } catch (error) {
    writeToLog(`Error en IPC update-cheques: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al actualizar cheques: ${error.message}` };
  }
});
ipcMain.handle('update-cheque3', async (event, { IDCheque, sit }) => {
  writeToLog(`IPC: Actualizando cheque3 con ID: ${IDCheque} y situación: ${sit}`);
  try {
    return await actualizarCheque3Service(IDCheque, sit);
  } catch (error) {
    writeToLog(`Error en IPC update-cheque3: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al actualizar cheque 3: ${error.message}` };
  }
});
ipcMain.handle('cheque3-rechazado', async () => {
  try {
    return await cheque3R();
  } catch (error) {
    writeToLog(`Error en IPC cheque3-rechazado: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener cheque 3 rechazado: ${error.message}` };
  }
});
ipcMain.handle('cheque3-situacion', async () => {
  try {
    return await situacion();
  } catch (error) {
    writeToLog(`Error en IPC cheque3-situacion: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener situación de cheque 3: ${error.message}` };
  }
});
ipcMain.handle('registro-cheque3-sit', async (event, { emp, suc, IDCheque, sit, sitAnt }) => {
  try {
    return await registro(emp, suc, IDCheque, sit, sitAnt);
  } catch (error) {
    writeToLog(`Error en IPC registro-cheque3-sit: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al registrar situación de cheque 3: ${error.message}` };
  }
});

// Artículos
ipcMain.handle('get-articulos', async () => {
  try {
    return await getArticulos();
  } catch (error) {
    writeToLog(`Error en IPC get-articulos: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener artículos: ${error.message}` };
  }
});
ipcMain.handle('get-clases', async () => {
  try {
    return await getClases();
  } catch (error) {
    writeToLog(`Error en IPC get-clases: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener clases: ${error.message}` };
  }
});
ipcMain.handle('get-proveedores', async () => {
  try {
    return await getProveedores();
  } catch (error) {
    writeToLog(`Error en IPC get-proveedores: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener proveedores: ${error.message}` };
  }
});
ipcMain.handle('get-rubros', async () => {
  try {
    return await getRubros();
  } catch (error) {
    writeToLog(`Error en IPC get-rubros: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener rubros: ${error.message}` };
  }
});
ipcMain.handle('get-tasas-iva', async () => {
  try {
    return await getTasasIVA();
  } catch (error) {
    writeToLog(`Error en IPC get-tasas-iva: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener tasas IVA: ${error.message}` };
  }
});
ipcMain.handle('get-articulo-details-by-id', async (event, codGenArticulo) => {
  try {
    return await getArticuloDetailsById(codGenArticulo);
  } catch (error) {
    writeToLog(`Error en IPC get-articulo-details-by-id: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener detalles de artículo: ${error.message}` };
  }
});
ipcMain.handle('clase-existe', async (event, codigoClase) => {
  try {
    return await claseExiste(codigoClase);
  } catch (error) {
    writeToLog(`Error en IPC clase-existe: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al verificar clase: ${error.message}` };
  }
});
ipcMain.handle('rubro-existe', async (event, codigoRubro) => {
  try {
    return await rubroExiste(codigoRubro);
  } catch (error) {
    writeToLog(`Error en IPC rubro-existe: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al verificar rubro: ${error.message}` };
  }
});
ipcMain.handle('get-proveedor-details', async (event, codigoProveedor) => {
  try {
    return await getProveedorDetails(codigoProveedor);
  } catch (error) {
    writeToLog(`Error en IPC get-proveedor-details: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener detalles de proveedor: ${error.message}` };
  }
});
ipcMain.handle('get-tasa-iva-details', async (event, codigoTasaIVA) => {
  try {
    return await getTasaIVADetails(codigoTasaIVA);
  } catch (error) {
    writeToLog(`Error en IPC get-tasa-iva-details: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener detalles de tasa IVA: ${error.message}` };
  }
});
ipcMain.handle('get-updated-fecha', async (event) => {
  try {
    return await getupdreg();
  } catch (error) {
    writeToLog(`Error en IPC get-updated-fecha: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener fecha de actualización: ${error.message}` };
  }
});

// Precios
ipcMain.handle('get-precios', async () => {
  try {
    return await obtenerPreciosService();
  } catch (error) {
    writeToLog(`Error en IPC get-precios: ${error.message}\n${error.stack}`);
    console.error(error);
    return { success: false, message: `Error al obtener precios: ${error.message}` };
  }
});

ipcMain.handle('actualizar-precios', async () => {
    try {
        return await actualizarPreciosService();
    } catch (error) {
        console.error('Error en IPC al actualizar precios:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-precios-actualizados', async () => {
    try {
        return await obtenerPreciosActualizadosService();
    } catch (error) {
        console.error('Error en IPC al obtener precios actualizados:', error);
        return { success: false, message: error.message };
    }
});
// Abrir archivo Excel
ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
  try {
    if (!relativeFilePath) {
      writeToLog("Error: No se proporcionó una ruta de archivo relativa para download-and-open-excel.");
      throw new Error("No se proporcionó una ruta de archivo relativa.");
    }

    const appBasePath = app.getAppPath();
    const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);
    writeToLog(`Intentando abrir archivo Excel: ${absoluteFilePath}`);

    if (!fs.existsSync(absoluteFilePath)) {
      writeToLog(`Error: Archivo no encontrado en la ruta: ${absoluteFilePath}`);
      throw new Error(`Archivo no encontrado: ${absoluteFilePath}`);
    }

    const result = await shell.openPath(absoluteFilePath);
    if (result) { // shell.openPath devuelve un string de error si falla
      writeToLog(`Fallo al abrir archivo Excel: ${result}`);
      throw new Error(`Fallo al abrir archivo: ${result}`);
    }

    writeToLog("Plantilla Excel abierta automáticamente.");
    return { success: true, message: "Plantilla abierta automáticamente." };
  } catch (error) {
    const errorMessage = `Error en download-and-open-excel: ${error.message}\n${error.stack}`;
    writeToLog(errorMessage);
    console.error(errorMessage);
    return { success: false, message: `Error al abrir la plantilla: ${error.message}` };
  }
});
