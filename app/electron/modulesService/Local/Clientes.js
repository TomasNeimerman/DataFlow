// electron/modulesService/Local/Clientes.js
// =====================================================
// Back Clientes (Local) - Catálogos + Listado + Updates
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
 * ============================================================
 */

/** ─── Solapa: General ───────────────────────────────────── */
async function getCatalogosGeneral() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();

    const [cvt, tip, dlp, ven, zon, prv, pai] = await Promise.all([
      req.query("SELECT cvt_Cod, cvt_Desc FROM CondVta"),
      req.query("SELECT tic_Cod, tic_Desc FROM TipCli"),
      req.query("SELECT dlp_Cod, dlp_Desc FROM DefListP WHERE dlp_Habilitacion='1'"),
      req.query("SELECT ven_Cod, ven_Desc FROM Vendedor"),
      req.query("SELECT zon_Cod, zon_Desc FROM Zona"),
      req.query("SELECT * FROM prv"),
      req.query("SELECT * FROM Paises"),
    ]);

    const data = {
      CondVta:  mapCatalog(cvt,  ['cvt_Cod'],  ['cvt_Desc']),
      TipCli:   mapCatalog(tip,  ['tic_Cod'],  ['tic_Desc']),
      DefListP: mapCatalog(dlp,  ['dlp_Cod'],  ['dlp_Desc']),
      Vendedor: mapCatalog(ven,  ['ven_Cod'],  ['ven_Desc']),
      Zona:     mapCatalog(zon,  ['zon_Cod'],  ['zon_Desc']),
      PRV:      mapCatalog(prv,  ['prv_Codigo','prv_Cod','prv_Id','Codigo','Cod','prv_codigo'], ['prv_descrip','prv_Desc','prv_Nombre','Descripcion','Desc']),
      Paises:   mapCatalog(pai,  ['pai_Cod','pais_Cod','Codigo','Cod','Id'],       ['pai_Desc','pais_Desc','Nombre','Desc','Descripcion']),
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

/** ─── Solapa: Otros Datos ──────────────────────────────── */
async function getCatalogosOtros() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();

    const [d1, d2, trn, pro] = await Promise.all([
      req.query("SELECT dc1_Cod, dc1_Desc FROM Defi1Cli"),
      req.query("SELECT dc2_Cod, dc2_Desc FROM Defi2Cli"),
      req.query("SELECT trn_Cod, trn_Desc FROM Transporte"),
      req.query("SELECT pro_Cod, pro_RazSoc FROM Proveed"),
    ]);

    const data = {
      Defi1Cli:   mapCatalog(d1, ['dc1_Cod'], ['dc1_Desc']),
      Defi2Cli:   mapCatalog(d2, ['dc2_Cod'], ['dc2_Desc']),
      Transporte: mapCatalog(trn, ['trn_Cod'], ['trn_Desc']),
      Proveed:    mapCatalog(pro, ['pro_Cod'], ['pro_RazSoc']),
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
 * 2) LISTADO (traerTodos) — sin cambios
 * ============================================================
 */
async function traerTodos() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT 
        c.cli_Cod      AS CodCliente, 
        c.cli_RazSoc   AS RazonSocial, 
        c.cli_Direc    AS Direccion,
        c.clizon_Cod   AS CodZona,
        z.zon_Desc     AS Zona,
        c.cli_Loc      AS Localidad,
        c.cli_CodPos   AS CodigoPostal,
        c.clicvt_Cod   AS CodCodicionVenta,
        cvt.cvt_Desc   AS CondicionVenta,
        c.cliven_Cod   AS CodVendedor,
        v.ven_Desc     AS Vendedor,
        c.clitic_Cod   AS CodTipoCliente,
        t.tic_Desc     AS TipoCliente,
        c.clidlp_Cod   AS CodListaPrecio,
        dlp.dlp_Desc   AS ListaPrecio,
        c.clidco_Cod   AS CodDescuentoCom,
        dco.dco_Desc   AS DescuentoCom,

        -- General extra
        c.cliprv_Codigo,
        c.clipai_Cod,

        -- Otros datos
        c.clidc1_Cod, c.clidc2_Cod, c.clitrn_Cod, c.clipro_Cod,

        -- Impositivos
        c.clisiv_Cod, c.clitdc_Cod, c.clisig_Cod, c.clisib_Cod, c.cliape_Cod
      FROM Clientes c
      LEFT JOIN CondVta  cvt ON cvt.cvt_Cod = c.clicvt_Cod
      LEFT JOIN Vendedor v   ON v.ven_Cod   = c.cliven_Cod
      LEFT JOIN TipCli   t   ON t.tic_Cod   = c.clitic_Cod
      LEFT JOIN DefListP dlp ON dlp.dlp_Cod = c.clidlp_Cod
      LEFT JOIN Zona     z   ON z.zon_Cod   = c.clizon_Cod
      LEFT JOIN DescCom  dco ON dco.dco_Cod = c.clidco_Cod
      WHERE c.cli_Habilitado = '1'
      ORDER BY c.cli_Cod
    `);
    return { success: true, data: rs.recordset || [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

/* ============================================================
 * 3) Listas habilitadas (legacy) — sin cambios
 * ============================================================
 */
async function traerCodigosLista() {
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const rs = await pool.request().query(`
      SELECT dlp_Cod
      FROM DefListP
      WHERE dlp_Habilitacion='1'
      ORDER BY dlp_Cod
    `);
    return { success: true, data: (rs.recordset || []).map(r => String(r.dlp_Cod ?? '').trim()) };
  } catch (e) {
    return { success: false, message: e?.message || 'Error obteniendo códigos de lista.' };
  } finally { try { await pool?.close(); } catch {} }
}

/* ============================================================
 * 4) Actualizar lista (legacy) — sin cambios
 * ============================================================
 */
async function actualizarLista({ fromCod, toCod, cliCods = [] } = {}) {
  if (!toCod) return { success: false, message: 'Falta lista destino (toCod).' };
  if (!Array.isArray(cliCods) || cliCods.length === 0) {
    return { success: false, message: 'No hay clientes seleccionados (cliCods).' };
  }

  const idsCsv = cliCods.map(String).join(',');

  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());
    const req = pool.request();
    req.input('fromCod', sql.VarChar(20), String(fromCod ?? ''));
    req.input('toCod',   sql.VarChar(20), String(toCod));
    req.input('ids',     sql.NVarChar(sql.MAX), idsCsv);

    const q = `
      UPDATE c SET c.clidlp_Cod = @toCod
      FROM Clientes c
      WHERE c.clidlp_Cod = @fromCod
        AND c.cli_Cod IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','));

      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const rs = await req.query(q);
    return { success: true, updatedRows: rs.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando clientes.' };
  } finally { try { await pool?.close(); } catch {} }
}

/* ============================================================
 * 5) Actualizar CAMPOS VARIOS — sin cambios
 * ============================================================
 */
// Helper: resolver ven_Cod desde código, "cod - desc" o descripción pura
async function resolveVendedorCode(pool, raw) {
  const val = String(raw ?? '').trim();
  if (!val) return null;

  // 1) si vino "600 - Pablo Tucci" o "600" -> probar por código
  const maybeCode = val.replace(/\s*-.*/, '').trim();
  if (maybeCode) {
    const rsCode = await pool.request()
      .input('c', sql.VarChar(50), maybeCode)
      .query('SELECT ven_Cod FROM Vendedor WHERE ven_Cod = @c');
    if (rsCode.recordset?.length === 1) {
      return String(rsCode.recordset[0].ven_Cod).trim();
    }
  }

  // 2) si no, buscar por descripción exacta
  const rsDesc = await pool.request()
    .input('d', sql.VarChar(200), val)
    .query('SELECT ven_Cod FROM Vendedor WHERE ven_Desc = @d');

  if (rsDesc.recordset?.length === 1) {
    return String(rsDesc.recordset[0].ven_Cod).trim();
  }
  if (rsDesc.recordset?.length > 1) {
    throw new Error(`Descripción de vendedor ambigua: '${val}'.`);
  }
  throw new Error(`No se encontró vendedor por código/descr.: '${val}'.`);
}

async function actualizarCampos({ cliCods = [], sets = {}, fromList = null } = {}) {
  if (!Array.isArray(cliCods) || cliCods.length === 0) {
    return { success: false, message: 'No hay clientes seleccionados (cliCods).' };
  }

  // Copia que vamos a normalizar (especialmente vendedor)
  const setsNorm = { ...sets };

  // Abro conexión una vez porque voy a resolver vendedor y luego actualizar
  let pool;
  try {
    pool = await sql.connect(getAdminDbConfig());

    // ─────────────────────────────
    // Caso especial: VENDEDOR
    // El front ahora puede mandar: "600 - Pablo Tucci", "Pablo Tucci" o "600".
    // Siempre resolvemos a ven_Cod antes del UPDATE para no romper la FK.
    // ─────────────────────────────
    if (setsNorm.vendedor != null && setsNorm.vendedor !== '') {
      const raw = String(setsNorm.vendedor).trim();
      const possibleCode = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;
      const possibleDesc = raw.includes(' - ')
        ? raw.split(' - ').slice(1).join(' - ').trim()
        : raw;

      let rs;

      // 1) Intento por código exacto (ej: "600")
      rs = await pool.request()
        .input('code', sql.VarChar(50), possibleCode)
        .query(`
          SELECT ven_Cod
          FROM Vendedor
          WHERE LTRIM(RTRIM(ven_Cod)) = LTRIM(RTRIM(@code))
        `);

      // 2) Si no hubo match por código, intento por descripción exacta (ej: "Pablo Tucci")
      if (!rs.recordset?.length) {
        rs = await pool.request()
          .input('desc', sql.NVarChar(200), possibleDesc)
          .query(`
            SELECT ven_Cod
            FROM Vendedor
            WHERE LTRIM(RTRIM(ven_Desc)) = LTRIM(RTRIM(@desc))
          `);
      }

      if (!rs.recordset?.length) {
        return {
          success: false,
          message: `El vendedor '${raw}' no existe (ni por código ni por descripción).`
        };
      }
      if (rs.recordset.length > 1) {
        const sample = rs.recordset.slice(0, 5).map(r => r.ven_Cod).join(', ');
        return {
          success: false,
          message: `La descripción de vendedor '${possibleDesc}' es ambigua. Códigos posibles: ${sample}.`
        };
      }

      // Código final a usar en Clientes.cliven_Cod
      const vendorCode = String(rs.recordset[0].ven_Cod).trim();
      setsNorm.vendedor = vendorCode;
    }

    // ─────────────────────────────
    // Mapeo general de campos → columnas
    // ─────────────────────────────
    const mapCols = {
      // General
      condVta:  'clicvt_Cod',
      provincia:'cliprv_Codigo',
      vendedor: 'cliven_Cod',   // ahora ya normalizado a ven_Cod existente
      tipoCli:  'clitic_Cod',
      lista:    'clidlp_Cod',
      zona:     'clizon_Cod',
      // Impositivos
      iva:   'clisiv_Cod',
      tdoc:  'clitdc_Cod',
      gan:   'clisig_Cod',
      ib:    'clisib_Cod',
      ape:   'cliape_Cod',
      // Otros
      trn:   'clitrn_Cod',
      prov:  'clipro_Cod',
      def1:  'clidc1_Cod',
      def2:  'clidc2_Cod',
    };

    // Build dinámico del SET
    const setPairs = [];
    const inputs = [];

    Object.entries(mapCols).forEach(([key, col]) => {
      const val = setsNorm?.[key];
      if (val != null && val !== '') {
        const pname = `v_${key}`;
        setPairs.push(`c.${col} = @${pname}`);
        inputs.push({ pname, type: sql.VarChar(50), value: String(val) });
      }
    });

    if (setPairs.length === 0) {
      return { success: false, message: 'No hay campos para actualizar en "sets".' };
    }

    const idsCsv = cliCods.map(String).join(',');

    const req = pool.request();
    inputs.forEach(p => req.input(p.pname, p.type, p.value));
    req.input('ids', sql.NVarChar(sql.MAX), idsCsv);
    req.input('fromList', sql.VarChar(20), fromList ? String(fromList) : null);

    // UPDATE final (mismo patrón de antes)
    const q = `
      UPDATE c SET
        ${setPairs.join(',\n        ')}
      FROM Clientes c
      WHERE (@fromList IS NULL OR c.clidlp_Cod = @fromList)
        AND c.cli_Cod IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','));

      SELECT @@ROWCOUNT AS updatedRows;
    `;
    const upd = await req.query(q);

    return { success: true, updatedRows: upd.recordset?.[0]?.updatedRows ?? 0 };
  } catch (e) {
    return { success: false, message: e?.message || 'Error actualizando campos de clientes.' };
  } finally {
    try { await pool?.close(); } catch {}
  }
}




module.exports = {
  // nuevos por solapa
  getCatalogosGeneral,
  getCatalogosImpositivos,
  getCatalogosOtros,
  // agregador (compatibilidad)
  getCatalogos,
  // existentes
  traerTodos,
  traerCodigosLista,
  actualizarLista,
  actualizarCampos,
};
