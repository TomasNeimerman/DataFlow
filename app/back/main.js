// back/main.js
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const sql = require('mssql');
const fs = require('fs');
const { obtenerCheque: obtenerChequeService, actualizarCheque: actualizarChequeService } = require('./modulesService/ChequesP');
const { iniciarSesion: iniciarSesionService, obtenerModulos: obtenerModulosService } = require('./modulesService/Login');
const { obtenerCheque3: obtenerCheque3Service, actualizarCheque3: actualizarCheque3Service } = require('./modulesService/Cheques3'); // <--- Asegúrate de que esta línea exista y esté correcta
const { getClases: getClases } = require('./modulesService/Articulos'); // Asegúrate de que esta línea exista y esté correcta
const logger = require('./logger');
const { get } = require('http');

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

ipcMain.handle('obtener-cheque3', async (event, id) => {
  return await obtenerCheque3Service(id);
});

ipcMain.handle('update-cheque3', async (event, cheque) => {
  return await actualizarCheque3Service(cheque);
});
ipcMain.handle('get-clases', async (event) => {
  return await getClases();
})
ipcMain.handle('download-and-open-excel', async (event, relativeFilePath) => { // Aquí relativeFilePath es el '../templates/chequesp.xlsx'
  try {
      if (!relativeFilePath) {
          throw new Error("No se proporcionó una ruta de archivo relativa.");
      }

      const appBasePath = app.getAppPath(); // C:\Users\Tomas\Desktop\ArchivosPC\SistemaCONE\app

      // **Esta es la línea clave y está bien así:**
      // Resuelve la ruta relativa a una ruta absoluta del sistema de archivos.
      const absoluteFilePath = path.resolve(appBasePath, relativeFilePath);

      console.log(`Intentando abrir archivo en ruta absoluta: ${absoluteFilePath}`);

      if (!fs.existsSync(absoluteFilePath)) {
          throw new Error(`El archivo no se encontró en la ruta: ${absoluteFilePath}`);
      }

      // Abre el archivo usando shell.openPath()
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