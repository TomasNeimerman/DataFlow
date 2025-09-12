// scripts/clear-store.js
const { app } = require('electron');

app.whenReady().then(() => {
  const fs = require('fs');
  const path = require('path');
  const Store = require('electron-store');

  const storesToWipe = [ new Store() /*, new Store({ name:'otra' }) */ ];

  for (const store of storesToWipe) {
    try { store.clear(); } catch {}
    try {
      const file = store.path;
      const dir  = path.dirname(file);
      const base = path.basename(file).replace(/\.json$/i, '');
      try { fs.rmSync(file, { force: true }); } catch {}
      for (const extra of ['.json.bak', '.json.lock']) {
        try { fs.rmSync(path.join(dir, `${base}${extra}`), { force: true }); } catch {}
      }
      console.log('[clear-store] OK en:', dir);
    } catch (e) {
      console.warn('[clear-store] No se pudo borrar archivos físicos:', e.message);
    }
  }

  app.quit();
});
