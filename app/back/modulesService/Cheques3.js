// back/modulesService/Cheques3.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function obtenerCheque3(id) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM Cheques3 WHERE ch3_ID = @id`); // Consulta a la tabla Cheques3
    return {
      success: true,
      cheque: result.recordset[0] || null,
    };
  } catch (err) {
    console.error('❌ Error en obtenerCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

async function actualizarCheque3(cheque) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const { idCheque, nroDefinitivo } = cheque;

    const existe = await pool.request()
      .input('id', sql.Int, idCheque)
      .query(`SELECT COUNT(*) as count FROM Cheques3 WHERE ch3_ID = @id`); // Consulta a la tabla Cheques3

    if (existe.recordset[0].count === 0) {
      return { success: false, message: `Cheque3 ID ${idCheque} no existe y no se puede actualizar.` };
    }

    await pool.request()
      .input('idCheque', sql.Int, idCheque)
      .input('nroDefinitivo', sql.NVarChar, nroDefinitivo) // Asegúrate del tipo de dato correcto
      .query(`
        UPDATE Cheques3 SET
          ch3_NroCheq = @nroDefinitivo
        WHERE ch3_ID = @idCheque
      `); // Actualiza la tabla Cheques3 y la columna correcta

    return { success: true, message: 'Cheque3 actualizado correctamente.' };
  } catch (err) {
    console.error('❌ Error en actualizarCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = { obtenerCheque3, actualizarCheque3 };