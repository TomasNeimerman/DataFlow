// modulesService/Clientes.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

/** Listas habilitadas (para combo destino) */
async function getListasHabilitadas() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT dlp_Cod, dlp_Desc
      FROM DefListP
      WHERE dlp_Habilitacion = '1'
      ORDER BY dlp_Cod
    `);
    return {
      success: true,
      data: (rs.recordset || []).map(r => ({
        cod: String(r.dlp_Cod ?? '').trim(),
        desc: String(r.dlp_Desc ?? '').trim(),
      })),
    };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo listas habilitadas.' };
  } finally { try { await pool?.close(); } catch {} }
}

/** LISTAR CLIENTES de la lista seleccionada (listaCod), con tu query */
async function listarClientesHabilitados({ listaCod } = {}) {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('lista', sql.VarChar(10), listaCod ? String(listaCod) : null);

    const q = `
      SELECT 
  c.cli_cod,
  c.clizon_cod AS CodZona, 
  z.zon_Desc   AS Zona,
  c.cliven_cod AS CodVendedor, 
  v.ven_Desc   AS Vendedor,
  c.clitic_cod AS CodTipoCli, 
  t.tic_Desc   AS TipoCli,
  d1.dc1_cod   AS CodDistribucion, 
  d1.dc1_Desc  AS Distribucion, 
  d2.dc2_cod   AS CodCanal, 
  d2.dc2_Desc  AS Canal
FROM Clientes c
LEFT JOIN Defi1Cli d1   ON d1.dc1_Cod   = c.clidc1_Cod
LEFT JOIN Defi2Cli d2   ON c.clidc2_Cod = d2.dc2_cod
LEFT JOIN Vendedor v    ON c.cliven_Cod = v.ven_Cod
LEFT JOIN Zona z        ON c.clizon_Cod = z.zon_Cod
LEFT JOIN TipCli t      ON t.tic_Cod    = c.clitic_Cod
LEFT JOIN DefListP dlp  ON dlp.dlp_Cod  = c.clidlp_Cod
WHERE (@lista IS NULL OR c.clidlp_Cod = @lista);
    `;
    const rs = await req.query(q);
    return { success: true, data: rs.recordset || [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Error listando clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

/**
 * ACTUALIZAR por filtros/selección, restringiendo a la lista origen (fromCod) si viene.
 * payload: { toCod, fromCod?, filtros?: { vendedor?, distribucion?, canal? }, cliCods?: string[] }
 */
async function actualizarListaPorFiltros({ toCod, fromCod = null, filtros = {}, cliCods = null } = {}) {
  if (!toCod) return { success: false, message: 'Falta lista destino (toCod).' };

  const { vendedor = null, distribucion = null, canal = null } = filtros || {};
  const idsCsv = Array.isArray(cliCods) && cliCods.length ? cliCods.join(',') : null;

  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('toCod',   sql.VarChar(10), String(toCod));
    req.input('fromCod', sql.VarChar(10), fromCod ? String(fromCod) : null);
    req.input('v',  sql.VarChar(50), vendedor || null);
    req.input('d1', sql.VarChar(50), distribucion || null);
    req.input('d2', sql.VarChar(50), canal || null);
    req.input('ids', sql.NVarChar(sql.MAX), idsCsv); // "1,3,4"

    const q = `
      UPDATE c SET c.clidlp_Cod = @toCod
      FROM Clientes c
      LEFT JOIN DefListP dlp ON dlp.dlp_Cod = c.clidlp_Cod
      WHERE (@fromCod IS NULL OR c.clidlp_Cod = @fromCod)
        AND (@v  IS NULL OR c.cliven_Cod = @v)
        AND (@d1 IS NULL OR c.clidc1_Cod = @d1)
        AND (@d2 IS NULL OR c.clidc2_Cod = @d2)
        AND (
          @ids IS NULL
          OR c.cli_cod IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))
        );

      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const rs = await req.query(q);
    return { success: true, updatedRows: rs.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando clientes por filtros.' };
  } finally { try { await pool?.close(); } catch {} }
}
async function getOrdenamientos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT TOP 1
        ISNULL(LTRIM(RTRIM(pge_NomDefi1Cli)),'') AS pge_NomDefi1Cli,
        ISNULL(LTRIM(RTRIM(pge_NomDefi2Cli)),'') AS pge_NomDefi2Cli
      FROM ParamGen
    `);

    const row = rs.recordset?.[0] || {};
    return {
      success: true,
      data: {
        pge_NomDefi1Cli: row.pge_NomDefi1Cli ?? '',
        pge_NomDefi2Cli: row.pge_NomDefi2Cli ?? '',
      },
    };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo ordenamientos (ParamGen).' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

module.exports = {
  getListasHabilitadas,
  listarClientesHabilitados,
  actualizarListaPorFiltros,
  getOrdenamientos
};
