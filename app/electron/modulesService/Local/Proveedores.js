// electron/modulesService/Local/Proveedores.js
// =====================================================
// Back Proveedores (Local) - Catálogos + Listado + Updates
// (Adaptado desde Clientes.js)
// =====================================================
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

/** Helper: pick primer campo existente */
function pick(row, candidates = []) {
  for (const k of candidates) if (row && row[k] != null) return row[k];
  return null;
}

/** Helper: mapear recordset a { value, label } con columnas posibles */
function mapCatalog(rs, codeCandidates, descCandidates) {
  const out = [];
  (rs?.recordset || []).forEach(row => {
    const cod = String(pick(row, codeCandidates) ?? '').trim();
    const des = String(pick(row, descCandidates) ?? '').trim();
    if (cod) out.push({ value: cod, label: des ? `${cod} - ${des}` : cod });
  });
  out.sort((a, b) => (a.value > b.value ? 1 : -1));
  return out;
}

/* ============================================================
 * 1) CATALOGOS (separados por solapa) + agregador
 *    Nota: Se quitaron catálogos NO usados en este módulo:
 *          Zona, Lista de Precios (DefListP), Descuentos (DescCom/financieros)
 * ============================================================
 */

/** ─── Solapa: General ───────────────────────────────────── */
async function getCatalogosGeneral() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();

    const [cpg, prv, pai] = await Promise.all([
      req.query("SELECT cpg_Cod, cpg_Desc FROM CondPago"),
      req.query("SELECT * FROM prv"),
      req.query("SELECT * FROM Paises"),
    ]);

    const data = {
      CondPago: mapCatalog(cpg, ['cpg_Cod'], ['cpg_Desc']),
      PRV:      mapCatalog(prv, ['prv_Codigo','prv_Cod','prv_Id','Codigo','Cod','prv_codigo'], ['prv_descrip','prv_Desc','prv_Nombre','Descripcion','Desc']),
      Paises:   mapCatalog(pai, ['pai_Cod','pais_Cod','Codigo','Cod','Id'],       ['pai_Desc','pais_Desc','Nombre','Desc','Descripcion']),
    };
    return { success: true, data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo catálogos (General).' };
  } finally { try { await pool?.close(); } catch {} }
}

/** ─── Solapa: Datos Impositivos ────────────────────────── */
async function getCatalogosImpositivos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();

    const [siva, tdoc, sgan, sib, ape] = await Promise.all([
      req.query("SELECT siv_Cod, siv_Desc FROM SitIVA"),
      req.query("SELECT tdc_Cod, tdc_Desc FROM TipoDocum"),
      req.query("SELECT sig_Cod, sig_Desc FROM SituGan"),
      req.query("SELECT sib_Cod, sib_Desc FROM SitIB"),
      req.query("SELECT ape_Cod, ape_Desc FROM Apertura"),
    ]);

    const data = {
      SitIVA:    mapCatalog(siva, ['siv_Cod'], ['siv_Desc']),
      TipoDocum: mapCatalog(tdoc, ['tdc_Cod'], ['tdc_Desc']),
      SituGan:   mapCatalog(sgan, ['sig_Cod'], ['sig_Desc']),
      SitIB:     mapCatalog(sib,  ['sib_Cod'], ['sib_Desc']),
      Apertura:  mapCatalog(ape,  ['ape_Cod'], ['ape_Desc']),
    };
    return { success: true, data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo catálogos (Impositivos).' };
  } finally { try { await pool?.close(); } catch {} }
}

/** ─── Solapa: Otros Datos ────────────────────────────────
 *  Nota: Mantengo Defi1Cli/Defi2Cli por compatibilidad (si el front los usa como ordenamientos),
 *  pero si en tu DB existen catálogos específicos de proveedores, cambiamos estas queries.
 */
async function getCatalogosOtros() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();

    const [d1, d2] = await Promise.all([
      req.query("SELECT dc1_Cod, dc1_Desc FROM Defi1Cli"),
      req.query("SELECT dc2_Cod, dc2_Desc FROM Defi2Cli"),
    ]);

    const data = {
      Defi1Cli: mapCatalog(d1, ['dc1_Cod'], ['dc1_Desc']),
      Defi2Cli: mapCatalog(d2, ['dc2_Cod'], ['dc2_Desc']),
    };
    return { success: true, data };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo catálogos (Otros).' };
  } finally { try { await pool?.close(); } catch {} }
}

/** ─── Agregador (compatibilidad con front existente) ───── */
async function getCatalogos() {
  const [g, i, o] = await Promise.all([
    getCatalogosGeneral(),
    getCatalogosImpositivos(),
    getCatalogosOtros(),
  ]);
  const ok = [g, i, o].every(x => x && x.success);
  if (!ok) {
    const firstErr = [g, i, o].find(x => !x?.success);
    return { success: false, message: firstErr?.message || 'Error obteniendo catálogos.' };
  }
  return { success: true, data: { ...(g.data || {}), ...(i.data || {}), ...(o.data || {}) } };
}

/* ============================================================
 * 2) LISTADO (traerTodos) — actualizado a Proveedores
 *    Campos NO usados en este módulo (omitidos): Zona, Descuentos (com/fin), Lista de Precios.
 * ============================================================
 */
async function traerTodos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT 
        p.pro_Cod        AS CodProveedor, 
        p.pro_RazSoc     AS RazonSocial, 
        p.pro_Direc      AS Direccion,
        p.pro_Loc        AS Localidad,
        p.pro_CodPos     AS CodigoPostal,

        p.procpg_Cod     AS CodCondicionPago,
        cpg.cpg_Desc     AS CondicionPago,

        -- General extra
        p.proprv_Codigo  AS Provincia,
        p.propai_Cod     AS Pais,

        -- Otros datos
        p.prodp1_Cod     AS [Ordenamiento 1],
        p.prodp2_Cod     AS [Ordenamiento 2],

        -- Impositivos
        p.prosiv_Cod     AS SituacionIVA,
        p.protdc_Cod     AS TipodeDocumento,
        p.prosig_Cod     AS Ganancias,
        p.prosib_Cod     AS IngresosBrutos,
        p.proape_Cod     AS Apertura

      FROM Proveed p 
      LEFT JOIN CondPago   cpg ON cpg.cpg_Cod = p.procpg_Cod
      LEFT JOIN SitFcieraP sfp ON sfp.sfppro_Cod = p.pro_Cod
      WHERE p.pro_Habilitado = '1'
      ORDER BY p.pro_Cod
    `);
    return { success: true, data: rs.recordset || [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo proveedores.' };
  } finally { try { await pool?.close(); } catch {} }
}

/* ============================================================
 * 3) Listas habilitadas (legacy) — NO APLICA
 * ============================================================
 */
async function traerCodigosLista() {
  return { success: false, message: 'No aplica en Proveedores (Lista de Precios no se usa en este módulo).' };
}

/* ============================================================
 * 4) Actualizar lista (legacy) — NO APLICA
 * ============================================================
 */
async function actualizarLista() {
  return { success: false, message: 'No aplica en Proveedores (Lista de Precios no se usa en este módulo).' };
}

/* ============================================================
 * 5) Actualizar CAMPOS VARIOS — adaptado a Proveedores
 *    Nota: se usa proCods (pero aceptamos cliCods por compatibilidad si el front viejo lo manda).
 * ============================================================
 */
async function actualizarCampos({ proCods = [], cliCods = [], sets = {} } = {}) {
  const finalIds = (Array.isArray(proCods) && proCods.length)
    ? proCods
    : (Array.isArray(cliCods) ? cliCods : []);

  if (!Array.isArray(finalIds) || finalIds.length === 0) {
    return { success: false, message: 'No hay proveedores seleccionados (proCods).' };
  }

  const setsNorm = { ...sets };

  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());

    // Mapeo de campos → columnas en Proveed
    const mapCols = {
      // Identificación / contacto
      razonSocial:   'pro_RazSoc',
      direccion:     'pro_Direc',
      localidad:     'pro_Loc',
      codigoPostal:  'pro_CodPos',

      // General
      condPago:      'procpg_Cod',
      provincia:     'proprv_Codigo',
      pais:          'propai_Cod',

      // Otros datos
      orden1:        'prodp1_Cod',
      orden2:        'prodp2_Cod',

      // Impositivos
      iva:           'prosiv_Cod',
      tdoc:          'protdc_Cod',
      gan:           'prosig_Cod',
      ib:            'prosib_Cod',
      ape:           'proape_Cod',
    };

    const setPairs = [];
    const inputs = [];

    Object.entries(mapCols).forEach(([key, col]) => {
      const val = setsNorm?.[key];
      if (val != null && val !== '') {
        const pname = `v_${key}`;
        setPairs.push(`p.${col} = @${pname}`);
        inputs.push({ pname, type: sql.VarChar(100), value: String(val) });
      }
    });

    if (setPairs.length === 0) {
      return { success: false, message: 'No hay campos para actualizar en "sets".' };
    }

    const idsCsv = finalIds.map(String).join(',');

    const req = pool.request();
    inputs.forEach(p => req.input(p.pname, p.type, p.value));
    req.input('ids', sql.NVarChar(sql.MAX), idsCsv);

    const q = `
      UPDATE p SET
        ${setPairs.join(',\n        ')}
      FROM Proveed p
      WHERE p.pro_Cod IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','));

      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const upd = await req.query(q);

    return { success: true, updatedRows: upd.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando campos de proveedores.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}

module.exports = {
  getCatalogosGeneral,
  getCatalogosImpositivos,
  getCatalogosOtros,
  getCatalogos,
  traerTodos,
  traerCodigosLista,
  actualizarLista,
  actualizarCampos,
};
