const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Variable para saber si estamos en desarrollo o en producción
const isDev = !app.isPackaged;

// --- Definición de Ruta ---
// Esta es la ruta a tu archivo de configuración principal. Ahora es inteligente:
// - En desarrollo: Busca en tu carpeta de proyecto.
// - En producción: Busca en la carpeta 'resources', que es donde lo coloca el instalador.
const configFilePath = isDev
    ? path.join(__dirname, 'fileConfigUpdater', 'dbConfig.properties')
    : path.join(process.resourcesPath, 'fileConfigUpdater', 'dbConfig.properties');

/**
 * Lee el archivo dbConfig.properties y devuelve el objeto de configuración para la BD principal.
 * Se cambió el nombre a "getCentralDbConfig" para mayor claridad.
 */
function getDbConfig() {
    try {
        if (!fs.existsSync(configFilePath)) {
            throw new Error(`El archivo de configuración principal no se encontró en: ${configFilePath}`);
        }

        const configFile = fs.readFileSync(configFilePath, 'utf-8');
        const config = {};
        configFile.split(/\r?\n/).forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                config[key.trim()] = value.trim();
            }
        });

        return {
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            server: config.DB_SERVER,
            port: parseInt(config.DB_PORT, 10),
            database: config.DB_DATABASE,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            requestTimeout: 60000 // Timeout para evitar errores
        };
    } catch (error) {
        console.error("Error crítico al leer la configuración central:", error);
        return {}; // Devuelve un objeto vacío si falla
    }
}

module.exports = { getDbConfig };