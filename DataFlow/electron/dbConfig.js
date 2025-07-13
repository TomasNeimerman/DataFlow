const fs = require('fs');
const path = require('path');

function getDbConfig() {
    const configPath = path.join(__dirname, './fileConfigUpdater/dbConfig.properties');
    const configFile = fs.readFileSync(configPath, 'utf-8');

    const config = {};
    configFile.split('\n').forEach(line => {
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
        }
    };
}

module.exports = { getDbConfig };
