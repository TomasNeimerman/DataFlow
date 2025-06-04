// back/modulesService/Cheques3.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function obtenerCheque3Rechazado(id) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT ch3emp_Codigo, ch3_ID, ch3_NroCheq, ch3_Edo, ch3_FVto, ch3_Importe FROM Cheques3 WHERE ch3_Edo = 'R' AND ch3sit_Cod IS NULL`); // Consulta a la tabla Cheques3
    return {
      success: true,
      cheque: result.recordset || null,
    };
  } catch (err) {
    console.error('❌ Error en obtenerCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

// Dentro de actualizarCheque3 en back/modulesService/Cheques3.js
async function actualizarCheque3(IDCheque, sit) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('[db-operations/Cheques3.js] Intentando conectar a la base de datos con config:', dbConfig);
    pool = await sql.connect(dbConfig); 
    console.log('[db-operations/Cheques3.js] Conexión a la base de datos establecida.');

    const parsedIDCheque = parseInt(IDCheque, 10);
    if (isNaN(parsedIDCheque)) {
        throw new Error(`ID de Cheque inválido: '${IDCheque}'. Debe ser un número válido.`);
    }
    const sanitizedSit = (sit === undefined || sit === null) ? '' : String(sit);

    console.log(`[db-operations/Cheques3.js] Ejecutando consulta con idCheque: ${parsedIDCheque}, sit: ${sanitizedSit}`);
    const request = new sql.Request(pool);
    request.input('idCheque', sql.Int, parsedIDCheque);
    request.input('sit', sql.NVarChar, sanitizedSit);

    await request.query(`
        UPDATE Cheques3 SET
          ch3sit_Cod = @sit
        WHERE ch3_ID = @idCheque
    `);
    console.log('[db-operations/Cheques3.js] Consulta SQL ejecutada con éxito.');

    return { success: true, message: 'Cheque3 actualizado correctamente.' };
  } catch (err) {
    console.error('❌ Error en actualizarCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) {
      console.log('[db-operations/Cheques3.js] Cerrando conexión a la base de datos.');
      await pool.close();
    }
  }
}

async function obtenerCheque3Actualizado(id) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT ch3emp_Codigo, ch3_ID, ch3_NroCheq, ch3_Edo, ch3_FVto, ch3_Importe, ch3sit_Cod FROM Cheques3 WHERE ch3_ID = @id`); // Consulta a la tabla Cheques3
    return {
      success: true,
      data: result.recordset || null,
    };
  } catch (err) {
    console.error('❌ Error en obtenerCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}
async function getSituacion(){
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT sit_Cod, sit_Desc FROM Situacion`); // Consulta a la tabla Situacion
    return {
      success: true,
      data: result.recordset || [],
    };
  } catch (err) {
    console.error('❌ Error en getSituacion (Situacion):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = { obtenerCheque3Actualizado, actualizarCheque3, obtenerCheque3Rechazado, getSituacion };