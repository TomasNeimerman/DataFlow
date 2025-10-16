"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import usePreciosActualizador from "../../../public/hooks/preciosActualizador";
import styles from "./styles.module.css";

const ListaPreciosForm = ({ nombreModulo = "Actualizador por Excel", idCliente }) => {
  // --- estado base (descargar/importar) ---
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [selectedOption, setSelectedOption] = useState(""); // descargar/importar
  const [isOptionConfirmed, setIsOptionConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState("descargar"); // descargar | importar | resultados | clientes

  const {
    estadoImportar,
    mensajeImportacion,
    resultados,
    puedeVerResultados,
    handleDescargarLista,
    handleImportar,
  } = usePreciosActualizador();

  useEffect(() => { if (puedeVerResultados) setActiveSection("resultados"); }, [puedeVerResultados]);

  // --- módulos (título) ---
  const [modulos, setModulos] = useState([]);
  const [loadingModulos, setLoadingModulos] = useState(false);
  const [errorModulos, setErrorModulos] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!idCliente) return;
      try {
        if (!window?.api?.getModules) return;
        setLoadingModulos(true); setErrorModulos("");
        const res = await window.api.getModules(idCliente);
        if (!mounted) return;
        if (res?.success && Array.isArray(res?.data)) setModulos(res.data);
        else if (Array.isArray(res)) setModulos(res);
        else setErrorModulos("No se pudieron cargar los módulos.");
      } catch (e) {
        if (!mounted) return;
        setErrorModulos(e?.message || "Error al obtener módulos.");
      } finally { if (mounted) setLoadingModulos(false); }
    })();
    return () => { mounted = false; };
  }, [idCliente]);

  const moduloSeleccionado = useMemo(() => {
    if (!Array.isArray(modulos) || !modulos.length) return undefined;
    return modulos.find(
      (m) => m?.nombre === nombreModulo || m?.displayName === nombreModulo || m?.key === nombreModulo
    );
  }, [modulos, nombreModulo]);

  const tituloModuloResuelto =
    (loadingModulos ? "Cargando…" : (moduloSeleccionado?.displayName || moduloSeleccionado?.nombre)) ||
    nombreModulo;

  // --- códigos de lista (para descargar/importar) ---
  const [codigosLista, setCodigosLista] = useState([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [errorCodigos, setErrorCodigos] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!window?.api?.getCodigosLista) return;
        setLoadingCodigos(true); setErrorCodigos("");
        const res = await window.api.getCodigosLista();
        if (!mounted) return;
        if (res?.success && Array.isArray(res?.data)) {
          setCodigosLista(
            res.data.map((r) => ({
              value: String(r.lprdlp_Cod ?? "").trim(),
              label: `${String(r.lprdlp_Cod ?? "").trim()} - ${String(r.dlp_Desc ?? "").trim()}`,
            }))
          );
        } else if (Array.isArray(res)) {
          setCodigosLista(res.map((code) => ({ value: String(code), label: String(code) })));
        } else {
          setErrorCodigos("No se pudieron cargar los códigos de lista.");
        }
      } catch (e) {
        if (!mounted) return;
        setErrorCodigos(e?.message || "Error al obtener códigos de lista.");
      } finally { if (mounted) setLoadingCodigos(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // === Vista previa en modal ===
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [errorPreview, setErrorPreview] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchPreview = useCallback(async (lista) => {
    if (!lista || !window.api?.previewLista) return;
    try {
      setLoadingPreview(true); setErrorPreview(""); setPreview([]);
      const res = await window.api.previewLista(lista, 20);
      if (res?.success) setPreview(res.data || []);
      else setErrorPreview(res?.message || "No se pudo obtener la vista previa.");
    } catch (e) {
      setErrorPreview(e?.message || "Error en vista previa.");
    } finally { setLoadingPreview(false); }
  }, []);

  const handleConfirmarSeleccion = useCallback(() => {
    if (!selectedOption) return;
    setIsOptionConfirmed(true);
    setIsPreviewOpen(true);
    fetchPreview(selectedOption);
  }, [selectedOption, fetchPreview]);

  // cerrar modal con ESC
  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setIsPreviewOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen]);

  // --- handlers (descargar / importar) ---
  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f); setFileName(f ? f.name : ""); setIsFileLoaded(!!f);
  };
  const handleCancel = () => {
    setFile(null); setFileName(""); setIsFileLoaded(false);
    const el = document?.getElementById("loadFile"); if (el) el.value = "";
  };
  const handleDescargarClick = () => { if (selectedOption) handleDescargarLista(selectedOption); };
  const handleSelectChange = (e) => {
    setSelectedOption(e.target.value);
    setIsOptionConfirmed(false);
    setPreview([]); setErrorPreview(""); setIsPreviewOpen(false);
  };
  const handleImportarClick = () => { if (file && selectedOption) handleImportar(file, selectedOption); };

  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0,00";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const statusLower = typeof estadoImportar === "string" ? estadoImportar.toLowerCase() : "";
  const feedbackClass = statusLower.includes("error")
    ? styles.errorBox
    : statusLower.includes("sin cambios")
    ? styles.info
    : styles.successBox;

  // === CLIENTES ===

  // dataset + estado de carga/error
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [errorCliList, setErrorCliList] = useState("");

  // listas habilitadas (para filtro Lista actual y para lista destino)
  const [listasH, setListasH] = useState([]);
  useEffect(() => { (async () => {
    try { const r = await window.api.getListasClientes?.(); if (r?.success) setListasH(r.data || []); } catch {}
  })(); }, []);

  // ===== ORDENAMIENTOS (ParamGen) =====
  const [ordenamientos, setOrdenamientos] = useState({
    hasDefi1: true,  // Distribución
    hasDefi2: true,  // Canal
    labelDefi1: "Distribución",
    labelDefi2: "Canal",
  });

  // carga de ParamGen al entrar a la solapa (si existe el método)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (activeSection !== "clientes") return;
      try {
        if (!window.api?.getOrdenamientos) {
          // sin api => fallback: ambos visibles con labels por defecto
          if (mounted) setOrdenamientos(o => ({ ...o }));
          return;
        }
        const r = await window.api.getOrdenamientos();
        // Aceptamos distintas formas: {success,data:{pge_NomDefi1Cli, pge_NomDefi2Cli}} o plano
        const data = r?.data ?? r ?? {};
        const raw1 = String(data.pge_NomDefi1Cli ?? "").trim();
        const raw2 = String(data.pge_NomDefi2Cli ?? "").trim();

        const hasDefi1 = !!raw1; // si está vacío, no mostrar
        const hasDefi2 = !!raw2;

        if (mounted) setOrdenamientos({
          hasDefi1,
          hasDefi2,
          labelDefi1: hasDefi1 ? raw1 : "Distribución",
          labelDefi2: hasDefi2 ? raw2 : "Canal",
        });
      } catch (e) {
        // on error => fallback (ambos visibles)
        if (mounted) setOrdenamientos({
          hasDefi1: true,
          hasDefi2: true,
          labelDefi1: "Distribución",
          labelDefi2: "Canal",
        });
      }
    })();
    return () => { mounted = false; };
  }, [activeSection]);

  // filtros (incluye Lista actual arriba)
  const [fLista, setFLista]       = useState(""); // Lista (actual) — opcional
  const [fVendedor, setFVendedor] = useState("");
  const [fDistrib,  setFDistrib]  = useState("");
  const [fCanal,    setFCanal]    = useState("");

  // si un ordenamiento no existe, asegurarse de limpiar su filtro
  useEffect(() => { if (!ordenamientos.hasDefi1 && fDistrib) setFDistrib(""); }, [ordenamientos.hasDefi1]); // Distribución
  useEffect(() => { if (!ordenamientos.hasDefi2 && fCanal)   setFCanal(""); },   [ordenamientos.hasDefi2]); // Canal

  const limpiarFiltros = useCallback(() => {
    setFLista(""); setFVendedor(""); setFDistrib(""); setFCanal("");
  }, []);

  /** Carga/recarga clientes. Si fLista está vacío => trae TODOS; si no, filtra por esa lista (en el back). */
  const loadClientes = useCallback(async () => {
    try {
      setClientesLoading(true);
      const r = await window.api.clientesListar({ listaCod: fLista || null });
      setClientes(r?.success ? (r.data || []) : []);
      setErrorCliList(r?.success ? "" : (r?.message || "No se pudo cargar clientes."));
    } catch (e) {
      setErrorCliList(e?.message || "Error cargando clientes.");
    } finally {
      setClientesLoading(false);
    }
  }, [fLista]);

  // cargar al entrar a la solapa y cada vez que cambia fLista
  useEffect(() => {
    if (activeSection === "clientes") loadClientes();
  }, [activeSection, fLista, loadClientes]);

  // opciones de filtros (derivadas del dataset)
  const vendedores = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodVendedor != null) s.add(`${c.CodVendedor}||${c.Vendedor || ""}`); });
    return Array.from(s).map(x => { const [cod, desc] = x.split("||"); return { cod, desc }; })
      .sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const distribuciones = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodDistribucion != null) s.add(`${c.CodDistribucion}||${c.Distribucion || ""}`); });
    return Array.from(s).map(x => { const [cod, desc] = x.split("||"); return { cod, desc }; })
      .sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  const canales = useMemo(() => {
    const s = new Set();
    (clientes || []).forEach(c => { if (c.CodCanal != null) s.add(`${c.CodCanal}||${c.Canal || ""}`); });
    return Array.from(s).map(x => { const [cod, desc] = x.split("||"); return { cod, desc }; })
      .sort((a,b) => (a.cod > b.cod ? 1 : -1));
  }, [clientes]);

  // aplicar filtros en memoria (Vendedor + condicionales)
  const filtrados = useMemo(() => {
    return (clientes || []).filter(c => {
      const okL = true; // fLista lo maneja el back (ya viene filtrado si aplica)
      const okV = !fVendedor || String(c.CodVendedor)     === String(fVendedor);
      const okD = !ordenamientos.hasDefi1 || !fDistrib  || String(c.CodDistribucion) === String(fDistrib);
      const okC = !ordenamientos.hasDefi2 || !fCanal    || String(c.CodCanal)        === String(fCanal);
      return okL && okV && okD && okC;
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
  const allVisibleIds = useMemo(() => (filtrados || []).map(c => String(c.cli_cod)), [filtrados]);

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
  const cantFiltros = useMemo(() => {
  let n = 0;
  if (fLista) n++;
  if (fVendedor) n++;
  if (ordenamientos.hasDefi1 && fDistrib) n++;
  if (ordenamientos.hasDefi2 && fCanal) n++;
  return n;
}, [fLista, fVendedor, fDistrib, fCanal, ordenamientos]);

  // lista destino
  const [toList, setToList] = useState("");
  const [loadingUpd, setLoadingUpd] = useState(false);
  const [msgUpd, setMsgUpd] = useState("");

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

  /** Aplica el cambio y refresca lista (si hay filtro por lista, desaparecen) */
  const aplicarCambio = useCallback(async () => {
    setMsgUpd("");
    if (!toList) { setMsgUpd("Seleccioná una lista nueva."); return; }

    const targetCount = (selectionMode && selectedCli.size > 0) ? selectedCli.size : filtrados.length;
    if (targetCount === 0) { setMsgUpd("No hay clientes para actualizar."); return; }

    const ok = confirm(`Vas a actualizar ${targetCount} cliente(s) a la lista “${toList}”. ¿Continuar?`);
    if (!ok) return;

    try {
      setLoadingUpd(true);

      const payload =
        (selectionMode && selectedCli.size > 0)
          ? { toCod: toList, fromCod: fLista || null, cliCods: Array.from(selectedCli) }
          : { toCod: toList, fromCod: fLista || null, filtros: {
              vendedor: fVendedor || null,
              distribucion: (ordenamientos.hasDefi1 && fDistrib) ? fDistrib : null,
              canal:       (ordenamientos.hasDefi2 && fCanal)   ? fCanal   : null,
            }};

      const r = await window.api.clientesActualizarFiltrado(payload);

      if (r?.success) {
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
    ordenamientos.hasDefi1, ordenamientos.hasDefi2,
    removeLocallyUpdated, loadClientes
  ]);

  return (
    <div className={`${styles.container} ${activeSection === "resultados" ? styles.containerWide : ""}`}>
      {/* Título */}
      <div className={styles.titleContainer} style={{ marginBottom: "0.75rem" }}>
        <h1 className={styles.title}>{tituloModuloResuelto}</h1>
        {!!errorModulos && <small className={styles.errorText}>{errorModulos}</small>}
      </div>

      {/* Tabs */}
      <div className={styles.toggleContainer}>
        <button className={`${styles.toggleButton} ${activeSection === "descargar" ? styles.active : ""}`}
                onClick={() => setActiveSection("descargar")}>Descargar Lista</button>
        <button className={`${styles.toggleButton} ${activeSection === "importar" ? styles.active : ""}`}
                onClick={() => setActiveSection("importar")}>Importar Lista</button>
        {puedeVerResultados && (
          <button className={`${styles.toggleButton} ${activeSection === "resultados" ? styles.active : ""}`}
                  onClick={() => setActiveSection("resultados")}
                  title="Ver resultados de la última actualización">Resultados Lista</button>
        )}
        <button className={`${styles.toggleButton} ${activeSection === "clientes" ? styles.active : ""}`}
                onClick={() => setActiveSection("clientes")}>Clientes</button>
      </div>

      {/* Contenido (scroll interno) */}
      <div className={styles.sectionContent}>
        {/* Descargar */}
        {activeSection === "descargar" && (
          <>
            <div className={styles.titleContainer}><h2 className={styles.title}>Seleccionar Lista</h2></div>
            <select className={styles.select} value={selectedOption} onChange={handleSelectChange} disabled={loadingCodigos}>
              <option value="">{loadingCodigos ? "Cargando listas..." : "Seleccione una opción..."}</option>
              {codigosLista.map((op) => (<option key={op.value} value={op.value}>{op.label}</option>))}
            </select>
            {!!errorCodigos && <small className={styles.errorText} style={{ display: "block", marginTop: 6 }}>{errorCodigos}</small>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button className={styles.btn} disabled={!selectedOption} onClick={handleConfirmarSeleccion}>Confirmar selección</button>
              {isOptionConfirmed && (
                <>
                  <button className={styles.btn} onClick={() => { setIsPreviewOpen(true); fetchPreview(selectedOption); }}>
                    Ver vista previa
                  </button>
                  <button className={styles.btn} onClick={handleDescargarClick}>Descargar lista</button>
                  <p className={styles.info} style={{ margin: 0, alignSelf: "center" }}>Opción seleccionada: <strong>{selectedOption}</strong></p>
                </>
              )}
            </div>
          </>
        )}

        {/* Importar */}
        {activeSection === "importar" && (
          <>
            <div className={styles.titleContainer}><h1 className={styles.title}>Importar Datos</h1></div>
            <input type="file" className={styles.input} id="loadFile" accept=".xlsx, .xls" onChange={handleFileChange} />
            <div className={styles.buttonsContainer}>
              <button className={styles.btn} onClick={handleCancel}>Limpiar</button>
              <button className={styles.btn} disabled={!isFileLoaded || !selectedOption} onClick={handleImportarClick}>Importar</button>
            </div>
            {estadoImportar ? (<p className={feedbackClass}>{mensajeImportacion || estadoImportar}</p>) : null}
            {fileName && (<p className={styles.info}>Archivo seleccionado: <strong>{fileName}</strong></p>)}
          </>
        )}

        {/* Resultados */}
        {activeSection === "resultados" && (
          <>
            <div className={styles.titleContainer}><h2 className={styles.title}>Resultados de la actualización</h2></div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    <th>Lista</th><th>Cod.Gen</th><th>Ele1</th><th>Ele2</th><th>Ele3</th>
                    <th className={styles.num}>Precio Anterior</th>
                    <th className={`${styles.num} ${styles.priceNew}`}>Precio Nuevo</th>
                    <th>Fecha Mod.</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(resultados) && resultados.length > 0 ? (
                    resultados.map((r, i) => (
                      <tr key={i} className={styles.row}>
                        <td>{r.lprdlp_Cod}</td>
                        <td>{r.lprart_CodGen}</td>
                        <td>{r.lprart_CodEle1 || ""}</td>
                        <td>{r.lprart_CodEle2 || ""}</td>
                        <td>{r.lprart_CodEle3 || ""}</td>
                        <td className={styles.num}>{money(r.PrecioAnterior)}</td>
                        <td className={`${styles.num} ${styles.priceNew}`}>{money(r.PrecioNuevo)}</td>
                        <td>{r.FechaModStr || ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className={styles.noResults}>No hay resultados para mostrar aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Clientes */}
        {activeSection === "clientes" && (
          <>
            <div className={styles.titleContainer}><h2 className={styles.title}> Actualizacion Masiva</h2></div>
            <p className={styles.tabNote}> Podés filtrar por <strong>Lista de Precios</strong>,
              <strong> Vendedor</strong>{ordenamientos.hasDefi1 && ", "}<strong>{ordenamientos.hasDefi1 ? ordenamientos.labelDefi1 : ""}</strong>
              {ordenamientos.hasDefi2 && " y "}<strong>{ordenamientos.hasDefi2 ? ordenamientos.labelDefi2 : ""}</strong>. Luego selecciona la <strong>Lista a Aplicar</strong> a los clientes que cumplen los <strong>Filtros Seleccionados</strong>.
            </p>

            <div className={styles.filtersBar}>
              {/* Filtro de Lista (actual) a lo ancho */}
              <div className={`${styles.filterItem} ${styles.filterFull}`}>
                <label className={styles.label}>Lista Seleccionada</label>
                <select className={styles.select} value={fLista} onChange={(e)=>setFLista(e.target.value)}>
                  <option value="">(Todas)</option>
                  {listasH.map(l => <option key={l.cod} value={l.cod}>{l.cod} - {l.desc}</option>)}
                </select>
              </div>

              {/* Vendedor siempre visible */}
              <div className={styles.filterItem}>
                <label className={styles.label}>Vendedor</label>
                <select className={styles.select} value={fVendedor} onChange={(e)=>setFVendedor(e.target.value)}>
                  <option value="">(Todos)</option>
                  {vendedores.map(v => <option key={v.cod} value={v.cod}>{v.cod} - {v.desc}</option>)}
                </select>
              </div>

              {/* Distribución solo si existe en ParamGen */}
              {ordenamientos.hasDefi1 && (
                <div className={styles.filterItem}>
                  <label className={styles.label}>{ordenamientos.labelDefi1}</label>
                  <select className={styles.select} value={fDistrib} onChange={(e)=>setFDistrib(e.target.value)}>
                    <option value="">(Todas)</option>
                    {distribuciones.map(d => <option key={d.cod} value={d.cod}>{d.cod} - {d.desc}</option>)}
                  </select>
                </div>
              )}

              {/* Canal solo si existe en ParamGen */}
              {ordenamientos.hasDefi2 && (
                <div className={styles.filterItem}>
                  <label className={styles.label}>{ordenamientos.labelDefi2}</label>
                  <select className={styles.select} value={fCanal} onChange={(e)=>setFCanal(e.target.value)}>
                    <option value="">(Todos)</option>
                    {canales.map(c => <option key={c.cod} value={c.cod}>{c.cod} - {c.desc}</option>)}
                  </select>
                </div>
              )}

              {/* Botones: debajo, a lo ancho */}
              <div className={styles.filterActions}>
                <button className={styles.btn} onClick={limpiarFiltros}>Limpiar Filtros</button>
                {(filtrados.length > 1) && (
                  <button className={styles.btn} onClick={toggleSelectionMode}
                          title="Elegir manualmente qué clientes actualizar">
                    {selectionMode ? "Salir de Selección" : "Seleccionar Clientes"}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.summaryLine}>
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
              {!!errorCliList && <span className={styles.errorText} style={{ marginLeft: 8 }}>{errorCliList}</span>}
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    {selectionMode && (
                      <th className={styles.checkCell}>
                        <input type="checkbox" aria-label="Seleccionar todos"
                               checked={selectedCount === allVisibleIds.length && allVisibleIds.length > 0}
                               onChange={toggleAll} />
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
                        <tr key={`${id}-${i}`} className={styles.row}>
                          {selectionMode && (
                            <td className={styles.checkCell}>
                              <input type="checkbox" checked={isChecked}
                                     onChange={() => toggleOne(id)}
                                     aria-label={`Seleccionar cliente ${id}`} />
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
                    <tr><td colSpan={selectionMode ? 7 : 6} className={styles.noResults}>Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.applyBar}>
              <div>
                <label className={styles.label}>Lista de Precios a Asignar </label>
                <select className={styles.select} value={toList} onChange={(e)=>setToList(e.target.value)}>
                  <option value="">Seleccioná…</option>
                  {listasH.map(l => <option key={l.cod} value={l.cod}>{l.cod} - {l.desc}</option>)}
                </select>
              </div>
              <button className={styles.btn}
                      disabled={!toList || loadingUpd || (selectionMode ? selectedCount === 0 : filtrados.length === 0)}
                      onClick={aplicarCambio}>
                {loadingUpd ? "Actualizando..." :
                  `Aplicar a ${(selectionMode && selectedCount > 0) ? selectedCount : filtrados.length} Cliente(s)`}
              </button>
            </div>

            {!!msgUpd && (
              <p className={msgUpd.startsWith("✔") ? styles.successBox : styles.errorBox} style={{ marginTop: 10 }}>
                {msgUpd}
              </p>
            )}
          </>
        )}
      </div>

      {/* === MODAL DE VISTA PREVIA === */}
      {isPreviewOpen && (
        <div className={styles.modalOverlay} onClick={(e)=>{ if (e.target === e.currentTarget) setIsPreviewOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.title} style={{ margin: 0 }}>Vista previa – Lista {selectedOption}</h3>
              <button className={styles.modalClose} onClick={()=>setIsPreviewOpen(false)}>Cerrar</button>
            </div>
            <div className={styles.modalBody}>
              {loadingPreview && <p className={styles.info}>Cargando vista previa…</p>}
              {!!errorPreview && <p className={styles.errorText}>{errorPreview}</p>}
              {!loadingPreview && !errorPreview && (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.headerRow}>
                        <th>Cod.Gen</th><th>Ele1</th><th>Ele2</th><th>Ele3</th>
                        <th>Descripción</th><th>Moneda</th><th className={styles.num}>Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview || []).slice(0, 20).map((r, i) => (
                        <tr key={i} className={styles.row}>
                          <td>{r.CodGenerico}</td>
                          <td>{r.CodElemento1 || ""}</td>
                          <td>{r.CodElemento2 || ""}</td>
                          <td>{r.CodElemento3 || ""}</td>
                          <td>{r.DescripcionGen}</td>
                          <td>{r.Moneda}</td>
                          <td className={styles.num}>{money(r.Precio)}</td>
                        </tr>
                      ))}
                      {(!preview || preview.length === 0) && (
                        <tr><td colSpan={7} className={styles.noResults}>Sin datos para mostrar.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* === FIN MODAL === */}
    </div>
  );
};

export default ListaPreciosForm;
