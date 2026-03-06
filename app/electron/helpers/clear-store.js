// electron/helpers/clear-store.js
const { app } = require('electron');

app.whenReady().then(() => {
  const fs = require('fs');
  const path = require('path');
  const Store = require('electron-store');

  // Usa --hard para borrar absolutamente todo (incluyendo remember.*)
  const HARD = process.argv.includes('--hard');

  const storesToWipe = [ new Store() ];

  // ✅ preservamos todo lo necesario para auto-login cuando NO es hard
  const KEEP_REGEX = [
    /^remember\.enabled$/,
    /^remember\.user$/,
    /^remember\.deviceId$/,
    /^remember\.usingKeytar$/,  // << agregado
    /^remember\.secret$/,       // << agregado (fallback legacy si alguna vez se usó)
    /^remember\.blob\./,        // si tenías cifrado custom
    /^deviceId$/,               // deviceId estable del equipo
  ];
  const keepKey = (k) => KEEP_REGEX.some(rx => rx.test(k));

  for (const store of storesToWipe) {
    // electron-store v7: .store existe, pero keys() también — cubrimos ambos
    const keys = store.store ? Object.keys(store.store) : store.keys?.() || [];

    // snapshot de lo que vamos a preservar (solo si NO es hard)
    const keepData = {};
    if (!HARD) {
      for (const k of keys) {
        if (keepKey(k)) keepData[k] = store.get(k);
      }
    }

    // limpieza lógica (borra todo lo que NO preservamos, o todo si HARD)
    for (const k of keys) {
      if (HARD || !keepKey(k)) {
        try { store.delete(k); } catch {}
      }
    }

    if (!HARD) {
      // restaurar recordatorios
      for (const [k, v] of Object.entries(keepData)) {
        try { store.set(k, v); } catch {}
      }
      console.log('[clear-store] Soft wipe OK (remember.* preservado)');
    } else {
      // 🧨 borrado físico del archivo de store y anexos
      try {
        const file = store.path;                    // ruta absoluta del .json principal
        const dir  = path.dirname(file);
        const base = path.basename(file).replace(/\.json$/i, '');

        // IMPORTANTE: el principal se borra tal cual (sin join)
        try { fs.rmSync(file, { force: true }); } catch {}

        // anexos en el mismo directorio
        for (const extra of ['.json.bak', '.json.lock']) {
          try { fs.rmSync(path.join(dir, `${base}${extra}`), { force: true }); } catch {}
        }
        console.log('[clear-store] HARD wipe OK en:', dir);
      } catch (e) {
        console.warn('[clear-store] HARD wipe: no se pudo borrar archivos físicos:', e.message);
      }
    }
  }

  app.quit();
});