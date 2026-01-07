// electron/modulesService/Cheques3.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

/**
 * LISTADO: ahora trae TODOS los cheques de terceros
 * con las columnas y alias pedidos:
 *  Empresa, ID_Cheque, Cliente, Número, FechaVencimiento, Importe, Estado, Situacion
 */
async function obtenerCheque3Rechazado() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT
        C.ch3emp_Codigo                      AS Empresa,
        C.ch3_ID                             AS idCheque,
        CL.cli_RazSoc                        AS Cliente,
        C.ch3_NroCheq                        AS NroCheque,
        C.ch3_Fvto                           AS FechaVencimiento,
        C.ch3_Importe                        AS Importe,
        C.ch3_Edo                            AS Estado,
        C.ch3_FecMod                         AS FecMod,
        S.sit_Desc                           AS Situacion
      FROM Cheques3 AS C
      LEFT JOIN Situacion AS S ON S.sit_Cod = C.ch3sit_Cod
      LEFT JOIN Clientes  AS CL ON CL.cli_cod = C.ch3cli_Cod
    `);

    return { success: true, cheque: result.recordset || [] };
  } catch (err) {
    console.error('❌ Error en obtenerCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * UPDATE (legacy): solo situación (se mantiene por compat)
 * Devuelve updatedAt (yyyy-MM-dd HH:mm:ss) desde ch3_FecMod.
 */
async function actualizarCheque3(IDCheque, sit) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const id = parseInt(IDCheque, 10);
    if (isNaN(id)) throw new Error(`ID inválido: '${IDCheque}'`);

    const r = new sql.Request(pool);
    r.input('idCheque', sql.Int, id);
    r.input('sit', sql.NVarChar, String(sit ?? ''));

    await r.query(`
      UPDATE Cheques3
      SET ch3sit_Cod = @sit,
          ch3_FecMod = GETDATE()
      WHERE ch3_ID = @idCheque
    `);

    const r2 = await pool.request()
      .input('idCheque', sql.Int, id)
      .query(`SELECT CONVERT(varchar(19), ch3_FecMod, 120) AS updatedAt FROM Cheques3 WHERE ch3_ID = @idCheque`);

    const updatedAt = r2.recordset?.[0]?.updatedAt || null;
    return { success: true, message: 'Situación actualizada.', updatedAt };
  } catch (err) {
    console.error('❌ Error en actualizarCheque3 (Cheques3):', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * UPDATE por campo: 'situacion' | 'fvto' | 'numero'
 * - fvto espera 'YYYY-MM-DD'
 * - retorna siempre updatedAt (yyyy-MM-dd HH:mm:ss)
 */
async function actualizarCheque3Campo({ IDCheque, campo, valor }) {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    const id = parseInt(IDCheque, 10);
    if (isNaN(id)) throw new Error(`ID inválido: '${IDCheque}'`);

    const mode = String(campo || '').toLowerCase();
    if (!['situacion', 'fvto', 'numero'].includes(mode)) {
      throw new Error(`Campo no soportado: '${campo}'`);
    }

    const r = new sql.Request(pool);
    r.input('idCheque', sql.Int, id);

    if (mode === 'situacion') {
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3sit_Cod = @val,
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
    } else if (mode === 'fvto') {
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3_FVto = CONVERT(datetime, @val, 120),
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
    } else if (mode === 'numero') {
      r.input('val', sql.NVarChar, String(valor ?? ''));
      await r.query(`
        UPDATE Cheques3
        SET ch3_NroCheq = @val,
            ch3_FecMod = GETDATE()
        WHERE ch3_ID = @idCheque
      `);
    }

    const r2 = await pool.request()
      .input('idCheque', sql.Int, id)
      .query(`SELECT CONVERT(varchar(19), ch3_FecMod, 120) AS updatedAt FROM Cheques3 WHERE ch3_ID = @idCheque`);

    const updatedAt = r2.recordset?.[0]?.updatedAt || null;

    const msg =
      mode === 'situacion' ? 'Situación actualizada.' :
      mode === 'fvto'      ? 'Fecha de vencimiento actualizada.' :
                             'Número de cheque actualizado.';

    return { success: true, message: msg, updatedAt };
  } catch (err) {
    console.error('❌ actualizarCheque3Campo:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * Catálogo de Situación (código + descripción)
 */
async function getSituacion(){
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT sit_Cod, sit_Desc FROM Situacion`);
    return { success: true, data: result.recordset || [] };
  } catch (err) {
    console.error('❌ getSituacion:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * Registro histórico (Cheq3Sit):
 * - Acepta sitAnt como código o descripción. Si viene descripción,
 *   se intenta resolver al código antes de insertar.
 */
async function registroCheq3Sit(emp, suc, IDCheque, sit, sitAnt){
  let pool;
  const messages = [];
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);

    if (suc === undefined) { suc = ' '; }

    let sitAntCode = String(sitAnt ?? '').trim();
    const sitNewCode = String(sit ?? '').trim();

    // Resolver sitAnt si vino descripción (o algo que no es código)
    if (sitAntCode) {
      // ¿Existe como código?
      const chk1 = await pool.request()
        .input('x', sql.NVarChar, sitAntCode)
        .query(`SELECT TOP 1 sit_Cod FROM Situacion WHERE sit_Cod = @x`);
      if (!chk1.recordset?.length) {
        const chk2 = await pool.request()
          .input('x', sql.NVarChar, sitAntCode)
          .query(`SELECT TOP 1 sit_Cod FROM Situacion WHERE sit_Desc = @x`);
        sitAntCode = chk2.recordset?.[0]?.sit_Cod || '';
      }
    }

    messages.push(`Verificando si la situacion del cheque ya existe: ${sitAntCode} -> ${sitNewCode}`);

    if (sitAntCode !== sitNewCode) {
      await pool.request()
        .input('emp', sql.NVarChar, emp)
        .input('suc', sql.NVarChar, suc)
        .input('IDCheque', sql.Int, IDCheque)
        .input('sit', sql.NVarChar, sitNewCode)
        .input('sitAnt', sql.NVarChar, sitAntCode)
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
  } catch (err) {
    console.error('❌ registroCheq3Sit:', err);
    messages.push(`❌ No se pudo generar el registro: ${err.message}`);
    return { success: false, message: messages.join('\n') };
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * Última fecha de cambio por Cheq3Sit (para resaltar en UI)
 */
async function getUpdatedbyRegistro(){
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT c3sch3_ID, CONVERT(varchar(19), MAX(c3s_FCmbio), 120) AS c3s_FCmbio
      FROM Cheq3Sit
      GROUP BY c3sch3_ID;
    `);
    return { success: true, data: result.recordset || [] };
  } catch (err) {
    console.error('❌ getUpdatedbyRegister:', err);
    return { success: false, message: err.message };
  } finally {
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
