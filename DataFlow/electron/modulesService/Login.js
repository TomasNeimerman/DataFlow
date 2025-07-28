// RUTA: back/modulesService/Login.js

const mysql = require('mysql2/promise');
const path = require('path');
const { generarToken } = require('../jwtService');

// RUTA CORREGIDA: Sube dos directorios (hasta la raíz) y luego entra a 'electron'
const { getDbConfig } = require(path.join(__dirname, '..', '..', 'electron', 'dbConfig.js'));

async function iniciarSesion({ usuario, contraseña }) {
    let poolAdmin;
    try {
        // Usa la función ya importada
        const dbConfigAdmin = getDbConfig();
        
        const mysqlConfigAdmin = {
            host: dbConfigAdmin.server,
            port: dbConfigAdmin.port || 3306,
            user: dbConfigAdmin.user,
            password: dbConfigAdmin.password,
            database: dbConfigAdmin.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        console.log('Configuración de MySQL:', mysqlConfigAdmin);
        poolAdmin = await mysql.createPool(mysqlConfigAdmin);

        const [loginRows] = await poolAdmin.execute(
            `SELECT Id, Nombre, Apellido, Email, IdCliente FROM Usuarios WHERE Usuario = ? AND Contraseña = ?`,
            [usuario, contraseña]
        );

        if (loginRows.length === 0) {
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }

        const user = loginRows[0];
        let fechaActual = new Date();
        fechaActual.setHours(fechaActual.getHours() - 3);

        await poolAdmin.execute(
            'UPDATE Usuarios SET FechaUltAcceso = ? WHERE Usuario = ?',
            [fechaActual, usuario]
        );

        const token = generarToken(user);
        return { success: true, user, token };

    } catch (error) {
        console.error('Error en iniciarSesion:', error);
        return { success: false, message: error.message };
    } finally {
        if (poolAdmin) {
            await poolAdmin.end();
        }
    }
}

async function obtenerModulos(idCliente) {
    if (!idCliente) return { success: false, message: 'Falta idCliente' };
    
    let poolEmpresa;
    try {
        // Usa la función ya importada
        const dbConfigAdmin = getDbConfig();
        if (!dbConfigAdmin || !dbConfigAdmin.server) {
            return { success: false, message: 'No se pudo obtener la configuración de la base de datos.' }; 
        }

        const mysqlConfigAdmin = {
            host: dbConfigAdmin.server,
            port: dbConfigAdmin.port || 3306,
            user: dbConfigAdmin.user,
            password: dbConfigAdmin.password,
            database: dbConfigAdmin.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        poolEmpresa = await mysql.createPool(mysqlConfigAdmin);

        const [rows] = await poolEmpresa.execute(
            `
                SELECT
                    m.Id AS ModuloId, m.Nombre AS ModuloNombre, m.Texto, m.Icono, m.Link, m.PathExcelModelo,
                    (SELECT COUNT(*) FROM ModulosXCliente mx2 WHERE mx2.IdModulo = m.Id) AS countClientesPorModulo
                FROM ModulosXCliente mx
                JOIN Modulos m ON mx.IdModulo = m.Id
                WHERE mx.IdCliente = ?
            `,
            [idCliente]
        );

        const modulos = rows.map(modulo => ({
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
        console.error('Error en obtenerModulos:', error);
        return { success: false, message: 'Error en la base de datos de la empresa.' };
    } finally {
        if (poolEmpresa) {
            await poolEmpresa.end();
        }
    }
}

module.exports = { iniciarSesion, obtenerModulos };