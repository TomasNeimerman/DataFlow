"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";
import PaginationBar from "../PaginationBar";

/** Acordeón simple */
function Accordion({ title, defaultOpen = true, rightAdornment = null, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} onClick={() => setOpen((o) => !o)}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardHeaderRight}>
          {rightAdornment}
          <span className={`${styles.chev} ${open ? styles.chevOpen : ""}`}>▾</span>
        </span>
      </button>
      {open && <div className={styles.cardBody}>{children}</div>}
    </div>
  );
}

/** Mini-tabs (solapas) */
function SubTabs({ active, onChange, tabs }) {
  return (
    <div className={styles.subTabs}>
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`${styles.subTab} ${active === t.key ? styles.subTabActive : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function Proveedores() {
  // ===== dataset =====
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorPro, setErrorPro] = useState("");

  // ===== catálogos (cargados por solapa) =====
  const [catalogos, setCatalogos] = useState({
    // General
    CondPago: [],
    PRV: [],
    Paises: [],
    // Impositivos
    SitIVA: [],
    TipoDocum: [],
    SituGan: [],
    SitIB: [],
    Apertura: [],
    // Otros
    Defi1Cli: [],
    Defi2Cli: [],
  });

  const [catGeneralLoaded, setCatGeneralLoaded] = useState(false);
  const [catImpoLoaded, setCatImpoLoaded] = useState(false);
  const [catOtrosLoaded, setCatOtrosLoaded] = useState(false);

  // ===== filtros (por solapas) =====
  const [fTab, setFTab] = useState("general"); // general | impo | otros

  // General
  const [fCondPago, setFCondPago] = useState("");
  const [fProvincia, setFProvincia] = useState("");
  const [fPais, setFPais] = useState("");

  // Impositivos
  const [fIVA, setFIVA] = useState("");
  const [fTipoDoc, setFTipoDoc] = useState("");
  const [fGan, setFGan] = useState("");
  const [fIB, setFIB] = useState("");
  const [fApe, setFApe] = useState("");

  // Otros
  const [fOrd1, setFOrd1] = useState("");
  const [fOrd2, setFOrd2] = useState("");

  // ===== selección manual =====
  const [selectedPro, setSelectedPro] = useState(() => new Set());
  const selectedCount = selectedPro.size;

  // ===== paginación =====
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const toggleOne = useCallback((id) => {
    setSelectedPro((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const toggleAll = useCallback((ids) => {
    setSelectedPro((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  // ===== campos a actualizar (UI) =====
  const [uTab, setUTab] = useState("general"); // general | impo | otros

  // General
  const [updCondPago, setUpdCondPago] = useState({ enabled: false, value: "" });
  const [updProvincia, setUpdProvincia] = useState({ enabled: false, value: "" });
  const [updPais, setUpdPais] = useState({ enabled: false, value: "" });

  // Impositivos
  const [updIVA, setUpdIVA] = useState({ enabled: false, value: "" });
  const [updTipoDoc, setUpdTipoDoc] = useState({ enabled: false, value: "" });
  const [updGan, setUpdGan] = useState({ enabled: false, value: "" });
  const [updIB, setUpdIB] = useState({ enabled: false, value: "" });
  const [updApe, setUpdApe] = useState({ enabled: false, value: "" });

  // Otros
  const [updOrd1, setUpdOrd1] = useState({ enabled: false, value: "" });
  const [updOrd2, setUpdOrd2] = useState({ enabled: false, value: "" });

  // mensajes / aplicar
  const [applyMsg, setApplyMsg] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);

  // ===== helpers de carga =====
  const loadProveedores = useCallback(async () => {
    setLoading(true);
    setErrorPro("");
    setProveedores([]);
    try {
      // Preferimos proveedoresForm; igual tenés back-compat si cae a clientesForm
      const api = window?.api?.proveedoresForm || window?.api?.clientesForm;
      const r = await api?.traerTodos?.();
      if (!r?.success) throw new Error(r?.message || "No se pudo cargar Proveedores.");
      setProveedores(r.data || []);
    } catch (e) {
      setErrorPro(e?.message || "Error cargando Proveedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogosGeneral = useCallback(async () => {
    try {
      const api = window?.api?.proveedoresForm || window?.api?.clientesForm;
      const res = await api?.getCatalogosGeneral?.();
      if (res?.success) {
        setCatalogos((prev) => ({ ...prev, ...(res.data || {}) }));
        setCatGeneralLoaded(true);
        return true;
      }
      const all = await api?.getCatalogos?.();
      if (all?.success) {
        const d = all.data || {};
        setCatalogos((prev) => ({
          ...prev,
          CondPago: d.CondPago || [],
          PRV: d.PRV || [],
          Paises: d.Paises || [],
        }));
        setCatGeneralLoaded(true);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadCatalogosImpo = useCallback(async () => {
    try {
      const api = window?.api?.proveedoresForm || window?.api?.clientesForm;
      const res = await api?.getCatalogosImpositivos?.();
      if (res?.success) {
        setCatalogos((prev) => ({ ...prev, ...(res.data || {}) }));
        setCatImpoLoaded(true);
        return true;
      }
      const all = await api?.getCatalogos?.();
      if (all?.success) {
        const d = all.data || {};
        setCatalogos((prev) => ({
          ...prev,
          SitIVA: d.SitIVA || [],
          TipoDocum: d.TipoDocum || [],
          SituGan: d.SituGan || [],
          SitIB: d.SitIB || [],
          Apertura: d.Apertura || [],
        }));
        setCatImpoLoaded(true);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadCatalogosOtros = useCallback(async () => {
    try {
      const api = window?.api?.proveedoresForm || window?.api?.clientesForm;
      const res = await api?.getCatalogosOtros?.();
      if (res?.success) {
        setCatalogos((prev) => ({ ...prev, ...(res.data || {}) }));
        setCatOtrosLoaded(true);
        return true;
      }
      const all = await api?.getCatalogos?.();
      if (all?.success) {
        const d = all.data || {};
        setCatalogos((prev) => ({
          ...prev,
          Defi1Cli: d.Defi1Cli || [],
          Defi2Cli: d.Defi2Cli || [],
        }));
        setCatOtrosLoaded(true);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ===== efectos de carga =====
  useEffect(() => {
    loadProveedores();
  }, [loadProveedores]);

  useEffect(() => {
    if (!catGeneralLoaded) loadCatalogosGeneral();
  }, [catGeneralLoaded, loadCatalogosGeneral]);

  useEffect(() => {
    if (fTab === "impo" && !catImpoLoaded) loadCatalogosImpo();
    if (fTab === "otros" && !catOtrosLoaded) loadCatalogosOtros();
  }, [fTab, catImpoLoaded, catOtrosLoaded, loadCatalogosImpo, loadCatalogosOtros]);

  // ===== opciones helper =====
  const opts = useMemo(
    () => ({
      // General
      condPago: catalogos.CondPago || [],
      provincias: catalogos.PRV || [],
      paises: catalogos.Paises || [],
      // Impositivos
      iva: catalogos.SitIVA || [],
      tdoc: catalogos.TipoDocum || [],
      gan: catalogos.SituGan || [],
      ib: catalogos.SitIB || [],
      ape: catalogos.Apertura || [],
      // Otros
      ord1: catalogos.Defi1Cli || [],
      ord2: catalogos.Defi2Cli || [],
    }),
    [catalogos]
  );

  // ===== aplicar filtros =====
  const filtrados = useMemo(() => {
    const eq = (v, x) => !v || String(x ?? "") === String(v);

    return (proveedores || []).filter((p) => {
      return (
        // General
        eq(fCondPago, p.CodCondicionPago) &&
        eq(fProvincia, p.Provincia) &&
        eq(fPais, p.Pais) &&
        // Impositivos
        eq(fIVA, p.SituacionIVA) &&
        eq(fTipoDoc, p.TipodeDocumento) &&
        eq(fGan, p.Ganancias) &&
        eq(fIB, p.IngresosBrutos) &&
        eq(fApe, p.Apertura) &&
        // Otros
        eq(fOrd1, p["Ordenamiento 1"]) &&
        eq(fOrd2, p["Ordenamiento 2"])
      );
    });
  }, [proveedores, fCondPago, fProvincia, fPais, fIVA, fTipoDoc, fGan, fIB, fApe, fOrd1, fOrd2]);

  // Paginación de datos filtrados
  const paginatedProveedores = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtrados.slice(start, end);
  }, [filtrados, page, pageSize]);

  // ids visibles en la página actual (para seleccionar todos)
  const visibleIds = useMemo(
    () => (paginatedProveedores || []).map((p) => String(p.CodProveedor)),
    [paginatedProveedores]
  );

  // ===== limpiar filtros =====
  const limpiarFiltros = useCallback(() => {
    setFCondPago("");
    setFProvincia("");
    setFPais("");
    setFIVA("");
    setFTipoDoc("");
    setFGan("");
    setFIB("");
    setFApe("");
    setFOrd1("");
    setFOrd2("");
    setPage(1); // Reset a la primera página
  }, []);

  // Handlers de paginación
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  // ===== aplicar cambios =====
  const aplicarCambios = useCallback(async () => {
    setApplyMsg("");

    const proCods = Array.from(selectedPro);
    if (proCods.length === 0) {
      setApplyMsg("Seleccioná al menos un proveedor de la grilla.");
      return;
    }

    const sets = {
      // General
      condPago:  updCondPago.enabled ? updCondPago.value : null,
      provincia: updProvincia.enabled ? updProvincia.value : null,
      pais:      updPais.enabled ? updPais.value : null,

      // Impositivos
      iva:  updIVA.enabled ? updIVA.value : null,
      tdoc: updTipoDoc.enabled ? updTipoDoc.value : null,
      gan:  updGan.enabled ? updGan.value : null,
      ib:   updIB.enabled ? updIB.value : null,
      ape:  updApe.enabled ? updApe.value : null,

      // Otros
      orden1: updOrd1.enabled ? updOrd1.value : null,
      orden2: updOrd2.enabled ? updOrd2.value : null,
    };

    const compactSets = Object.fromEntries(Object.entries(sets).filter(([, v]) => v != null && v !== ""));
    if (!Object.keys(compactSets).length) {
      setApplyMsg("Activá y elegí al menos un campo para actualizar.");
      return;
    }

    try {
      setApplyBusy(true);
      const api = window?.api?.proveedoresForm || window?.api?.clientesForm;
      const payload = { proCods, sets: compactSets };
      const r = await api?.actualizarCampos?.(payload);

      if (r?.success) {
        setApplyMsg(`✔ Se actualizaron ${r.updatedRows ?? 0} proveedor(es).`);
        setSelectedPro(new Set());
        await loadProveedores();
      } else {
        setApplyMsg(r?.message || "No se pudo aplicar el cambio.");
      }
    } catch (e) {
      setApplyMsg(e?.message || "Error al aplicar cambios.");
    } finally {
      setApplyBusy(false);
    }
  }, [
    selectedPro,
    loadProveedores,
    updCondPago,
    updProvincia,
    updPais,
    updIVA,
    updTipoDoc,
    updGan,
    updIB,
    updApe,
    updOrd1,
    updOrd2,
  ]);

  // ======= render =======
  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Proveedores</h2>
        <EmpresaSelected />
      </div>

      {/* FILTROS */}
      <Accordion
        title="FILTROS"
        rightAdornment={
          <button
            className={styles.smallBtn}
            onClick={(e) => {
              e.stopPropagation();
              limpiarFiltros();
            }}
          >
            Limpiar
          </button>
        }
      >
        <SubTabs
          active={fTab}
          onChange={setFTab}
          tabs={[
            { key: "general", label: "General" },
            { key: "impo", label: "Datos impositivos" },
            { key: "otros", label: "Otros datos" },
          ]}
        />

        {fTab === "general" && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Condición de Pago</label>
              <select className={styles.select} value={fCondPago} onChange={(e) => setFCondPago(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.condPago.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Provincia</label>
              <select className={styles.select} value={fProvincia} onChange={(e) => setFProvincia(e.target.value)}>
                <option value="">(Todas)</option>
                {(opts.provincias || []).map((o) => (
                  <option key={o.value || o.label} value={o.value || o.label}>
                    {o.label || o.value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>País</label>
              <select className={styles.select} value={fPais} onChange={(e) => setFPais(e.target.value)}>
                <option value="">(Todos)</option>
                {(opts.paises || []).map((o) => (
                  <option key={o.value || o.label} value={o.value || o.label}>
                    {o.label || o.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {fTab === "impo" && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Situación IVA</label>
              <select className={styles.select} value={fIVA} onChange={(e) => setFIVA(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.iva.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Tipo Documento</label>
              <select className={styles.select} value={fTipoDoc} onChange={(e) => setFTipoDoc(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.tdoc.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ganancias</label>
              <select className={styles.select} value={fGan} onChange={(e) => setFGan(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.gan.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ingresos Brutos</label>
              <select className={styles.select} value={fIB} onChange={(e) => setFIB(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.ib.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Apertura</label>
              <select className={styles.select} value={fApe} onChange={(e) => setFApe(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.ape.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {fTab === "otros" && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Ordenamiento 1</label>
              <select className={styles.select} value={fOrd1} onChange={(e) => setFOrd1(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.ord1.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ordenamiento 2</label>
              <select className={styles.select} value={fOrd2} onChange={(e) => setFOrd2(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.ord2.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className={styles.summaryLine}>
          {loading ? (
            "Cargando proveedores…"
          ) : (
            <>
              Total: {proveedores.length} | Filtrados: <strong>{filtrados.length}</strong>
            </>
          )}
          {!!errorPro && <span className={styles.errorText}> · {errorPro}</span>}
        </div>
      </Accordion>

      {/* CONTENEDOR */}
      <Accordion title="CONTENEDOR" defaultOpen={true}>
        <div className={styles.resizableArea}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.headerRow}>
                  <th className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={selectedCount === visibleIds.length && visibleIds.length > 0}
                      onChange={() => toggleAll(visibleIds)}
                    />
                  </th>
                  <th>Proveedor</th>
                  <th>Razón Social</th>
                  <th>Dirección</th>
                  <th>Localidad</th>
                  <th>CP</th>
                  <th>Cond. Pago</th>
                  <th>Provincia</th>
                  <th>País</th>
                </tr>
              </thead>
              <tbody>
                {!filtrados.length ? (
                  <tr>
                    <td colSpan={9} className={styles.noResults}>
                      {loading ? "Cargando…" : "Sin resultados"}
                    </td>
                  </tr>
                ) : (
                  paginatedProveedores.map((p, i) => {
                    const id = String(p.CodProveedor);
                    const checked = selectedPro.has(id);

                    return (
                      <tr key={`${id}-${i}`} className={styles.row}>
                        <td className={styles.checkCell}>
                          <input type="checkbox" checked={checked} onChange={() => toggleOne(id)} />
                        </td>
                        <td>{p.CodProveedor}</td>
                        <td>{p.RazonSocial}</td>
                        <td>{p.Direccion}</td>
                        <td>{p.Localidad}</td>
                        <td>{p.CodigoPostal}</td>
                        <td>{`${p.CodCondicionPago ?? ""}${p.CondicionPago ? " - " + p.CondicionPago : ""}`}</td>
                        <td>{p.Provincia}</td>
                        <td>{p.Pais}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.resizeHandle} />
        </div>

        <PaginationBar
          totalRows={filtrados.length}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[15, 30, 60, 90, 120]}
          labels={{ items: "proveedores" }}
        />
      </Accordion>

      {/* CAMPOS A ACTUALIZAR */}
      <Accordion title="CAMPOS A ACTUALIZAR" defaultOpen={true}>
        <SubTabs
          active={uTab}
          onChange={setUTab}
          tabs={[
            { key: "general", label: "General" },
            { key: "impo", label: "Datos impositivos" },
            { key: "otros", label: "Otros datos" },
          ]}
        />

        {uTab === "general" && (
          <div className={styles.updateGrid}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input
                  type="checkbox"
                  checked={updCondPago.enabled}
                  onChange={(e) => setUpdCondPago((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <span>Condición de Pago</span>
              </label>
              <select
                className={styles.select}
                disabled={!updCondPago.enabled}
                value={updCondPago.value}
                onChange={(e) => setUpdCondPago((s) => ({ ...s, value: e.target.value }))}
              >
                <option value="">(seleccionar)</option>
                {opts.condPago.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input
                  type="checkbox"
                  checked={updProvincia.enabled}
                  onChange={(e) => setUpdProvincia((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <span>Provincia</span>
              </label>
              <select
                className={styles.select}
                disabled={!updProvincia.enabled}
                value={updProvincia.value}
                onChange={(e) => setUpdProvincia((s) => ({ ...s, value: e.target.value }))}
              >
                <option value="">(seleccionar)</option>
                {(opts.provincias || []).map((o) => (
                  <option key={o.value || o.label} value={o.value || o.label}>
                    {o.label || o.value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input
                  type="checkbox"
                  checked={updPais.enabled}
                  onChange={(e) => setUpdPais((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <span>País</span>
              </label>
              <select
                className={styles.select}
                disabled={!updPais.enabled}
                value={updPais.value}
                onChange={(e) => setUpdPais((s) => ({ ...s, value: e.target.value }))}
              >
                <option value="">(seleccionar)</option>
                {(opts.paises || []).map((o) => (
                  <option key={o.value || o.label} value={o.value || o.label}>
                    {o.label || o.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {uTab === "impo" && (
          <div className={styles.updateGrid}>
            {[
              { state: updIVA, set: setUpdIVA, label: "Situación IVA", list: opts.iva },
              { state: updTipoDoc, set: setUpdTipoDoc, label: "Tipo Documento", list: opts.tdoc },
              { state: updGan, set: setUpdGan, label: "Ganancias", list: opts.gan },
              { state: updIB, set: setUpdIB, label: "Ingresos Brutos", list: opts.ib },
              { state: updApe, set: setUpdApe, label: "Apertura", list: opts.ape },
            ].map(({ state, set, label, list }) => (
              <div className={styles.fieldRow} key={label}>
                <label className={styles.fieldLabel}>
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={(e) => set((s) => ({ ...s, enabled: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
                <select
                  className={styles.select}
                  disabled={!state.enabled}
                  value={state.value}
                  onChange={(e) => set((s) => ({ ...s, value: e.target.value }))}
                >
                  <option value="">(seleccionar)</option>
                  {(list || []).map((o) => (
                    <option key={o.value || o.label} value={o.value || o.label}>
                      {o.label || o.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {uTab === "otros" && (
          <div className={styles.updateGrid}>
            {[
              { state: updOrd1, set: setUpdOrd1, label: "Ordenamiento 1", list: opts.ord1 },
              { state: updOrd2, set: setUpdOrd2, label: "Ordenamiento 2", list: opts.ord2 },
            ].map(({ state, set, label, list }) => (
              <div className={styles.fieldRow} key={label}>
                <label className={styles.fieldLabel}>
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={(e) => set((s) => ({ ...s, enabled: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
                <select
                  className={styles.select}
                  disabled={!state.enabled}
                  value={state.value}
                  onChange={(e) => set((s) => ({ ...s, value: e.target.value }))}
                >
                  <option value="">(seleccionar)</option>
                  {(list || []).map((o) => (
                    <option key={o.value || o.label} value={o.value || o.label}>
                      {o.label || o.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Accordion>

      {/* APLICAR */}
      <div className={styles.footerBar}>
        {applyMsg && (
          <p className={`${styles.footerMsg} ${applyMsg.startsWith("✔") ? styles.ok : styles.error}`}>
            {applyMsg}
          </p>
        )}
        <button className={styles.btnAccentFull} disabled={applyBusy || selectedCount === 0} onClick={aplicarCambios}>
          {applyBusy ? "Aplicando…" : `Aplicar a ${selectedCount} proveedor(es)`}
        </button>
      </div>
    </div>
  );
}
