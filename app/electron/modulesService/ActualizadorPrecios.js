// modulesService/ActualizadorPrecios.js
const sql = require("mssql");
const { getAdminDbConfig } = require("../userDbConfig.js");

/**
 * Config SQL base
 */
function getCfg() {
  return {
    ...getAdminDbConfig(),
    connectionTimeout: 60000,
    requestTimeout: 120000,
  };
}

/**
 * Util: cierra pool silenciosamente
 */
async function safeClose(pool) {
  try { await pool?.close?.(); } catch {}
}

/* ============================================================
   1) OBTENER CÓDIGOS DE LISTA
   SELECT DISTINCT(lprdlp_Cod) FROM ListaPrec
   ============================================================ */
async function obtenerCodigoLista() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT DISTINCT lprdlp_Cod, dlp_Desc
      FROM dbo.ListaPrec
      LEFT JOIN dbo.DefListP ON dlp_Cod = lprdlp_Cod
      ORDER BY lprdlp_Cod
    `);

    const data = (rs.recordset || []).map((r) => ({
      lprdlp_Cod: String(r.lprdlp_Cod || '').trim(),
      dlp_Desc: String(r.dlp_Desc || '').trim(),
    }));

    return { success: true, data };
  } catch (err) {
    console.error('obtenerCodigosLista:', err);
    return { success: false, message: err?.message || 'Error al obtener códigos de lista.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

/* ============================================================
   2) OBTENER LISTA DE PRECIOS POR CÓDIGO
   SELECT campos + LEFT JOIN Articulos (para art_DescGen)
   ============================================================ */
async function obtenerListaPrecios(listaCod) {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('listaCod', sql.VarChar(3), String(listaCod || '').trim());

    const q = `
      SELECT 
        lprdlp_Cod,
        dlp_Desc,
        lprart_CodGen,
        lprart_CodEle1,
        lprart_CodEle2,
        lprart_CodEle3,
        art_DescGen,
        art_CodEle1,
        art_CodEle2,
        art_CodEle3,
        lpr_Precio
      FROM dbo.ListaPrec
      LEFT JOIN dbo.Articulos ON art_CodGen = lprart_CodGen
      LEFT JOIN dbo.DefListP  ON dlp_Cod   = lprdlp_Cod
      WHERE lprdlp_Cod = @listaCod
    `;

    const rs = await req.query(q);
    return { success: true, data: rs.recordset || [] };
  } catch (err) {
    console.error('obtenerListaPrecios:', err);
    return { success: false, message: err?.message || 'Error al obtener la lista.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

/* ============================================================
   3) ACTUALIZACIÓN SIMPLE POR EXCEL (SIN PROGRESS)
   - items: [{ lprdlp_Cod, lprart_CodGen, lpr_Precio, lprart_CodEle1?, lprart_CodEle2?, lprart_CodEle3? }]
   - WHERE considera Ele1/2/3 si vienen (verificación más precisa)
   - SET lpr_Precio y lpr_FecMod = GETDATE()
   ============================================================ */

async function actualizarPreciosExcel(items = []) {
  let pool;
  try {
    if (!Array.isArray(items)) {
      return { success: false, message: 'Payload inválido: se esperaba un array.' };
    }

    // Normalización mínima en JS
    const compact = items.map((r) => ({
      lprdlp_Cod: String(r.lprdlp_Cod ?? '').trim(),
      lprart_CodGen: String(r.lprart_CodGen ?? '').trim(),
      lprart_CodEle1: String(r.lprart_CodEle1 ?? '').trim(),
      lprart_CodEle2: String(r.lprart_CodEle2 ?? '').trim(),
      lprart_CodEle3: String(r.lprart_CodEle3 ?? '').trim(),
      lpr_Precio: Number(r.lpr_Precio ?? NaN),
    })).filter(x => x.lprdlp_Cod && x.lprart_CodGen && Number.isFinite(x.lpr_Precio));

    if (compact.length === 0) {
      return { success: false, message: 'No hay filas válidas para actualizar.' };
    }

    // Armado de XML seguro (sin depender de OPENJSON)
    const xmlEscape = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const xml = [
      '<rows>',
      ...compact.map(r => `
        <r>
          <lprdlp_Cod>${xmlEscape(r.lprdlp_Cod)}</lprdlp_Cod>
          <lprart_CodGen>${xmlEscape(r.lprart_CodGen)}</lprart_CodGen>
          <lprart_CodEle1>${xmlEscape(r.lprart_CodEle1)}</lprart_CodEle1>
          <lprart_CodEle2>${xmlEscape(r.lprart_CodEle2)}</lprart_CodEle2>
          <lprart_CodEle3>${xmlEscape(r.lprart_CodEle3)}</lprart_CodEle3>
          <lpr_Precio>${isFinite(r.lpr_Precio) ? r.lpr_Precio : ''}</lpr_Precio>
        </r>`),
      '</rows>'
    ].join('');

    const cfg = {
      ...getAdminDbConfig(),
      connectionTimeout: 60000,
      requestTimeout: 300000,
    };

    pool = await sql.connect(cfg);
    const req = pool.request();
    req.input('xmlPayload', sql.NVarChar(sql.MAX), xml);

    // T-SQL con XML.nodes() (compatible). Filtra UPDATE cuando hay diferencia.
    const TSQL = `
SET NOCOUNT ON;

DECLARE @xml XML = TRY_CAST(@xmlPayload AS XML);

IF (@xml IS NULL)
BEGIN
  SELECT CAST(0 AS INT) AS updated, CAST(0 AS INT) AS attempted, CAST(0 AS INT) AS notFound;
  SELECT TOP 0
    CAST('' AS VARCHAR(3))  AS lprdlp_Cod,
    CAST('' AS VARCHAR(20)) AS lprart_CodGen,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle1,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle2,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle3,
    CAST(0 AS DECIMAL(18,4)) AS PrecioAnterior,
    CAST(0 AS DECIMAL(18,4)) AS PrecioNuevo,
    CAST(GETDATE() AS DATETIME) AS FechaMod,
    CAST('' AS VARCHAR(19)) AS FechaModStr;
  RETURN;
END;

DECLARE @J TABLE (
  lprdlp_Cod     VARCHAR(3)   NOT NULL,
  lprart_CodGen  VARCHAR(20)  NOT NULL,
  lprart_CodEle1 VARCHAR(6)       NULL,
  lprart_CodEle2 VARCHAR(6)       NULL,
  lprart_CodEle3 VARCHAR(6)       NULL,
  lpr_Precio     DECIMAL(18,4) NOT NULL
);

INSERT INTO @J (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio)
SELECT
  T.C.value('(lprdlp_Cod/text())[1]', 'VARCHAR(3)'),
  T.C.value('(lprart_CodGen/text())[1]', 'VARCHAR(20)'),
  NULLIF(T.C.value('(lprart_CodEle1/text())[1]', 'VARCHAR(6)'), ''),
  NULLIF(T.C.value('(lprart_CodEle2/text())[1]', 'VARCHAR(6)'), ''),
  NULLIF(T.C.value('(lprart_CodEle3/text())[1]', 'VARCHAR(6)'), ''),
  TRY_CAST(T.C.value('(lpr_Precio/text())[1]', 'NVARCHAR(50)') AS DECIMAL(18,4))
FROM @xml.nodes('/rows/r') AS T(C)
WHERE
  T.C.exist('(lprdlp_Cod)[1]') = 1
  AND T.C.exist('(lprart_CodGen)[1]') = 1
  AND TRY_CAST(T.C.value('(lpr_Precio/text())[1]', 'NVARCHAR(50)') AS DECIMAL(18,4)) IS NOT NULL;

DECLARE @attempted INT = (SELECT COUNT(*) FROM @J);

IF (@attempted = 0)
BEGIN
  SELECT CAST(0 AS INT) AS updated, CAST(0 AS INT) AS attempted, CAST(0 AS INT) AS notFound;
  SELECT TOP 0
    CAST('' AS VARCHAR(3))  AS lprdlp_Cod,
    CAST('' AS VARCHAR(20)) AS lprart_CodGen,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle1,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle2,
    CAST(NULL AS VARCHAR(6)) AS lprart_CodEle3,
    CAST(0 AS DECIMAL(18,4)) AS PrecioAnterior,
    CAST(0 AS DECIMAL(18,4)) AS PrecioNuevo,
    CAST(GETDATE() AS DATETIME) AS FechaMod,
    CAST('' AS VARCHAR(19)) AS FechaModStr;
  RETURN;
END;

DECLARE @Res TABLE(
  lprdlp_Cod     VARCHAR(3),
  lprart_CodGen  VARCHAR(20),
  lprart_CodEle1 VARCHAR(6),
  lprart_CodEle2 VARCHAR(6),
  lprart_CodEle3 VARCHAR(6),
  PrecioAnterior DECIMAL(18,4),
  PrecioNuevo    DECIMAL(18,4),
  FechaMod       DATETIME,
  FechaModStr    VARCHAR(19)
);

UPDATE lp
SET
  lp.lpr_Precio    = j.lpr_Precio,
  lp.lpr_FecMod    = GETDATE(),
  lp.lprusu_Codigo = 'ADMIN'
OUTPUT
  inserted.lprdlp_Cod,
  inserted.lprart_CodGen,
  inserted.lprart_CodEle1,
  inserted.lprart_CodEle2,
  inserted.lprart_CodEle3,
  deleted.lpr_Precio,           -- PrecioAnterior
  inserted.lpr_Precio,          -- PrecioNuevo
  inserted.lpr_FecMod,          -- FechaMod (datetime original)
  CONVERT(VARCHAR(10), inserted.lpr_FecMod, 103) + ' ' + CONVERT(VARCHAR(8), inserted.lpr_FecMod, 108) -- dd/MM/yyyy HH:mm:ss
INTO @Res
FROM dbo.ListaPrec lp
JOIN @J j
  ON lp.lprdlp_Cod                 = j.lprdlp_Cod
 AND lp.lprart_CodGen              = j.lprart_CodGen
 AND ISNULL(lp.lprart_CodEle1, '') = ISNULL(j.lprart_CodEle1, '')
 AND ISNULL(lp.lprart_CodEle2, '') = ISNULL(j.lprart_CodEle2, '')
 AND ISNULL(lp.lprart_CodEle3, '') = ISNULL(j.lprart_CodEle3, '')
WHERE ISNULL(lp.lpr_Precio, 0) <> ISNULL(j.lpr_Precio, 0);

-- Resumen
SELECT
  updated   = COUNT(*),
  attempted = @attempted,
  notFound  = @attempted - COUNT(*)
FROM @Res;

-- Detalle
SELECT
  lprdlp_Cod,
  lprart_CodGen,
  lprart_CodEle1,
  lprart_CodEle2,
  lprart_CodEle3,
  PrecioAnterior,
  PrecioNuevo,
  FechaMod,
  FechaModStr
FROM @Res
ORDER BY lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3;
`;

    const rs = await req.query(TSQL);

    const summary = rs.recordsets?.[0]?.[0] || { updated: 0, attempted: compact.length, notFound: compact.length };
    const resultados = rs.recordsets?.[1] || [];

    return { success: true, ...summary, resultados };
  } catch (err) {
    console.error('actualizarPreciosExcel:', err);
    return { success: false, message: err?.message || 'Error al actualizar precios.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}



/* ============================================================
   4) ÚLTIMOS ACTUALIZADOS (log) CON JOIN A ARTICULOS
   - Usa CONE_RegistroActualizacionPrecios (última corrida)
   - Devuelve claves + Ele1/2/3 y art_DescGen (LEFT JOIN)
   ============================================================ */
async function obtenerPreciosExcelActualizados() {
  let pool;
  try {
    pool = await sql.connect(getCfg());
    const req = pool.request();
    const q = `
      DECLARE @last DATETIME = (SELECT MAX(FechaEjecucion) FROM dbo.CONE_RegistroActualizacionPrecios);

      SELECT
        r.ListaPrecioCod          AS lprdlp_Cod,
        r.ArticuloCodGen          AS lprart_CodGen,
        r.ArticuloCodEle1         AS lprart_CodEle1,
        r.ArticuloCodEle2         AS lprart_CodEle2,
        r.ArticuloCodEle3         AS lprart_CodEle3,
        a.art_DescGen             AS art_DescGen,
        r.PrecioOriginal          AS lpr_Precio_Anterior,
        r.PrecioNuevo             AS lpr_Precio_Nuevo,
        r.FechaEjecucion          AS FechaEjecucion
      FROM dbo.CONE_RegistroActualizacionPrecios r
      LEFT JOIN dbo.Articulos a
        ON a.art_CodGen  = r.ArticuloCodGen
       AND a.art_CodEle1 = r.ArticuloCodEle1
       AND a.art_CodEle2 = r.ArticuloCodEle2
       AND a.art_CodEle3 = r.ArticuloCodEle3
      WHERE r.FechaEjecucion = @last
      ORDER BY r.ArticuloCodGen, r.ArticuloCodEle1, r.ArticuloCodEle2, r.ArticuloCodEle3;
    `;
    const rs = await req.query(q);
    return { success: true, data: rs.recordset || [] };
  } catch (err) {
    console.error("obtenerPreciosExcelActualizados:", err);
    return { success: false, message: err?.message || "Error al consultar actualizados." };
  } finally {
    await safeClose(pool);
  }
}

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  obtenerCodigoLista,
  obtenerListaPrecios,
  actualizarPreciosExcel,
  obtenerPreciosExcelActualizados,
};
