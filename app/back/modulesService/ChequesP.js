// back/modulesService/Chequesp.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function obtenerCheque(id) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('Conectando a la base de datos con la configuración:', dbConfig);
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM ChequesP WHERE chp_ID = @id`);

    return {
      success: true,
      cheque: result.recordset[0] || null,
    };
  } catch (err) {
    console.error('❌ Error en obtenerCheque (Chequesp):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

async function actualizarCheque(cheque) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const { idCheque, nroDefinitivo } = cheque;

    const existe = await pool.request()
      .input('id', sql.Int, idCheque)
      .query(`SELECT COUNT(*) as count FROM ChequesP WHERE chp_ID = @id`);

    if (existe.recordset[0].count === 0) {
      return { success: false, message: `Cheque ID ${idCheque} no existe y no se puede actualizar.` };
    }

    await pool.request()
      .input('idCheque', sql.Int, idCheque)
      .input('nroDefinitivo', sql.Int, nroDefinitivo)
      .query(`
        UPDATE ChequesP SET
          chp_NroCheq = @nroDefinitivo
        WHERE chp_ID = @idCheque
      `);

    return { success: true, message: 'Cheque actualizado correctamente.' };
  } catch (err) {
    console.error('❌ Error en actualizarCheque (Chequesp):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = { obtenerCheque, actualizarCheque };