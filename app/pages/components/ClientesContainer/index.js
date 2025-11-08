"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";

/* ──────────────────────────────
 *  Mini Tabs (3 solapas)
 * ────────────────────────────── */
function Tabs({ tabs = [], value, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.value}
          className={`${styles.tab} ${value === t.value ? styles.tabActive : ""}`}
          onClick={() => onChange(t.value)}
          type="button"
        >
          {t.label}
        </button>
      ))}
      <div className={styles.tabUnderline} />
    </div>
  );
}

/* ──────────────────────────────
 *  Card/Acordeón reusable
 * ────────────────────────────── */
function Accordion({ title, defaultOpen = true, rightAdornment = null, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} onClick={() => setOpen((o) => !o)} type="button">
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

/* Select genérico */
function Combo({ label, value, onChange, options = [], placeholder = "(Todos)" }) {
  return (
    <div className={styles.filterItem}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={styles.select} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </select>
    </div>
  );
}

/* Select de actualización: con checkbox inline en header */
function UpdateField({ checked, onChecked, label, value, onChange, options = [], placeholder = "(seleccionar)" }) {
  return (
    <div className={styles.updateFieldLine}>
      <label className={styles.updateFieldLabel}>
        <input type="checkbox" checked={checked} onChange={(e) => onChecked(e.target.checked)} />
        <span>{label}</span>
      </label>
      <select
        className={styles.select}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!checked}
      >
        <option value="">{placeholder}</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Clientes() {
  /* ===================== base ===================== */
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorCli, setErrorCli] = useState("");

  /* ===================== catálogos ===================== */
  const [cats, setCats] = useState({
    CondVta: [],
    TipCli: [],
    DefListP: [],
    Vendedor: [],
    Zona: [],
    Defi1Cli: [],
    Defi2Cli: [],
    Transporte: [],
    Proveed: [],
    SitIVA: [],
    TipoDocum: [],
    SituGan: [],
    SitIB: [],
    Apertura: [],
    PRV: [],
    Paises: [],
  });

  /* ===================== filtros (por solapa) ===================== */
  const [tabFiltros, setTabFiltros] = useState("general"); // general | impo | otros

  const [fGeneral, setFGeneral] = useState({
    condVta: "",
    provincia: "",
    vendedor: "",
    tipoCli: "",
    lista: "",
    zona: "",
  });

  const [fImpo, setFImpo] = useState({
    iva: "",
    tdoc: "",
    gan: "",
    ib: "",
    ape: "",
  });

  const [fOtros, setFOtros] = useState({
    trn: "",
    prov: "",
    def1: "",
    def2: "",
  });

  const limpiarFiltros = useCallback(() => {
    setFGeneral({ condVta: "", provincia: "", vendedor: "", tipoCli: "", lista: "", zona: "" });
    setFImpo({ iva: "", tdoc: "", gan: "", ib: "", ape: "" });
    setFOtros({ trn: "", prov: "", def1: "", def2: "" });
  }, []);

  /* ===================== selección en grilla ===================== */
  const [selected, setSelected] = useState(() => new Set());
  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      const k = String(id);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }, []);
  const toggleAll = useCallback((ids) => {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids.map(String))));
  }, []);

  /* ===================== actualización (sets) ===================== */
  const [tabUpdate, setTabUpdate] = useState("general");

  const [enabled, setEnabled] = useState({
    condVta: false,
    provincia: false,
    vendedor: false,
    tipoCli: false,
    lista: false,
    zona: false,
    iva: false,
    tdoc: false,
    gan: false,
    ib: false,
    ape: false,
    trn: false,
    prov: false,
    def1: false,
    def2: false,
  });

  const [sets, setSets] = useState({
    condVta: "",
    provincia: "",
    vendedor: "",
    tipoCli: "",
    lista: "",
    zona: "",
    iva: "",
    tdoc: "",
    gan: "",
    ib: "",
    ape: "",
    trn: "",
    prov: "",
    def1: "",
    def2: "",
  });

  const setEn = (k, v) => setEnabled((s) => ({ ...s, [k]: v }));
  const setVal = (k, v) => setSets((s) => ({ ...s, [k]: v }));

  /* ===================== bootstrap ===================== */
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorCli("");
    try {
      const cat = await window?.api?.clientesForm?.getCatalogos?.();
      if (cat?.success) setCats(cat.data || {});

      const li = await window?.api?.clientesForm?.traerTodos?.();
      if (!li?.success) throw new Error(li?.message || "No se pudo cargar Clientes.");
      setClientes(li.data || []);
    } catch (e) {
      setErrorCli(e?.message || "Error cargando datos.");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ===================== filtrado en memoria ===================== */
  const filtrados = useMemo(() => {
    const g = fGeneral || {};
    const i = fImpo || {};
    const o = fOtros || {};

    return (clientes || []).filter((c) => {
      // General
      const okCondVta = !g.condVta || String(c.CodCodicionVenta) === String(g.condVta);
      const okProvincia = !g.provincia || String(c.cliprv_Codigo || c.clipai_Cod || "") === String(g.provincia);
      const okVendedor = !g.vendedor || String(c.CodVendedor) === String(g.vendedor);
      const okTipoCli = !g.tipoCli || String(c.CodTipoCliente) === String(g.tipoCli);
      const okLista = !g.lista || String(c.CodListaPrecio) === String(g.lista);
      const okZona = !g.zona || String(c.CodZona) === String(g.zona);

      // Impositivos
      const okIVA = !i.iva || String(c.clisiv_Cod || "") === String(i.iva);
      const okTdoc = !i.tdoc || String(c.clitdc_Cod || "") === String(i.tdoc);
      const okGan = !i.gan || String(c.clisig_Cod || "") === String(i.gan);
      const okIB = !i.ib || String(c.clisib_Cod || "") === String(i.ib);
      const okApe = !i.ape || String(c.cliape_Cod || "") === String(i.ape);

      // Otros
      const okTrn = !o.trn || String(c.clitrn_Cod || "") === String(o.trn);
      const okProv = !o.prov || String(c.clipro_Cod || "") === String(o.prov);
      const okDef1 = !o.def1 || String(c.clidc1_Cod || "") === String(o.def1);
      const okDef2 = !o.def2 || String(c.clidc2_Cod || "") === String(o.def2);

      return (
        okCondVta &&
        okProvincia &&
        okVendedor &&
        okTipoCli &&
        okLista &&
        okZona &&
        okIVA &&
        okTdoc &&
        okGan &&
        okIB &&
        okApe &&
        okTrn &&
        okProv &&
        okDef1 &&
        okDef2
      );
    });
  }, [clientes, fGeneral, fImpo, fOtros]);

  const allVisibleIds = useMemo(() => (filtrados || []).map((c) => String(c.CodCliente ?? c.cli_cod)), [filtrados]);
  const selectedCount = selected.size;

  /* ===================== aplicar cambios ===================== */
  const [applyMsg, setApplyMsg] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);

  const aplicarCambios = useCallback(async () => {
    setApplyMsg("");

    // Construir sets habilitados
    const payloadSets = {};
    Object.keys(sets).forEach((k) => {
      if (enabled[k] && sets[k] !== "") payloadSets[k] = sets[k];
    });

    if (Object.keys(payloadSets).length === 0) {
      setApplyMsg("Activá al menos un campo e indicó su nuevo valor.");
      return;
    }

    const cliCods = Array.from(selected);
    if (cliCods.length === 0) {
      setApplyMsg("Seleccioná al menos un cliente en la grilla.");
      return;
    }

    try {
      setApplyBusy(true);
      const fromList = fGeneral.lista || null; // restringe a 'Lista actual' si querés
      const r = await window?.api?.clientesForm?.actualizarCampos?.({
        cliCods,
        sets: payloadSets,
        fromList,
      });

      if (r?.success) {
        setApplyMsg(`✔ Se actualizaron ${r.updatedRows ?? 0} cliente(s).`);
        setSelected(new Set());
        await loadData();
      } else {
        setApplyMsg(r?.message || "No se pudo actualizar.");
      }
    } catch (e) {
      setApplyMsg(e?.message || "Error al actualizar.");
    } finally {
      setApplyBusy(false);
    }
  }, [enabled, sets, selected, fGeneral.lista, loadData]);

  /* ===================== render ===================== */
  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador Clientes</h2>
        <EmpresaSelected />
      </div>

      {/* 1) FILTROS */}
      <Accordion
        title="FILTROS"
        defaultOpen={true}
        rightAdornment={
          <button className={styles.smallBtn} onClick={(e) => { e.stopPropagation(); limpiarFiltros(); }} type="button">
            Limpiar
          </button>
        }
      >
        <Tabs
          tabs={[
            { value: "general", label: "General" },
            { value: "impo", label: "Datos impositivos" },
            { value: "otros", label: "Otros datos" },
          ]}
          value={tabFiltros}
          onChange={setTabFiltros}
        />

        {/* General */}
        {tabFiltros === "general" && (
          <div className={styles.filtersBar}>
            <div className={`${styles.filterItem} ${styles.filterFull}`}>
              <label className={styles.label}>Lista actual</label>
              <select
                className={styles.select}
                value={fGeneral.lista}
                onChange={(e) => setFGeneral((s) => ({ ...s, lista: e.target.value }))}
              >
                <option value="">(Todas)</option>
                {(cats.DefListP || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <Combo label="Condición Venta" value={fGeneral.condVta} onChange={(v) => setFGeneral((s) => ({ ...s, condVta: v }))} options={cats.CondVta} />
            <Combo label="Provincia" value={fGeneral.provincia} onChange={(v) => setFGeneral((s) => ({ ...s, provincia: v }))} options={cats.PRV?.length ? cats.PRV : cats.Paises} />
            <Combo label="Vendedor" value={fGeneral.vendedor} onChange={(v) => setFGeneral((s) => ({ ...s, vendedor: v }))} options={cats.Vendedor} />
            <Combo label="Tipo Cliente" value={fGeneral.tipoCli} onChange={(v) => setFGeneral((s) => ({ ...s, tipoCli: v }))} options={cats.TipCli} />
            <Combo label="Zona" value={fGeneral.zona} onChange={(v) => setFGeneral((s) => ({ ...s, zona: v }))} options={cats.Zona} />
          </div>
        )}

        {/* Impositivos */}
        {tabFiltros === "impo" && (
          <div className={styles.filtersBar}>
            <Combo label="Situación IVA" value={fImpo.iva} onChange={(v) => setFImpo((s) => ({ ...s, iva: v }))} options={cats.SitIVA} />
            <Combo label="Tipo Documento" value={fImpo.tdoc} onChange={(v) => setFImpo((s) => ({ ...s, tdoc: v }))} options={cats.TipoDocum} />
            <Combo label="Ganancias" value={fImpo.gan} onChange={(v) => setFImpo((s) => ({ ...s, gan: v }))} options={cats.SituGan} />
            <Combo label="Ingresos Brutos" value={fImpo.ib} onChange={(v) => setFImpo((s) => ({ ...s, ib: v }))} options={cats.SitIB} />
            <Combo label="Apertura Contable" value={fImpo.ape} onChange={(v) => setFImpo((s) => ({ ...s, ape: v }))} options={cats.Apertura} />
          </div>
        )}

        {/* Otros */}
        {tabFiltros === "otros" && (
          <div className={styles.filtersBar}>
            <Combo label="Transporte" value={fOtros.trn} onChange={(v) => setFOtros((s) => ({ ...s, trn: v }))} options={cats.Transporte} />
            <Combo label="Proveedor" value={fOtros.prov} onChange={(v) => setFOtros((s) => ({ ...s, prov: v }))} options={cats.Proveed} />
            <Combo label="Ordenamiento 1" value={fOtros.def1} onChange={(v) => setFOtros((s) => ({ ...s, def1: v }))} options={cats.Defi1Cli} />
            <Combo label="Ordenamiento 2" value={fOtros.def2} onChange={(v) => setFOtros((s) => ({ ...s, def2: v }))} options={cats.Defi2Cli} />
          </div>
        )}

        <div className={styles.summaryLine}>
          {loading ? (
            "Cargando clientes…"
          ) : (
            <>
              Total: {clientes.length} | Filtrados: <strong>{filtrados.length}</strong>
              {fGeneral.lista && <> | Lista actual: {fGeneral.lista}</>}
            </>
          )}
          {!!errorCli && <span className={styles.errorText}> · {errorCli}</span>}
        </div>
      </Accordion>

      {/* 2) CONTENEDOR (grilla) */}
      <Accordion title="CONTENEDOR" defaultOpen={true}>
        <div className={styles.tableContainer /* height resizable via CSS que ya tenés */}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th className={styles.checkCell}>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={selected.size > 0 && selected.size === allVisibleIds.length && allVisibleIds.length > 0}
                    onChange={() => toggleAll(allVisibleIds)}
                  />
                </th>
                <th>Cliente</th>
                <th>Razón Social</th>
                <th>Zona</th>
                <th>Vendedor</th>
                <th>Tipo</th>
                <th>Lista</th>
              </tr>
            </thead>
            <tbody>
              {!filtrados.length ? (
                <tr>
                  <td colSpan={7} className={styles.noResults}>
                    {loading ? "Cargando…" : "Sin resultados"}
                  </td>
                </tr>
              ) : (
                filtrados.slice(0, 2000).map((c, i) => {
                  const id = String(c.CodCliente ?? c.cli_cod);
                  const isChecked = selected.has(id);
                  return (
                    <tr key={`${id}-${i}`} className={styles.row}>
                      <td className={styles.checkCell}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleOne(id)} aria-label={`Sel ${id}`} />
                      </td>
                      <td>{c.CodCliente}</td>
                      <td>{c.RazonSocial}</td>
                      <td>{c.CodZona} - {c.Zona || ""}</td>
                      <td>{c.CodVendedor} - {c.Vendedor || ""}</td>
                      <td>{c.CodTipoCliente} - {c.TipoCliente || ""}</td>
                      <td>{c.CodListaPrecio} - {c.ListaPrecio || ""}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Accordion>

      {/* 3) CAMPOS A ACTUALIZAR */}
      <Accordion title="CAMPOS A ACTUALIZAR" defaultOpen={true}>
        <Tabs
          tabs={[
            { value: "general", label: "General" },
            { value: "impo", label: "Datos impositivos" },
            { value: "otros", label: "Otros datos" },
          ]}
          value={tabUpdate}
          onChange={setTabUpdate}
        />

        {tabUpdate === "general" && (
          <div className={styles.updateGrid}>
            <UpdateField label="Condición Venta" checked={enabled.condVta} onChecked={(v) => setEn("condVta", v)} value={sets.condVta} onChange={(v) => setVal("condVta", v)} options={cats.CondVta} />
            <UpdateField label="Provincia" checked={enabled.provincia} onChecked={(v) => setEn("provincia", v)} value={sets.provincia} onChange={(v) => setVal("provincia", v)} options={cats.PRV?.length ? cats.PRV : cats.Paises} />
            <UpdateField label="Vendedor" checked={enabled.vendedor} onChecked={(v) => setEn("vendedor", v)} value={sets.vendedor} onChange={(v) => setVal("vendedor", v)} options={cats.Vendedor} />
            <UpdateField label="Tipo Cliente" checked={enabled.tipoCli} onChecked={(v) => setEn("tipoCli", v)} value={sets.tipoCli} onChange={(v) => setVal("tipoCli", v)} options={cats.TipCli} />
            <UpdateField label="Lista Precios" checked={enabled.lista} onChecked={(v) => setEn("lista", v)} value={sets.lista} onChange={(v) => setVal("lista", v)} options={cats.DefListP} />
            <UpdateField label="Zona" checked={enabled.zona} onChecked={(v) => setEn("zona", v)} value={sets.zona} onChange={(v) => setVal("zona", v)} options={cats.Zona} />
          </div>
        )}

        {tabUpdate === "impo" && (
          <div className={styles.updateGrid}>
            <UpdateField label="Situación IVA" checked={enabled.iva} onChecked={(v) => setEn("iva", v)} value={sets.iva} onChange={(v) => setVal("iva", v)} options={cats.SitIVA} />
            <UpdateField label="Tipo Documento" checked={enabled.tdoc} onChecked={(v) => setEn("tdoc", v)} value={sets.tdoc} onChange={(v) => setVal("tdoc", v)} options={cats.TipoDocum} />
            <UpdateField label="Ganancias" checked={enabled.gan} onChecked={(v) => setEn("gan", v)} value={sets.gan} onChange={(v) => setVal("gan", v)} options={cats.SituGan} />
            <UpdateField label="Ingresos Brutos" checked={enabled.ib} onChecked={(v) => setEn("ib", v)} value={sets.ib} onChange={(v) => setVal("ib", v)} options={cats.SitIB} />
            <UpdateField label="Apertura Contable" checked={enabled.ape} onChecked={(v) => setEn("ape", v)} value={sets.ape} onChange={(v) => setVal("ape", v)} options={cats.Apertura} />
          </div>
        )}

        {tabUpdate === "otros" && (
          <div className={styles.updateGrid}>
            <UpdateField label="Transporte" checked={enabled.trn} onChecked={(v) => setEn("trn", v)} value={sets.trn} onChange={(v) => setVal("trn", v)} options={cats.Transporte} />
            <UpdateField label="Proveedor" checked={enabled.prov} onChecked={(v) => setEn("prov", v)} value={sets.prov} onChange={(v) => setVal("prov", v)} options={cats.Proveed} />
            <UpdateField label="Ordenamiento 1" checked={enabled.def1} onChecked={(v) => setEn("def1", v)} value={sets.def1} onChange={(v) => setVal("def1", v)} options={cats.Defi1Cli} />
            <UpdateField label="Ordenamiento 2" checked={enabled.def2} onChecked={(v) => setEn("def2", v)} value={sets.def2} onChange={(v) => setVal("def2", v)} options={cats.Defi2Cli} />
          </div>
        )}
      </Accordion>

      {/* Botón de aplicar */}
      <div className={styles.footerBar}>
        {applyMsg && (
          <p className={`${styles.footerMsg} ${applyMsg.startsWith("✔") ? styles.ok : styles.error}`}>{applyMsg}</p>
        )}
        <button
          className={styles.btnAccentFull}
          disabled={applyBusy || selectedCount === 0}
          onClick={aplicarCambios}
          type="button"
        >
          {applyBusy ? "Aplicando…" : `Aplicar a ${selectedCount} cliente(s)`}
        </button>
      </div>
    </div>
  );
}
