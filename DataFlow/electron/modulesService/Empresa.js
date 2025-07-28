const mysql = require('mysql2/promise');

// Importa la función para la DB principal/fija
const { getDbConfig } = require('../dbConfig.js'); 
// Importa la función para escribir la configuración del usuario/dinámica
const { writeAdminDbConfig } = require('../userDbConfig.js');


async function obtenerListadoEmpresas(idCliente) {
    let pool;
    try {
        const dbConfig = getDbConfig();
        if (!dbConfig || !dbConfig.server) {
            throw new Error("Configuración de la base de datos principal no encontrada.");
        }
        
        const mysqlConfig = {
            host: dbConfig.server,
            port: dbConfig.port || 3306,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        
        pool = await mysql.createPool(mysqlConfig);
        
        // Query corregida con la tabla y columnas nuevas
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
        const dbConfig = getDbConfig(); 
        if (!dbConfig || !dbConfig.server) {
            throw new Error("Configuración de la base de datos principal no encontrada.");
        }
        
        const mysqlConfig = {
            host: dbConfig.server,
            port: dbConfig.port || 3306,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        };
        
        pool = await mysql.createPool(mysqlConfig);

        // Query corregida con la tabla y columnas nuevas, usando alias para mantener la compatibilidad
        const [rows] = await pool.execute(
            'SELECT Id AS id, Nombre AS nombreEmpresa, Server AS server, Usuario AS user, Contraseña AS password, InstanciaBD AS database, Port AS port FROM Empresa WHERE Id = ?',
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
        // Esta función escribe en userDbConfig.properties y no necesita cambios.
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