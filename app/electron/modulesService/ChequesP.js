// back/modulesService/Chequesp.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

// 👉 util simple: ahora de Argentina (workaround actual -3h)
function nowArgentina() {
  const d = new Date();
  d.setHours(d.getHours() - 3); // luego lo hacemos bien con TZ
  return d;
}

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

    // 👇 ahora esperamos también el usuario (nombre de usuario)
    const { idCheque, nroDefinitivo, usuario } = cheque;

    // Validación mínima
    if (!idCheque) return { success: false, message: 'Falta idCheque' };
    if (nroDefinitivo == null) return { success: false, message: 'Falta nroDefinitivo' };

    const existe = await pool.request()
      .input('id', sql.Int, idCheque)
      .query(`SELECT COUNT(*) as count FROM ChequesP WHERE chp_ID = @id`);

    if ((existe.recordset[0]?.count || 0) === 0) {
      return { success: false, message: `Cheque ID ${idCheque} no existe y no se puede actualizar.` };
    }

    const fechaMod = nowArgentina();
    const codigoUsuario = (usuario || '').toString().trim() || 'desconocido';

    // ✅ Actualizamos número + fecha de modificación + usuario
    await pool.request()
      .input('idCheque', sql.Int, idCheque)
      .input('nroDefinitivo', sql.Int, nroDefinitivo)
      .input('fecMod', sql.DateTime, fechaMod)
      .input('codigoUsuario', sql.VarChar(50), codigoUsuario)
      .query(`
        UPDATE ChequesP SET
          chp_NroCheq     = @nroDefinitivo,
          chp_FecMod      = GETDATE(),
          chpusu_Codigo   = @codigoUsuario
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
