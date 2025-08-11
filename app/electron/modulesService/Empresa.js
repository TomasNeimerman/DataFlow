const mysql = require('mysql2/promise');

// Importa la función para la DB principal/fija (para leer la lista de empresas)
const { getDbConfig } = require('../dbConfig.js'); 
// Importa la función para escribir la configuración del usuario/dinámica
const { writeAdminDbConfig } = require('../userDbConfig.js');

/**
 * Obtiene la lista de empresas para un cliente desde la base de datos principal.
 */
async function obtenerListadoEmpresas(idCliente) {
    let pool;
    try {
        // Usa la configuración de la base de datos principal
        const dbConfig = getDbConfig();
        if (!dbConfig || !dbConfig.server) {
            throw new Error("Configuración de la base de datos principal no encontrada.");
        }
        
        const mysqlConfig = {
            host: dbConfig.server,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        
        pool = await mysql.createPool(mysqlConfig);
        
        const [rows] = await pool.execute(
            'SELECT Id, Nombre AS nombreEmpresa FROM Empresa WHERE IdCliente = ?',
            [idCliente]
        );

        return rows;

    } catch (error) {
        console.error("Error en obtenerListadoEmpresas:", error);
        throw error;
    } finally {
        if (pool) await pool.end();
    }
}

/**
 * Obtiene los detalles de conexión de una empresa específica desde la base de datos principal.
 */
async function getDatosEmpresaById(idEmpresa) {
    let pool;
    try {
        // También usa la configuración de la base de datos principal
        const dbConfig = getDbConfig(); 
        if (!dbConfig || !dbConfig.server) {
            throw new Error("Configuración de la base de datos principal no encontrada.");
        }
        
        const mysqlConfig = {
            host: dbConfig.server,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        };
        
        pool = await mysql.createPool(mysqlConfig);

        const [rows] = await pool.execute(
            'SELECT Id AS id, Nombre AS nombreEmpresa, Server AS server, Port AS port, Usuario AS user, Contraseña AS password, InstanciaBD AS database FROM Empresa WHERE Id = ?',
            [idEmpresa]
        );

        return rows[0];

    } catch (error) {
        console.error("Error en getDatosEmpresaById:", error);
        throw error;
    } finally {
        if (pool) await pool.end();
    }
}

/**
 * Guarda los detalles de la empresa seleccionada en el archivo de configuración del usuario.
 */
async function guardarDatosEmpresaConfig(empresaData) {
    try {
        // Llama a la función que escribe en userDbConfig.properties
        await writeAdminDbConfig(empresaData);
    } catch (error) {
        console.error("Error en guardarDatosEmpresaConfig:", error);
        throw error;
    }
}

module.exports = {
    obtenerListadoEmpresas,
    getDatosEmpresaById,
    guardarDatosEmpresaConfig
};