// back/modulesService/Cheques3.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

const fecha = new Date().toISOString().replace('T', ' ').replace('Z', '');

async function obtenerCheque3Rechazado(id) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT ch3emp_Codigo, ch3_ID, ch3_NroCheq, ch3_Edo, ch3_FVto, ch3_Importe, ch3suc_Cod,ch3sit_Cod,
        (SELECT c3s_FCmbio FROM Cheq3Sit WHERE c3sch3_ID = @id) AS ch3_FCmbio
        FROM Cheques3 WHERE ch3_Edo = 'R'`); // Consulta a la tabla Cheques3
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
    pool = await sql.connect(dbConfig); 

    const parsedIDCheque = parseInt(IDCheque, 10);
    if (isNaN(parsedIDCheque)) {
        throw new Error(`ID de Cheque inválido: '${IDCheque}'. Debe ser un número válido.`);
    }
    const sanitizedSit = (sit === undefined || sit === null) ? '' : String(sit);
   
    const request = new sql.Request(pool);
    request.input('idCheque', sql.Int, parsedIDCheque);
    request.input('sit', sql.NVarChar, sanitizedSit);
    request.input('fecha', sql.DateTime, fecha);
    console.log("fecha", fecha)
    await request.query(`
        UPDATE Cheques3 SET
          ch3sit_Cod = @sit,
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
async function registroCheq3Sit(emp,suc,IDCheque,sit,sitAnt){
  let pool;
  try{
    if (suc === undefined) { suc = ' '; }
     // Formato YYYY-MM-DD
    console.log('Verificando si la situacion del cheque ya existe:', sitAnt, "con", sit);
    if (sitAnt != sit ) {
      const dbConfig = getAdminDbConfig();
      pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input('emp', sql.NVarChar, emp)
        .input('suc', sql.NVarChar, suc)
        .input('IDCheque', sql.Int, IDCheque)
        .input('fecha', sql.DateTime, fecha)
        .input('sit', sql.NVarChar, sit)
        .input('sitAnt', sql.NVarChar, sitAnt)
        .input('pCG', sql.NVarChar, 'C')
        .query(`INSERT INTO Cheq3Sit (c3semp_Codigo,c3ssuc_Cod,c3sch3_ID,c3s_FCmbio,c3s_CodSitAct,c3ssit_CodAnt,c3ssit_CodActIN, c3s_PasadoCG, c3s_CodApe) VALUES (@emp, @suc, @IDCheque,GETDATE(),@sit,@sitAnt,@sit,@pCG, ' ')`); // Consulta a la tabla Situacion
    return {success: true, message: 'Registro de Cheque3 actualizado correctamente.'};
    }else{
      console.log('No se requiere actualizar el registro de Cheque3, la situacion no ha cambiado.');
    }
  }catch(err){
    console.error('❌ No se pudo generar el registro:', err);
    return { success: false, message: err.message };
  }
  finally {
    if (pool) await pool.close();
  }
}
async function getUpdatedbyRegistro(){
  let pool;
  try{
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT c3sch3_ID, MAX(c3s_FCmbio) AS c3s_FCmbio
              FROM Cheq3Sit
              GROUP BY c3sch3_ID;`); // Consulta a la tabla Cheq3Sit
    return {success: true, data: result.recordset || []};
  }catch(err){
    console.error('❌ Error en getUpdatedbyRegister (Cheques3):', err);
    return { success: false, message: err.message };
  }finally {
    if (pool) await pool.close();
  }
}


module.exports = { actualizarCheque3, obtenerCheque3Rechazado, getSituacion, registroCheq3Sit, getUpdatedbyRegistro };