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
-- Iniciar una transacción para poder hacer commit de los cambios
BEGIN TRANSACTION;

-- Tabla temporal para almacenar los resultados de la actualización
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
    PrecioFinal MONEY NULL,
    PrecioOriginal MONEY NULL,
    InfoCotizacion VARCHAR(100) NULL
);

-- Calcular la fecha de ayer y hoy
DECLARE @FechaAyer DATE = DATEADD(day, -1, CAST(GETDATE() AS DATE));
DECLARE @FechaHoy DATE = CAST(GETDATE() AS DATE);

-- Paso 1: Insertar nuevos artículos en la lista LBC si no existen
INSERT INTO dbo.ListaPrec (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo)
SELECT
    'LBC', -- Insertar en la lista LBC
    a.art_CodGen,
    a.art_CodEle1,
    a.art_CodEle2,
    a.art_CodEle3,
    0, -- Precio inicial en cero
    1, -- Asumimos que se imprime por defecto
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
  AND NOT EXISTS (SELECT 1 FROM dbo.ListaPrec lp
                  WHERE lp.lprdlp_Cod = 'LBC'
                    AND lp.lprart_CodGen = a.art_CodGen
                    AND lp.lprart_CodEle1 = a.art_CodEle1
                    AND lp.lprart_CodEle2 = a.art_CodEle2
                    AND lp.lprart_CodEle3 = a.art_CodEle3);

-- Paso 2: Calcular los nuevos precios y guardarlos en la tabla temporal (versión optimizada)
INSERT INTO #ResultadosActualizacion (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, CostoOriginal, MonedaOriginal, TipoCambioOriginal, FechaCotizacionAplicada, CotizacionAplicada, CostoBasePesos, PrecioFinal, PrecioOriginal, InfoCotizacion)
SELECT
    lp.lprdlp_Cod,
    lp.lprart_CodGen,
    lp.lprart_CodEle1,
    lp.lprart_CodEle2,
    lp.lprart_CodEle3,
    ap.apr_PrProv AS CostoOriginal,
    ap.aprmon_CodigoPrProv AS MonedaOriginal,
    ap.aprmtca_CodigoPrProv AS TipoCambioOriginal,
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN @FechaHoy
        ELSE ISNULL(mc_ayer.mcot_fecha, mc_anterior.mcot_fecha)
    END AS FechaCotizacionAplicada,
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 1
        WHEN ap.aprmon_CodigoPrProv = '2' THEN ISNULL(mc_ayer.mcot_cotiza, mc_anterior.mcot_cotiza)
        ELSE 1
    END AS CotizacionAplicada,
    ap.apr_PrProv *
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 1
        WHEN ap.aprmon_CodigoPrProv = '2' THEN ISNULL(mc_ayer.mcot_cotiza, mc_anterior.mcot_cotiza)
        ELSE 1
    END AS CostoBasePesos,
    (ap.apr_PrProv *
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 1
        WHEN ap.aprmon_CodigoPrProv = '2' THEN ISNULL(mc_ayer.mcot_cotiza, mc_anterior.mcot_cotiza)
        ELSE 1
    END) * (1 + ar2.ar2_MargenMay / 100) AS PrecioFinal,
    lp.lpr_Precio AS PrecioOriginal,
    CASE
        WHEN ap.aprmon_CodigoPrProv = '1' THEN 'Costo en Pesos (Cotización = 1)'
        WHEN mc_ayer.mcot_fecha IS NOT NULL THEN 'Cotización del día anterior'
        WHEN mc_anterior.mcot_fecha IS NOT NULL THEN 'Cotización anterior (más antigua)'
        ELSE 'No se encontró cotización'
    END AS InfoCotizacion
FROM dbo.ListaPrec lp
INNER JOIN dbo.Articulos a ON lp.lprart_CodGen = a.art_CodGen AND lp.lprart_CodEle1 = a.art_CodEle1 AND lp.lprart_CodEle2 = a.art_CodEle2 AND lp.lprart_CodEle3 = a.art_CodEle3
INNER JOIN dbo.Articulos2 ar2 ON a.art_CodGen = ar2.ar2art_CodGen AND a.art_CodEle1 = ar2.ar2art_CodEle1 AND a.art_CodEle2 = ar2.ar2art_CodEle2 AND a.art_CodEle3 = ar2.ar2art_CodEle3
OUTER APPLY (
    SELECT TOP 1 apr_PrProv, aprmon_CodigoPrProv, aprmtca_CodigoPrProv
    FROM dbo.ArtProv
    WHERE aprart_CodGen = lp.lprart_CodGen
      AND aprart_CodEle1 = lp.lprart_CodEle1
      AND aprart_CodEle2 = lp.lprart_CodEle2
      AND aprart_CodEle3 = lp.lprart_CodEle3
    ORDER BY apr_FecMod DESC
) ap
LEFT JOIN manager.dbo.mon_cam mc_ayer ON ap.aprmon_CodigoPrProv = mc_ayer.mon_codigo COLLATE DATABASE_DEFAULT AND ap.aprmtca_CodigoPrProv = mc_ayer.mtca_codigo COLLATE DATABASE_DEFAULT AND CAST(mc_ayer.mcot_fecha AS DATE) = @FechaAyer
LEFT JOIN manager.dbo.mon_cam mc_anterior ON ap.aprmon_CodigoPrProv = mc_anterior.mon_codigo COLLATE DATABASE_DEFAULT AND ap.aprmtca_CodigoPrProv = mc_anterior.mtca_codigo COLLATE DATABASE_DEFAULT
    AND mc_anterior.mcot_fecha = (
        SELECT MAX(mca.mcot_fecha)
        FROM manager.dbo.mon_cam mca
        WHERE mca.mon_codigo = ap.aprmon_CodigoPrProv COLLATE DATABASE_DEFAULT
          AND mca.mtca_codigo = ap.aprmtca_CodigoPrProv COLLATE DATABASE_DEFAULT
          AND mca.mcot_fecha < @FechaAyer
    )
WHERE lp.lprdlp_Cod = 'LBC'
  AND lp.lprart_CodGen LIKE 'R-%';

-- Paso 3: Actualizar la tabla ListaPrec con el nuevo precio (versión corregida)
UPDATE lp
SET lp.lpr_Precio = CASE WHEN ra.PrecioFinal IS NULL THEN 0 ELSE ra.PrecioFinal END,
    lp.lpr_FecMod = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
INNER JOIN #ResultadosActualizacion ra
    ON lp.lprdlp_Cod = ra.lprdlp_Cod COLLATE DATABASE_DEFAULT
    AND lp.lprart_CodGen = ra.lprart_CodGen COLLATE DATABASE_DEFAULT
    AND lp.lprart_CodEle1 = ra.lprart_CodEle1 COLLATE DATABASE_DEFAULT
    AND lp.lprart_CodEle2 = ra.lprart_CodEle2 COLLATE DATABASE_DEFAULT
    AND lp.lprart_CodEle3 = ra.lprart_CodEle3 COLLATE DATABASE_DEFAULT
WHERE lp.lprdlp_Cod = 'LBC'
  AND lp.lprart_CodGen LIKE 'R-%';

-- Paso 4: Insertar el registro de la actualización en la tabla de log
INSERT INTO dbo.CONE_RegistroActualizacionPrecios (
    ListaPrecioCod, ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3,
    PrecioOriginal, PrecioNuevo, CostoOriginal, MonedaOriginal, TipoCambioOriginal,
    FechaCotizacionAplicada, CotizacionAplicada, CostoBasePesos, MarkupAplicadoPorcentaje,
    InfoCotizacion, UsuarioEjecucion
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
    ISNULL(CASE
        WHEN ra.CostoBasePesos <> 0 THEN (ra.PrecioFinal / ra.CostoBasePesos - 1) * 100
        ELSE 0
    END, 0),
    ra.InfoCotizacion,
    SUSER_SNAME()
FROM #ResultadosActualizacion ra
WHERE ra.lprdlp_Cod = 'LBC'
  AND ra.lprart_CodGen LIKE 'R-%';

-- Limpiar la tabla temporal
DROP TABLE #ResultadosActualizacion;

-- Aplicar los cambios de forma permanente
COMMIT TRANSACTION;
-- Si algo falla, puedes cancelar con: ROLLBACK TRANSACTION;

GO
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