// CJS, Node 14
const fs = require('fs');
const path = require('path');

let logFilePath = null;

function initLogger(app) {
  const userDataPath = app.getPath('userData');
  logFilePath = path.join(userDataPath, 'app_error.log');
}

function writeToLog(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    if (!logFilePath) return console.log(line);
    fs.appendFileSync(logFilePath, line);
  } catch (e) {
    console.error('Error al escribir en el log:', e.message);
  }
}

module.exports = { initLogger, writeToLog };
