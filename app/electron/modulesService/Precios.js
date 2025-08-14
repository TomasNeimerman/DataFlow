const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function obtenerPrecios() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('Conectando a la base de datos con la configuración:', dbConfig);
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT TOP 100 lprdlp_Cod, lprart_CodGen, lpr_Precio, lpr_FecMod FROM ListaPrec`);

    return {
      success: true,
      precios: result.recordset || [],
    };
  } catch (err) {
    console.error('❌ Error en obtenerPrecios:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}
async function actualizarListaDePrecios() {
    let pool;
    
    try {
        const dbConfig = getAdminDbConfig();
        console.log('Conectando a la base de datos con la configuración:', dbConfig);
        pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        // El script SQL que proporcionaste. Es largo, así que lo mantenemos como una constante.
        const scriptActualizacion = `
BEGIN TRANSACTION;
SET NOCOUNT ON;

---------------------------------------------------------------------
-- 1) Tabla temporal con collation explícito (evita conflictos)
---------------------------------------------------------------------
IF OBJECT_ID('tempdb..#ResultadosActualizacion') IS NOT NULL
    DROP TABLE #ResultadosActualizacion;

CREATE TABLE #ResultadosActualizacion (
    lprdlp_Cod           VARCHAR(3)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodGen        VARCHAR(20)  COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle1       VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle2       VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle3       VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    CostoOriginal        MONEY        NULL,
    MonedaOriginal       VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    TipoCambioOriginal   VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    FechaCotizacionAplicada DATETIME  NULL,
    CotizacionAplicada   FLOAT        NULL,
    CostoBasePesos       MONEY        NULL,
    PrecioFinal          MONEY        NULL,
    PrecioOriginal       MONEY        NULL,
    InfoCotizacion       VARCHAR(100) COLLATE DATABASE_DEFAULT NULL
);

---------------------------------------------------------------------
-- 2) Fechas útiles
---------------------------------------------------------------------
DECLARE @FechaAyer DATE = DATEADD(day, -1, CAST(GETDATE() AS DATE));
DECLARE @FechaHoy  DATE = CAST(GETDATE() AS DATE);

---------------------------------------------------------------------
-- 3) Insertar nuevos artículos en LBC si no existen
---------------------------------------------------------------------
INSERT INTO dbo.ListaPrec (
    lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3,
    lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo
)
SELECT
    'LBC',
    a.art_CodGen, a.art_CodEle1, a.art_CodEle2, a.art_CodEle3,
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
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.ListaPrec lp
        WHERE lp.lprdlp_Cod      = 'LBC'
          AND lp.lprart_CodGen   = a.art_CodGen
          AND lp.lprart_CodEle1  = a.art_CodEle1
          AND lp.lprart_CodEle2  = a.art_CodEle2
          AND lp.lprart_CodEle3  = a.art_CodEle3
  );

---------------------------------------------------------------------
-- 4) Calcular precios y registrar resultados (solo LBC, artículos R-%)
--    Usamos CROSS APPLY para obtener el último ArtProv + cotizaciones
---------------------------------------------------------------------
INSERT INTO #ResultadosActualizacion (
    lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3,
    CostoOriginal, MonedaOriginal, TipoCambioOriginal,
    FechaCotizacionAplicada, CotizacionAplicada,
    CostoBasePesos, PrecioFinal, PrecioOriginal, InfoCotizacion
)
SELECT
    lp.lprdlp_Cod,
    lp.lprart_CodGen, lp.lprart_CodEle1, lp.lprart_CodEle2, lp.lprart_CodEle3,

    ap.apr_PrProv                                    AS CostoOriginal,
    ap.aprmon_CodigoPrProv                           AS MonedaOriginal,
    ap.aprmtca_CodigoPrProv                          AS TipoCambioOriginal,

    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN @FechaHoy
        ELSE ISNULL(mc_ayer.mcot_fecha, mc_ant.mcot_fecha)
    END                                              AS FechaCotizacionAplicada,

    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 1
        WHEN ap.aprmon_CodigoPrProv = '2' THEN ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza)
        ELSE 1
    END                                              AS CotizacionAplicada,

    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN ap.apr_PrProv
        WHEN ap.aprmon_CodigoPrProv = '2' THEN ap.apr_PrProv * ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza)
        ELSE ap.apr_PrProv
    END                                              AS CostoBasePesos,

    /* PrecioFinal = costo base en pesos * (1 + margen mayorista/100) */
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN ap.apr_PrProv * (1 + ar2.ar2_MargenMay / 100.0)
        WHEN ap.aprmon_CodigoPrProv = '2' THEN (ap.apr_PrProv * ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza)) * (1 + ar2.ar2_MargenMay / 100.0)
        ELSE ap.apr_PrProv * (1 + ar2.ar2_MargenMay / 100.0)
    END                                              AS PrecioFinal,

    lp.lpr_Precio                                    AS PrecioOriginal,

    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 'Costo en Pesos (Cotización = 1)'
        WHEN mc_ayer.mcot_fecha IS NOT NULL THEN 'Cotización del día anterior'
        WHEN mc_ant.mcot_fecha  IS NOT NULL THEN 'Cotización anterior (más antigua)'
        ELSE 'No se encontró cotización'
    END                                              AS InfoCotizacion
FROM dbo.ListaPrec lp
INNER JOIN dbo.Articulos a
    ON lp.lprart_CodGen  = a.art_CodGen
   AND lp.lprart_CodEle1 = a.art_CodEle1
   AND lp.lprart_CodEle2 = a.art_CodEle2
   AND lp.lprart_CodEle3 = a.art_CodEle3
INNER JOIN dbo.Articulos2 ar2
    ON a.art_CodGen  = ar2.ar2art_CodGen
   AND a.art_CodEle1 = ar2.ar2art_CodEle1
   AND a.art_CodEle2 = ar2.ar2art_CodEle2
   AND a.art_CodEle3 = ar2.ar2art_CodEle3
-- último proveedor habitual para ese artículo
CROSS APPLY (
    SELECT TOP 1 ap.*
    FROM dbo.ArtProv ap
    WHERE ap.aprart_CodGen  = lp.lprart_CodGen
      AND ap.aprart_CodEle1 = lp.lprart_CodEle1
      AND ap.aprart_CodEle2 = lp.lprart_CodEle2
      AND ap.aprart_CodEle3 = lp.lprart_CodEle3
    ORDER BY ap.apr_FecMod DESC
) ap
-- cotización del día anterior (ayer)
OUTER APPLY (
    SELECT TOP 1 m.*
    FROM manager.dbo.mon_cam m
    WHERE m.mon_codigo COLLATE DATABASE_DEFAULT = ap.aprmon_CodigoPrProv  COLLATE DATABASE_DEFAULT
      AND m.mtca_codigo COLLATE DATABASE_DEFAULT = ap.aprmtca_CodigoPrProv COLLATE DATABASE_DEFAULT
      AND CAST(m.mcot_fecha AS DATE) = @FechaAyer
    ORDER BY m.mcot_fecha DESC
) mc_ayer
-- última cotización anterior a ayer
OUTER APPLY (
    SELECT TOP 1 m.*
    FROM manager.dbo.mon_cam m
    WHERE m.mon_codigo COLLATE DATABASE_DEFAULT = ap.aprmon_CodigoPrProv  COLLATE DATABASE_DEFAULT
      AND m.mtca_codigo COLLATE DATABASE_DEFAULT = ap.aprmtca_CodigoPrProv COLLATE DATABASE_DEFAULT
      AND m.mcot_fecha < @FechaAyer
    ORDER BY m.mcot_fecha DESC
) mc_ant
WHERE lp.lprdlp_Cod = 'LBC'
  AND lp.lprart_CodGen LIKE 'R-%';

---------------------------------------------------------------------
-- 5) Actualizar ListaPrec (collation-safe en el JOIN)
---------------------------------------------------------------------
UPDATE lp
SET lp.lpr_Precio     = ISNULL(ra.PrecioFinal, 0),
    lp.lpr_FecMod     = GETDATE(),
    lp.lprusu_Codigo  = 'ADMIN'
FROM dbo.ListaPrec lp
INNER JOIN #ResultadosActualizacion ra
    ON lp.lprdlp_Cod      COLLATE DATABASE_DEFAULT = ra.lprdlp_Cod
   AND lp.lprart_CodGen   COLLATE DATABASE_DEFAULT = ra.lprart_CodGen
   AND lp.lprart_CodEle1  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle1
   AND lp.lprart_CodEle2  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle2
   AND lp.lprart_CodEle3  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle3
WHERE lp.lprdlp_Cod = 'LBC'
  AND lp.lprart_CodGen LIKE 'R-%';

---------------------------------------------------------------------
-- 6) Registrar auditoría de cambios
---------------------------------------------------------------------
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
    ISNULL(CASE WHEN ra.CostoBasePesos <> 0 THEN (ra.PrecioFinal / ra.CostoBasePesos - 1) * 100 ELSE 0 END, 0),
    ra.InfoCotizacion,
    SUSER_SNAME()
FROM #ResultadosActualizacion ra
WHERE ra.lprdlp_Cod = 'LBC'
  AND ra.lprart_CodGen LIKE 'R-%';

---------------------------------------------------------------------
-- 7) Limpieza y commit
---------------------------------------------------------------------
DROP TABLE #ResultadosActualizacion;

--ROLLBACK TRANSACTION; -- <- para pruebas
COMMIT TRANSACTION;

        `;
        
        const request = new sql.Request(transaction);
        await request.query(scriptActualizacion);
        
        await transaction.commit();

        return { success: true, message: 'La lista de precios se ha actualizado correctamente.' };

    } catch (error) {
        console.error('Error al ejecutar el script de actualización de precios:', error);
        await transaction.rollback(); // Deshacer cambios en caso de error
        // Lanza el error para que sea capturado por el manejador de IPC
        throw new Error('Error en la base de datos al actualizar los precios.'); 
    } finally {
    if (pool) await pool.close();
  }
}
async function obtenerPreciosActualizados() {
    let pool
    try {
        const dbConfig = getAdminDbConfig();
        console.log('Conectando a la base de datos con la configuración:', dbConfig);
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT 
                FechaEjecucion, 
                ListaPrecioCod,
                ArticuloCodGen + ' ' + ArticuloCodEle1 + ' ' + ArticuloCodEle2 + ' ' + ArticuloCodEle3 AS CodArticulo,
                art_DescGen + ' ' + artele_Desc1 + ' ' + artele_Desc2 + ' ' + artele_Desc3 AS Descripcion,
                PrecioOriginal AS PrecioAnterior, 
                PrecioNuevo
            FROM CONE_RegistroActualizacionPrecios
            LEFT JOIN Articulos 
                ON art_CodGen = ArticuloCodGen
                AND art_CodEle1 = ArticuloCodEle1
                AND art_CodEle2 = ArticuloCodEle2
                AND art_CodEle3 = ArticuloCodEle3
            WHERE FechaEjecucion = (
                SELECT MAX(FechaEjecucion) 
                FROM CONE_RegistroActualizacionPrecios
            )
            ORDER BY ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3;`);

        return { success: true, preciosActualizados: result.recordset };

    } catch (error) {
        console.error('Error al obtener los precios actualizados:', error);
        throw new Error('Error en la base de datos al obtener los precios actualizados.');
    }
}

module.exports = {
    obtenerPrecios,
    actualizarListaDePrecios,
    obtenerPreciosActualizados
};