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

  const pool = await getPool();
  const r = await pool.request()
    .input('codcli', sql.VarChar(50), String(codcli))
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
        AND cve_CodCli = @codcli
        AND cvemon_Codigo = @mon_codigo
        AND cvemtca_CodigoCC = @mtca_codigo
      ORDER BY cve_FEmision DESC, cve_Nro DESC
    `);

  return r.recordset || [];
}

module.exports = {
  __getPool: getPool,
  getTiposComprobante,
  getMonedas,
  getTipoCambio,
  getFacturas, // ← NUEVO
};
