// modulesService/GeneradorPrecios.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

// ---------- helpers ----------
const progressFn = (onProgress) => (p, stage, msg) => {
  try { onProgress && onProgress(p, stage, msg); } catch (_) {}
};

function tryAlert(title, message) {
  try {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow?.getFocusedWindow?.() || null;
    if (dialog?.showMessageBoxSync) {
      dialog.showMessageBoxSync(win, {
        type: 'error',
        title: String(title || 'Aviso'),
        message: String(message || ''),
      });
    }
  } catch (_) {}
}

// ---------- script EXACTO (tal cual lo pasaste) ----------
const SQL_UPDATE_PRECIOS_EXACTO = `
BEGIN TRANSACTION;

IF OBJECT_ID('tempdb..#ResultadosActualizacion') IS NOT NULL
    DROP TABLE #ResultadosActualizacion;

CREATE TABLE #ResultadosActualizacion (
    lprdlp_Cod VARCHAR(3) NOT NULL,
    lprart_CodGen VARCHAR(20) NOT NULL,
    lprart_CodEle1 VARCHAR(6) NOT NULL,
    lprart_CodEle2 VARCHAR(6) NOT NULL,
    lprart_CodEle3 VARCHAR(6) NOT NULL,
    CostoOriginal MONEY NULL,
    MonedaOriginal VARCHAR(3) NULL,
    TipoCambioOriginal VARCHAR(3) NULL,
    FechaCotizacionAplicada DATETIME NULL,
    CotizacionAplicada FLOAT NULL,
    CostoBasePesos MONEY NULL,
    MargenMay REAL NOT NULL DEFAULT 0,
    MargenMin REAL NOT NULL DEFAULT 0,
    PrecioFinal MONEY NULL,
    PrecioOriginal MONEY NULL,
    InfoCotizacion VARCHAR(100) NULL
);

DECLARE @FechaAyer DATE = DATEADD(day, -1, CAST(GETDATE() AS DATE));
DECLARE @FechaHoy DATE = CAST(GETDATE() AS DATE);

INSERT INTO dbo.ListaPrec (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo)
SELECT
    'LBC',
    a.art_CodGen,
    a.art_CodEle1,
    a.art_CodEle2,
    a.art_CodEle3,
    0,
    1,
    GETDATE(),
    'ADMIN'
FROM dbo.Articulos a
LEFT JOIN dbo.DtsArticulos da
    ON a.art_CodGen = da.art_CodGen
    AND a.art_CodEle1 = da.art_CodEle1
    AND a.art_CodEle2 = da.art_CodEle2
    AND a.art_CodEle3 = da.art_CodEle3
WHERE a.art_CircVta = 1
  AND a.art_InclEnLisP = 1
  AND da.Dart_ActualizarListaPrec = 'S'
  AND a.art_codGen+a.art_codele1++a.art_codele2+a.art_codele3 NOT IN 
  (SELECT lp.lprart_codGen+lp.lprart_codele1+lp.lprart_codele2+lp.lprart_CodEle3 FROM dbo.ListaPrec lp
                  WHERE lp.lprdlp_Cod = 'LBC'
                    AND lp.lprart_CodGen = a.art_CodGen
                    AND lp.lprart_CodEle1 = a.art_CodEle1
                    AND lp.lprart_CodEle2 = a.art_CodEle2
                    AND lp.lprart_CodEle3 = a.art_CodEle3)

INSERT INTO #ResultadosActualizacion 
(lprdlp_Cod, 
lprart_CodGen, 
lprart_CodEle1, 
lprart_CodEle2, 
lprart_CodEle3, 
CostoOriginal,
MonedaOriginal, 
TipoCambioOriginal, 
FechaCotizacionAplicada, 
CotizacionAplicada, 
CostoBasePesos, 
PrecioFinal, 
PrecioOriginal, 
InfoCotizacion)
SELECT [lprdlp_Cod],[lprart_CodGen],[lprart_CodEle1],[lprart_CodEle2],[lprart_CodEle3],
       [CostoOriginal],[MonedaOriginal],[TipoCambioOriginal],[FechaCotizacionAplicada],
       [CotizacionAplicada],[CostoBasePesos],[PrecioFinal],[PrecioOriginal],[InfoCotizacion]
  FROM [SBDATEST].[dbo].[CONE_Mark_Up_Articulos_Analisis]

UPDATE lp
SET lp.lpr_Precio = CASE WHEN ra.PrecioFinal IS NULL THEN 0 ELSE ra.PrecioFinal END ,
    lp.lpr_FecMod = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
INNER JOIN #ResultadosActualizacion ra
    ON lp.lprdlp_Cod = ra.lprdlp_Cod
    AND lp.lprart_CodGen = ra.lprart_CodGen
    AND lp.lprart_CodEle1 = ra.lprart_CodEle1
    AND lp.lprart_CodEle2 = ra.lprart_CodEle2
    AND lp.lprart_CodEle3 = ra.lprart_CodEle3
WHERE lp.lprdlp_Cod = 'LBC';

INSERT INTO dbo.CONE_RegistroActualizacionPrecios (
    ListaPrecioCod,ArticuloCodGen,ArticuloCodEle1,ArticuloCodEle2,ArticuloCodEle3,
    PrecioOriginal,PrecioNuevo,CostoOriginal,MonedaOriginal,TipoCambioOriginal,
    FechaCotizacionAplicada,CotizacionAplicada,CostoBasePesos,MarkupAplicadoPorcentaje,
    InfoCotizacion,UsuarioEjecucion
)
SELECT ra.lprdlp_Cod,ra.lprart_CodGen,ra.lprart_CodEle1,ra.lprart_CodEle2,ra.lprart_CodEle3,
       ra.PrecioOriginal,ra.PrecioFinal,ra.CostoOriginal,ra.MonedaOriginal,ra.TipoCambioOriginal,
       ra.FechaCotizacionAplicada,ra.CotizacionAplicada,ra.CostoBasePesos,
       ISNULL(CASE WHEN ra.CostoBasePesos <> 0
              THEN (ra.PrecioFinal / ra.CostoBasePesos - 1) * 100 ELSE 0 END, 0),
       ra.InfoCotizacion,SUSER_SNAME()
FROM #ResultadosActualizacion ra
WHERE ra.lprdlp_Cod = 'LBC';

DROP TABLE #ResultadosActualizacion;

COMMIT TRANSACTION;
`;

// ---------- obtener listados simples ----------
async function obtenerPrecios() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT TOP (100)
        lprdlp_Cod,
        lprart_CodGen,
        ISNULL(lprart_CodEle1,'') AS lprart_CodEle1,
        ISNULL(lprart_CodEle2,'') AS lprart_CodEle2,
        ISNULL(lprart_CodEle3,'') AS lprart_CodEle3,
        CAST(lpr_Precio AS DECIMAL(18,4)) AS lpr_Precio,
        lpr_FecMod
      FROM dbo.ListaPrec
      ORDER BY lpr_FecMod DESC, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3
    `;
    const rs = await pool.request().query(q);
    return { success: true, precios: rs.recordset || [] };
  } catch (err) {
    console.error('❌ Error en obtenerPrecios:', err);
    return { success: false, message: err.message };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

// ---------- actualización con PROGRESO y validaciones ----------
async function actualizarListaDePrecios({ onProgress, mode = 'progressive' } = {}) {
  // Config de timeouts altos SOLO para esta operación pesada
  const cfg = {
    ...getAdminDbConfig(),
    connectionTimeout: 120000, // 120s para conectar
    requestTimeout:    600000, // 10 min para ejecutar
  };

  if (mode === 'exact') {
    // Ejecuta tu script tal cual (con timeouts altos)
    let pool;
    try {
      const progress = progressFn(onProgress);
      progress(2, 'Preparando', 'Conectando a la base…');
      pool = await sql.connect(cfg);

      progress(10, 'Ejecutando', 'Lanzando script exacto…');
      const req = pool.request();
      req.timeout = cfg.requestTimeout;
      await req.batch(SQL_UPDATE_PRECIOS_EXACTO);

      progress(100, 'Finalizado', 'La lista de precios se ha actualizado.');
      return { success: true, message: 'La lista de precios se ha actualizado correctamente (script exacto).' };
    } catch (error) {
      console.error('❌ Error (script exacto):', error);
      const msg = /timeout/i.test(error?.message)
        ? 'La actualización superó el tiempo máximo (timeout).'
        : (error?.message || 'Error al ejecutar el script exacto.');
      tryAlert('Actualización de precios', msg);
      return { success: false, message: msg };
    } finally {
      try { await pool?.close(); } catch {}
    }
  }

  // Modo con progreso granular (con timeouts altos)
  const progress = progressFn(onProgress);
  let pool, tx;

  try {
    progress(2, 'Preparando', 'Conectando a la base…');
    pool = await sql.connect(cfg);

    progress(5, 'Transacción', 'Iniciando transacción…');
    tx = new sql.Transaction(pool);
    await tx.begin();

    // Helpers que fijan timeout por Request
    const q  = (text) => { const r = new sql.Request(tx); r.timeout = cfg.requestTimeout; return r.batch(text); };
    const q1 = (text) => { const r = new sql.Request(tx); r.timeout = cfg.requestTimeout; return r.query(text); };

    // 1) crear temp
    progress(10, 'Temporal', 'Creando tabla temporal…');
    await q(`
IF OBJECT_ID('tempdb..#ResultadosActualizacion') IS NOT NULL
  DROP TABLE #ResultadosActualizacion;

CREATE TABLE #ResultadosActualizacion (
  lprdlp_Cod VARCHAR(3) NOT NULL,
  lprart_CodGen VARCHAR(20) NOT NULL,
  lprart_CodEle1 VARCHAR(6) NOT NULL,
  lprart_CodEle2 VARCHAR(6) NOT NULL,
  lprart_CodEle3 VARCHAR(6) NOT NULL,
  CostoOriginal MONEY NULL,
  MonedaOriginal VARCHAR(3) NULL,
  TipoCambioOriginal VARCHAR(3) NULL,
  FechaCotizacionAplicada DATETIME NULL,
  CotizacionAplicada FLOAT NULL,
  CostoBasePesos MONEY NULL,
  MargenMay REAL NOT NULL DEFAULT 0,
  MargenMin REAL NOT NULL DEFAULT 0,
  PrecioFinal MONEY NULL,
  PrecioOriginal MONEY NULL,
  InfoCotizacion VARCHAR(100) NULL
);
    `);

    // 2) variables (compatibilidad)
    progress(15, 'Variables', 'Seteando variables…');
    await q(`DECLARE @FechaAyer DATE = DATEADD(day,-1,CAST(GETDATE() AS DATE)); DECLARE @FechaHoy DATE = CAST(GETDATE() AS DATE);`);

    // 3) insertar faltantes en LBC
    progress(25, 'Validación', 'Insertando artículos que faltan en LBC…');
    const insRes = await q1(`
INSERT INTO dbo.ListaPrec (lprdlp_Cod,lprart_CodGen,lprart_CodEle1,lprart_CodEle2,lprart_CodEle3,lpr_Precio,lpr_Imprime,lpr_FecMod,lprusu_Codigo)
SELECT 'LBC',a.art_CodGen,a.art_CodEle1,a.art_CodEle2,a.art_CodEle3,0,1,GETDATE(),'ADMIN'
FROM dbo.Articulos a
LEFT JOIN dbo.DtsArticulos da
  ON a.art_CodGen=da.art_CodGen AND a.art_CodEle1=da.art_CodEle1 AND a.art_CodEle2=da.art_CodEle2 AND a.art_CodEle3=da.art_CodEle3
WHERE a.art_CircVta=1 AND a.art_InclEnLisP=1 AND da.Dart_ActualizarListaPrec='S'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.ListaPrec lp
    WHERE lp.lprdlp_Cod='LBC'
      AND lp.lprart_CodGen=a.art_CodGen
      AND lp.lprart_CodEle1=a.art_CodEle1
      AND lp.lprart_CodEle2=a.art_CodEle2
      AND lp.lprart_CodEle3=a.art_CodEle3
  );
    `);
    const insertedLBC = insRes?.rowsAffected?.[0] ?? 0;
    progress(32, 'Validación', `Faltantes insertados en LBC: ${insertedLBC}`);

    // 4) verificar existencia de la vista/tabla de análisis
    progress(35, 'Chequeos', 'Verificando análisis de mark-up…');
    const checkView = await q1(`
SELECT 1 AS ok
WHERE EXISTS (
  SELECT 1
  FROM sys.objects
  WHERE (name = 'CONE_Mark_Up_Articulos_Analisis')
    AND (type IN ('V','U'))
);
    `);
    if (!checkView?.recordset?.length) {
      const msg = "No se encontró dbo.CONE_Mark_Up_Articulos_Analisis (vista/tabla).";
      throw new Error(msg);
    }

    // 5) volcar análisis a #temp
    progress(50, 'Cargando', 'Cargando análisis en temporal…');
    await q(`
INSERT INTO #ResultadosActualizacion (
  lprdlp_Cod,lprart_CodGen,lprart_CodEle1,lprart_CodEle2,lprart_CodEle3,
  CostoOriginal,MonedaOriginal,TipoCambioOriginal,FechaCotizacionAplicada,CotizacionAplicada,
  CostoBasePesos,PrecioFinal,PrecioOriginal,InfoCotizacion
)
SELECT [lprdlp_Cod],[lprart_CodGen],[lprart_CodEle1],[lprart_CodEle2],[lprart_CodEle3],
       [CostoOriginal],[MonedaOriginal],[TipoCambioOriginal],[FechaCotizacionAplicada],
       [CotizacionAplicada],[CostoBasePesos],[PrecioFinal],[PrecioOriginal],[InfoCotizacion]
FROM [SBDATEST].[dbo].[CONE_Mark_Up_Articulos_Analisis];
    `);

    const tempCount = await q1(`SELECT COUNT(*) AS c FROM #ResultadosActualizacion;`);
    const rowsTemp = tempCount?.recordset?.[0]?.c ?? 0;
    if (rowsTemp === 0) {
      throw new Error('La tabla temporal quedó vacía. No hay datos para actualizar.');
    }
    progress(60, 'Cargando', `Filas en temporal: ${rowsTemp}`);

    // 6) aplicar update en ListaPrec
    progress(72, 'Actualizando', 'Aplicando precios en LBC…');
    const updRes = await q1(`
UPDATE lp
SET lp.lpr_Precio = CASE WHEN ra.PrecioFinal IS NULL THEN 0 ELSE ra.PrecioFinal END,
    lp.lpr_FecMod = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
INNER JOIN #ResultadosActualizacion ra
  ON lp.lprdlp_Cod=ra.lprdlp_Cod
 AND lp.lprart_CodGen=ra.lprart_CodGen
 AND lp.lprart_CodEle1=ra.lprart_CodEle1
 AND lp.lprart_CodEle2=ra.lprart_CodEle2
 AND lp.lprart_CodEle3=ra.lprart_CodEle3
WHERE lp.lprdlp_Cod='LBC';
    `);
    const updated = updRes?.rowsAffected?.reduce?.((a,b)=>a+b,0) ?? (updRes?.rowsAffected?.[0] ?? 0);
    progress(80, 'Actualizando', `Filas actualizadas: ${updated}`);

    // 7) auditoría
    progress(86, 'Auditando', 'Registrando cambios…');
    const audRes = await q1(`
INSERT INTO dbo.CONE_RegistroActualizacionPrecios (
  ListaPrecioCod,ArticuloCodGen,ArticuloCodEle1,ArticuloCodEle2,ArticuloCodEle3,
  PrecioOriginal,PrecioNuevo,CostoOriginal,MonedaOriginal,TipoCambioOriginal,
  FechaCotizacionAplicada,CotizacionAplicada,CostoBasePesos,MarkupAplicadoPorcentaje,
  InfoCotizacion,UsuarioEjecucion
)
SELECT ra.lprdlp_Cod,ra.lprart_CodGen,ra.lprart_CodEle1,ra.lprart_CodEle2,ra.lprart_CodEle3,
       ra.PrecioOriginal,ra.PrecioFinal,ra.CostoOriginal,ra.MonedaOriginal,ra.TipoCambioOriginal,
       ra.FechaCotizacionAplicada,ra.CotizacionAplicada,ra.CostoBasePesos,
       ISNULL(CASE WHEN ra.CostoBasePesos<>0 THEN (ra.PrecioFinal/ra.CostoBasePesos-1)*100 ELSE 0 END,0),
       ra.InfoCotizacion,SUSER_SNAME()
FROM #ResultadosActualizacion ra
WHERE ra.lprdlp_Cod='LBC';
    `);
    const audited = audRes?.rowsAffected?.[0] ?? 0;
    progress(90, 'Auditando', `Filas auditadas: ${audited}`);

    // 8) limpieza temp
    progress(94, 'Limpiando', 'Eliminando temporales…');
    await q(`DROP TABLE #ResultadosActualizacion;`);

    // 9) commit
    progress(98, 'Finalizando', 'Confirmando cambios…');
    await tx.commit();

    progress(100, 'Listo', 'La lista de precios se actualizó correctamente.');
    return { success: true, message: 'La lista de precios se ha actualizado correctamente.' };

  } catch (error) {
    console.error('❌ Error en actualización de precios (progressive):', error);
    try { await tx?.rollback(); } catch (e) { console.error('Rollback falló:', e); }
    const msg = /timeout/i.test(error?.message)
      ? 'La actualización superó el tiempo máximo (timeout).'
      : (error?.message || 'Error en la base de datos al actualizar los precios.');
    tryAlert('Actualización de precios', msg);
    return { success: false, message: msg };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

// ---------- último lote actualizado ----------
async function obtenerPreciosActualizados() {
  let pool;
  try {
    // Timeouts más altos por si el SELECT es grande
    const cfg = {
      ...getAdminDbConfig(),
      connectionTimeout: 60000,  // 60s
      requestTimeout:    300000, // 5 min
    };
    pool = await sql.connect(cfg);
    const req = pool.request();
    req.timeout = cfg.requestTimeout;

    const q = `
SELECT 
  FechaEjecucion, 
  ListaPrecioCod,
  ArticuloCodGen + ' ' + ArticuloCodEle1 + ' ' + ArticuloCodEle2 + ' ' + ArticuloCodEle3 AS CodArticulo,
  art_DescGen + ' ' + artele_Desc1 + ' ' + artele_Desc2 + ' ' + artele_Desc3 AS Descripcion,
  CostoOriginal, mon_descrip AS MonedaCosto,
  CotizacionAplicada AS Cotizacion, 
  CostoBasePesos, MarkupAplicadoPorcentaje AS MarkUp,
  PrecioOriginal AS PrecioAnterior, 
  PrecioNuevo,
  A.art_InclEnLisP, A.art_CircVta, D.Dart_ActualizarListaPrec
FROM CONE_RegistroActualizacionPrecios R
LEFT JOIN Articulos A
  ON A.art_CodGen  = R.ArticuloCodGen
 AND A.art_CodEle1 = R.ArticuloCodEle1
 AND A.art_CodEle2 = R.ArticuloCodEle2
 AND A.art_CodEle3 = R.ArticuloCodEle3
LEFT JOIN mon ON mon_Codigo = R.MonedaOriginal
LEFT JOIN DtsArticulos D ON D.art_CodGen = A.art_CodGen
WHERE FechaEjecucion = (SELECT MAX(FechaEjecucion) FROM CONE_RegistroActualizacionPrecios)
ORDER BY ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3
    `;
    const rs = await req.query(q);
    return { success: true, preciosActualizados: rs.recordset || [] };
  } catch (error) {
    console.error('❌ Error al obtener precios actualizados:', error);
    const msg = /timeout/i.test(error?.message)
      ? 'La consulta de resultados superó el tiempo máximo (timeout).'
      : 'Error en la base de datos al obtener los precios actualizados.';
    return { success: false, message: msg };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

// ---------- exports ----------
module.exports = {
  // existentes
  obtenerPrecios,
  actualizarListaDePrecios,      // progressive (default) o exact
  obtenerPreciosActualizados,
};
