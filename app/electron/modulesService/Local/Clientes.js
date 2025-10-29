// modulesForm/Clientes.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

/** Traer TODOS los clientes habilitados (SELECT exacto). */
async function traerTodos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      select 
        cli_Cod       AS CodCliente, 
        cli_RazSoc    AS RazonSocial, 
        cli_Direc     AS Direccion,
        clizon_Cod    AS CodZona,
        zon_Desc      AS Zona,
        cli_Loc       AS Localidad,
        cli_CodPos    AS CodigoPostal,
        clicvt_Cod    AS CodCodicionVenta,
        cvt_Desc      AS CondicionVenta,
        cliven_Cod    AS CodVendedor,
        ven_Desc      AS Vendedor,
        clitic_Cod    AS CodTipoCliente,
        tic_Desc      AS TipoCliente,
        clidlp_Cod    AS CodListaPrecio,
        dlp_Desc      AS ListaPrecio,
        clidco_Cod    AS CodDescuentoCom,
        dco_Desc      AS DescuentoCom
      from Clientes
      LEFT JOIN CondVta  ON cvt_Cod = clicvt_Cod
      LEFT JOIN Vendedor ON ven_Cod = cliven_Cod
      LEFT JOIN TipCli   ON tic_Cod = clitic_Cod
      LEFT JOIN DefListP ON dlp_Cod = clidlp_Cod
      LEFT JOIN Zona     ON zon_Cod = clizon_Cod
      LEFT JOIN DescCom  ON dco_Cod = clidco_Cod
      where cli_Habilitado = '1'
      ORDER BY cli_Cod;
    `;
    const rs = await pool.request().query(q);
    return { success: true, data: rs.recordset || [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Error listando clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

/** Traer CÓDIGOS de listas habilitadas (solo el código). */
async function traerCodigosLista() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT LTRIM(RTRIM(dlp_Cod)) AS dlp_Cod
      FROM DefListP
      WHERE dlp_Habilitacion='1'
      ORDER BY dlp_Cod;
    `;
    const rs = await pool.request().query(q);
    const data = (rs.recordset || []).map(r => String(r.dlp_Cod ?? '').trim());
    return { success: true, data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo códigos de lista.' };
  } finally { try { await pool?.close(); } catch {} }
}

/** Reemplazar lista ORIGEN por DESTINO. params: { fromCod, toCod } */
async function actualizarLista({ toCod, fromCod } = {}) {
  if (!toCod || !fromCod) {
    return { success: false, message: 'Faltan parámetros: toCod y fromCod son obligatorios.' };
  }
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('toCod',   sql.VarChar(20), String(toCod));
    req.input('fromCod', sql.VarChar(20), String(fromCod));
    const q = `
      UPDATE c
      SET c.clidlp_Cod = @toCod
      FROM Clientes c
      WHERE c.clidlp_Cod = @fromCod;
      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const rs = await req.query(q);
    return { success: true, updatedRows: rs.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

module.exports = { traerTodos, traerCodigosLista, actualizarLista };
