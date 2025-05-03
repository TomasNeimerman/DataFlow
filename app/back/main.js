const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const sql = require('mssql');
const fs = require('fs');
const { generarToken } = require('./jwtService');
const { getDbConfig } = require('./dbConfig');
const { getAdminDbConfig } = require('./dbAdminConfig.js');

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
  try {
    const dbConfig = getDbConfig();
    const pool = await sql.connect(dbConfig);

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
            role: 'quit',
            label: 'Salir',
            accelerator: 'Esc'
          },
          {
            label: 'Reload',
            accelerator: 'F5',
            click: () => {
              mainWindow.reload();
            }
          }
        ]
      }
    ];
    
     
        
      
    

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    await pool.close();

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
    await pool.close();
    return { success: true, modulos };

  } catch (error) {
    console.error('Error en get-modules:', error);
    return { success: false, message: 'Error en la base de datos.' };
  }
});

ipcMain.handle('obtener-cheques', async (event, id) => {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM Cheques WHERE chp_ID = @id`);

    return {
      success: true,
      cheque: result.recordset[0] || null,
    };
  } catch (err) {
    console.error('❌ Error en obtener-cheques:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
});

ipcMain.handle('update-cheques', async (event, cheque) => {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const {
      codEmp, emp, idCheque, fechaEmision,
      movimiento, tipoCheque, estado, fechaVenc,
      chequeCodigo, nroDefinitivo, importe, idCliente
    } = cheque;

    const fecEnt = convertirFecha(fechaEmision);
    const fecVto = convertirFecha(fechaVenc);
    const importeFinal = parseFloat(
      importe.replace(/,/g, '').replace('-', '')
    );
    

    const existe = await pool.request()
      .input('id', sql.Int, idCheque)
      .query(`SELECT COUNT(*) as count FROM Cheques WHERE chp_ID = @id`);

    if (existe.recordset[0].count === 0) {
      return { success: false, message: `Cheque ID ${idCheque} no existe y no se puede actualizar.` };
    }

    await pool.request()
      .input('codEmp', sql.VarChar(50), codEmp)
      .input('emp', sql.VarChar(50), emp)
      .input('idCheque', sql.Int, idCheque)
      .input('fecEnt', sql.Date, fecEnt)
      .input('movSuc', sql.VarChar(50), movimiento)
      .input('tipo', sql.VarChar(50), tipoCheque)
      .input('edo', sql.VarChar(50), estado)
      .input('fecVto', sql.Date, fecVto)
      .input('ctbCod', sql.Int, chequeCodigo)
      .input('definitivo', sql.Int, nroDefinitivo)
      .input('importe', sql.Float, importeFinal)
      .input('idcl', sql.Int, idCliente)
      .query(`
        UPDATE Cheques SET 
          chp_FEnt = @fecEnt,
          chpbco_Suc = @movSuc,
          chptch_Cod = @tipo,
          chp_edo = @edo,
          chp_FVto = @fecVto,
          chp_NroCheq = @ctbCod,
          chp_NroDtvo = @definitivo,
          chp_Importe = @importe
        WHERE chp_ID = @idCheque AND chpemp_Codigo = @codEmp AND chpsuc_Cod = @emp AND chpemp_IdCliente = @idcl
      `);

    return { success: true, message: 'Cheque actualizado correctamente.' };
  } catch (err) {
    console.error('❌ Error en update-cheques:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
});

function convertirFecha(fechaDDMMYYYY) {
  if (!fechaDDMMYYYY || typeof fechaDDMMYYYY !== 'string') {
    throw new Error(`Fecha inválida (no definida o no string): ${fechaDDMMYYYY}`);
  }

  const partes = fechaDDMMYYYY.split("/");
  if (partes.length !== 3) {
    throw new Error(`Fecha malformateada: ${fechaDDMMYYYY}`);
  }

  const [dia, mes, año] = partes.map(str => parseInt(str, 10));
  if (isNaN(dia) || isNaN(mes) || isNaN(año)) {
    throw new Error(`Partes numéricas inválidas en la fecha: ${fechaDDMMYYYY}`);
  }

  const fechaUTC = new Date(Date.UTC(año, mes - 1, dia));
  if (isNaN(fechaUTC.getTime())) {
    throw new Error(`Fecha inválida al convertir: ${fechaDDMMYYYY}`);
  }

  return fechaUTC;
}
