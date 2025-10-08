// electron/modulesService/Cheques3.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

// ⛔️ No uses toISOString() (eso mete UTC/Z)

// --- LISTADO DE CHEQUES R ---
async function obtenerCheque3Rechazado(_idIgnorado) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    // Traigo la última fecha de cambio por cheque y la convierto a string sin TZ
    const result = await pool.request().query(`
      SELECT
        C.ch3emp_Codigo,
        C.ch3_ID,
        C.ch3_NroCheq,
        C.ch3_Edo,
        C.ch3_FVto,
        C.ch3_Importe,
        C.ch3suc_Cod,
        C.ch3sit_Cod,
        CONVERT(varchar(19),
          (SELECT MAX(S.c3s_FCmbio) FROM Cheq3Sit S WHERE S.c3sch3_ID = C.ch3_ID),
          120
        ) AS ch3_FCmbio
      FROM Cheques3 AS C
      WHERE C.ch3_Edo = 'R'
    `);

    return { success: true, cheque: result.recordset || [] };
  } catch (err) {
    console.error('❌ Error en obtenerCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

// --- UPDATE CHEQUE3 ---
async function actualizarCheque3(IDCheque, sit) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const parsedIDCheque = parseInt(IDCheque, 10);
    if (isNaN(parsedIDCheque)) {
      throw new Error(`ID de Cheque inválido: '${IDCheque}'. Debe ser un número válido.`);
    }
    const sanitizedSit = (sit === undefined || sit === null) ? '' : String(sit);

    const request = new sql.Request(pool);
    request.input('idCheque', sql.Int, parsedIDCheque);
    request.input('sit', sql.NVarChar, sanitizedSit);

    await request.query(`
      UPDATE Cheques3
      SET ch3sit_Cod = @sit,
          ch3_FecMod = GETDATE()
      WHERE ch3_ID = @idCheque
    `);

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

// --- SITUACIONES ---
async function getSituacion(){
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT sit_Cod, sit_Desc FROM Situacion`);
    return { success: true, data: result.recordset || [] };
  } catch (err) {
    console.error('❌ Error en getSituacion (Situacion):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

// --- REGISTRO CAMBIO DE SITUACION ---
async function registroCheq3Sit(emp, suc, IDCheque, sit, sitAnt){
  let pool;
  const messages = [];
  try{
    if (suc === undefined) suc = ' ';

    messages.push(`Verificando si la situacion del cheque ya existe: ${sitAnt} con ${sit}`);

    if (sitAnt != sit ) {
      const dbConfig = getAdminDbConfig();
      pool = await sql.connect(dbConfig);
      await pool.request()
        .input('emp', sql.NVarChar, emp)
        .input('suc', sql.NVarChar, suc)
        .input('IDCheque', sql.Int, IDCheque)
        .input('sit', sql.NVarChar, sit)
        .input('sitAnt', sql.NVarChar, sitAnt)
        .input('pCG', sql.NVarChar, 'C')
        .query(`
          INSERT INTO Cheq3Sit
            (c3semp_Codigo, c3ssuc_Cod, c3sch3_ID, c3s_FCmbio, c3s_CodSitAct, c3ssit_CodAnt, c3ssit_CodActIN, c3s_PasadoCG, c3s_CodApe)
          VALUES
            (@emp, @suc, @IDCheque, GETDATE(), @sit, @sitAnt, @sit, @pCG, ' ')
        `);

      messages.push('Registro de Cheque3 actualizado correctamente.');
      return { success: true, message: messages.join('\n') };
    } else {
      const msg = 'No se requiere actualizar el registro de Cheque3, la situacion no ha cambiado.';
      messages.push(msg);
      return { success: true, message: messages.join('\n') };
    }
  } catch(err){
    console.error('❌ No se pudo generar el registro:', err);
    messages.push(`❌ No se pudo generar el registro: ${err.message}`);
    return { success: false, message: messages.join('\n') };
  } finally {
    if (pool) await pool.close();
  }
}

// --- ULTIMA FECHA POR CHEQUE (para pintar en la grilla) ---
async function getUpdatedbyRegistro(){
  let pool;
  try{
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT
        c3sch3_ID,
        CONVERT(varchar(19), MAX(c3s_FCmbio), 120) AS c3s_FCmbio
      FROM Cheq3Sit
      GROUP BY c3sch3_ID
    `);
    return { success: true, data: result.recordset || [] };
  } catch(err){
    console.error('❌ Error en getUpdatedbyRegister (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = {
  actualizarCheque3,
  obtenerCheque3Rechazado,
  getSituacion,
  registroCheq3Sit,
  getUpdatedbyRegistro
};
