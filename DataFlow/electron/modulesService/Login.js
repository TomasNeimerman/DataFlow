// back/modulesService/Login.js
const mysql = require('mysql2/promise'); // Usamos el cliente MySQL con promesas
const fs = require('fs').promises; // Usamos la API de promesas para async/await
const path = require('path');
const { generarToken } = require('../jwtService');


// Función para obtener la configuración de la base de datos de la empresa
async function obtenerConfiguracionEmpresa(idCliente) {
    let poolAdmin; // Declarar poolAdmin fuera del try para asegurar su cierre
    try {
        const dbConfigAdmin = require('../dbConfig').getDbConfig();
        
        // Adaptar la configuración para mysql2
        const mysqlConfigAdmin = {
            host: dbConfigAdmin.server,
            port: dbConfigAdmin.port || 3306, // Puerto por defecto de MySQL es 3306
            user: dbConfigAdmin.user,
            password: dbConfigAdmin.password,
            database: dbConfigAdmin.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        poolAdmin = await mysql.createPool(mysqlConfigAdmin);

        // Consulta MySQL: Usar '?' para los parámetros
        const [rows] = await poolAdmin.execute(
            `
                SELECT Server, Port, InstanciaBD, Usuario, Contraseña
                FROM Empresa
                WHERE IdCliente = ?
            `,
            [idCliente]
        );

        if (rows.length > 0) {
            const empresaData = rows[0];
            const configContent = `DB_USER=${empresaData.Usuario}\nDB_PASSWORD=${empresaData.Contraseña}\nDB_SERVER=${empresaData.Server}\nDB_PORT=${empresaData.Port || 3306}\nDB_DATABASE=${empresaData.InstanciaBD}\n`;
            const configPath = path.join(__dirname, '../../fileConfigUpdater/userDbConfig.properties'); // Nombre de archivo diferente para evitar confusión

            try {
                await fs.writeFile(configPath, configContent, 'utf-8');
                console.log(`Archivo de configuración creado para el cliente ${idCliente} en: ${configPath}`);
            } catch (err) {
                console.error('Error al escribir el archivo de configuración:', err);
            }

            return {
                server: empresaData.Server,
                port: empresaData.Port ? parseInt(empresaData.Port, 10) : 3306,
                database: empresaData.InstanciaBD, // Usar InstanciaBD para la base de datos
                user: empresaData.Usuario,
                password: empresaData.Contraseña,
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error al obtener configuración de la empresa:', error);
        return null;
    } finally {
        if (poolAdmin) {
            await poolAdmin.end(); // Cerrar el pool de conexiones
        }
    }
}

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

        const empresaConfig = await obtenerConfiguracionEmpresa(idCliente);
        if (!empresaConfig) {
            return { success: false, message: 'No se encontró la configuración de la base de datos para su empresa.' };
        }

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

        return { success: true, user, token, empresaConfig };
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
