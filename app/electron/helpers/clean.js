// electron/helpers/clean.js
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

function rm(target) {
  const full = path.resolve(target);
  try {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`✔ borrado: ${full}`);
  } catch (e) {
    console.warn(`(omitido) ${full}: ${e.message}`);
  }
}

// Lee el template del output de electron-builder y reemplaza ${version}
const outputTemplate = pkg.build?.directories?.output || 'dist';
const outputDir = outputTemplate.replace(/\$\{version\}/g, pkg.version);


// Borra .next y la salida del build (por ejemplo "DataFlow 0.3.0")
rm('.next');
rm(outputDir);
