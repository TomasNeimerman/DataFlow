// electron/modulesService/Local/Recibos.js
// ✅ Node/Electron (CommonJS)
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig');

let _pool = null;
async function getPool() {
  if (_pool && _pool.connected) return _pool;
  _pool = await sql.connect(getAdminDbConfig());
  return _pool;
}

function parseDateYYYYMMDD(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function ok(data) { return { ok: true, data }; }
function fail(message, error) { 
  console.error("[Recibos] DB error:", message, error);
  return { ok: false, error: message };
}

/** Tipos de Comprobante (RC/V) */
async function getTiposComprobante({ tipoFijo = 'RC', circuito = 'V' } = {}) {
  const pool = await getPool();
  const r = await pool.request()
    .input('tipoFijo', sql.VarChar(4), String(tipoFijo))
    .input('circuito', sql.VarChar(2), String(circuito))
    .query(`
      SELECT tco_cod, tco_desc
      FROM tipcomp
      WHERE tco_TipoFijo = @tipoFijo
        AND tco_Circuito = @circuito
        AND tco_Habilitado = 1
      ORDER BY tco_cod
    `);
  return r.recordset || [];
}

/** Moneda + Tipo de Cambio disponibles por moneda */
async function getMonedas() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT m.mon_codigo, m.mon_descrip, t.mtca_codigo, t.mtca_descrip
    FROM mon m
    LEFT JOIN mon_tca t ON t.mon_codigo = m.mon_codigo
    WHERE m.mon_habili = 1
    ORDER BY m.mon_codigo, t.mtca_codigo
  `);
  return r.recordset || [];
}

/** Tipo de Cambio por (moneda, tipo, fecha) */
async function getTipoCambio({ mon_codigo, mtca_codigo, fecha }) {
  if (!mon_codigo) throw new Error('mon_codigo requerido');
  if (!mtca_codigo) throw new Error('mtca_codigo requerido');
  if (!fecha) throw new Error('fecha requerida (YYYY-MM-DD)');
  const fechaDt = parseDateYYYYMMDD(fecha);
  if (!fechaDt) throw new Error('fecha inválida');

  const pool = await getPool();
  const r = await pool.request()
    .input('mon_codigo', sql.VarChar(16), String(mon_codigo))
    .input('mtca_codigo', sql.VarChar(16), String(mtca_codigo))
    .input('fecha', sql.Date, fechaDt)
    .query(`
      SELECT TOP 1 mcot_cotiza
      FROM mon_cam
      WHERE mon_codigo = @mon_codigo
        AND mtca_codigo = @mtca_codigo
        AND mcot_fecha <= @fecha
      ORDER BY mcot_fecha DESC
    `);

  const row = r.recordset && r.recordset[0];
  return row ? Number(row.mcot_cotiza) : null;
}

/** 🔥 Facturas por Cliente + Moneda + Tipo de Cambio (FC/ND con saldo ≠ 0) */
async function getFacturas({ codcli, mon_codigo, mtca_codigo }) {
  if (!codcli) throw new Error('codcli requerido');
  if (!mon_codigo) throw new Error('mon_codigo requerido');
  if (!mtca_codigo) throw new Error('mtca_codigo requerido');
  const codigoFixed = "%"+codcli+"%";
  const pool = await getPool();
  const r = await pool.request()
    .input('codcli', sql.VarChar(50), String(codigoFixed))
    .input('mon_codigo', sql.VarChar(16), String(mon_codigo))
    .input('mtca_codigo', sql.VarChar(16), String(mtca_codigo))
    .query(`
      SELECT
        cve_FEmision        AS [Fecha Emision],
        cve_FVto            AS [Fecha Vencimiento],
        CONCAT(cvetco_Cod,' ',cve_Letra,' ',cve_CodPvt,'-',cve_Nro) AS Comprobante,
        cve_ImpMonEmis      AS [Importe Original],
        cve_SaldoMonCC      AS Saldo
      FROM CabVenta
      LEFT JOIN TipComp ON tco_Cod = cvetco_Cod AND tco_Circuito = cve_Circuito
      LEFT JOIN mon      ON mon_codigo = cvemon_Codigo
      LEFT JOIN mon_tca  ON mtca_codigo = cvemtca_CodigoCC
      WHERE tco_TipoFijo IN ('FC','ND')
        AND cve_SaldoMonLoc <> 0
        AND cve_CodCli LIKE @codcli
        AND cvemon_Codigo = @mon_codigo
        AND cvemtca_CodigoCC = @mtca_codigo
      ORDER BY cve_FEmision DESC, cve_Nro DESC
    `);

  return r.recordset || [];
}
async function getMonedasTcEditables() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT CAST(mon_codigo AS VARCHAR(8)) AS mon_codigo
      FROM manager.dbo.mon
      WHERE mon_Clase <> 'P'
    `;
    const { recordset } = await pool.request().query(q);
    // Devuelvo como array de strings para comparar fácil en el front
    const data = Array.isArray(recordset) ? recordset.map(r => String(r.mon_codigo)) : [];
    return { ok: true, data };
  } catch (e) {
    console.error('[Recibos] getMonedasTcEditables error:', e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { pool && pool.close && pool.close(); } catch {}
  }
}
async function getSaldoCliente(payload = {}) {
  let pool;
  try {
    const { codcli, mon_codigo, mtca_codigo } = payload;
    if (!codcli || !mon_codigo || !mtca_codigo) {
      return { ok: false, error: 'Faltan parámetros: codcli, mon_codigo, mtca_codigo' };
    }

    pool = await sql.connect(getAdminDbConfig());
    const q = `
      SELECT SUM(cve_SaldoMonCC) AS saldo
      FROM CabVenta
      WHERE cve_CodCli = @codcli
        AND cvemon_Codigo = @mon_codigo
        AND cvemtca_CodigoCC = @mtca_codigo
    `;
    const req = pool.request()
      .input('codcli', sql.VarChar, String(codcli))
      .input('mon_codigo', sql.VarChar, String(mon_codigo))
      .input('mtca_codigo', sql.VarChar, String(mtca_codigo));

    const { recordset } = await req.query(q);
    const raw = recordset?.[0]?.saldo;
    const saldo = raw == null ? 0 : Number(raw);

    return { ok: true, saldo };
  } catch (e) {
    console.error('[Recibos] getSaldoCliente error:', e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { pool && pool.close && pool.close(); } catch {}
  }
}
  // ===========================================
  // Medios de aplicación (catálogos)
  // ===========================================
  async function getTransferencias() {
    try {
      const pool = await getPool();
      const q = `
        SELECT 
          ctbbco_Cod   AS CodBanco,
          bco_descrip  AS Banco,
          ctb_Cod      AS NroCuenta,
          ctb_Desc     AS Cuenta,
          mon_simbolo +' - '+mtca_descrip AS Moneda
        FROM CtaBan
        LEFT JOIN bco      ON bco_codigo = ctbbco_Cod
        LEFT JOIN mon      ON mon_codigo = ctbmon_Codigo
        LEFT JOIN mon_tca  ON mtca_codigo = ctbmtca_Codigo
        ORDER BY bco_descrip, ctb_Desc
      `;
      const r = await pool.request().query(q);
      return ok(r.recordset || []);
    } catch (e) { return fail("getTransferencias", e); }
  }

  async function getCajas() {
    try {
      const pool = await getPool();
      const q = `
        SELECT 
          caj_Cod  AS CodCaja, 
          caj_Desc AS Caja, 
          mon_simbolo +' - '+mtca_descrip AS Moneda
        FROM Cajas
        LEFT JOIN mon     ON mon_codigo = cajmon_Codigo
        LEFT JOIN mon_tca ON mtca_codigo = cajmtca_Codigo
        ORDER BY caj_Desc
      `;
      const r = await pool.request().query(q);
      return ok(r.recordset || []);
    } catch (e) { return fail("getCajas", e); }
  }

  async function getAplicaciones() {
    try {
      const pool = await getPool();
      const q = `
        SELECT 
          apl_Cod  AS CodCaja, 
          apl_Desc AS Caja, 
          mon_simbolo +' - '+mtca_descrip AS Moneda
        FROM Aplicacion
        LEFT JOIN mon     ON mon_codigo = aplmon_Codigo
        LEFT JOIN mon_tca ON mtca_codigo = aplmtca_Codigo
        ORDER BY apl_Desc
      `;
      const r = await pool.request().query(q);
      return ok(r.recordset || []);
    } catch (e) { return fail("getAplicaciones", e); }
  }
module.exports = {
  __getPool: getPool,
  getTiposComprobante,
  getMonedas,
  getTipoCambio,
  getFacturas,
  getMonedasTcEditables,
  getSaldoCliente,
  getTransferencias,
  getAplicaciones,
  getCajas,
};
