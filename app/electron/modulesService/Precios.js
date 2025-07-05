const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function obtenerPrecios() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('Conectando a la base de datos con la configuración:', dbConfig);
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT TOP 100 lprdlp_Cod, lprart_CodGen, lpr_Precio, lpr_FecMod FROM ListaPrec`);

    return {
      success: true,
      precios: result.recordset || [],
    };
  } catch (err) {
    console.error('❌ Error en obtenerPrecios:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = {
  obtenerPrecios,
};