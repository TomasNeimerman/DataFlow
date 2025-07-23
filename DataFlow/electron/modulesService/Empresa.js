// back/modulesService/Empresa.js
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const dbConfig = require('../dbConfig');


/**
 * Configura y retorna un pool de conexiones MySQL.
 * @param {object} config El objeto de configuración de la base de datos.
 * @returns {Promise<mysql.Pool>} Una promesa que resuelve con un pool de conexiones.
 */
async function createMysqlPool(config) {
    const mysqlConfig = {
        host: config.server,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
    return await mysql.createPool(mysqlConfig);
}

/**
 * Obtiene los datos de configuración de UNA empresa específica desde la base de datos de administración.
 * @param {string} idCliente El ID del cliente para buscar la empresa.
 * @returns {Promise<object|null>} Una promesa que resuelve con los datos de la empresa (Server, Port, InstanciaBD, Usuario, Contraseña) o null si no se encuentra o hay un error.
 */
async function getDatosEmpresaById(idEmpresa) {
    let poolAdmin;
    try {
        const dbConfigAdmin = dbConfig.getDbConfig();
        poolAdmin = await createMysqlPool(dbConfigAdmin);

        const [rows] = await poolAdmin.execute(
            `
                SELECT IdCliente, Nombre, Server, Port, InstanciaBD, Usuario, Contraseña
                FROM Empresa
                WHERE Id = ?
            `,
            [idEmpresa]
        );

        if (rows.length > 0) {
            const empresaData = rows[0];
            return {
                idCliente: empresaData.IdCliente, // Aseguramos que el idCliente también se retorna
                nombreEmpresa: empresaData.Nombre, // Añadimos NombreEmpresa para el select
                server: empresaData.Server,
                port: empresaData.Port ? parseInt(empresaData.Port, 10) : 3306,
                database: empresaData.InstanciaBD,
                user: empresaData.Usuario,
                password: empresaData.Contraseña,
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error al obtener los datos de la empresa por ID:', error);
        throw error;
    } finally {
        if (poolAdmin) {
            await poolAdmin.end();
        }
    }
}

/**
 * Obtiene un listado de todas las empresas disponibles desde la base de datos de administración.
 * Esto es para poblar el <select> en el frontend.
 * @returns {Promise<Array<object>>} Una promesa que resuelve con un array de objetos { IdCliente, NombreEmpresa }.
 */
async function obtenerListadoEmpresas(idCliente) {
    let poolAdmin;
    try {
        const dbConfigAdmin = dbConfig.getDbConfig();
        poolAdmin = await createMysqlPool(dbConfigAdmin);

        const [rows] = await poolAdmin.execute(
            `
                SELECT Id, Nombre
                FROM Empresa WHERE IdCliente = ?
                ORDER BY Nombre
            `,[idCliente]
        );
        return rows.map(row => ({
            Id: row.Id,
            nombreEmpresa: row.Nombre
        }));
    } catch (error) {
        console.error('Error al obtener el listado de empresas:', error);
        throw error;
    } finally {
        if (poolAdmin) {
            await poolAdmin.end();
        }
    }
}


/**
 * Guarda los datos de configuración de la empresa en un archivo .properties.
 * Este archivo se usará para que el cliente se conecte a su base de datos específica.
 * @param {object} empresaData Los datos de la empresa a guardar (server, port, database, user, password).
 * @param {string} idCliente El ID del cliente (para mensajes de log).
 * @returns {Promise<void>} Una promesa que resuelve cuando el archivo ha sido escrito.
 */
async function guardarDatosEmpresaConfig(empresaData, idCliente) {
    if (!empresaData) {
        console.warn('No se proporcionaron datos de empresa para guardar el archivo de configuración.');
        return;
    }

    const configContent = `DB_USER=${empresaData.user}\nDB_PASSWORD=${empresaData.password}\nDB_SERVER=${empresaData.server}\nDB_PORT=${empresaData.port || 3306}\nDB_DATABASE=${empresaData.database}\n`;
    const configPath = path.join(__dirname, '../fileConfigUpdater/userDbConfig.properties');

    try {
        await fs.writeFile(configPath, configContent, 'utf-8');
        console.log(`Archivo de configuración creado para el cliente ${idCliente} en: ${configPath}`);
    } catch (err) {
        console.error('Error al escribir el archivo de configuración para el cliente', idCliente, ':', err);
        throw err;
    }
}


module.exports = {
    getDatosEmpresaById, // Cambié el nombre para ser más específico (antes obtenerDatosEmpresa)
    obtenerListadoEmpresas, // Nueva función para el select
    guardarDatosEmpresaConfig
};