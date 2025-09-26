// modulesService/ActualizadorPrecios.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const sql = require("mssql");
const XLSX = require("xlsx");
let electronApp = null;
try { electronApp = require("electron").app; } catch (_) {}
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
   2) DESCARGAR LISTA → XLSX (usando template)
   ============================================================ */
function getDownloadsDir() {
  if (electronApp?.getPath) return electronApp.getPath("downloads");
  return path.join(os.homedir(), "Downloads");
}

function resolveTemplatePath() {
  const candidates = [
    path.resolve(process.cwd(), "public", "templates", "precios.xlsx"),
    path.resolve(__dirname, "..", "public", "templates", "precios.xlsx"),
    path.resolve(process.resourcesPath || "", "public", "templates", "precios.xlsx"),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  throw new Error("No se encontró el template precios.xlsx");
}

async function descargarListaXlsx(listaCod) {
  let pool;
  try {
    const lista = String(listaCod ?? "").trim();
    if (!lista) return { success: false, message: "Debe seleccionar un código de lista." };

    pool = await sql.connect(require("../userDbConfig").getAdminDbConfig());
    const req = pool.request();
    req.input("lista", sql.VarChar(10), lista);

    const query = `
      SELECT
        lp.lprdlp_Cod     AS CodigoLista,
        d.dlp_Desc        AS ListaPrecios,
        lp.lprart_CodGen  AS CodGenerico,
        lp.lprart_CodEle1 AS CodElemento1,
        lp.lprart_CodEle2 AS CodElemento2,
        lp.lprart_CodEle3 AS CodElemento3,
        a.art_DescGen     AS DescripcionGen,
        a.artele_Desc1    AS DescripcionEle1,
        a.artele_Desc2    AS DescripcionEle2,
        a.artele_Desc3    AS DescripcionEle3,
        m.mon_descrip     AS Moneda,
        lp.lpr_Precio     AS Precio
      FROM dbo.mon        AS m
      INNER JOIN dbo.DefListP  AS d
        ON CONVERT(varbinary(256), m.mon_codigo) = CONVERT(varbinary(256), d.dlpmon_Codigo)
      INNER JOIN dbo.ListaPrec AS lp
        ON lp.lprdlp_Cod = d.dlp_Cod
      INNER JOIN dbo.Articulos AS a
        ON  a.art_codgen  = lp.lprart_CodGen
        AND a.art_codele1 = lp.lprart_codele1
        AND a.art_codele2 = lp.lprart_codele2
        AND a.art_codele3 = lp.lprart_codele3
      WHERE lp.lprdlp_Cod = @lista
      ORDER BY CodGenerico, CodElemento1, CodElemento2, CodElemento3;
    `;

    const rs = await req.query(query);
    const rows = rs.recordset || [];
    if (!rows.length) return { success: false, message: `La lista ${lista} no tiene ítems.` };

    const templatePath = resolveTemplatePath();
    const wb = XLSX.readFile(templatePath, { cellDates: false });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    if (!ws) throw new Error("Hoja del template no encontrada.");

    // Orden EXACTO del template (incluye Moneda antes de Precio)
    const dataRows = rows.map(r => ([
      r.CodigoLista ?? "",
      r.ListaPrecios ?? "",
      r.CodGenerico ?? "",
      r.CodElemento1 ?? "",
      r.CodElemento2 ?? "",
      r.CodElemento3 ?? "",
      r.DescripcionGen ?? "",
      r.DescripcionEle1 ?? "",
      r.DescripcionEle2 ?? "",
      r.DescripcionEle3 ?? "",
      r.Moneda ?? "",
      Number(r.Precio) ?? 0
    ]));

    // Pegar desde A2 y recalcular rango !ref
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A2" });
    const lastRow = dataRows.length + 1;
    const lastColIndex = 12 - 1; // 12 columnas (A..L)
    ws["!ref"] = `A1:${XLSX.utils.encode_cell({ r: lastRow - 1, c: lastColIndex })}`;

    const downloads = getDownloadsDir();
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const fname = `ListaPrecios_${lista}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.xlsx`;
    const outPath = path.join(downloads, fname);

    XLSX.writeFileXLSX(wb, outPath, { compression: true });
    await fsp.access(outPath, fs.constants.R_OK);

    return { success: true, path: outPath };
  } catch (err) {
    console.error("descargarListaXlsx:", err);
    return { success: false, message: err?.message || "Error al generar el Excel." };
  } finally {
    try { await pool?.close(); } catch {}
  }
}


/* ============================================================
   3) ACTUALIZACIÓN POR EXCEL (reforzada)
   - Deduplica, valida lista única
   - Filtra solo las que EXISTEN en ListaPrec
   - UPDATE solo si cambia el precio
   - Devuelve resumen + detalle con la fecha real de DB
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

    // Armado de XML seguro
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

-- 1) XML -> @J (crudo: Ele1/2/3 pueden venir NULL)
DECLARE @J TABLE (
  lprdlp_Cod     VARCHAR(10)  NOT NULL,
  lprart_CodGen  VARCHAR(20)  NOT NULL,
  lprart_CodEle1 VARCHAR(6)       NULL,
  lprart_CodEle2 VARCHAR(6)       NULL,
  lprart_CodEle3 VARCHAR(6)       NULL,
  lpr_Precio     DECIMAL(18,4) NOT NULL
);

INSERT INTO @J (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3, lpr_Precio)
SELECT
  LTRIM(RTRIM(T.C.value('(lprdlp_Cod/text())[1]', 'VARCHAR(10)'))),
  LTRIM(RTRIM(T.C.value('(lprart_CodGen/text())[1]', 'VARCHAR(20)'))),
  NULLIF(LTRIM(RTRIM(T.C.value('(lprart_CodEle1/text())[1]', 'VARCHAR(6)'))), ''),
  NULLIF(LTRIM(RTRIM(T.C.value('(lprart_CodEle2/text())[1]', 'VARCHAR(6)'))), ''),
  NULLIF(LTRIM(RTRIM(T.C.value('(lprart_CodEle3/text())[1]', 'VARCHAR(6)'))), ''),
  TRY_CAST(T.C.value('(lpr_Precio/text())[1]', 'NVARCHAR(50)') AS DECIMAL(18,4))
FROM @xml.nodes('/rows/r') AS T(C)
WHERE
  T.C.exist('(lprdlp_Cod)[1]') = 1
  AND T.C.exist('(lprart_CodGen)[1]') = 1
  AND TRY_CAST(T.C.value('(lpr_Precio/text())[1]', 'NVARCHAR(50)') AS DECIMAL(18,4)) IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM @J)
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

-- 2) Deduplicar -> @J2 con Ele1/2/3 NO NULL (''), para permitir PK
DECLARE @J2 TABLE (
  lprdlp_Cod     VARCHAR(10)  NOT NULL,
  lprart_CodGen  VARCHAR(20)  NOT NULL,
  lprart_CodEle1 VARCHAR(6)   NOT NULL,
  lprart_CodEle2 VARCHAR(6)   NOT NULL,
  lprart_CodEle3 VARCHAR(6)   NOT NULL,
  lpr_Precio     DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3)
);

INSERT INTO @J2
SELECT DISTINCT
  LTRIM(RTRIM(lprdlp_Cod))                    AS lprdlp_Cod,
  LTRIM(RTRIM(lprart_CodGen))                 AS lprart_CodGen,
  ISNULL(lprart_CodEle1, '')                  AS lprart_CodEle1,
  ISNULL(lprart_CodEle2, '')                  AS lprart_CodEle2,
  ISNULL(lprart_CodEle3, '')                  AS lprart_CodEle3,
  lpr_Precio
FROM @J;

-- 3) Asegurar lista única
DECLARE @ListaCod VARCHAR(10) = (SELECT TOP 1 lprdlp_Cod FROM @J2);
IF EXISTS (SELECT 1 FROM @J2 WHERE lprdlp_Cod <> @ListaCod)
BEGIN
  SELECT CAST(0 AS INT) AS updated, COUNT(*) AS attempted, COUNT(*) AS notFound;
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

DECLARE @attempted INT = (SELECT COUNT(*) FROM @J2);

-- 4) Filtrar SOLO las que existen en ListaPrec -> @Jx (NO NULL en Ele1/2/3)
DECLARE @Jx TABLE (
  lprdlp_Cod     VARCHAR(10)  NOT NULL,
  lprart_CodGen  VARCHAR(20)  NOT NULL,
  lprart_CodEle1 VARCHAR(6)   NOT NULL,
  lprart_CodEle2 VARCHAR(6)   NOT NULL,
  lprart_CodEle3 VARCHAR(6)   NOT NULL,
  lpr_Precio     DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (lprdlp_Cod, lprart_CodGen, lprart_CodEle1, lprart_CodEle2, lprart_CodEle3)
);

INSERT INTO @Jx
SELECT j.*
FROM @J2 j
WHERE EXISTS (
  SELECT 1
  FROM dbo.ListaPrec lp
  WHERE lp.lprdlp_Cod                 = j.lprdlp_Cod
    AND lp.lprart_CodGen              = j.lprart_CodGen
    AND ISNULL(lp.lprart_CodEle1,'')  = j.lprart_CodEle1
    AND ISNULL(lp.lprart_CodEle2,'')  = j.lprart_CodEle2
    AND ISNULL(lp.lprart_CodEle3,'')  = j.lprart_CodEle3
);

-- 5) Resultado detalle
DECLARE @Res TABLE(
  lprdlp_Cod     VARCHAR(10),
  lprart_CodGen  VARCHAR(20),
  lprart_CodEle1 VARCHAR(6),
  lprart_CodEle2 VARCHAR(6),
  lprart_CodEle3 VARCHAR(6),
  PrecioAnterior DECIMAL(18,4),
  PrecioNuevo    DECIMAL(18,4),
  FechaMod       DATETIME,
  FechaModStr    VARCHAR(19)
);

-- 6) UPDATE solo si cambia el precio (y restringido a la lista única)
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
  inserted.lpr_FecMod,          -- FechaMod
  CONVERT(VARCHAR(10), inserted.lpr_FecMod, 103) + ' ' + CONVERT(VARCHAR(8), inserted.lpr_FecMod, 108)
INTO @Res
FROM dbo.ListaPrec lp
JOIN @Jx j
  ON lp.lprdlp_Cod                 = j.lprdlp_Cod
 AND lp.lprart_CodGen              = j.lprart_CodGen
 AND ISNULL(lp.lprart_CodEle1,'')  = j.lprart_CodEle1
 AND ISNULL(lp.lprart_CodEle2,'')  = j.lprart_CodEle2
 AND ISNULL(lp.lprart_CodEle3,'')  = j.lprart_CodEle3
WHERE lp.lprdlp_Cod = @ListaCod
  AND ISNULL(lp.lpr_Precio, 0) <> ISNULL(j.lpr_Precio, 0);

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
  descargarListaXlsx,
  actualizarPreciosExcel,
  obtenerPreciosExcelActualizados,
};
