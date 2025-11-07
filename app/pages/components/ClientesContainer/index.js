"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";

/** Acordeón simple */
function Accordion({ title, defaultOpen = true, rightAdornment = null, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} onClick={() => setOpen(o => !o)}>
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

/** Mini-tabs (solapas) reusables: General / Impositivos / Otros */
function SubTabs({ active, onChange, tabs }) {
  return (
    <div className={styles.subTabs}>
      {tabs.map(t => (
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

export default function Clientes() {
  // ===== dataset =====
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorCli, setErrorCli] = useState("");

  // ===== catálogos (tablas relacionadas) =====
  const [catalogos, setCatalogos] = useState({
    CondVta: [], TipCli: [], DefListP: [], Vendedor: [], Zona: [],
    PRV: [], Paises: [], Defi1Cli: [], Defi2Cli: [], Transporte: [], Proveed: [],
    SitIVA: [], TipoDocum: [], SituGan: [], SitIB: [], Apertura: [],
  });

  // ===== filtros (por solapas) =====
  const [fTab, setFTab] = useState("general"); // general | impo | otros

  // General
  const [fCondVta, setFCondVta] = useState("");
  const [fProvincia, setFProvincia] = useState(""); // (si hay código disponible)
  const [fVendedor, setFVendedor] = useState("");
  const [fTipoCli, setFTipoCli] = useState("");
  const [fLista, setFLista] = useState("");
  const [fZona, setFZona] = useState("");

  // Impositivos
  const [fIVA, setFIVA] = useState("");
  const [fTipoDoc, setFTipoDoc] = useState("");
  const [fGan, setFGan] = useState("");
  const [fIB, setFIB] = useState("");
  const [fApe, setFApe] = useState("");

  // Otros
  const [fTrn, setFTrn] = useState("");
  const [fProv, setFProv] = useState(""); // proveedor
  const [fDef1, setFDef1] = useState("");
  const [fDef2, setFDef2] = useState("");

  // ===== selección manual de clientes =====
  const [selectionMode, setSelectionMode] = useState(true);
  const [selectedCli, setSelectedCli] = useState(() => new Set());
  const selectedCount = selectedCli.size;

  const toggleOne = useCallback((id) => {
    setSelectedCli(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const toggleAll = useCallback((ids) => {
    setSelectedCli(prev => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  // ===== campos a actualizar (UI) =====
  const [uTab, setUTab] = useState("general"); // general | impo | otros
  const [updLP, setUpdLP] = useState({ enabled: false, value: "" });
  const [updCondVta, setUpdCondVta] = useState({ enabled: false, value: "" });
  const [updProvincia, setUpdProvincia] = useState({ enabled: false, value: "" });
  const [updVendedor, setUpdVendedor] = useState({ enabled: false, value: "" });
  const [updTipoCli, setUpdTipoCli] = useState({ enabled: false, value: "" });
  const [updZona, setUpdZona] = useState({ enabled: false, value: "" });

  const [updIVA, setUpdIVA] = useState({ enabled: false, value: "" });
  const [updTipoDoc, setUpdTipoDoc] = useState({ enabled: false, value: "" });
  const [updGan, setUpdGan] = useState({ enabled: false, value: "" });
  const [updIB, setUpdIB] = useState({ enabled: false, value: "" });
  const [updApe, setUpdApe] = useState({ enabled: false, value: "" });

  const [updTrn, setUpdTrn] = useState({ enabled: false, value: "" });
  const [updProv, setUpdProv] = useState({ enabled: false, value: "" });
  const [updDef1, setUpdDef1] = useState({ enabled: false, value: "" });
  const [updDef2, setUpdDef2] = useState({ enabled: false, value: "" });

  // mensajes / aplicar
  const [applyMsg, setApplyMsg] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);

  // ===== cargar clientes =====
  const loadClientes = useCallback(async () => {
    setLoading(true); setErrorCli(""); setClientes([]);
    try {
      // firma acordada: clientesForm.traerTodos()
      let r = await window?.api?.clientesForm?.traerTodos?.();
      if (!r?.success) throw new Error(r?.message || "No se pudo cargar Clientes.");
      setClientes(r.data || []);
    } catch (e) {
      setErrorCli(e?.message || "Error cargando Clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== cargar catálogos =====
  useEffect(() => { loadClientes(); }, [loadClientes]);

  useEffect(() => {
    (async () => {
      try {
        // Si existe getCatalogos del preload (ideal)
        const res = await window?.api?.clientesForm?.getCatalogos?.();
        if (res?.success) { setCatalogos({ ...catalogos, ...(res.data || {}) }); return; }
      } catch {}

      // Fallback: derivar de los clientes cargados
      const toOpt = (codeKey, descKey) => {
        const S = new Map();
        (clientes || []).forEach(c => {
          const cod = String(c[codeKey] ?? "").trim();
          const des = String(c[descKey] ?? "").trim();
          if (cod) S.set(cod, des ? `${cod} - ${des}` : cod);
        });
        return Array.from(S, ([value, label]) => ({ value, label }));
      };

      setCatalogos(prev => ({
        ...prev,
        CondVta: toOpt("CodCodicionVenta", "CondicionVenta"),
        TipCli: toOpt("CodTipoCliente", "TipoCliente"),
        DefListP: toOpt("CodListaPrecio", "ListaPrecio"),
        Vendedor: toOpt("CodVendedor", "Vendedor"),
        Zona: toOpt("CodZona", "Zona"),
        // el resto puede venir vacío si no existe en dataset
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  // ===== opciones helper =====
  const opts = useMemo(() => ({
    listas: catalogos.DefListP,
    vendedores: catalogos.Vendedor,
    tiposCli: catalogos.TipCli,
    zonas: catalogos.Zona,
    condVta: catalogos.CondVta,
    provincias: (catalogos.PRV?.length ? catalogos.PRV : catalogos.Paises) || [],
    defi1: catalogos.Defi1Cli,
    defi2: catalogos.Defi2Cli,
    transporte: catalogos.Transporte,
    proveedores: catalogos.Proveed,
    iva: catalogos.SitIVA,
    tdoc: catalogos.TipoDocum,
    gan: catalogos.SituGan,
    ib: catalogos.SitIB,
    ape: catalogos.Apertura,
  }), [catalogos]);

  // ===== aplicar filtros =====
  const filtrados = useMemo(() => {
    const f = (c) => {
      const eq = (v, x) => !v || String(x ?? "") === String(v);
      return (
        // General
        eq(fCondVta, c.CodCodicionVenta) &&
        eq(fProvincia, c.CodProvincia ?? c.cliprv_Codigo ?? c.clipai_Cod) &&
        eq(fVendedor, c.CodVendedor) &&
        eq(fTipoCli, c.CodTipoCliente ?? c.clitic_Cod) &&
        eq(fLista, c.CodListaPrecio ?? c.clidlp_Cod) &&
        eq(fZona, c.CodZona ?? c.clizon_Cod) &&

        // Impositivos
        eq(fIVA, c.clisiv_Cod) &&
        eq(fTipoDoc, c.clitdc_Cod) &&
        eq(fGan, c.clisig_Cod) &&
        eq(fIB, c.clisib_Cod) &&
        eq(fApe, c.cliape_Cod) &&

        // Otros
        eq(fTrn, c.clitrn_Cod) &&
        eq(fProv, c.clipro_Cod ?? c.clipro_cod) &&
        eq(fDef1, c.clidc1_Cod) &&
        eq(fDef2, c.clidc2_Cod)
      );
    };
    return (clientes || []).filter(f);
  }, [
    clientes,
    fCondVta, fProvincia, fVendedor, fTipoCli, fLista, fZona,
    fIVA, fTipoDoc, fGan, fIB, fApe, fTrn, fProv, fDef1, fDef2
  ]);

  // ids visibles (para seleccionar todos)
  const visibleIds = useMemo(
    () => (filtrados || []).map(c => String(c.CodCliente ?? c.cli_cod)),
    [filtrados]
  );

  // ===== limpiar filtros =====
  const limpiarFiltros = useCallback(() => {
    setFCondVta(""); setFProvincia(""); setFVendedor(""); setFTipoCli(""); setFLista(""); setFZona("");
    setFIVA(""); setFTipoDoc(""); setFGan(""); setFIB(""); setFApe("");
    setFTrn(""); setFProv(""); setFDef1(""); setFDef2("");
  }, []);

  // ===== aplicar cambios =====
  const aplicarCambios = useCallback(async () => {
    setApplyMsg("");

    // construir payload general (por si agregás endpoint más adelante)
    const toUpdate = {
      general: {
        condVta: updCondVta.enabled ? updCondVta.value : null,
        provincia: updProvincia.enabled ? updProvincia.value : null,
        vendedor: updVendedor.enabled ? updVendedor.value : null,
        tipoCli: updTipoCli.enabled ? updTipoCli.value : null,
        lista: updLP.enabled ? updLP.value : null,
        zona: updZona.enabled ? updZona.value : null,
      },
      impo: {
        iva: updIVA.enabled ? updIVA.value : null,
        tdoc: updTipoDoc.enabled ? updTipoDoc.value : null,
        gan: updGan.enabled ? updGan.value : null,
        ib: updIB.enabled ? updIB.value : null,
        ape: updApe.enabled ? updApe.value : null,
      },
      otros: {
        trn: updTrn.enabled ? updTrn.value : null,
        prov: updProv.enabled ? updProv.value : null,
        def1: updDef1.enabled ? updDef1.value : null,
        def2: updDef2.enabled ? updDef2.value : null,
      }
    };

    const cliCods = Array.from(selectedCli);
    if (cliCods.length === 0) {
      setApplyMsg("Seleccioná al menos un cliente de la grilla.");
      return;
    }

    // Caso soportado hoy: Lista de Precios (usa clientesForm.actualizarLista)
    const wantsLP = !!toUpdate.general.lista;
    const wantsSomethingElse =
      Object.values(toUpdate.general).some((v, k) => v && k !== "lista") ||
      Object.values(toUpdate.impo).some(Boolean) ||
      Object.values(toUpdate.otros).some(Boolean);

    if (wantsSomethingElse) {
      setApplyMsg("Por ahora sólo está implementado el cambio de 'Lista de Precios'. El resto quedará habilitado cuando exista el endpoint de back.");
      return;
    }

    if (!wantsLP) {
      setApplyMsg("Activá y elegí un valor en 'Lista de Precios' para aplicar.");
      return;
    }

    // actualizarLista requiere fromCod (lista origen). Usamos el filtro fLista.
    if (!fLista) {
      setApplyMsg("Seleccioná la Lista actual (origen) en Filtros → General → 'Lista Precios'.");
      return;
    }

    try {
      setApplyBusy(true);
      const r = await window?.api?.clientesForm?.actualizarLista?.({
        fromCod: fLista,
        toCod: updLP.value,
        cliCods,
      });
      if (r?.success) {
        setApplyMsg(`✔ Se actualizaron ${r.updatedRows ?? 0} cliente(s).`);
        setSelectedCli(new Set());
        await loadClientes();
      } else {
        setApplyMsg(r?.message || "No se pudo aplicar el cambio.");
      }
    } catch (e) {
      setApplyMsg(e?.message || "Error al aplicar cambios.");
    } finally {
      setApplyBusy(false);
    }
  }, [
    selectedCli, updLP, updCondVta, updProvincia, updVendedor, updTipoCli, updZona,
    updIVA, updTipoDoc, updGan, updIB, updApe, updTrn, updProv, updDef1, updDef2,
    fLista, loadClientes
  ]);

  // ======= render =======
  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador Clientes</h2>
        <EmpresaSelected />
      </div>

      {/* FILTROS */}
      <Accordion
        title="FILTROS"
        rightAdornment={
          <button className={styles.smallBtn} onClick={(e)=>{ e.stopPropagation(); limpiarFiltros(); }}>
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
              <label className={styles.label}>Condición Venta</label>
              <select className={styles.select} value={fCondVta} onChange={e=>setFCondVta(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.condVta.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Provincia</label>
              <select className={styles.select} value={fProvincia} onChange={e=>setFProvincia(e.target.value)}>
                <option value="">(Todas)</option>
                {(opts.provincias || []).map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Vendedor</label>
              <select className={styles.select} value={fVendedor} onChange={e=>setFVendedor(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.vendedores.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Tipo Cliente</label>
              <select className={styles.select} value={fTipoCli} onChange={e=>setFTipoCli(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.tiposCli.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Lista Precios (origen)</label>
              <select className={styles.select} value={fLista} onChange={e=>setFLista(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.listas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Zona</label>
              <select className={styles.select} value={fZona} onChange={e=>setFZona(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.zonas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {fTab === "impo" && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Situación IVA</label>
              <select className={styles.select} value={fIVA} onChange={e=>setFIVA(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.iva.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Tipo Documento</label>
              <select className={styles.select} value={fTipoDoc} onChange={e=>setFTipoDoc(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.tdoc.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ganancias</label>
              <select className={styles.select} value={fGan} onChange={e=>setFGan(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.gan.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ingresos Brutos</label>
              <select className={styles.select} value={fIB} onChange={e=>setFIB(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.ib.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Apertura Contable</label>
              <select className={styles.select} value={fApe} onChange={e=>setFApe(e.target.value)}>
                <option value="">(Todas)</option>
                {opts.ape.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {fTab === "otros" && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Transporte</label>
              <select className={styles.select} value={fTrn} onChange={e=>setFTrn(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.transporte.map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Proveedor</label>
              <select className={styles.select} value={fProv} onChange={e=>setFProv(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.proveedores.map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ordenamiento 1</label>
              <select className={styles.select} value={fDef1} onChange={e=>setFDef1(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.defi1.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Ordenamiento 2</label>
              <select className={styles.select} value={fDef2} onChange={e=>setFDef2(e.target.value)}>
                <option value="">(Todos)</option>
                {opts.defi2.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className={styles.summaryLine}>
          {loading ? "Cargando clientes…" : (
            <>Total: {clientes.length} | Filtrados: <strong>{filtrados.length}</strong>{fLista && <> | Lista actual: {fLista}</>}</>
          )}
          {!!errorCli && <span className={styles.errorText}> · {errorCli}</span>}
        </div>
      </Accordion>

      {/* CONTENEDOR (grilla) */}
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
                  <th>Cliente</th>
                  <th>Zona</th>
                  <th>Vendedor</th>
                  <th>Tipo</th>
                  <th>Lista</th>
                  <th>Cond.Vta</th>
                </tr>
              </thead>
              <tbody>
                {!filtrados.length ? (
                  <tr><td colSpan={7} className={styles.noResults}>{loading ? "Cargando…" : "Sin resultados"}</td></tr>
                ) : (
                  filtrados.slice(0, 2000).map((c, i) => {
                    const id = String(c.CodCliente ?? c.cli_cod);
                    const checked = selectedCli.has(id);
                    return (
                      <tr key={`${id}-${i}`} className={styles.row}>
                        <td className={styles.checkCell}>
                          <input type="checkbox" checked={checked} onChange={() => toggleOne(id)} />
                        </td>
                        <td>{c.CodCliente ?? c.cli_cod}</td>
                        <td>{(c.CodZona ?? "")} - {(c.Zona ?? "")}</td>
                        <td>{(c.CodVendedor ?? "")} - {(c.Vendedor ?? "")}</td>
                        <td>{(c.CodTipoCliente ?? c.clitic_Cod ?? "")} - {(c.TipoCliente ?? "")}</td>
                        <td>{(c.CodListaPrecio ?? c.clidlp_Cod ?? "")} - {(c.ListaPrecio ?? "")}</td>
                        <td>{(c.CodCodicionVenta ?? c.clicvt_Cod ?? "")} - {(c.CondicionVenta ?? "")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.resizeHandle} />
        </div>
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

        {/* General */}
        {uTab === "general" && (
          <div className={styles.updateGrid}>
            {/* Lista de Precios (con input en el header) */}
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updLP.enabled} onChange={(e)=>setUpdLP(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Lista de Precios</span>
              </label>
              <select className={styles.select} disabled={!updLP.enabled} value={updLP.value} onChange={(e)=>setUpdLP(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {opts.listas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updCondVta.enabled} onChange={(e)=>setUpdCondVta(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Condición Venta</span>
              </label>
              <select className={styles.select} disabled={!updCondVta.enabled} value={updCondVta.value} onChange={(e)=>setUpdCondVta(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {opts.condVta.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updProvincia.enabled} onChange={(e)=>setUpdProvincia(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Provincia</span>
              </label>
              <select className={styles.select} disabled={!updProvincia.enabled} value={updProvincia.value} onChange={(e)=>setUpdProvincia(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {(opts.provincias || []).map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updVendedor.enabled} onChange={(e)=>setUpdVendedor(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Vendedor</span>
              </label>
              <select className={styles.select} disabled={!updVendedor.enabled} value={updVendedor.value} onChange={(e)=>setUpdVendedor(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {opts.vendedores.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updTipoCli.enabled} onChange={(e)=>setUpdTipoCli(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Tipo Cliente</span>
              </label>
              <select className={styles.select} disabled={!updTipoCli.enabled} value={updTipoCli.value} onChange={(e)=>setUpdTipoCli(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {opts.tiposCli.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                <input type="checkbox" checked={updZona.enabled} onChange={(e)=>setUpdZona(s=>({ ...s, enabled: e.target.checked }))} />
                <span>Zona</span>
              </label>
              <select className={styles.select} disabled={!updZona.enabled} value={updZona.value} onChange={(e)=>setUpdZona(s=>({ ...s, value: e.target.value }))}>
                <option value="">(seleccionar)</option>
                {opts.zonas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Impositivos */}
        {uTab === "impo" && (
          <div className={styles.updateGrid}>
            {[
              { state: updIVA, set: setUpdIVA, label: "Situación IVA", list: opts.iva },
              { state: updTipoDoc, set: setUpdTipoDoc, label: "Tipo Documento", list: opts.tdoc },
              { state: updGan, set: setUpdGan, label: "Ganancias", list: opts.gan },
              { state: updIB, set: setUpdIB, label: "Ingresos Brutos", list: opts.ib },
              { state: updApe, set: setUpdApe, label: "Apertura Contable", list: opts.ape },
            ].map(({ state, set, label, list }) => (
              <div className={styles.fieldRow} key={label}>
                <label className={styles.fieldLabel}>
                  <input type="checkbox" checked={state.enabled} onChange={(e)=>set(s=>({ ...s, enabled: e.target.checked }))} />
                  <span>{label}</span>
                </label>
                <select className={styles.select} disabled={!state.enabled} value={state.value} onChange={(e)=>set(s=>({ ...s, value: e.target.value }))}>
                  <option value="">(seleccionar)</option>
                  {(list || []).map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Otros */}
        {uTab === "otros" && (
          <div className={styles.updateGrid}>
            {[
              { state: updTrn, set: setUpdTrn, label: "Transporte", list: opts.transporte },
              { state: updProv, set: setUpdProv, label: "Proveedor", list: opts.proveedores },
              { state: updDef1, set: setUpdDef1, label: "Ordenamiento 1", list: opts.defi1 },
              { state: updDef2, set: setUpdDef2, label: "Ordenamiento 2", list: opts.defi2 },
            ].map(({ state, set, label, list }) => (
              <div className={styles.fieldRow} key={label}>
                <label className={styles.fieldLabel}>
                  <input type="checkbox" checked={state.enabled} onChange={(e)=>set(s=>({ ...s, enabled: e.target.checked }))} />
                  <span>{label}</span>
                </label>
                <select className={styles.select} disabled={!state.enabled} value={state.value} onChange={(e)=>set(s=>({ ...s, value: e.target.value }))}>
                  <option value="">(seleccionar)</option>
                  {(list || []).map(o => <option key={o.value || o.label} value={o.value || o.label}>{o.label || o.value}</option>)}
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
        <button
          className={styles.btnAccentFull}
          disabled={applyBusy || selectedCount === 0}
          onClick={aplicarCambios}
        >
          {applyBusy ? "Aplicando…" : `Aplicar a ${selectedCount} cliente(s)`}
        </button>
      </div>
    </div>
  );
}
