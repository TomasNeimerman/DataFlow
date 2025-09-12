// modulesService/Precios.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

const ANALYSIS_DB = process.env.ANALYSIS_DB || 'SBDATEST'; // ← por defecto SBDATEST

const progressFn = (onProgress) => (p, stage, msg) => { try { onProgress && onProgress(p, stage, msg); } catch {} };

// -------------------------------
async function obtenerPrecios() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT TOP (100)
        lprdlp_Cod, lprart_CodGen,
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
  } finally { try { await pool?.close(); } catch {} }
}

// -------------------------------
// 2) Actualización masiva (LBC) — mantiene tu script, sin USE/GO
// -------------------------------
async function actualizarListaDePrecios({ onProgress } = {}) {
  const progress = progressFn(onProgress);
  let pool, tx;
  try {
    pool = await sql.connect(getAdminDbConfig());
    tx = new sql.Transaction(pool);
    await tx.begin();

    const q = async (text) => new sql.Request(tx).query(text);

    progress(5, 'Preparando', 'Creando tabla temporal…');
    await q(`
IF OBJECT_ID('tempdb..#ResultadosActualizacion') IS NOT NULL DROP TABLE #ResultadosActualizacion;
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
DECLARE @FechaHoy  DATE = CAST(GETDATE() AS DATE);
    `);

    progress(20, 'Analizando', 'Insertando nuevos artículos en LBC…');
    await q(`
INSERT INTO dbo.ListaPrec (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo)
SELECT 'LBC', a.art_CodGen, a.art_CodEle1, a.art_CodEle2, a.art_CodEle3,
       0, 1, GETDATE(), 'ADMIN'
FROM dbo.Articulos a
LEFT JOIN dbo.DtsArticulos da
  ON  a.art_CodGen  = da.art_CodGen
  AND a.art_CodEle1 = da.art_CodEle1
  AND a.art_CodEle2 = da.art_CodEle2
  AND a.art_CodEle3 = da.art_CodEle3
WHERE a.art_CircVta = 1
  AND a.art_InclEnLisP = 1
  AND da.Dart_ActualizarListaPrec = 'S'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.ListaPrec lp
    WHERE lp.lprdlp_Cod='LBC'
      AND lp.lprart_CodGen  = a.art_CodGen
      AND lp.lprart_CodEle1 = a.art_CodEle1
      AND lp.lprart_CodEle2 = a.art_CodEle2
      AND lp.lprart_CodEle3 = a.art_CodEle3
  );
    `);

    progress(50, 'Cargando', 'Volcando análisis de SBDATEST…');
    await q(`
INSERT INTO #ResultadosActualizacion (
  lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3,
  CostoOriginal, MonedaOriginal, TipoCambioOriginal, FechaCotizacionAplicada,
  CotizacionAplicada, CostoBasePesos, PrecioFinal, PrecioOriginal, InfoCotizacion
)
SELECT
  [lprdlp_Cod], [lprart_CodGen], [lprart_CodEle1], [lprart_CodEle2], [lprart_CodEle3],
  [CostoOriginal], [MonedaOriginal], [TipoCambioOriginal], [FechaCotizacionAplicada],
  [CotizacionAplicada], [CostoBasePesos], [PrecioFinal], [PrecioOriginal], [InfoCotizacion]
FROM [${ANALYSIS_DB}].[dbo].[CONE_Mark_Up_Articulos_Analisis];
    `);

    progress(70, 'Actualizando', 'Aplicando precios a ListaPrec…');
    await q(`
UPDATE lp
SET lp.lpr_Precio    = CASE WHEN ra.PrecioFinal IS NULL THEN 0 ELSE ra.PrecioFinal END,
    lp.lpr_FecMod    = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
JOIN #ResultadosActualizacion ra
  ON  lp.lprdlp_Cod     = ra.lprdlp_Cod
  AND lp.lprart_CodGen  = ra.lprart_CodGen
  AND lp.lprart_CodEle1 = ra.lprart_CodEle1
  AND lp.lprart_CodEle2 = ra.lprart_CodEle2
  AND lp.lprart_CodEle3 = ra.lprart_CodEle3
WHERE lp.lprdlp_Cod = 'LBC';
    `);

    progress(85, 'Auditando', 'Registrando auditoría…');
    await q(`
INSERT INTO dbo.CONE_RegistroActualizacionPrecios (
  ListaPrecioCod, ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3,
  PrecioOriginal, PrecioNuevo, CostoOriginal, MonedaOriginal, TipoCambioOriginal,
  FechaCotizacionAplicada, CotizacionAplicada, CostoBasePesos, MarkupAplicadoPorcentaje,
  InfoCotizacion, UsuarioEjecucion
)
SELECT
  ra.lprdlp_Cod, ra.lprart_CodGen, ra.lprart_CodEle1, ra.lprart_CodEle2, ra.lprart_CodEle3,
  ra.PrecioOriginal, ra.PrecioFinal, ra.CostoOriginal, ra.MonedaOriginal, ra.TipoCambioOriginal,
  ra.FechaCotizacionAplicada, ra.CotizacionAplicada, ra.CostoBasePesos,
  ISNULL(CASE WHEN ra.CostoBasePesos <> 0 THEN (ra.PrecioFinal / ra.CostoBasePesos - 1) * 100 ELSE 0 END, 0),
  ra.InfoCotizacion, SUSER_SNAME();
    `);

    progress(95, 'Limpiando', 'Eliminando temporales…');
    await q(`DROP TABLE #ResultadosActualizacion;`);

    await tx.commit();
    progress(100, 'Finalizado', 'La lista de precios se actualizó correctamente.');
    return { success: true, message: 'La lista de precios se ha actualizado correctamente.' };
  } catch (error) {
    console.error('❌ Error al actualizar lista de precios:', error);
    try { await tx?.rollback(); } catch {}
    return { success: false, message: 'Error en la base de datos al actualizar los precios.' };
  } finally { try { await pool?.close(); } catch {} }
}

// -------------------------------
async function obtenerPreciosActualizados() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
SELECT 
  r.FechaEjecucion, 
  r.ListaPrecioCod,
  r.ArticuloCodGen + ' ' + r.ArticuloCodEle1 + ' ' + r.ArticuloCodEle2 + ' ' + r.ArticuloCodEle3 AS CodArticulo,
  A.art_DescGen + ' ' + A.artele_Desc1 + ' ' + A.artele_Desc2 + ' ' + A.artele_Desc3 AS Descripcion,
  r.CostoOriginal, m.mon_descrip AS MonedaCosto,
  r.CotizacionAplicada AS Cotizacion, 
  r.CostoBasePesos, r.MarkupAplicadoPorcentaje AS MarkUp,
  r.PrecioOriginal AS PrecioAnterior, 
  r.PrecioNuevo, 
  A.art_InclEnLisP, A.art_CircVta, D.Dart_ActualizarListaPrec
FROM dbo.CONE_RegistroActualizacionPrecios r
LEFT JOIN dbo.Articulos A
  ON A.art_CodGen  = r.ArticuloCodGen
 AND A.art_CodEle1 = r.ArticuloCodEle1
 AND A.art_CodEle2 = r.ArticuloCodEle2
 AND A.art_CodEle3 = r.ArticuloCodEle3
LEFT JOIN dbo.mon m 
  ON m.mon_Codigo = r.MonedaOriginal
LEFT JOIN dbo.DtsArticulos D
  ON D.art_CodGen  = A.art_CodGen
 AND D.art_CodEle1 = A.art_CodEle1
 AND D.art_CodEle2 = A.art_CodEle2
 AND D.art_CodEle3 = A.art_CodEle3
WHERE r.FechaEjecucion = (SELECT MAX(FechaEjecucion) FROM dbo.CONE_RegistroActualizacionPrecios)
ORDER BY r.ArticuloCodGen, r.ArticuloCodEle1, r.ArticuloCodEle2, r.ArticuloCodEle3;
    `;
    const rs = await pool.request().query(q);
    return { success: true, preciosActualizados: rs.recordset || [] };
  } catch (error) {
    console.error('❌ Error al obtener precios actualizados:', error);
    return { success: false, message: 'Error en la base de datos al obtener los precios actualizados.' };
  } finally { try { await pool?.close(); } catch {} }
}

module.exports = {
  obtenerPrecios,
  actualizarListaDePrecios,
  obtenerPreciosActualizados,
};
