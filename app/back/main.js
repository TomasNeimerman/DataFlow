// electron/main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const sql = require('mssql');
const { generarToken } = require('./jwtService');
const { getDbConfig } = require('./dbConfig');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,  
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://localhost:3000/Login');
  mainWindow.webContents.openDevTools();
  const template = [
    {
      label: 'Menú',
      submenu: [{ role: 'quit', label: 'Salir' }]
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

ipcMain.handle('login', async (event, { usuario, contraseña }) => {
  try {
    const dbConfig = getDbConfig();
    const pool = await sql.connect(dbConfig);

    // 🔹 1. Hacer login
    const loginResult = await pool.request()
      .input('usuario', sql.NVarChar, usuario)
      .input('contraseña', sql.NVarChar, contraseña)
      .query(`
        SELECT Id, Nombre, Apellido, Email, IdCliente
        FROM Usuarios
        WHERE Usuario = @usuario AND Contraseña = @contraseña
      `);

    if (loginResult.recordset.length === 0) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const user = loginResult.recordset[0];

    // Actualizar FechaUltAcceso
    let fechaActual = new Date();
    fechaActual.setHours(fechaActual.getHours() - 3);

    await pool.request()
      .input('fecha', sql.DateTime, fechaActual)
      .input('usuario', sql.NVarChar, usuario)
      .query('UPDATE Usuarios SET FechaUltAcceso = @fecha WHERE Usuario = @usuario');

    const token = generarToken(user);

    const idCliente = user.IdCliente;
    mainWindow.webContents.executeJavaScript(
      `localStorage.setItem("idCliente", "${idCliente}");`
    );

    // 🔹 2. Obtener módulos
    const modulesResult = await pool.request()
      .input('idCliente', sql.Int, idCliente)
      .query(`
        SELECT 
          m.Id AS ModuloId,
          m.Nombre AS ModuloNombre,
          m.Texto,
          m.Icono,
          m.Link,
          (
            SELECT COUNT(*) 
            FROM ModulosXCliente mx2 
            WHERE mx2.IdModulo = m.Id
          ) AS countClientesPorModulo
        FROM ModulosXCliente mx
        JOIN Modulos m ON mx.IdModulo = m.Id
        WHERE mx.IdCliente = @idCliente
      `);

    const modulos = modulesResult.recordset.map(modulo => ({
      id: modulo.ModuloId,
      nombre: modulo.ModuloNombre,
      texto: modulo.Texto,
      icono: modulo.Icono,
      link: modulo.Link,
      countClientesPorModulo: modulo.countClientesPorModulo
    }));

    // 🔹 3. Crear menú dinámico en Electron
    const template = [
      {
        label: 'Menú',
        submenu: modulos.map(modulo => ({
          label: modulo.nombre,
          click: () => {
            // Pasamos el nombre del módulo como query param
            mainWindow.loadURL(`${modulo.link}?modulo=${encodeURIComponent(modulo.nombre)}`);
          }
        }))
      },
      { role: 'quit', label: 'Salir' }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return { 
      success: true, 
      user: {
        id: user.Id,
        nombre: user.Nombre,
        apellido: user.Apellido,
        email: user.Email,
        idCliente: user.IdCliente
      },
      modulos,
      token
    };

  } catch (error) {
    console.error('Error en login local:', error);
    return { success: false, message: error.message };
  }
});
// 📦 OBTENER MÓDULOS
ipcMain.handle('get-modules', async (event, idCliente) => {
  if (!idCliente) return { success: false, message: 'Falta idCliente' };

  try {
    const dbConfig = getDbConfig();
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('idCliente', sql.Int, idCliente)
      .query(`
        SELECT 
          m.Id AS ModuloId,
          m.Nombre AS ModuloNombre,
          m.Texto,
          m.Icono,
          m.Link,
          m.PathExcelModelo,
          (
            SELECT COUNT(*) 
            FROM ModulosXCliente mx2 
            WHERE mx2.IdModulo = m.Id
          ) AS countClientesPorModulo
        FROM ModulosXCliente mx
        JOIN Modulos m ON mx.IdModulo = m.Id
        WHERE mx.IdCliente = @idCliente
      `);

    const modulos = result.recordset.map(modulo => ({
      id: modulo.ModuloId,
      nombre: modulo.ModuloNombre,
      texto: modulo.Texto,
      icono: modulo.Icono,
      link: modulo.Link,
      pathExcel: modulo.PathExcelModelo,
      countClientesPorModulo: modulo.countClientesPorModulo
    }));

    return { success: true, modulos };

  } catch (error) {
    console.error('Error en get-modules:', error);
    return { success: false, message: 'Error en la base de datos.' };
  }
});

