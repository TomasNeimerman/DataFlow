// back/main.js
const { app, BrowserWindow, ipcMain, Menu, shell, nativeImage } = require('electron');
const { createServer } = require('http');
const next = require('next');
const url = require('url'); // Asegúrate de que url esté importado
const fs = require('fs'); // Ya lo tenías, asegúrate que se usa si lo necesitas
const path = require('path'); // Ya lo tenías, asegúrate que se usa si lo necesitas
// Servicios personalizados
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { registroCheq3Sit: registro, actualizarCheque3: actualizarCheque3Service, obtenerCheque3Rechazado: cheque3R, getSituacion: situacion, getUpdatedbyRegistro: getupdreg } = require('./modulesService/Cheques3');
const {
  getArticulos, getClases, getProveedores, getRubros, getTasasIVA,
  getArticuloDetailsById, claseExiste, rubroExiste, getProveedorDetails, getTasaIVADetails
} = require('./modulesService/Articulos');
const isDev = !app.isPackaged;
const port = 3000;
const nextApp = next({ dev: isDev, dir: path.join(__dirname, '..') });
const handle = nextApp.getRequestHandler();

let mainWindow;

async function createMainWindow() {
  await nextApp.prepare();
  
  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 920,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });


  mainWindow.loadURL(`http://localhost:${port}/Login`);
  
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
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
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
    if (!modulesResult.success) return { success: false, message: modulesResult.message };

    const modulos = modulesResult.modulos.map(modulo => ({
      id: modulo.id,
      nombre: modulo.nombre,
      texto: modulo.texto,
      icono: modulo.icono,
      link: modulo.link,
      path: modulo.pathExcel,
      countClientesPorModulo: modulo.countClientesPorModulo,
    }));

    const template = [
      {
        label: 'Menú',
        submenu: [
          ...modulos.map(modulo => ({
            label: modulo.nombre,
            click: () => {
              mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}`);
            },
          })),
          { type: 'separator' },
          {
            label: 'Toggle DevTools',
            accelerator: 'F12',
            click: () => mainWindow.webContents.toggleDevTools(),
          },
          {
            label: 'Actualizar',
            accelerator: 'F5',
            click: () => mainWindow.reload(),
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

    return { success: true, user: result.user, modulos, token: result.token };
  }

  return result;
});

// --- IPC HANDLERS ---
ipcMain.handle('get-modules', async (event, idCliente) => await obtenerModulosService(idCliente));
ipcMain.handle('obtener-cheques', async (event, id) => await obtenerChequeService(id));
ipcMain.handle('update-cheques', async (event, cheque) => await actualizarChequeService(cheque));
ipcMain.handle('update-cheque3', async (event, { IDCheque, sit }) => {
  console.log(`Actualizando cheque con ID: ${IDCheque} y situación: ${sit} EN MAIN`);
  return await actualizarCheque3Service(IDCheque, sit);
});
ipcMain.handle('cheque3-rechazado', async () => await cheque3R());
ipcMain.handle('cheque3-situacion', async () => await situacion());
ipcMain.handle('registro-cheque3-sit', async (event, { emp, suc, IDCheque, sit, sitAnt }) => await registro(emp, suc, IDCheque, sit, sitAnt));

// Artículos
ipcMain.handle('get-articulos', async () => await getArticulos());
ipcMain.handle('get-clases', async () => await getClases());
ipcMain.handle('get-proveedores', async () => await getProveedores());
ipcMain.handle('get-rubros', async () => await getRubros());
ipcMain.handle('get-tasas-iva', async () => await getTasasIVA());
ipcMain.handle('get-articulo-details-by-id', async (event, codGenArticulo) => await getArticuloDetailsById(codGenArticulo));
ipcMain.handle('clase-existe', async (event, codigoClase) => await claseExiste(codigoClase));
ipcMain.handle('rubro-existe', async (event, codigoRubro) => await rubroExiste(codigoRubro));
ipcMain.handle('get-proveedor-details', async (event, codigoProveedor) => await getProveedorDetails(codigoProveedor));
ipcMain.handle('get-tasa-iva-details', async (event, codigoTasaIVA) => await getTasaIVADetails(codigoTasaIVA));
ipcMain.handle('get-updated-fecha', async (event) => await getupdreg())
// Abrir archivo Excel
ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => {
  try {
    if (!relativeFilePath) throw new Error("No se proporcionó una ruta de archivo relativa.");

    const appBasePath = app.getAppPath();
    const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);

    if (!fs.existsSync(absoluteFilePath)) throw new Error(`Archivo no encontrado: ${absoluteFilePath}`);

    const result = await shell.openPath(absoluteFilePath);
    if (result) throw new Error(`Fallo al abrir archivo: ${result}`);

    return { success: true, message: "Plantilla abierta automáticamente." };
  } catch (error) {
    console.error('Error en download-and-open-excel:', error);
    return { success: false, message: `Error al abrir la plantilla: ${error.message}` };
  }
});