"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../../components/EmpresaSelected";
import usePreciosActualizador from "../../../public/hooks/preciosActualizador";

// Tabs
import DescargarTab from "../../components/ListaPreciosTabs/DescargarTab";
import ImportarTab from "../../components/ListaPreciosTabs/ImportarTab";
import ResultadosTab from "../../components/ListaPreciosTabs/ResultadosTab";
import ClientesTab from "../../components/ListaPreciosTabs/ClientesTab";

export default function ActualizadordePrecios() {
  // Hook base: importar/descargar/resultados (como antes)
  const {
    estadoImportar,
    mensajeImportacion,
    handleDescargarLista,
    handleImportar,
    resultados,
    puedeVerResultados,
  } = usePreciosActualizador();

  // --- Tabs ---
  const [activeTab, setActiveTab] = useState("descargar"); // descargar | importar | resultados | clientes

  // --- Codigos de Lista (compartido para Descargar/Importar) ---
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
          setErrorCodigos("No se pudieron cargar los Códigos de Lista.");
        }
      } catch (e) {
        if (!mounted) return;
        setErrorCodigos(e?.message || "Error al obtener códigos de lista.");
      } finally { if (mounted) setLoadingCodigos(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // --- Selección de lista + Vista previa (modal) ---
  const [selectedOption, setSelectedOption] = useState(""); // código de lista
  const [isOptionConfirmed, setIsOptionConfirmed] = useState(false);

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
      else setErrorPreview(res?.message || "No se pudo obtener la Vista Previa.");
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

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setIsPreviewOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen]);

  // --- Resultados de asignación de Clientes (desde tab Clientes) ---
  const [cliAsignacionResultados, setCliAsignacionResultados] = useState(null);

  const handleAsignacionCompleta = useCallback((detalle) => {
    setCliAsignacionResultados(detalle);     // lo muestra en Resultados
    setActiveTab("resultados");              // saltar a resultados
  }, []);

  // --- Título dinámico (simple y efectivo) ---


  // --- Helpers para acciones delegadas a tabs ---
  const onDescargarClick = useCallback(() => {
    if (selectedOption) handleDescargarLista(selectedOption);
  }, [selectedOption, handleDescargarLista]);

  const onImportarArchivo = useCallback((file) => {
    if (file && selectedOption) handleImportar(file, selectedOption);
  }, [selectedOption, handleImportar]);

  // Money util para modal
  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0,00";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        {/* Título */}
        <div className={styles.titleContainer} style={{ marginBottom: "0.75rem" }}>
          <h1 className={styles.title}>{activeTab == "clientes" ? "Clientes - Asignación de Listas de Precios" : "Actualizador de Listas de Precios por Excel"}</h1>
          <EmpresaSelected />
        </div>

        {/* Tabs */}
        <div className={styles.toggleContainer}>
          <button
            className={`${styles.toggleButton} ${activeTab === "descargar" ? styles.active : ""}`}
            onClick={() => setActiveTab("descargar")}
          >
            Descargar Lista
          </button>
          <button
            className={`${styles.toggleButton} ${activeTab === "importar" ? styles.active : ""}`}
            onClick={() => setActiveTab("importar")}
          >
            Importar Lista
          </button>
          {(puedeVerResultados || !!cliAsignacionResultados) && (
            <button
              className={`${styles.toggleButton} ${activeTab === "resultados" ? styles.active : ""}`}
              onClick={() => setActiveTab("resultados")}
              title="Ver resultados de la última actualización"
            >
              Resultados
            </button>
          )}
          <button
            className={`${styles.toggleButton} ${activeTab === "clientes" ? styles.active : ""}`}
            onClick={() => setActiveTab("clientes")}
          >
            Clientes
          </button>
        </div>

        {/* Contenido */}
        <div className={styles.sectionContent}>
          {activeTab === "descargar" && (
            <DescargarTab
              codigosLista={codigosLista}
              loadingCodigos={loadingCodigos}
              errorCodigos={errorCodigos}
              selectedOption={selectedOption}
              onSelectChange={(v) => { setSelectedOption(v); setIsOptionConfirmed(false); }}
              isOptionConfirmed={isOptionConfirmed}
              onConfirmarSeleccion={handleConfirmarSeleccion}
              onVerVistaPrevia={() => { setIsPreviewOpen(true); fetchPreview(selectedOption); }}
              onDescargarClick={onDescargarClick}
            />
          )}

          {activeTab === "importar" && (
            <ImportarTab
              selectedOption={selectedOption}
              estadoImportar={estadoImportar}
              mensajeImportacion={mensajeImportacion}
              onImportarArchivo={onImportarArchivo}
            />
          )}

          {activeTab === "resultados" && (
            <ResultadosTab
              resultados={resultados}
              cliDetalle={cliAsignacionResultados}
            />
          )}

          {activeTab === "clientes" && (
            <ClientesTab
              onAsignacionCompleta={handleAsignacionCompleta}
            />
          )}
        </div>
      </div>

      {/* === MODAL DE VISTA PREVIA === */}
      {isPreviewOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e)=>{ if (e.target === e.currentTarget) setIsPreviewOpen(false); }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.title} style={{ margin: 0 }}>
                Vista previa – Lista {selectedOption}
              </h3>
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
}
