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
        cvetco_Cod                                  AS TipoFijo,
        cve_Letra                                   AS Letra,
        RIGHT(RTRIM(ISNULL(cve_CodPvt,'')), 5)      AS PtoVenta,
        RIGHT(RTRIM(ISNULL(cve_Nro,'')),    8)      AS Numero,
        cve_FEmision        AS [Fecha Emision],
        cve_FVto            AS [Fecha Vencimiento],
        CONCAT(cvetco_Cod,' ',cve_Letra,' ',
               RIGHT(RTRIM(ISNULL(cve_CodPvt,'')),5),'-',
               RIGHT(RTRIM(ISNULL(cve_Nro,'')),8)) AS Comprobante,
        cve_ImpMonEmis      AS [Importe Original],
        cve_SaldoMonCC      AS Saldo
      FROM CabVenta
      LEFT JOIN TipComp ON tco_Cod = cvetco_Cod AND tco_Circuito = cve_Circuito
      LEFT JOIN mon      ON mon_codigo = cvemon_Codigo
      LEFT JOIN mon_tca  ON mtca_codigo = cvemtca_CodigoCC
      WHERE tco_TipoFijo IN ('FC','ND')
        AND cve_SaldoMonCC <> 0
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
    const codigoFixed = '%' + codcli + '%';
    const q = `
      SELECT SUM(cve_SaldoMonCC) AS saldo
      FROM CabVenta
      LEFT JOIN TipComp ON tco_Cod = cvetco_Cod AND tco_Circuito = cve_Circuito
      WHERE tco_TipoFijo IN ('FC','ND')
        AND cve_SaldoMonCC > 0
        AND cve_CodCli LIKE @codcli
        AND cvemon_Codigo = @mon_codigo
        AND cvemtca_CodigoCC = @mtca_codigo
    `;
    const req = pool.request()
      .input('codcli', sql.VarChar, codigoFixed)
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
async function getCveIDRC(numero, ptoVenta) {
  const pool = await getPool();
  const nro = String(numero || '').trim().padStart(8, '0');
  const pto = String(ptoVenta || '').trim();
  const r = await pool.request()
    .input('nro', sql.VarChar(20), nro)
    .input('pto', sql.VarChar(10), pto)
    .query(`
      SELECT TOP 1 cve_ID, cveemp_Codigo, cvesuc_Cod
      FROM CabVenta
      WHERE cvetco_Cod = 'RC'
        AND cve_Nro LIKE '%' + @nro
        AND cve_CodPvt LIKE '%' + @pto
      ORDER BY cve_ID DESC
    `);
  if (!r.recordset || !r.recordset[0]) return null;
  return r.recordset[0];
}

async function aplicarRelacionComprobante(rcCveID, aplicaciones) {
  if (!aplicaciones || aplicaciones.length === 0) return;

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Get RC empresa/sucursal/nroCuota
    const rcRow = await transaction.request()
      .input('rcId', sql.Int, rcCveID)
      .query(`SELECT cveemp_Codigo, cvesuc_Cod, cve_NroCuota FROM CabVenta WHERE cve_ID = @rcId`);
    if (!rcRow.recordset || !rcRow.recordset[0])
      throw new Error(`RC cve_ID=${rcCveID} no encontrado en CabVenta`);
    const rcEmp    = rcRow.recordset[0].cveemp_Codigo ?? 'MODE';
    const rcSuc    = rcRow.recordset[0].cvesuc_Cod    ?? '';
    const rcCuota  = rcRow.recordset[0].cve_NroCuota  ?? ' ';

    let totalAplicado = 0;

    for (let i = 0; i < aplicaciones.length; i++) {
      const ap = aplicaciones[i];
      const importe = Math.round(Math.abs(parseFloat(ap.importe) || 0) * 100) / 100;
      if (importe <= 0) continue;

      const fcTipo  = String(ap.tipoComprobante || 'FC').trim();
      const fcLetra = String(ap.letra || ' ').trim() || ' ';
      const fcNro   = String(ap.numeroComprobante || ap.numero || '').trim().padStart(8, '0');
      const fcPto   = String(ap.puntoVenta || '').trim();

      const fcRow = await transaction.request()
        .input('tipo',  sql.VarChar(4),  fcTipo)
        .input('letra', sql.VarChar(4),  fcLetra)
        .input('nro',   sql.VarChar(20), fcNro)
        .input('pto',   sql.VarChar(10), fcPto)
        .query(`
          SELECT TOP 1 cve_ID, cveemp_Codigo, cvesuc_Cod, cve_NroCuota
          FROM CabVenta
          WHERE cvetco_Cod = @tipo
            AND RTRIM(ISNULL(cve_Letra,'')) = @letra
            AND cve_Nro LIKE '%' + @nro
            AND cve_CodPvt LIKE '%' + @pto
          ORDER BY cve_ID DESC
        `);
      if (!fcRow.recordset || !fcRow.recordset[0])
        throw new Error(`FC no encontrado: ${fcTipo} ${fcLetra} ${fcPto}-${fcNro}`);

      const fcCveID = fcRow.recordset[0].cve_ID;
      const fcEmp   = fcRow.recordset[0].cveemp_Codigo ?? rcEmp;
      const fcSuc   = fcRow.recordset[0].cvesuc_Cod   ?? '';
      const fcCuota = fcRow.recordset[0].cve_NroCuota ?? ' ';

      // Insertar relación: Col1=FC, Col2=RC, Col3=RC (igual a Col2)
      // Bejerman filtra por rcvcve_IDCol2 = RC para mostrar FCs aplicadas en botón "Aplicado"
      await transaction.request()
        .input('emp1',      sql.VarChar(10), fcEmp)
        .input('suc1',      sql.VarChar(10), fcSuc)
        .input('id1',       sql.Int,         fcCveID)
        .input('cuota1',    sql.VarChar(10), fcCuota)
        .input('emp2',      sql.VarChar(10), rcEmp)
        .input('suc2',      sql.VarChar(10), rcSuc)
        .input('id2',       sql.Int,         rcCveID)
        .input('cuota2',    sql.VarChar(10), rcCuota)
        .input('emp3',      sql.VarChar(10), rcEmp)
        .input('suc3',      sql.VarChar(10), rcSuc)
        .input('id3',       sql.Int,         rcCveID)
        .input('cuota3',    sql.VarChar(10), rcCuota)
        .input('impLoc',    sql.Float, importe)
        .input('impCC',     sql.Float, importe)
        .query(`
          INSERT INTO RelCompVta (
            rcvemp_CodigoCol1, rcvsuc_CodCol1, rcvcve_IDCol1, rcvcve_NroCuotaCol1,
            rcvemp_CodigoCol2, rcvsuc_CodCol2, rcvcve_IDCol2, rcvcve_NroCuotaCol2,
            rcvemp_CodigoCol3, rcvsuc_CodCol3, rcvcve_IDCol3, rcvcve_NroCuotaCol3,
            rcv_ImpMonLoc, rcv_ImpMonCC, rcv_DescNCRC, rcv_PasadoCC,
            rcv_FecMod, rcvusu_Codigo,
            rcvemp_CodigoCol4, rcvsuc_CodCol4, rcvcve_IDCol4, rcvcve_NroCuotaCol4,
            rcv_DiferenciaCotiz, rcv_SeCompenso, rcv_GrabaRegEspXComp, rcv_RegEspXComp
          ) VALUES (
            @emp1, @suc1, @id1, @cuota1,
            @emp2, @suc2, @id2, @cuota2,
            @emp3, @suc3, @id3, @cuota3,
            @impLoc, @impCC, 1, 0,
            GETDATE(), 'ADMIN',
            NULL, NULL, NULL, NULL,
            0, NULL, 'N', 0
          )
        `);

      // Actualizar saldo FC
      await transaction.request()
        .input('imp', sql.Float, importe)
        .input('id',  sql.Int, fcCveID)
        .query(`UPDATE CabVenta SET cve_SaldoMonCC = ROUND(cve_SaldoMonCC - @imp, 2) WHERE cve_ID = @id`);

      totalAplicado = Math.round((totalAplicado + importe) * 100) / 100;
    }

    // Actualizar saldo RC (saldo es negativo, sumar lo aplicado lo lleva a 0)
    if (totalAplicado > 0) {
      await transaction.request()
        .input('total', sql.Float, totalAplicado)
        .input('rcId',  sql.Int, rcCveID)
        .query(`UPDATE CabVenta SET cve_SaldoMonCC = ROUND(cve_SaldoMonCC + @total, 2) WHERE cve_ID = @rcId`);
    }

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

async function actualizarTalonarRC(numeroUsado) {
  const pool = await getPool();
  await pool.request()
    .input('nro', sql.VarChar(20), String(numeroUsado))
    .query(`UPDATE Talonar SET tal_ActualNro = @nro WHERE tal_Cod = 'RC'`);
}

async function getProximoNumeroRC() {
  const pool = await getPool();
  let numero = null;
  let ptoVenta = null;

  try {
    const t = await pool.request().query(`
      SELECT
        CAST(RIGHT(RTRIM(ISNULL(tal_ActualNro,'')), 8) AS INT) + 1 AS proximo,
        RTRIM(ISNULL(tal_CodPvt, '')) AS pvt
      FROM Talonar WHERE tal_Cod = 'RC'
    `);
    if (t.recordset && t.recordset[0]) {
      numero = String(t.recordset[0].proximo).padStart(8, '0');
      const v = String(t.recordset[0].pvt || '').trim();
      if (v) ptoVenta = v.padStart(5, '0');
    }
  } catch (e) {
    console.log('[getProximoNumeroRC] Talonar error:', e.message);
  }

  if (!numero) {
    try {
      const r = await pool.request().query(`
        SELECT ISNULL(MAX(CAST(RIGHT(RTRIM(ISNULL(cve_Nro,'')), 8) AS INT)), 0) + 1 AS proximo
        FROM CabVenta WHERE cvetco_Cod = 'RC'
      `);
      if (r.recordset && r.recordset[0])
        numero = String(r.recordset[0].proximo).padStart(8, '0');
    } catch (e2) { /* ignore */ }
  }

  if (!ptoVenta) {
    try {
      const c = await pool.request().query(`
        SELECT TOP 1 RIGHT(RTRIM(ISNULL(cve_CodPvt,'')), 5) AS pvt
        FROM CabVenta
        WHERE cvetco_Cod = 'RC' AND LTRIM(RTRIM(ISNULL(cve_CodPvt,''))) <> ''
        ORDER BY CAST(RIGHT(RTRIM(ISNULL(cve_Nro,'')), 8) AS INT) DESC
      `);
      if (c.recordset && c.recordset[0]) {
        const w = String(c.recordset[0].pvt || '').trim();
        ptoVenta = w ? w.padStart(5, '0') : null;
      }
    } catch (e3) { /* ignore */ }
  }

  return {
    numero:   numero   || '00000001',
    ptoVenta: ptoVenta || '00001',
  };
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
  getProximoNumeroRC,
  actualizarTalonarRC,
  getCveIDRC,
  aplicarRelacionComprobante,
};
