const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

// Helper: leer ch3_FecMod justo después del UPDATE
async function getModifiedAt(pool, id) {
  const r = new sql.Request(pool);
  r.input('idCheque', sql.Int, id);
  const q = await r.query(`
    SELECT
      ch3_FecMod,
      CONVERT(varchar(19), ch3_FecMod, 120) AS ch3_FecMod_str
    FROM Cheques3
    WHERE ch3_ID = @idCheque
  `);
  const row = q.recordset?.[0] || {};
  return {
    modifiedAtIso: row.ch3_FecMod || null,   // Date del driver
    modifiedAt: row.ch3_FecMod_str || null   // "YYYY-MM-DD HH:MM:SS"
  };
}

// --- LISTADO ---
async function obtenerCheque3Rechazado() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

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

// --- UPDATE SITUACION (legacy) — ahora devuelve fecha de modificación
async function actualizarCheque3(IDCheque, sit) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const parsedIDCheque = parseInt(IDCheque, 10);
    if (isNaN(parsedIDCheque)) throw new Error(`ID inválido: '${IDCheque}'`);

    const request = new sql.Request(pool);
    request.input('idCheque', sql.Int, parsedIDCheque);
    request.input('sit', sql.NVarChar, String(sit ?? ''));

    await request.query(`
      UPDATE Cheques3
      SET ch3sit_Cod = @sit,
          ch3_FecMod = GETDATE()
      WHERE ch3_ID = @idCheque
    `);

    const { modifiedAtIso, modifiedAt } = await getModifiedAt(pool, parsedIDCheque);
    return { success: true, message: 'Situación actualizada.', modifiedAt, modifiedAtIso };
  } catch (err) {
    console.error('❌ Error en actualizarCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) { await pool.close(); }
  }
}

// --- UPDATE por CAMPO — devuelve fecha de modificación en todos los casos
async function actualizarCheque3Campo({ IDCheque, campo, valor }) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const id = parseInt(IDCheque, 10);
    if (isNaN(id)) throw new Error(`ID inválido: '${IDCheque}'`);

    if (!['situacion','fvto','numero'].includes(String(campo))) {
      throw new Error(`Campo no soportado: '${campo}'`);
    }

    const r = new sql.Request(pool);
    r.input('idCheque', sql.Int, id);

    if (campo === 'situacion') {
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3sit_Cod = @val,
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
      const { modifiedAtIso, modifiedAt } = await getModifiedAt(pool, id);
      return { success: true, message: 'Situación actualizada.', modifiedAt, modifiedAtIso };
    }

    if (campo === 'fvto') {
      // Valor esperado 'YYYY-MM-DD'
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3_FVto = CONVERT(datetime, @val, 120),
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
      const { modifiedAtIso, modifiedAt } = await getModifiedAt(pool, id);
      return { success: true, message: 'Fecha de vencimiento actualizada.', modifiedAt, modifiedAtIso };
    }

    if (campo === 'numero') {
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3_NroCheq = @val,
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
      const { modifiedAtIso, modifiedAt } = await getModifiedAt(pool, id);
      return { success: true, message: 'Número de cheque actualizado.', modifiedAt, modifiedAtIso };
    }

    return { success: false, message: 'Sin cambios.' };
  } catch (err) {
    console.error('❌ actualizarCheque3Campo:', err);
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
    const result = await pool.request().query(`SELECT sit_Cod, sit_Desc FROM Situacion`);
    return { success: true, data: result.recordset || [] };
  } catch (err) {
    console.error('❌ getSituacion:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

async function registroCheq3Sit(emp, suc, IDCheque, sit, sitAnt){
  let pool;
  const messages = [];
  try{
    if (suc === undefined) { suc = ' '; }
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
    console.error('❌ registroCheq3Sit:', err);
    messages.push(`❌ No se pudo generar el registro: ${err.message}`);
    return { success: false, message: messages.join('\n') };
  } finally {
    if (pool) await pool.close();
  }
}

async function getUpdatedbyRegistro(){
  let pool;
  try{
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT c3sch3_ID, CONVERT(varchar(19), MAX(c3s_FCmbio), 120) AS c3s_FCmbio
      FROM Cheq3Sit
      GROUP BY c3sch3_ID;
    `);
    return {success: true, data: result.recordset || []};
  }catch(err){
    console.error('❌ getUpdatedbyRegister:', err);
    return { success: false, message: err.message };
  }finally {
    if (pool) await pool.close();
  }
}

module.exports = {
  actualizarCheque3,
  actualizarCheque3Campo,
  obtenerCheque3Rechazado,
  getSituacion,
  registroCheq3Sit,
  getUpdatedbyRegistro
};
