"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ui from "../../Modules/Precios/Actualizador/styles.module.css";
import styles from "./styles.module.css";

/**
 * Props:
 * - onAsignacionCompleta(detalle): function
 * - listaFiltroBase: string (opcional) → parámetro de “detalle” (arriba de Vendedor).
 *   Si viene, se usa para el prefijo (3 chars) y para el filtro `lista` del payload
 *   cuando no hay fLista seleccionada en la UI.
 */
export default function ClienteTab({ onAsignacionCompleta = () => {}, listaFiltroBase = "" }) {
  // dataset + estado de carga/error
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [errorCliList, setErrorCliList] = useState("");

  // listas habilitadas (para filtro Lista actual y lista destino)
  const [listasH, setListasH] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.api.getListasClientes?.();
        if (r?.success) setListasH(r.data || []);
      } catch {}
    })();
  }, []);

  // ===== ORDENAMIENTOS (ParamGen) =====
  const [ordenamientos, setOrdenamientos] = useState({
    hasDefi1: true,  // Distribución
    hasDefi2: true,  // Canal
    labelDefi1: "Distribución",
    labelDefi2: "Canal",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!window.api?.getOrdenamientos) {
          if (mounted) setOrdenamientos(o => ({ ...o }));
          return;
        }
        const r = await window.api.getOrdenamientos();
        const data = r?.data ?? r ?? {};
        const raw1 = String(data.pge_NomDefi1Cli ?? "").trim();
        const raw2 = String(data.pge_NomDefi2Cli ?? "").trim();
        const hasDefi1 = !!raw1;
        const hasDefi2 = !!raw2;

        if (mounted) setOrdenamientos({
          hasDefi1,
          hasDefi2,
          labelDefi1: hasDefi1 ? raw1 : "Distribución",
          labelDefi2: hasDefi2 ? raw2 : "Canal",
        });
      } catch {
        if (mounted) setOrdenamientos({
          hasDefi1: true,
          hasDefi2: true,
          labelDefi1: "Distribución",
          labelDefi2: "Canal",
        });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // filtros (incluye Lista actual arriba)
  const [fLista, setFLista]       = useState(""); // Lista (actual) — opcional
  const [fVendedor, setFVendedor] = useState("");
  const [fDistrib,  setFDistrib]  = useState("");
  const [fCanal,    setFCanal]    = useState("");

  // si un ordenamiento no existe, limpiar su filtro
  useEffect(() => { if (!ordenamientos.hasDefi1 && fDistrib) setFDistrib(""); }, [ordenamientos.hasDefi1]); // eslint-disable-line
  useEffect(() => { if (!ordenamientos.hasDefi2 && fCanal)   setFCanal(""); },   [ordenamientos.hasDefi2]); // eslint-disable-line

  const limpiarFiltros = useCallback(() => {
    setFLista(""); setFVendedor(""); setFDistrib(""); setFCanal("");
  }, []);

  /** Carga/recarga clientes. Si fLista está vacío => trae TODOS; si no, filtra por esa lista (en el back). */
  const loadClientes = useCallback(async () => {
    try {
      setClientesLoading(true);
      const r = await window.api.clientesListar({ listaCod: fLista || null });
      setClientes(r?.success ? (r.data || []) : []);
      setErrorCliList(r?.success ? "" : (r?.message || "No se pudo cargar Clientes."));
    } catch (e) {
      setErrorCliList(e?.message || "Error cargando Clientes.");
    } finally {
           setClientesLoading(false);
    }
  }, [fLista]);

  // cargar al entrar y cada vez que cambia fLista
  useEffect(() => { loadClientes(); }, [loadClientes]);

  // opciones de filtros (derivadas del dataset)
  const vendedores = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodVendedor != null) s.add(`${c.CodVendedor}||${c.Vendedor || ""}`); });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const distribuciones = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodDistribucion != null) s.add(`${c.CodDistribucion}||${c.Distribucion || ""}`); });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const canales = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodCanal != null) s.add(`${c.CodCanal}||${c.Canal || ""}`); });
    return Array.from(s).map(x => {
      const [cod, desc] = x.split("||");
      return { cod, desc };
    }).sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  // aplicar filtros en memoria (Vendedor + condicionales)
  const filtrados = useMemo(() => {
    return (clientes || []).filter(c => {
      const okV = !fVendedor || String(c.CodVendedor)     === String(fVendedor);
      const okD = !ordenamientos.hasDefi1 || !fDistrib  || String(c.CodDistribucion) === String(fDistrib);
      const okC = !ordenamientos.hasDefi2 || !fCanal    || String(c.CodCanal)        === String(fCanal);
      return okV && okD && okC;
    });
  }, [clientes, fVendedor, fDistrib, fCanal, ordenamientos.hasDefi1, ordenamientos.hasDefi2]);

  // === selección manual (checklist) ===
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCli, setSelectedCli] = useState(() => new Set());

  // mantener solo ids visibles si cambian filtros/data
  useEffect(() => {
    setSelectedCli(prev => {
      const next = new Set();
      const visible = new Set((filtrados || []).map(c => String(c.cli_cod)));
      [...prev].forEach(id => { if (visible.has(String(id))) next.add(String(id)); });
      return next;
    });
  }, [fVendedor, fDistrib, fCanal, clientes]); // eslint-disable-line

  const selectedCount = selectedCli.size;
  const allVisibleIds = useMemo(
    () => (filtrados || []).map(c => String(c.cli_cod)),
    [filtrados]
  );

  const toggleAll = useCallback(() => {
    setSelectedCli(prev =>
      prev.size === allVisibleIds.length
        ? new Set()
        : new Set(allVisibleIds)
    );
  }, [allVisibleIds]);

  const toggleSelectionMode = useCallback(() => {
    if ((filtrados || []).length <= 1) return;
    setSelectionMode(v => !v);
    setSelectedCli(new Set());
  }, [filtrados]);

  const toggleOne = useCallback((cli_cod) => {
    setSelectedCli(prev => {
      const n = new Set(prev);
      const key = String(cli_cod);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  // Contador de filtros activos
  const cantFiltros = useMemo(() => {
    let n = 0;
    if (fLista) n++;
    if (fVendedor) n++;
    if (ordenamientos.hasDefi1 && fDistrib) n++;
    if (ordenamientos.hasDefi2 && fCanal) n++;
    return n;
  }, [fLista, fVendedor, fDistrib, fCanal, ordenamientos]);

  // ======= LISTA DESTINO con verificación por PREFIJO (primeros 3) =======
  const [toList, setToList] = useState("");
  const [loadingUpd, setLoadingUpd] = useState(false);
  const [msgUpd, setMsgUpd] = useState("");

  const prefix3 = (code) => String(code ?? "").trim().slice(0, 3);

  // código base: del parámetro de detalle (si viene) o del filtro de lista
  const codigoBase = useMemo(() => (listaFiltroBase || fLista || "").trim(), [listaFiltroBase, fLista]);
  const prefijoBase = useMemo(() => prefix3(codigoBase), [codigoBase]);

  // NUEVO: prefijo por vendedor (usa el valor del filtro, que corresponde a c.CodVendedor)
  const prefijoVendedor = useMemo(() => (fVendedor ? prefix3(fVendedor) : ""), [fVendedor]);

  // opciones de destino excluyendo: prefijo de lista base Y prefijo de vendedor (si hay)
  const listasDestino = useMemo(() => {
    if (!codigoBase && !fVendedor) return listasH || [];
    return (listasH || []).filter(l => {
      const p = prefix3(l.cod);
      const exclPorLista = codigoBase ? (p === prefijoBase) : false;
      const exclPorVend  = fVendedor ? (p === prefijoVendedor) : false;
      return !(exclPorLista || exclPorVend);
    });
  }, [listasH, codigoBase, prefijoBase, fVendedor, prefijoVendedor]);

  // resetear destino si coincide el prefijo con lista base o con vendedor
  useEffect(() => {
    const pTo = prefix3(toList);
    if ((codigoBase && pTo === prefijoBase) || (fVendedor && pTo === prefijoVendedor)) {
      setToList("");
    }
  }, [toList, codigoBase, prefijoBase, fVendedor, prefijoVendedor]);

  // helper para buscar por código
  const findByCod = (arr, cod) => (arr || []).find(x => String(x.cod) === String(cod));

  /** Remueve optimistamente de la grilla los clientes actualizados solo si hay filtro de lista */
  const removeLocallyUpdated = useCallback(() => {
    if (!fLista) return; // si estoy viendo "Todas", no remuevo localmente
    setClientes(prev => {
      if (!prev || prev.length === 0) return prev;

      if (selectionMode && selectedCli.size > 0) {
        const ids = new Set(Array.from(selectedCli).map(String));
        return prev.filter(c => !ids.has(String(c.cli_cod)));
      }

      // sin selección: remover los que coinciden con filtros aplicados
      return prev.filter(c => {
        const matchV = !fVendedor || String(c.CodVendedor)     === String(fVendedor);
        const matchD = !ordenamientos.hasDefi1 || !fDistrib  || String(c.CodDistribucion) === String(fDistrib);
        const matchC = !ordenamientos.hasDefi2 || !fCanal    || String(c.CodCanal)        === String(fCanal);
        return !(matchV && matchD && matchC);
      });
    });
  }, [fLista, selectionMode, selectedCli, fVendedor, fDistrib, fCanal, ordenamientos.hasDefi1, ordenamientos.hasDefi2]);

  /** Aplica el cambio y notifica arriba con el detalle para Resultados */
  const aplicarCambio = useCallback(async () => {
    setMsgUpd("");

    // Guards: impedir mismo prefijo por lista base o por vendedor
    const pTo = prefix3(toList);
    if (codigoBase && pTo === prefijoBase) {
      setMsgUpd("La lista destino debe tener un prefijo distinto (primeros 3) al de la lista base.");
      return;
    }
    if (fVendedor && pTo === prefijoVendedor) {
      setMsgUpd("La lista destino debe tener un prefijo distinto (primeros 3) al del vendedor seleccionado.");
      return;
    }

    if (!toList) { setMsgUpd("Seleccioná una lista nueva."); return; }

    const targetCount = (selectionMode && selectedCli.size > 0) ? selectedCli.size : filtrados.length;
    if (targetCount === 0) { setMsgUpd("No hay clientes para actualizar."); return; }

    const ok = confirm(`Vas a actualizar ${targetCount} cliente(s) a la lista “${toList}”. ¿Continuar?`);
    if (!ok) return;

    // Snapshot de los clientes que se van a actualizar (para detalle)
    const snapshotItems = (selectionMode && selectedCli.size > 0)
      ? (filtrados || []).filter(c => selectedCli.has(String(c.cli_cod)))
      : (filtrados || []);

    try {
      setLoadingUpd(true);

      const payload =
        (selectionMode && selectedCli.size > 0)
          ? {
              toCod: toList,
              fromCod: fLista || null,
              cliCods: Array.from(selectedCli),
            }
          : {
              toCod: toList,
              fromCod: fLista || null,
              filtros: {
                // incluir lista base en payload (si no hay fLista, usar listaFiltroBase)
                lista: (fLista || listaFiltroBase || null),
                vendedor: fVendedor || null,
                distribucion: (ordenamientos.hasDefi1 && fDistrib) ? fDistrib : null,
                canal:       (ordenamientos.hasDefi2 && fCanal)   ? fCanal   : null,
              },
            };

      const r = await window.api.clientesActualizarFiltrado(payload);

      if (r?.success) {
        // Armo el detalle para Resultados
        const detalle = {
          ts: Date.now(),
          toList,
          fromList: fLista || null,
          count: r?.updatedRows ?? snapshotItems.length,
          hasDefi1: ordenamientos.hasDefi1,
          hasDefi2: ordenamientos.hasDefi2,
          labelDefi1: ordenamientos.labelDefi1,
          labelDefi2: ordenamientos.labelDefi2,
          filtros: {
            // mostramos también el código base usado en la validación por prefijo
            codigoBase: (listaFiltroBase || fLista || null),
            lista: (fLista || listaFiltroBase || null),
            vendedor: fVendedor ? findByCod(vendedores, fVendedor) : null,
            distribucion: (ordenamientos.hasDefi1 && fDistrib) ? findByCod(distribuciones, fDistrib) : null,
            canal: (ordenamientos.hasDefi2 && fCanal) ? findByCod(canales, fCanal) : null,
            modo: (selectionMode && selectedCli.size > 0) ? "seleccionados" : "filtrados",
          },
          items: snapshotItems.slice(0, 500).map(c => ({
            cli_cod: c.cli_cod,
            zona: `${c.CodZona ?? ""} - ${c.Zona ?? ""}`,
            vendedor: `${c.CodVendedor ?? ""} - ${c.Vendedor ?? ""}`, // <- c.CodVendedor visible en detalle
            tipo: `${c.CodTipoCli ?? ""} - ${c.TipoCli ?? ""}`,
            distribucion: ordenamientos.hasDefi1 ? `${c.CodDistribucion ?? ""} - ${c.Distribucion ?? ""}` : "",
            canal: ordenamientos.hasDefi2 ? `${c.CodCanal ?? ""} - ${c.Canal ?? ""}` : "",
          })),
        };

        onAsignacionCompleta(detalle);

        removeLocallyUpdated(); // efecto inmediato si hay fLista
        setSelectedCli(new Set());
        await loadClientes();   // refresco real (respeta fLista)
        setMsgUpd(`✔ Se actualizaron ${r.updatedRows ?? 0} clientes.`);
      } else {
        setMsgUpd(r?.message || "No se pudo actualizar.");
      }
    } catch (e) {
      setMsgUpd(e?.message || "Error al actualizar.");
    } finally {
      setLoadingUpd(false);
    }
  }, [
    toList, selectionMode, selectedCli, filtrados.length,
    fLista, fVendedor, fDistrib, fCanal,
    listaFiltroBase, codigoBase, prefijoBase,
    prefijoVendedor,
    ordenamientos.hasDefi1, ordenamientos.hasDefi2,
    ordenamientos.labelDefi1, ordenamientos.labelDefi2,
    removeLocallyUpdated, loadClientes,
    vendedores, distribuciones, canales,
    onAsignacionCompleta
  ]);

  return (
    <>
      <div className={styles.titleWrap}><h2 className={ui.title}>Actualización Masiva</h2></div>

      <p className={styles.tabNote}>
        Podés filtrar por <strong>Lista de Precios</strong>, <strong>Vendedor</strong>
        {ordenamientos.hasDefi1 && ", "}<strong>{ordenamientos.hasDefi1 ? ordenamientos.labelDefi1 : ""}</strong>
        {ordenamientos.hasDefi2 && " y "}<strong>{ordenamientos.hasDefi2 ? ordenamientos.labelDefi2 : ""}</strong>.
        Luego seleccioná la <strong>Lista a Aplicar</strong> a los clientes que cumplen los <strong>Filtros Seleccionados</strong>.
      </p>

      <div className={ui.filtersBar}>
        {/* Filtro de Lista (actual) a lo ancho */}
        <div className={`${ui.filterItem} ${ui.filterFull}`}>
          <label className={styles.label}>Lista Seleccionada</label>
          <select className={ui.select} value={fLista} onChange={(e)=>setFLista(e.target.value)}>
            <option value="">(Todas)</option>
            {listasH.map(l => <option key={l.cod} value={l.cod}>{l.cod} - {l.desc}</option>)}
          </select>
        </div>

        {/* Vendedor siempre visible */}
        <div className={ui.filterItem}>
          <label className={styles.label}>Vendedor</label>
          <select className={ui.select} value={fVendedor} onChange={(e)=>setFVendedor(e.target.value)}>
            <option value="">(Todos)</option>
            {vendedores.map(v => <option key={v.cod} value={v.cod}>{v.cod} - {v.desc}</option>)}
          </select>
        </div>

        {/* Distribución solo si existe en ParamGen */}
        {ordenamientos.hasDefi1 && (
          <div className={ui.filterItem}>
            <label className={styles.label}>{ordenamientos.labelDefi1}</label>
            <select className={ui.select} value={fDistrib} onChange={(e)=>setFDistrib(e.target.value)}>
              <option value="">(Todas)</option>
              {distribuciones.map(d => <option key={d.cod} value={d.cod}>{d.cod} - {d.desc}</option>)}
            </select>
          </div>
        )}

        {/* Canal solo si existe en ParamGen */}
        {ordenamientos.hasDefi2 && (
          <div className={ui.filterItem}>
            <label className={styles.label}>{ordenamientos.labelDefi2}</label>
            <select className={ui.select} value={fCanal} onChange={(e)=>setFCanal(e.target.value)}>
              <option value="">(Todos)</option>
              {canales.map(c => <option key={c.cod} value={c.cod}>{c.cod} - {c.desc}</option>)}
            </select>
          </div>
        )}

        {/* Botones: debajo, a lo ancho */}
        <div className={ui.filterActions}>
          <button className={ui.btn} onClick={limpiarFiltros}>Limpiar Filtros</button>
          {(filtrados.length > 1) && (
            <button
              className={ui.btn}
              onClick={toggleSelectionMode}
              title="Elegir manualmente qué Clientes Actualizar"
            >
              {selectionMode ? "Salir de Selección" : "Seleccionar Clientes"}
            </button>
          )}
        </div>
      </div>

      <div className={ui.summaryLine}>
        {clientesLoading ? (
          <span>Cargando clientes…</span>
        ) : (
          <span>
            Total: {clientes.length} | Filtrados: <strong>{filtrados.length}</strong>
            {cantFiltros > 0 && <> | Filtro(s): {cantFiltros}</>}
            {selectionMode && ` | Seleccionados: ${selectedCount}`}
            {fLista && ` | Lista actual: ${fLista}`}
          </span>
        )}
        {!!errorCliList && <span className={ui.errorText} style={{ marginLeft: 8 }}>{errorCliList}</span>}
      </div>

      <div className={ui.tableWrapper}>
        <table className={ui.table}>
          <thead>
            <tr className={ui.headerRow}>
              {selectionMode && (
                <th className={ui.checkCell}>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar Todos"
                    checked={selectedCount === allVisibleIds.length && allVisibleIds.length > 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th>Cliente</th>
              <th>Zona</th>
              <th>Vendedor</th>
              <th>Tipo</th>
              <th>{ordenamientos.hasDefi1 ? ordenamientos.labelDefi1 : "—"}</th>
              <th>{ordenamientos.hasDefi2 ? ordenamientos.labelDefi2 : "—"}</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length ? (
              filtrados.slice(0, 1000).map((c, i) => {
                const id = String(c.cli_cod);
                const isChecked = selectedCli.has(id);
                return (
                  <tr key={`${id}-${i}`} className={ui.row}>
                    {selectionMode && (
                      <td className={ui.checkCell}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(id)}
                          aria-label={`Seleccionar Cliente ${id}`}
                        />
                      </td>
                    )}
                    <td>{c.cli_cod}</td>
                    <td>{c.CodZona} - {c.Zona || ""}</td>
                    <td>{c.CodVendedor} - {c.Vendedor || ""}</td>
                    <td>{c.CodTipoCli} - {c.TipoCli || ""}</td>
                    <td>{ordenamientos.hasDefi1 ? `${c.CodDistribucion ?? ""} - ${c.Distribucion ?? ""}` : "—"}</td>
                    <td>{ordenamientos.hasDefi2 ? `${c.CodCanal ?? ""} - ${c.Canal ?? ""}` : "—"}</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={selectionMode ? 7 : 6} className={ui.noResults}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={ui.applyBar}>
        <div>
          <label className={styles.label}>Lista de Precios a Asignar</label>
          <select className={ui.select} value={toList} onChange={(e)=>setToList(e.target.value)}>
            <option value="">Seleccioná…</option>
            {listasDestino.map(l => <option key={l.cod} value={l.cod}>{l.cod} - {l.desc}</option>)}
          </select>
        </div>
        <button
          className={ui.btn}
          disabled={!toList || loadingUpd || (selectionMode ? selectedCount === 0 : filtrados.length === 0)}
          onClick={aplicarCambio}
        >
          {loadingUpd ? "Actualizando..." :
            `Aplicar a ${(selectionMode && selectedCount > 0) ? selectedCount : filtrados.length} Cliente(s)`}
        </button>
      </div>

      {!!msgUpd && (
        <p className={msgUpd.startsWith("✔") ? ui.successBox : ui.errorBox} style={{ marginTop: 10 }}>
          {msgUpd}
        </p>
      )}
    </>
  );
}
