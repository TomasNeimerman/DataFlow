// modulesService/Precios.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

// Helper para reportar progreso sin romper si no lo pasan
const progressFn = (onProgress) => (p, stage, msg) => {
  try { onProgress && onProgress(p, stage, msg); } catch (_) {}
};

// -------------------------------
// 1) Listado simple (últimos 100)
// -------------------------------
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

// -------------------------------
// 2) Actualización masiva (LBC)
//    — Adaptada de tu script: sin USE/GO, con transacción y #temp
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

    // 1) Temp table (con collation alineada para evitar conflictos)
    await q(`
IF OBJECT_ID('tempdb..#ResultadosActualizacion') IS NOT NULL
    DROP TABLE #ResultadosActualizacion;

CREATE TABLE #ResultadosActualizacion (
    lprdlp_Cod              VARCHAR(3)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodGen           VARCHAR(20)  COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle1          VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle2          VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle3          VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    CostoOriginal           MONEY        NULL,
    MonedaOriginal          VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    TipoCambioOriginal      VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    FechaCotizacionAplicada DATETIME     NULL,
    CotizacionAplicada      FLOAT        NULL,
    CostoBasePesos          MONEY        NULL,
    MargenMay               REAL         NOT NULL DEFAULT 0,
    MargenMin               REAL         NOT NULL DEFAULT 0,
    PrecioFinal             MONEY        NULL,
    PrecioOriginal          MONEY        NULL,
    InfoCotizacion          VARCHAR(100) COLLATE DATABASE_DEFAULT NULL
);
    `);

    // (opcional) variables que tu script declaraba; las dejo por si las usás luego
    await q(`
DECLARE @FechaAyer DATE = DATEADD(day, -1, CAST(GETDATE() AS DATE));
DECLARE @FechaHoy  DATE = CAST(GETDATE() AS DATE);
    `);

    progress(20, 'Analizando', 'Insertando nuevos artículos en LBC…');

    // 2) Inserta en LBC si no existe y cumple condiciones
    await q(`
INSERT INTO dbo.ListaPrec (
    lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3,
    lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo
)
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
  ON  a.art_CodGen  = da.art_CodGen
  AND a.art_CodEle1 = da.art_CodEle1
  AND a.art_CodEle2 = da.art_CodEle2
  AND a.art_CodEle3 = da.art_CodEle3
WHERE a.art_CircVta = 1
  AND a.art_InclEnLisP = 1
  AND da.Dart_ActualizarListaPrec = 'S'
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.ListaPrec lp
        WHERE lp.lprdlp_Cod     = 'LBC'
          AND lp.lprart_CodGen  = a.art_CodGen
          AND lp.lprart_CodEle1 = a.art_CodEle1
          AND lp.lprart_CodEle2 = a.art_CodEle2
          AND lp.lprart_CodEle3 = a.art_CodEle3
  );
    `);

    progress(50, 'Cargando', 'Volcando análisis a la temporal…');

    // 3) Trae el análisis de CONE_Mark_Up_Articulos_Analisis a la #temp
    await q(`
INSERT INTO #ResultadosActualizacion (
    lprdlp_Cod,
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
    InfoCotizacion
)
SELECT 
    [lprdlp_Cod],
    [lprart_CodGen],
    [lprart_CodEle1],
    [lprart_CodEle2],
    [lprart_CodEle3],
    [CostoOriginal],
    [MonedaOriginal],
    [TipoCambioOriginal],
    [FechaCotizacionAplicada],
    [CotizacionAplicada],
    [CostoBasePesos],
    [PrecioFinal],
    [PrecioOriginal],
    [InfoCotizacion]
FROM [dbo].[CONE_Mark_Up_Articulos_Analisis];
-- Si necesitás forzar otra DB, usa: FROM [SBDATEST].[dbo].[CONE_Mark_Up_Articulos_Analisis]
    `);

    progress(70, 'Actualizando', 'Aplicando precios en ListaPrec (LBC)…');

    // 4) Update de ListaPrec según #temp (precio 0 si viene NULL)
    await q(`
UPDATE lp
SET lp.lpr_Precio    = CASE WHEN ra.PrecioFinal IS NULL THEN 0 ELSE ra.PrecioFinal END,
    lp.lpr_FecMod    = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
INNER JOIN #ResultadosActualizacion ra
    ON  lp.lprdlp_Cod     = ra.lprdlp_Cod
    AND lp.lprart_CodGen  = ra.lprart_CodGen
    AND lp.lprart_CodEle1 = ra.lprart_CodEle1
    AND lp.lprart_CodEle2 = ra.lprart_CodEle2
    AND lp.lprart_CodEle3 = ra.lprart_CodEle3
WHERE lp.lprdlp_Cod = 'LBC';
    `);

    progress(85, 'Auditando', 'Registrando auditoría…');

    // 5) Auditoría (columnas según tu script)
    await q(`
INSERT INTO dbo.CONE_RegistroActualizacionPrecios (
    ListaPrecioCod,
    ArticuloCodGen,
    ArticuloCodEle1,
    ArticuloCodEle2,
    ArticuloCodEle3,
    PrecioOriginal,
    PrecioNuevo,
    CostoOriginal,
    MonedaOriginal,
    TipoCambioOriginal,
    FechaCotizacionAplicada,
    CotizacionAplicada,
    CostoBasePesos,
    MarkupAplicadoPorcentaje,
    InfoCotizacion,
    UsuarioEjecucion
)
SELECT
    ra.lprdlp_Cod,
    ra.lprart_CodGen,
    ra.lprart_CodEle1,
    ra.lprart_CodEle2,
    ra.lprart_CodEle3,
    ra.PrecioOriginal,
    ra.PrecioFinal,
    ra.CostoOriginal,
    ra.MonedaOriginal,
    ra.TipoCambioOriginal,
    ra.FechaCotizacionAplicada,
    ra.CotizacionAplicada,
    ra.CostoBasePesos,
    ISNULL(CASE WHEN ra.CostoBasePesos <> 0
                THEN (ra.PrecioFinal / ra.CostoBasePesos - 1) * 100
                ELSE 0 END, 0) AS MarkupAplicadoPorcentaje,
    ra.InfoCotizacion,
    SUSER_SNAME();
    `);

    progress(95, 'Limpiando', 'Eliminando tabla temporal…');

    // 6) Limpieza
    await q(`DROP TABLE #ResultadosActualizacion;`);

    await tx.commit();
    progress(100, 'Finalizado', 'La lista de precios se actualizó correctamente.');
    return { success: true, message: 'La lista de precios se ha actualizado correctamente.' };

  } catch (error) {
    console.error('❌ Error al actualizar lista de precios:', error);
    try { await tx?.rollback(); } catch (_) {}
    return { success: false, message: 'Error en la base de datos al actualizar los precios.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}


// -------------------------------
// 3) Última ejecución (resumen)
// -------------------------------
async function obtenerPreciosActualizados() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT 
  FechaEjecucion, 
  ListaPrecioCod,
  ArticuloCodGen + ' ' + ArticuloCodEle1 + ' ' + ArticuloCodEle2 + ' ' + ArticuloCodEle3 AS CodArticulo,
  art_DescGen + ' ' + artele_Desc1 + ' ' + artele_Desc2 + ' ' + artele_Desc3 AS Descripcion, CostoOriginal, mon_descrip MonedaCosto,
  CotizacionAplicada Cotizacion, 
  CostoBasePesos, MarkupAplicadoPorcentaje MarkUp,

  PrecioOriginal AS PrecioAnterior, 
  PrecioNuevo
FROM CONE_RegistroActualizacionPrecios
LEFT JOIN Articulos 
  ON art_CodGen = ArticuloCodGen
 AND art_CodEle1 = ArticuloCodEle1
 AND art_CodEle2 = ArticuloCodEle2
 AND art_CodEle3 = ArticuloCodEle3
LEFT JOIN mon ON mon_Codigo=MonedaOriginal
WHERE FechaEjecucion = (
  SELECT MAX(FechaEjecucion) 
  FROM CONE_RegistroActualizacionPrecios
)
--AND ArticuloCodGen='R-ABR-PAR-30'
ORDER BY ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3

    `;
    const rs = await pool.request().query(q);
    return { success: true, preciosActualizados: rs.recordset || [] };
  } catch (error) {
    console.error('❌ Error al obtener precios actualizados:', error);
    return { success: false, message: 'Error en la base de datos al obtener los precios actualizados.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

module.exports = {
  obtenerPrecios,
  actualizarListaDePrecios,
  obtenerPreciosActualizados,
};
