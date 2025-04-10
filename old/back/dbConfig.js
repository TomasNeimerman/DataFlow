const fs = require('fs');
const path = require('path');

function getDbConfig() {
    const configPath = path.join(__dirname, 'fileConfigUpdater/dbConfig.properties');
    const configFile = fs.readFileSync(configPath, 'utf-8');

    const config = {};
    configFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            config[key.trim()] = value.trim();
        }
    });

    return {
        user: config.user,
        password: config.password,
        server: config.server,
        port: parseInt(config.port, 10),
        database: config.db,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };
}

module.exports = { getDbConfig };
