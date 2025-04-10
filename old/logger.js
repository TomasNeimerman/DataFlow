const fs = require('fs');
const path = require('path');

// Ensure the logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logFilePath = path.join(logsDir, `app_${new Date().toISOString().split('T')[0]}.log`);

function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${level}] ${message}\n`;
    
    // Append to file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });

    // Also log to console for immediate feedback
    console.log(`[${level}] ${message}`);
}

module.exports = {
    info: (message) => log(message, 'INFO'),
    warn: (message) => log(message, 'WARN'),
    error: (message) => log(message, 'ERROR'),
    debug: (message) => log(message, 'DEBUG')
};
