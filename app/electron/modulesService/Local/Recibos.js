// electron/modulesService/Local/Recibos.js
// ✅ Node/Electron (CommonJS)
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig');

let _pool = null;

async function getPool() {
  if (_pool && _pool.connected) return _pool;
  const cfg = getAdminDbConfig();
  _pool = await sql.connect(cfg);
  return _pool;
}

function parseDateYYYYMMDD(s) {
  // Espera 'YYYY-MM-DD'
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Tipos de Comprobante
 * Filtro fijo: tco_TipoFijo='RC', tco_Circuito='V', tco_Habilitado=1
 * Devuelve: [{ tco_cod, tco_desc }, ...]
 */
async function getTiposComprobante({ tipoFijo = 'RC', circuito = 'V' } = {}) {
  const pool = await getPool();
  const result = await pool.request()
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

  return result.recordset || [];
}

/**
 * Monedas habilitadas
 * Devuelve: [{ mon_codigo, mon_simbolo, mon_descrip }, ...]
 */
async function getMonedas() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT mon_codigo, mon_simbolo, mon_descrip
    FROM mon
    WHERE mon_habili = 1
    ORDER BY mon_codigo
  `);
  return result.recordset || [];
}

/**
 * Tipo de Cambio
 * Params: { mon_codigo: 'USD' | 'EUR' | 'ARS'..., fecha: 'YYYY-MM-DD' }
 * Devuelve: number | null   (mcot_cotiza)
 */
async function getTipoCambio({ mon_codigo, fecha }) {
  if (!mon_codigo) throw new Error('mon_codigo requerido');
  if (!fecha) throw new Error('fecha requerida (YYYY-MM-DD)');

  // Si tu lógica exige ARS=1.0, podés descomentar este atajo:
  // if (String(mon_codigo).toUpperCase() === 'ARS') return 1.0;

  const fechaDt = parseDateYYYYMMDD(fecha);
  if (!fechaDt) throw new Error('fecha inválida: use formato YYYY-MM-DD');

  const pool = await getPool();
  const result = await pool.request()
    .input('mon', sql.VarChar(16), String(mon_codigo))
    .input('fecha', sql.Date, fechaDt)
    .query(`
      SELECT TOP 1 mcot_cotiza
      FROM mon_cam
      WHERE mcot_fecha <= @fecha
        AND mon_codigo = @mon
      ORDER BY mcot_fecha DESC
    `);

  const row = result.recordset && result.recordset[0];
  return row ? Number(row.mcot_cotiza) : null;
}

module.exports = {
  // para test y otros servicios
  __getPool: getPool,

  // API pública del módulo
  getTiposComprobante,
  getMonedas,
  getTipoCambio,
};
