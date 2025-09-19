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
async function actualizarPreciosPorExcel(items = []) {
  const valid = [];
  const invalid = [];

  for (const it of Array.isArray(items) ? items : []) {
    const lprdlp_Cod    = (it?.lprdlp_Cod ?? "").toString().trim();
    const lprart_CodGen = (it?.lprart_CodGen ?? "").toString().trim();
    const lpr_Precio    = Number(it?.lpr_Precio);
    const ele1 = (it?.lprart_CodEle1 ?? "").toString().trim();
    const ele2 = (it?.lprart_CodEle2 ?? "").toString().trim();
    const ele3 = (it?.lprart_CodEle3 ?? "").toString().trim();

    const ok = lprdlp_Cod && lprart_CodGen && Number.isFinite(lpr_Precio);
    if (ok) valid.push({ lprdlp_Cod, lprart_CodGen, lpr_Precio, lprart_CodEle1: ele1, lprart_CodEle2: ele2, lprart_CodEle3: ele3 });
    else    invalid.push(it);
  }

  if (!valid.length) {
    return { success: false, updated: 0, invalid, message: "No hay filas válidas (faltan claves o precio)." };
  }

  let pool, tx;
  try {
    pool = await sql.connect(getCfg());
    tx = new sql.Transaction(pool);
    await tx.begin();

    let updated = 0;

    // UPDATE por fila (simple y claro). Si querés hacerlo set-based
    // con OPENJSON te lo dejo en una variante, pero me pediste simple.
    for (const r of valid) {
      const req = new sql.Request(tx);
      req.input("ldp",    sql.VarChar(10),  r.lprdlp_Cod);
      req.input("cod",    sql.VarChar(50),  r.lprart_CodGen);
      req.input("ele1",   sql.VarChar(50),  r.lprart_CodEle1 || null);
      req.input("ele2",   sql.VarChar(50),  r.lprart_CodEle2 || null);
      req.input("ele3",   sql.VarChar(50),  r.lprart_CodEle3 || null);
      req.input("precio", sql.Float,        r.lpr_Precio);

      // WHERE incluye Ele1..Ele3 solo si vienen distintos de null/empty
      const q = `
        UPDATE lp
           SET lp.lpr_Precio = @precio,
               lp.lpr_FecMod = GETDATE()
          FROM dbo.ListaPrec lp
         WHERE lp.lprdlp_Cod    = @ldp
           AND lp.lprart_CodGen = @cod
           AND (@ele1 IS NULL OR lp.lprart_CodEle1 = @ele1)
           AND (@ele2 IS NULL OR lp.lprart_CodEle2 = @ele2)
           AND (@ele3 IS NULL OR lp.lprart_CodEle3 = @ele3);
      `;
      const rs = await req.query(q);
      updated += (rs?.rowsAffected?.[0] || 0);
    }

    await tx.commit();
    return { success: true, updated, invalid, message: `Actualizados: ${updated}. Descartados: ${invalid.length}.` };
  } catch (err) {
    try { await tx?.rollback(); } catch {}
    console.error("actualizarPreciosPorExcel:", err);
    return { success: false, updated: 0, invalid, message: err?.message || "Error al actualizar precios." };
  } finally {
    await safeClose(pool);
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
  actualizarPreciosPorExcel,
  obtenerPreciosExcelActualizados,
};
