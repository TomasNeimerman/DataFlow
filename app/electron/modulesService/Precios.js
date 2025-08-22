// modulesService/Precios.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');
const path = require('path');
const fs = require('fs');

async function obtenerPrecios() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT TOP 100 lprdlp_Cod, lprart_CodGen, lpr_Precio, lpr_FecMod FROM ListaPrec`);
    return { success: true, precios: result.recordset || [] };
  } catch (err) {
    console.error('❌ Error en obtenerPrecios:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

async function actualizarListaDePrecios({ onProgress } = {}) {
  const progress = (p, stage, msg) => { try { onProgress && onProgress(p, stage, msg); } catch (_) {} };

  let pool;
  let transaction;
  const sessionId = uuidv4();

  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const q = (text, params = {}) => {
      const req = new sql.Request(transaction);
      // parámetros comunes
      req.input('Session', sql.UniqueIdentifier, sessionId);
      // params extra
      Object.entries(params).forEach(([k, v]) => req.input(k, v.type, v.value));
      return req.query(text);
    };

    progress(5, 'Preparando', 'Creando estructuras…');

    // 1) Crear tabla temp persistente si no existe
    await q(`
IF OBJECT_ID('dbo.CONE_TmpResultadosActualizacion','U') IS NULL
BEGIN
  CREATE TABLE dbo.CONE_TmpResultadosActualizacion (
    SessionId           UNIQUEIDENTIFIER NOT NULL,
    lprdlp_Cod          VARCHAR(3)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodGen       VARCHAR(20)  COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle1      VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle2      VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    lprart_CodEle3      VARCHAR(6)   COLLATE DATABASE_DEFAULT NOT NULL,
    CostoOriginal       MONEY        NULL,
    MonedaOriginal      VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    TipoCambioOriginal  VARCHAR(3)   COLLATE DATABASE_DEFAULT NULL,
    FechaCotizacionAplicada DATETIME NULL,
    CotizacionAplicada  FLOAT        NULL,
    CostoBasePesos      MONEY        NULL,
    PrecioFinal         MONEY        NULL,
    PrecioOriginal      MONEY        NULL,
    InfoCotizacion      VARCHAR(100) COLLATE DATABASE_DEFAULT NULL,
    CONSTRAINT PK_CONE_TmpResultadosActualizacion PRIMARY KEY NONCLUSTERED
      (SessionId, lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3)
  );
END;

-- limpiar por si queda basura de la misma sesión (no debería)
DELETE FROM dbo.CONE_TmpResultadosActualizacion WHERE SessionId = @Session;
    `);

    progress(15, 'Analizando', 'Insertando nuevos artículos en LBC…');

    // 2) Insertar nuevos en LBC
    await q(`
INSERT INTO dbo.ListaPrec (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio, lpr_Imprime, lpr_FecMod, lprusu_Codigo)
SELECT 'LBC', a.art_CodGen, a.art_CodEle1, a.art_CodEle2, a.art_CodEle3, 0, 1, GETDATE(), 'ADMIN'
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
      SELECT 1 FROM dbo.ListaPrec lp
      WHERE lp.lprdlp_Cod='LBC'
        AND lp.lprart_CodGen=a.art_CodGen
        AND lp.lprart_CodEle1=a.art_CodEle1
        AND lp.lprart_CodEle2=a.art_CodEle2
        AND lp.lprart_CodEle3=a.art_CodEle3
  );
    `);

    progress(40, 'Calculando', 'Cargando costos y cotizaciones…');

    // 3) Insertar en tabla de sesión con cálculos
    await q(`
DECLARE @FechaAyer DATE = DATEADD(day, -1, CAST(GETDATE() AS DATE));
DECLARE @FechaHoy  DATE = CAST(GETDATE() AS DATE);

INSERT INTO dbo.CONE_TmpResultadosActualizacion (
  SessionId, lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3,
  CostoOriginal, MonedaOriginal, TipoCambioOriginal,
  FechaCotizacionAplicada, CotizacionAplicada,
  CostoBasePesos, PrecioFinal, PrecioOriginal, InfoCotizacion
)
SELECT
  @Session,
  lp.lprdlp_Cod,
  lp.lprart_CodGen, lp.lprart_CodEle1, lp.lprart_CodEle2, lp.lprart_CodEle3,
  ap.apr_PrProv,
  ap.aprmon_CodigoPrProv,
  ap.aprmtca_CodigoPrProv,
  CASE WHEN ap.aprmon_CodigoPrProv='1' THEN @FechaHoy ELSE ISNULL(mc_ayer.mcot_fecha, mc_ant.mcot_fecha) END,
  CASE WHEN ap.aprmon_CodigoPrProv='1' THEN 1
       WHEN ap.aprmon_CodigoPrProv='2' THEN ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza)
       ELSE 1 END,
  CASE WHEN ap.aprmon_CodigoPrProv='1' THEN ap.apr_PrProv
       WHEN ap.aprmon_CodigoPrProv='2' THEN ap.apr_PrProv * ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza)
       ELSE ap.apr_PrProv END,
  CASE WHEN ap.aprmon_CodigoPrProv='1' THEN ap.apr_PrProv*(1+ar2.ar2_MargenMay/100.0)
       WHEN ap.aprmon_CodigoPrProv='2' THEN (ap.apr_PrProv*ISNULL(mc_ayer.mcot_cotiza, mc_ant.mcot_cotiza))*(1+ar2.ar2_MargenMay/100.0)
       ELSE ap.apr_PrProv*(1+ar2.ar2_MargenMay/100.0) END,
  lp.lpr_Precio,
  CASE WHEN ap.aprmon_CodigoPrProv='1' THEN 'Costo en Pesos (Cotización = 1)'
       WHEN mc_ayer.mcot_fecha IS NOT NULL THEN 'Cotización del día anterior'
       WHEN mc_ant.mcot_fecha  IS NOT NULL THEN 'Cotización anterior (más antigua)'
       ELSE 'No se encontró cotización' END
FROM dbo.ListaPrec lp
JOIN dbo.Articulos a
  ON lp.lprart_CodGen=a.art_CodGen AND lp.lprart_CodEle1=a.art_CodEle1 AND lp.lprart_CodEle2=a.art_CodEle2 AND lp.lprart_CodEle3=a.art_CodEle3
JOIN dbo.Articulos2 ar2
  ON a.art_CodGen=ar2.ar2art_CodGen AND a.art_CodEle1=ar2.ar2art_CodEle1 AND a.art_CodEle2=ar2.ar2art_CodEle2 AND a.art_CodEle3=ar2.ar2art_CodEle3
CROSS APPLY (
  SELECT TOP 1 ap.* FROM dbo.ArtProv ap
  WHERE ap.aprart_CodGen=lp.lprart_CodGen AND ap.aprart_CodEle1=lp.lprart_CodEle1 AND ap.aprart_CodEle2=lp.lprart_CodEle2 AND ap.aprart_CodEle3=lp.lprart_CodEle3
  ORDER BY ap.apr_FecMod DESC
) ap
OUTER APPLY (
  SELECT TOP 1 m.* FROM manager.dbo.mon_cam m
  WHERE m.mon_codigo COLLATE DATABASE_DEFAULT = ap.aprmon_CodigoPrProv  COLLATE DATABASE_DEFAULT
    AND m.mtca_codigo COLLATE DATABASE_DEFAULT = ap.aprmtca_CodigoPrProv COLLATE DATABASE_DEFAULT
    AND CAST(m.mcot_fecha AS DATE) = @FechaAyer
  ORDER BY m.mcot_fecha DESC
) mc_ayer
OUTER APPLY (
  SELECT TOP 1 m.* FROM manager.dbo.mon_cam m
  WHERE m.mon_codigo COLLATE DATABASE_DEFAULT = ap.aprmon_CodigoPrProv  COLLATE DATABASE_DEFAULT
    AND m.mtca_codigo COLLATE DATABASE_DEFAULT = ap.aprmtca_CodigoPrProv COLLATE DATABASE_DEFAULT
    AND m.mcot_fecha < @FechaAyer
  ORDER BY m.mcot_fecha DESC
) mc_ant
WHERE lp.lprdlp_Cod='LBC' AND lp.lprart_CodGen LIKE 'R-%';
    `);

    progress(65, 'Aplicando', 'Actualizando ListaPrec…');

    // 4) Update ListaPrec desde la tabla de sesión
    await q(`
UPDATE lp
SET lp.lpr_Precio    = ISNULL(ra.PrecioFinal, 0),
    lp.lpr_FecMod    = GETDATE(),
    lp.lprusu_Codigo = 'ADMIN'
FROM dbo.ListaPrec lp
JOIN dbo.CONE_TmpResultadosActualizacion ra
  ON ra.SessionId=@Session
 AND lp.lprdlp_Cod      COLLATE DATABASE_DEFAULT = ra.lprdlp_Cod
 AND lp.lprart_CodGen   COLLATE DATABASE_DEFAULT = ra.lprart_CodGen
 AND lp.lprart_CodEle1  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle1
 AND lp.lprart_CodEle2  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle2
 AND lp.lprart_CodEle3  COLLATE DATABASE_DEFAULT = ra.lprart_CodEle3
WHERE lp.lprdlp_Cod='LBC' AND lp.lprart_CodGen LIKE 'R-%';
    `);

    progress(85, 'Registrando', 'Guardando auditoría…');

    // 5) Auditoría
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
  ISNULL(CASE WHEN ra.CostoBasePesos<>0 THEN (ra.PrecioFinal/ra.CostoBasePesos - 1) * 100 ELSE 0 END, 0),
  ra.InfoCotizacion, SUSER_SNAME()
FROM dbo.CONE_TmpResultadosActualizacion ra
WHERE ra.SessionId=@Session AND ra.lprdlp_Cod='LBC' AND ra.lprart_CodGen LIKE 'R-%';
    `);

    progress(95, 'Limpiando', 'Removiendo datos temporales…');

    // 6) Limpieza de filas de la sesión
    await q(`DELETE FROM dbo.CONE_TmpResultadosActualizacion WHERE SessionId=@Session;`);

    await transaction.commit();
    progress(100, 'Finalizado', 'La lista de precios se ha actualizado correctamente.');
    return { success: true, message: 'La lista de precios se ha actualizado correctamente.' };

  } catch (error) {
    console.error('Error al ejecutar actualización de precios:', error);
    try { if (transaction) await transaction.rollback(); } catch (_) {}
    throw new Error('Error en la base de datos al actualizar los precios.');
  } finally {
    try { if (pool) await pool.close(); } catch (_) {}
  }
}

async function obtenerPreciosActualizados() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT 
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
      WHERE FechaEjecucion = (SELECT MAX(FechaEjecucion) FROM CONE_RegistroActualizacionPrecios)
      ORDER BY ArticuloCodGen, ArticuloCodEle1, ArticuloCodEle2, ArticuloCodEle3;
    `);
    return { success: true, preciosActualizados: result.recordset };
  } catch (error) {
    console.error('Error al obtener los precios actualizados:', error);
    throw new Error('Error en la base de datos al obtener los precios actualizados.');
  } finally {
    try { if (pool) await pool.close(); } catch (_) {}
  }
}
async function withPool(fn) {
  const pool = await sql.connect(getAdminDbConfig());
  try { return await fn(pool); }
  finally { try { await pool.close(); } catch (_) {} }
}

const TABLE = '[dbo].[ListaPrec]';

const norm = v => (v ?? '').toString().trim();

async function obtenerPrecioActualizador(keys) {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());

    const req = pool.request()
      .input('lprdlp_Cod',     sql.VarChar(50), norm(keys.lprdlp_Cod))
      .input('lprart_CodGen',  sql.VarChar(50), norm(keys.lprart_CodGen))
      .input('lprart_CodEle1', sql.VarChar(50), norm(keys.lprart_CodEle1))
      .input('lprart_CodEle2', sql.VarChar(50), norm(keys.lprart_CodEle2))
      .input('lprart_CodEle3', sql.VarChar(50), norm(keys.lprart_CodEle3));

    const q = `
      SELECT TOP 1 *
      FROM ${TABLE}
      WHERE lprdlp_Cod = @lprdlp_Cod
        AND lprart_CodGen = @lprart_CodGen
        AND COALESCE(lprart_CodEle1,'') = @lprart_CodEle1
        AND COALESCE(lprart_CodEle2,'') = @lprart_CodEle2
        AND COALESCE(lprart_CodEle3,'') = @lprart_CodEle3
    `;
    
    const rs = await req.query(q);
    const row = rs.recordset[0] || null;
    console.log('[Precios][SELECT]', {
      found: !!row,
      keys: {
        lprdlp_Cod: norm(keys.lprdlp_Cod),
        lprart_CodGen: norm(keys.lprart_CodGen),
        lprart_CodEle1: norm(keys.lprart_CodEle1),
        lprart_CodEle2: norm(keys.lprart_CodEle2),
        lprart_CodEle3: norm(keys.lprart_CodEle3),
      }
    });

    return { success: true, precio: row };
  } catch (err) {
    console.error('❌ Error en obtenerPrecioActualizador:', err);
    return { success: false, message: err.message };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

async function updatePrecioActualizador(payload) {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());

    const precioNum = typeof payload.precio === 'string'
      ? Number(payload.precio.replace(',', '.'))
      : Number(payload.precio);

    if (!isFinite(precioNum)) {
      console.warn('[Precios] Precio inválido:', payload.precio, 'payload=', {
        lprdlp_Cod: payload?.lprdlp_Cod,
        lprart_CodGen: payload?.lprart_CodGen,
        lprart_CodEle1: payload?.lprart_CodEle1,
        lprart_CodEle2: payload?.lprart_CodEle2,
        lprart_CodEle3: payload?.lprart_CodEle3
      });
      return { success: false, message: 'Precio inválido' };
    }

    const req = pool.request()
      .input('lprdlp_Cod',     sql.VarChar(50), norm(payload.lprdlp_Cod))
      .input('lprart_CodGen',  sql.VarChar(50), norm(payload.lprart_CodGen))
      .input('lprart_CodEle1', sql.VarChar(50), norm(payload.lprart_CodEle1))
      .input('lprart_CodEle2', sql.VarChar(50), norm(payload.lprart_CodEle2))
      .input('lprart_CodEle3', sql.VarChar(50), norm(payload.lprart_CodEle3))
      .input('precio',         sql.Decimal(18,4), precioNum);

    const q = `
      UPDATE ${TABLE}
         SET lpr_Precio = @precio
      WHERE lprdlp_Cod = @lprdlp_Cod
        AND lprart_CodGen = @lprart_CodGen
        AND COALESCE(lprart_CodEle1,'') = @lprart_CodEle1
        AND COALESCE(lprart_CodEle2,'') = @lprart_CodEle2
        AND COALESCE(lprart_CodEle3,'') = @lprart_CodEle3
    `;

    const r = await req.query(q);
    const updated = r.rowsAffected?.[0] || 0;

    if (updated === 0) {
      console.warn('[Precios][UPDATE sin match]', {
        keys: {
          lprdlp_Cod: norm(payload.lprdlp_Cod),
          lprart_CodGen: norm(payload.lprart_CodGen),
          lprart_CodEle1: norm(payload.lprart_CodEle1),
          lprart_CodEle2: norm(payload.lprart_CodEle2),
          lprart_CodEle3: norm(payload.lprart_CodEle3),
        },
        precio: precioNum
      });
      return { success: false, notFound: true, message: 'No se encontró coincidencia para actualizar.' };
    }

    console.log('[Precios][UPDATE OK]', {
      keys: {
        lprdlp_Cod: norm(payload.lprdlp_Cod),
        lprart_CodGen: norm(payload.lprart_CodGen),
        lprart_CodEle1: norm(payload.lprart_CodEle1),
        lprart_CodEle2: norm(payload.lprart_CodEle2),
        lprart_CodEle3: norm(payload.lprart_CodEle3),
      },
      precio: precioNum, rowsAffected: updated
    });

    return { success: true, rowsAffected: updated };
  } catch (err) {
    console.error('❌ Error en actualizarPrecioActualizador:', err);
    return { success: false, message: err.message };
  } finally {
    try { await pool?.close(); } catch {}
  }
}
module.exports = {
  obtenerPrecios,
  actualizarListaDePrecios,
  obtenerPreciosActualizados,
 obtenerPrecioActualizador,
  updatePrecioActualizador,
};
