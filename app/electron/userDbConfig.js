const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = !app.isPackaged;

const configFilePath = path.join(app.getPath('userData'), 'userDbConfig.properties');
const templatePath = isDev
    ? path.join(__dirname, 'fileConfigUpdater', 'userDbConfig.properties')
    : path.join(process.resourcesPath, 'fileConfigUpdater', 'userDbConfig.properties');

// ... (los logs de depuración se mantienen igual) ...

function initializeConfig() {
    if (!fs.existsSync(configFilePath)) {
        console.log(`[DEBUG] El archivo en ${configFilePath} NO existe. Se intentará copiar.`);
        try {
            console.log(`[DEBUG] Verificando si la plantilla existe en: ${templatePath}`);
            if (fs.existsSync(templatePath)) {
                console.log(`[DEBUG] Plantilla encontrada. Copiando...`);
                fs.copyFileSync(templatePath, configFilePath);
                console.log(`[DEBUG] Plantilla copiada exitosamente.`);
            } else {
                // Este es el punto más probable de fallo
                console.error(`[ERROR CRÍTICO] La plantilla NO se encontró en ${templatePath}. Creando archivo vacío.`);
                fs.writeFileSync(configFilePath, '', 'utf-8');
            }
        } catch (error) {
            console.error('[ERROR CRÍTICO] Falló la copia de la plantilla:', error);
        }
    } else {
        console.log(`[DEBUG] El archivo en ${configFilePath} ya existe. No se hace nada.`);
    }
}

function getAdminDbConfig() {
    if (!fs.existsSync(configFilePath)) {
        console.error('El archivo de configuración no existe en la ruta de usuario.');
        return {};
    }
    try {
        const configFile = fs.readFileSync(configFilePath, 'utf-8');
        const config = {};
        configFile.split(/\r?\n/).forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                config[key.trim()] = value.trim();
            }
        });

        if (!config.DB_SERVER) throw new Error("Configuración de BD inválida.");

        return {
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            server: config.DB_SERVER,
            port: parseInt(config.DB_PORT, 10),
            database: config.DB_DATABASE,
            options: { encrypt: false, trustServerCertificate: true },
            requestTimeout: 60000
        };
    } catch (error) {
        console.error(`Error al leer/parsear config:`, error);
        return {};
    }
}


// --- FUNCIÓN AÑADIDA ---
/**
 * Escribe los datos de conexión de la empresa seleccionada en el archivo userDbConfig.properties.
 * @param {object} empresaData - Un objeto con { server, user, password, database, port }
 */
function writeAdminDbConfig(empresaData) {
    try {
        const configContent = [
            `DB_SERVER=${empresaData.server}`,
            `DB_USER=${empresaData.user}`,
            `DB_PASSWORD=${empresaData.password}`,
            `DB_DATABASE=${empresaData.database}`,
            `DB_PORT=${empresaData.port}`
        ].join('\n');

        fs.writeFileSync(configFilePath, configContent, 'utf-8');
    } catch (error) {
        console.error('Error al escribir en el archivo de configuración del usuario:', error);
        throw error;
    }
}


module.exports = {
    initializeConfig,
    getAdminDbConfig,
    writeAdminDbConfig // <-- AÑADIR LA NUEVA FUNCIÓN A LAS EXPORTACIONES
};