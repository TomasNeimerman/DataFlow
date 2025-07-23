// back/modulesService/Login.js
const mysql = require('mysql2/promise'); // Usamos el cliente MySQL con promesas
const fs = require('fs').promises; // Usamos la API de promesas para async/await
const path = require('path');
const { generarToken } = require('../jwtService');



async function iniciarSesion({ usuario, contraseña }) {
    let poolAdmin; // Declarar poolAdmin fuera del try para asegurar su cierre
    try {
        const dbConfigAdmin = require('../dbConfig').getDbConfig();
        
        // Adaptar la configuración para mysql2
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

        // Consulta MySQL: Usar '?' para los parámetros
        const [loginRows] = await poolAdmin.execute(
            `
                SELECT Id, Nombre, Apellido, Email, IdCliente
                FROM Usuarios
                WHERE Usuario = ? AND Contraseña = ?
            `,
            [usuario, contraseña]
        );

        if (loginRows.length === 0) {
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }

        const user = loginRows[0];
        const idCliente = user.IdCliente;


        let fechaActual = new Date();
        // No es necesario ajustar la hora aquí si el servidor MySQL está configurado correctamente con la zona horaria
        // o si la aplicación maneja la zona horaria al mostrar.
       fechaActual.setHours(fechaActual.getHours() - 3);

        // Actualizar la fecha de último acceso
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
            await poolAdmin.end(); // Cerrar el pool de conexiones
        }
    }
}

async function obtenerModulos(idCliente) {
    if (!idCliente) return { success: false, message: 'Falta idCliente' };
    const dbConfigAdmin = require('../dbConfig').getDbConfig();
    if (!dbConfigAdmin) return { success: false, message: 'No se pudo obtener la configuración de la base de datos.' }; 
    
    let poolEmpresa; // Declarar poolEmpresa fuera del try para asegurar su cierre
    try {
        // Adaptar la configuración para mysql2
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

        // Consulta MySQL: Usar '?' para los parámetros. La subconsulta COUNT(*) es compatible con MySQL.
        const [rows] = await poolEmpresa.execute(
            `
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
            await poolEmpresa.end(); // Cerrar el pool de conexiones
        }
    }
}

module.exports = { iniciarSesion, obtenerModulos };
