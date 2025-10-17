// back/modulesService/Chequesp.js
const { getAdminDbConfig } = require('../userDbConfig.js');
const sql = require('mssql');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const XLSX = require('xlsx');


function toDMY(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (isNaN(d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getDownloadsDir() {
  try {
    const { app } = require('electron');
    const p = app?.getPath?.('downloads');
    if (p) return p;
  } catch {}
  // fallback
  return path.join(os.homedir(), 'Downloads');
}

function resolveChequesTemplatePath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', 'chequesp.xlsx'),
    path.join(process.cwd(), 'resources', 'public', 'templates', 'chequesp.xlsx'),
    path.join(__dirname, '..', '..', 'public', 'templates', 'chequesp.xlsx'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  throw new Error('Plantilla chequesp.xlsx no encontrada. Colocarla en /public/templates/');
}

function pad(n) { return String(n).padStart(2, '0'); }
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function ChequesPExcel() {
  let pool;
  try {
    // 🔧 usar el import directo (consistente)
    pool = await sql.connect(getAdminDbConfig());

    const query = `
      SELECT 
          chp.chpemp_Codigo AS CodEmpresa,
          emp.emp_razsoc     AS Empresa,
          chp.chp_ID         AS ID_Cheque,
          mf.mfocmf_FMov     AS Mov_FEmision,
          ''                 AS Mov,
          ''                 AS ChequeValor,
          emp.emp_habili     AS Estado,
          chp.chp_FVto       AS ChequeFVto,
          chp.chp_NroCheq    AS NumeroCheque,
          ''                 AS NroDefinitivo,
          chp.chp_Importe    AS Importe
      FROM ChequesP chp
      LEFT JOIN Emp  emp ON emp.emp_codigo COLLATE DATABASE_DEFAULT  = chp.chpemp_Codigo COLLATE DATABASE_DEFAULT
      LEFT JOIN MovF mf  ON mf.mfo_ID = mfocmf_ID
      LEFT JOIN RelaChqP r ON r.rcpchp_ID = chp.chp_ID
      WHERE chp.chp_Edo = 'E'
        AND emp.emp_habili = '1';
    `;

    const rs = await pool.request().query(query);
    const rows = rs.recordset || [];
    // No es error si no hay filas: igual generamos planilla vacía (para editar)
    
    const templatePath = resolveChequesTemplatePath();
    const wb = XLSX.readFile(templatePath, { cellDates: false });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    if (!ws) throw new Error('Hoja del template no encontrada.');

    // Orden EXACTO de columnas esperadas por tu hook:
    // "CodEmpresa","Emp.","ID Cheque","Mov. - F. Emisión","Mov.",
    // "Cheque - Tipo Valor - Cód.","Cheq. / Doc. / Obl. - Estado",
    // "Cheq. / Doc. / Obl. - F. Vto.","Cheq. / Doc. / Obl. - Nro.","Nro Definitivo","IMPORTE"
    const dataRows = rows.map(r => ([
      r.CodEmpresa ?? '',
      r.Empresa ?? '',
      r.ID_Cheque ?? '',
      toDMY(r.Mov_FEmision),
      '',                        // Mov (vacío)
      '',                        // Cheque - Tipo Valor - Cód. (vacío)
      r.Estado ?? '',
      toDMY(r.ChequeFVto),
      r.NumeroCheque ?? '',
      '',                        // Nro Definitivo (vacío para que lo complete el usuario)
      Number(r.Importe ?? 0),
    ]));

    // Pegar desde A2
    if (dataRows.length) {
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A2' });

      // 🔧 !ref correcto: última fila 0-based = dataRows.length (A1=0)
      const lastRowIndex = dataRows.length; // 0-based
      const lastColIndex = 10; // K (11ª col) -> índice 10
      ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: lastRowIndex, c: lastColIndex })}`;

      // 🔧 formateo de IMPORTE (K) usando variable distinta
      for (let i = 0; i < dataRows.length; i++) {
        const excelRow = 2 + i; // filas 2..N+1
        const cellAddr = `K${excelRow}`;
        if (ws[cellAddr]) ws[cellAddr].z = '#,##0.00';
      }
    }

    const downloads = getDownloadsDir();
    const outPath = path.join(downloads, `ChequesP_${stamp()}.xlsx`);
    XLSX.writeFileXLSX(wb, outPath, { compression: true });
    await fsp.access(outPath, fs.constants.R_OK);

    return { success: true, path: outPath };
  } catch (err) {
    console.error('descargarPlanillaChequesPXlsx:', err);
    return { success: false, message: err?.message || 'Error al generar la planilla de ChequesP.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

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
async function obtenerChequesPreview() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const query = `
      SELECT
        chp.chp_ID                  AS ID_Cheque,
        chp.chpemp_Codigo          AS CodEmpresa,
        emp.emp_razsoc             AS Empresa,
        chp.chp_NroCheq            AS NumeroActual,
        mf.mfocmf_FMov             AS Mov_FEmision,
        chp.chp_FVto               AS ChequeFVto,
        chp.chp_Importe            AS Importe,
        chp.chp_Edo                AS Estado,
        chp.chp_FecMod             AS FechaMod
      FROM ChequesP chp
      LEFT JOIN Emp  emp ON emp.emp_codigo COLLATE DATABASE_DEFAULT = chp.chpemp_Codigo COLLATE DATABASE_DEFAULT
      LEFT JOIN MovF mf  ON mf.mfo_ID = mfocmf_ID
      ORDER BY chp.chp_ID ASC;
    `;
    const rs = await pool.request().query(query);
    const rows = rs.recordset || [];
    return { success: true, data: rows };
  } catch (err) {
    console.error('❌ Error en obtenerChequesPreview:', err);
    return { success: false, message: err?.message || 'Error al obtener vista previa de cheques.' };
  } finally {
    try { await pool?.close(); } catch {}
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
   const nroStr = (nroDefinitivo ?? '').toString().trim();
const nroInt = Number.parseInt(nroStr, 10);
if (!nroStr) return { success: false, message: 'Falta nroDefinitivo' };
if (!Number.isFinite(nroInt)) return { success: false, message: 'nroDefinitivo inválido' };

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
      .input('nroDefinitivo', sql.Int, nroInt)
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

module.exports = {
  obtenerCheque,
  actualizarCheque,
  ChequesPExcel,
  obtenerChequesPreview, // 👈 NUEVO
};
