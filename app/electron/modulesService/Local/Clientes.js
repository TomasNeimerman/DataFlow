// modulesService/Clientes.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

/** Traer TODOS los clientes habilitados (query provista) */
async function traerTodos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      select 
        cli_Cod   AS CodCliente, 
        cli_RazSoc AS RazonSocial, 
        cli_Direc  AS Direccion,
        clizon_Cod AS CodZona,
        zon_Desc   AS Zona,
        cli_Loc    AS Localidad,
        cli_CodPos AS CodigoPostal,
        clicvt_Cod AS CodCodicionVenta,
        cvt_Desc   AS CondicionVenta,
        cliven_Cod AS CodVendedor,
        ven_Desc   AS Vendedor,
        clitic_Cod AS CodTipoCliente,
        tic_Desc   AS TipoCliente,
        clidlp_Cod AS CodListaPrecio,
        dlp_Desc   AS ListaPrecio,
        clidco_Cod AS CodDescuentoCom,
        dco_Desc   AS DescuentoCom
      from Clientes
      LEFT JOIN CondVta  ON cvt_Cod = clicvt_Cod
      LEFT JOIN Vendedor ON ven_Cod = cliven_Cod
      LEFT JOIN TipCli   ON tic_Cod = clitic_Cod
      LEFT JOIN DefListP ON dlp_Cod = clidlp_Cod
      LEFT JOIN Zona     ON zon_Cod = clizon_Cod
      LEFT JOIN DescCom  ON dco_Cod = clidco_Cod
      where cli_Habilitado = '1'
      order by cli_Cod
    `);
    return { success: true, data: rs.recordset || [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

/** Traer códigos de lista habilitados */
async function traerCodigosLista() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      select dlp_Cod from DefListP where dlp_Habilitacion='1' order by dlp_Cod
    `);
    return { success: true, data: (rs.recordset || []).map(r => String(r.dlp_Cod ?? '').trim()) };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo códigos de lista.' };
  } finally { try { await pool?.close(); } catch {} }
}

/**
 * Actualizar lista SOLO para los clientes seleccionados.
 * payload: { fromCod, toCod, cliCods: string[] }
 */
async function actualizarLista({ fromCod, toCod, cliCods = [] } = {}) {
  if (!toCod) return { success: false, message: 'Falta lista destino (toCod).' };
  if (!Array.isArray(cliCods) || cliCods.length === 0) {
    return { success: false, message: 'No hay clientes seleccionados (cliCods).' };
  }

  const idsCsv = cliCods.map(String).join(',');

  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('fromCod', sql.VarChar(20), String(fromCod ?? ''));
    req.input('toCod',   sql.VarChar(20), String(toCod));
    req.input('ids',     sql.NVarChar(sql.MAX), idsCsv);

    const q = `
      UPDATE c SET c.clidlp_Cod = @toCod
      FROM Clientes c
      WHERE c.clidlp_Cod = @fromCod
        AND c.cli_Cod IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','));

      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const rs = await req.query(q);
    return { success: true, updatedRows: rs.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

module.exports = { traerTodos, traerCodigosLista, actualizarLista };
