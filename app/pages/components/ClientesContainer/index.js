"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";

/** Acordeón simple reutilizable */
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

export default function Clientes() {
  // ===================== dataset base =====================
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorCli, setErrorCli] = useState("");

  // Ordenamientos (ParamGen) para rótulos opcionales — si no existen, no afectan
  const [ordenamientos, setOrdenamientos] = useState({
    hasDefi1: true,
    hasDefi2: true,
    labelDefi1: "Distribución",
    labelDefi2: "Canal",
  });

  // Listas habilitadas (para filtro y para “Lista de Precios” a aplicar)
  const [listasH, setListasH] = useState([]);

  // ===================== filtros (memoria) =====================
  const [fLista, setFLista]       = useState(""); // Lista actual (ORIGEN) obligatorio para actualizar
  const [fVendedor, setFVendedor] = useState("");
  const [fDistrib,  setFDistrib]  = useState("");
  const [fCanal,    setFCanal]    = useState("");

  // ===================== selección de filas =====================
  const [selectedCli, setSelectedCli] = useState(() => new Set());
  const selectedCount = selectedCli.size;

  // ===================== “Campos a actualizar” =====================
  const [fieldLpEnable, setFieldLpEnable] = useState(false);
  const [fieldLpValue,  setFieldLpValue]  = useState("");

  // Mensajes / estado aplicar
  const [applyMsg,  setApplyMsg]  = useState("");
  const [applyBusy, setApplyBusy] = useState(false);

  const normalize = (v) => (v == null ? "" : String(v).trim());

  // ====== bootstrap: ParamGen (opcional) + listas habilitadas ======
  useEffect(() => {
    (async () => {
      // ParamGen: si existe, usamos los rótulos de Defi1/Defi2
      try {
        if (window?.api?.getOrdenamientos) {
          const r = await window.api.getOrdenamientos();
          const data = r?.data ?? {};
          const raw1 = normalize(data.pge_NomDefi1Cli);
          const raw2 = normalize(data.pge_NomDefi2Cli);
          setOrdenamientos({
            hasDefi1: !!raw1,
            hasDefi2: !!raw2,
            labelDefi1: raw1 || "Distribución",
            labelDefi2: raw2 || "Canal",
          });
        }
      } catch {}

      // Listas de precios habilitadas (usa las nuevas funciones)
      try {
        const r =
          (await window?.api?.clientesForm?.traerCodigosLista?.()) ||
          (await window?.api?.traerCodigosLista?.()) ||
          null;

        if (r?.success) {
          // El back Local devuelve array de strings: ["100","200",...]
          const arr = Array.isArray(r.data)
            ? r.data.map(cod => ({ cod: String(cod), desc: "" }))
            : [];
          setListasH(arr);
        }
      } catch {}
    })();
  }, []);

  // ====== cargar clientes (usa traerTodos) ======
  const loadClientes = useCallback(async () => {
    setLoading(true);
    setErrorCli("");
    setApplyMsg("");
    setSelectedCli(new Set()); // al recargar, limpio selección

    try {
      const r =
        (await window?.api?.clientesForm?.traerTodos?.()) ||
        (await window?.api?.traerTodos?.()) ||
        null;

      if (!r?.success) throw new Error(r?.message || "No se pudo cargar Clientes.");
      setClientes(r.data || []);
    } catch (e) {
      setClientes([]);
      setErrorCli(e?.message || "Error cargando Clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  // ====== opciones para filtros (derivadas del dataset) ======
  const vendedores = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => {
      const cod = c.CodVendedor;
      const desc = c.Vendedor || "";
      if (cod != null) s.add(`${cod}||${desc}`);
    });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const distribuciones = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => {
      // Si el Local no trae estos campos, no se agregarán (undefined == null -> true)
      if (c.CodDistribucion != null) s.add(`${c.CodDistribucion}||${c.Distribucion || ""}`);
    });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const canales = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => {
      if (c.CodCanal != null) s.add(`${c.CodCanal}||${c.Canal || ""}`);
    });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  // ====== aplicar filtros en memoria ======
  const filtrados = useMemo(() => {
    return (clientes || []).filter(c => {
      const okLista = !fLista || String(c.CodListaPrecio) === String(fLista);
      const okVend  = !fVendedor || String(c.CodVendedor)     === String(fVendedor);
      const okD     = !ordenamientos.hasDefi1 || !fDistrib  || String(c.CodDistribucion) === String(fDistrib);
      const okC     = !ordenamientos.hasDefi2 || !fCanal    || String(c.CodCanal)        === String(fCanal);
      return okLista && okVend && okD && okC;
    });
  }, [clientes, fLista, fVendedor, fDistrib, fCanal, ordenamientos]);

  const cantFiltrosActivos = useMemo(() => {
    let n = 0;
    if (fLista) n++;
    if (fVendedor) n++;
    if (ordenamientos.hasDefi1 && fDistrib) n++;
    if (ordenamientos.hasDefi2 && fCanal) n++;
    return n;
  }, [fLista, fVendedor, fDistrib, fCanal, ordenamientos]);

  const limpiarFiltros = useCallback(() => {
    setFLista(""); setFVendedor(""); setFDistrib(""); setFCanal("");
  }, []);

  // ====== selección (checkbox por fila + seleccionar todos) ======
  const allVisibleIds = useMemo(
    () => (filtrados || []).map(c => String(c.CodCliente ?? c.cli_cod)),
    [filtrados]
  );

  const toggleAll = useCallback(() => {
    setSelectedCli(prev =>
      prev.size === allVisibleIds.length && allVisibleIds.length > 0
        ? new Set()
        : new Set(allVisibleIds)
    );
  }, [allVisibleIds]);

  const toggleOne = useCallback((id) => {
    const key = String(id);
    setSelectedCli(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  // ====== aplicar cambios (usa actualizarLista) ======
  const aplicarCambios = useCallback(async () => {
    setApplyMsg("");

    if (!fieldLpEnable) { setApplyMsg("Activá un campo en 'Campos a Actualizar'."); return; }
    if (!fieldLpValue)  { setApplyMsg("Seleccioná un valor para 'Lista de Precios'."); return; }
    if (!fLista)        { setApplyMsg("Seleccioná la 'Lista actual' (origen)."); return; }
    if (selectedCli.size === 0) { setApplyMsg("Seleccioná al menos un cliente en la grilla."); return; }

    const payload = {
      fromCod: String(fLista),
      toCod:   String(fieldLpValue),
      cliCods: Array.from(selectedCli), // ids de clientes seleccionados
    };

    try {
      setApplyBusy(true);
      const r =
        (await window?.api?.clientesForm?.actualizarLista?.(payload)) ||
        (await window?.api?.actualizarLista?.(payload)) ||
        null;

      if (r?.success) {
        setApplyMsg(`✔ Se actualizaron ${r.updatedRows ?? selectedCli.size} cliente(s).`);
        await loadClientes();       // refresco real
        setSelectedCli(new Set());  // limpio selección
      } else {
        setApplyMsg(r?.message || "No se pudo aplicar el cambio.");
      }
    } catch (e) {
      setApplyMsg(e?.message || "Error al aplicar cambios.");
    } finally {
      setApplyBusy(false);
    }
  }, [fieldLpEnable, fieldLpValue, fLista, selectedCli, loadClientes]);

  // ===================== render =====================
  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador Clientes</h2>
        <EmpresaSelected />
      </div>

      {/* 1) FILTROS */}
      <Accordion
        title={`FILTROS${cantFiltrosActivos ? ` · ${cantFiltrosActivos} activo(s)` : ""}`}
        defaultOpen={true}
        rightAdornment={
          <button className={styles.smallBtn} onClick={(e)=>{ e.stopPropagation(); limpiarFiltros(); }}>
            Limpiar
          </button>
        }
      >
        <div className={styles.filtersBar}>
          <div className={`${styles.filterItem} ${styles.filterFull}`}>
            <label className={styles.label}>Lista actual (origen)</label>
            <select value={fLista} onChange={e=>setFLista(e.target.value)} className={styles.select}>
              <option value="">(Todas)</option>
              {listasH.map(l => <option key={l.cod} value={l.cod}>{l.cod}</option>)}
            </select>
          </div>

          <div className={styles.filterItem}>
            <label className={styles.label}>Vendedor</label>
            <select value={fVendedor} onChange={e=>setFVendedor(e.target.value)} className={styles.select}>
              <option value="">(Todos)</option>
              {vendedores.map(v => <option key={v.cod} value={v.cod}>{v.cod} - {v.desc}</option>)}
            </select>
          </div>

          {ordenamientos.hasDefi1 && (
            <div className={styles.filterItem}>
              <label className={styles.label}>{ordenamientos.labelDefi1}</label>
              <select value={fDistrib} onChange={e=>setFDistrib(e.target.value)} className={styles.select}>
                <option value="">(Todas)</option>
                {distribuciones.map(d => <option key={d.cod} value={d.cod}>{d.cod} - {d.desc}</option>)}
              </select>
            </div>
          )}

          {ordenamientos.hasDefi2 && (
            <div className={styles.filterItem}>
              <label className={styles.label}>{ordenamientos.labelDefi2}</label>
              <select value={fCanal} onChange={e=>setFCanal(e.target.value)} className={styles.select}>
                <option value="">(Todos)</option>
                {canales.map(c => <option key={c.cod} value={c.cod}>{c.cod} - {c.desc}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className={styles.summaryLine}>
          {loading ? "Cargando clientes…" : (
            <>
              Total: {clientes.length} | Filtrados: <strong>{filtrados.length}</strong>
              {selectedCount > 0 && <> | Seleccionados: <strong>{selectedCount}</strong></>}
              {fLista && <> | Lista actual: {fLista}</>}
            </>
          )}
          {!!errorCli && <span className={styles.errorText}> · {errorCli}</span>}
        </div>
      </Accordion>

      {/* 2) CONTENEDOR (grilla con selección) */}
      <Accordion title="CLIENTES" defaultOpen={true}>
  <div className={`${styles.tableContainer} ${styles.resizableY}`}>
    <table className={styles.table}>
      <thead>
        <tr className={styles.headerRow}>
          <th style={{ width: 44, textAlign: "center" }}>
            <input
              type="checkbox"
              aria-label="Seleccionar todos"
              checked={
                selectedCli.size > 0 &&
                selectedCli.size === allVisibleIds.length &&
                allVisibleIds.length > 0
              }
              onChange={toggleAll}
            />
          </th>
          <th>Cliente</th>
          <th>Razón Social</th>
          <th>Dirección</th>
          <th>Zona</th>
          <th>Localidad</th>
          <th>Código Postal</th>
          <th>Cond. Venta</th>
          <th>Vendedor</th>
          <th>Tipo Cliente</th>
          <th>Lista de Precios</th>
          <th>Desc. Comercial</th>
        </tr>
      </thead>

      <tbody>
        {!filtrados.length ? (
          <tr>
            <td colSpan={13} className={styles.noResults}>
              {loading ? "Cargando…" : "Sin resultados"}
            </td>
          </tr>
        ) : (
          filtrados.slice(0, 2000).map((c, i) => {
            const id = String(c.CodCliente ?? c.cli_cod);
            const checked = selectedCli.has(id);
            return (
              <tr key={`${id}-${i}`} className={styles.row}>
                <td style={{ textAlign: "center", width: 44 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(id)}
                    aria-label={`Seleccionar Cliente ${id}`}
                  />
                </td>

                <td>{c.CodCliente}</td>
                <td>{c.RazonSocial || ""}</td>
                <td>{c.Direccion || ""}</td>
                <td>{c.CodZona} {c.Zona ? `- ${c.Zona}` : ""}</td>
                <td>{c.Localidad || ""}</td>
                <td>{c.CodigoPostal || ""}</td>
                <td>{c.CodCodicionVenta} {c.CondicionVenta ? `- ${c.CondicionVenta}` : ""}</td>
                <td>{c.CodVendedor} {c.Vendedor ? `- ${c.Vendedor}` : ""}</td>
                <td>{c.CodTipoCliente} {c.TipoCliente ? `- ${c.TipoCliente}` : ""}</td>
                <td>{c.CodListaPrecio} {c.ListaPrecio ? `- ${c.ListaPrecio}` : ""}</td>
                <td>{c.CodDescuentoCom || ""} {c.DescuentoCom ? `- ${c.DescuentoCom}` : ""}</td>
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
        <div className={styles.fieldCard}>
  <div
    className={`${styles.fieldHeaderInline} ${fieldLpEnable ? styles.fieldEnabled : ""}`}
  >
    <label className={styles.fieldCheckWrap}>
      <input
        type="checkbox"
        checked={fieldLpEnable}
        onChange={(e) => setFieldLpEnable(e.target.checked)}
      />
      <span className={styles.fieldTitle}>Lista de Precios</span>
    </label>

    <select
      className={styles.fieldSelectInline}
      value={fieldLpValue}
      onChange={(e) => setFieldLpValue(e.target.value)}
      disabled={!fieldLpEnable}
    >
      <option value="">(seleccionar)</option>
      {listasH.map((l) => (
        <option key={l.cod} value={l.cod}>
          {l.cod} {l.desc ? `- ${l.desc}` : ""}
        </option>
      ))}
    </select>
  </div>

</div>
      </Accordion>

      {/* Botón de aplicar */}
      <div className={styles.footerBar}>
        {applyMsg && (
          <p className={`${styles.footerMsg} ${applyMsg.startsWith("✔") ? styles.ok : styles.error}`}>
            {applyMsg}
          </p>
        )}
        <button
          className={styles.btnAccentFull}
          disabled={
            applyBusy ||
            !fieldLpEnable ||
            !fieldLpValue ||
            !fLista ||
            selectedCount === 0
          }
          onClick={aplicarCambios}
        >
          {applyBusy ? "Aplicando…" : `Aplicar a ${selectedCount} cliente(s)`}
        </button>
      </div>
    </div>
  );
}
