// pages/components/ListaPreciosForm/index.js
"use client";
import { useEffect, useMemo, useState } from "react";
import usePreciosActualizador from "../../../public/hooks/preciosActualizador";
import styles from "./styles.module.css";

const ListaPreciosForm = ({
  nombreModulo = "Actualizador por Excel",
  idCliente,
}) => {
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [isOptionConfirmed, setIsOptionConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState("descargar"); // "descargar" | "importar" | "resultados"

  const {
    estadoImportar,
    mensajeImportacion,
    resultados,
    puedeVerResultados,
    handleDescargarLista,
    handleImportar,
  } = usePreciosActualizador();

  // auto-cambiar a "resultados" cuando haya datos que mostrar
  useEffect(() => {
    if (puedeVerResultados) setActiveSection("resultados");
  }, [puedeVerResultados]);

  // ----- módulos (solo título) -----
  const [modulos, setModulos] = useState([]);
  const [loadingModulos, setLoadingModulos] = useState(false);
  const [errorModulos, setErrorModulos] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!idCliente) return;
      try {
        if (typeof window === "undefined" || !window.api?.getModules) return;
        setLoadingModulos(true);
        setErrorModulos("");
        const res = await window.api.getModules(idCliente);
        if (!mounted) return;
        if (res?.success && Array.isArray(res?.data)) setModulos(res.data);
        else if (Array.isArray(res)) setModulos(res);
        else setErrorModulos("No se pudieron cargar los módulos.");
      } catch (e) {
        if (!mounted) return;
        setErrorModulos(e?.message || "Error al obtener módulos.");
      } finally {
        if (mounted) setLoadingModulos(false);
      }
    })();
    return () => { mounted = false; };
  }, [idCliente]);

  const moduloSeleccionado = useMemo(() => {
    if (!Array.isArray(modulos) || !modulos.length) return undefined;
    return modulos.find(
      (m) =>
        m?.nombre === nombreModulo ||
        m?.displayName === nombreModulo ||
        m?.key === nombreModulo
    );
  }, [modulos, nombreModulo]);

  const tituloModuloResuelto =
    (loadingModulos
      ? "Cargando…"
      : (moduloSeleccionado?.displayName || moduloSeleccionado?.nombre)) ||
    nombreModulo;

  // ----- códigos de lista -----
  const [codigosLista, setCodigosLista] = useState([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [errorCodigos, setErrorCodigos] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window === "undefined" || !window.api?.getCodigosLista) return;
        setLoadingCodigos(true);
        setErrorCodigos("");
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
          setCodigosLista(
            res.map((code) => ({
              value: String(code),
              label: String(code),
            }))
          );
        } else {
          setErrorCodigos("No se pudieron cargar los códigos de lista.");
        }
      } catch (e) {
        if (!mounted) return;
        setErrorCodigos(e?.message || "Error al obtener códigos de lista.");
      } finally {
        if (mounted) setLoadingCodigos(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- handlers visuales -----
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setIsFileLoaded(true);
    } else {
      setFile(null);
      setFileName("");
      setIsFileLoaded(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setFileName("");
    setIsFileLoaded(false);
    const fileInput =
      typeof document !== "undefined" ? document.getElementById("loadFile") : null;
    if (fileInput) fileInput.value = "";
  };

  const handleConfirmarSeleccion = () => {
    if (selectedOption) setIsOptionConfirmed(true);
  };

  const handleDescargarClick = () => {
    if (selectedOption) handleDescargarLista(selectedOption);
  };

  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
    setIsOptionConfirmed(false);
  };

  const handleImportarClick = () => {
    if (file && selectedOption) handleImportar(file, selectedOption);
  };

  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0,00";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

  const statusLower = typeof estadoImportar === "string" ? estadoImportar.toLowerCase() : "";
  const feedbackClass =
    statusLower.includes("error")
      ? styles.errorBox
      : statusLower.includes("sin cambios")
      ? styles.info
      : styles.successBox;

  return (
    <div className={`${styles.container} ${activeSection === "resultados" ? styles.containerWide : ""}`}>
      <div className={styles.titleContainer} style={{ marginBottom: "0.75rem" }}>
        <h1 className={styles.title}>{tituloModuloResuelto}</h1>
        {!!errorModulos && <small className={styles.errorText}>{errorModulos}</small>}
      </div>

      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${activeSection === "descargar" ? styles.active : ""}`}
          onClick={() => setActiveSection("descargar")}
        >
          Descargar lista
        </button>
        <button
          className={`${styles.toggleButton} ${activeSection === "importar" ? styles.active : ""}`}
          onClick={() => setActiveSection("importar")}
        >
          Importar lista
        </button>

        {puedeVerResultados && (
          <button
            className={`${styles.toggleButton} ${activeSection === "resultados" ? styles.active : ""}`}
            onClick={() => setActiveSection("resultados")}
            title="Ver resultados de la última actualización"
          >
            Resultados lista
          </button>
        )}
      </div>

      <div className={styles.sectionContent}>
        {activeSection === "descargar" && (
          <>
            <div className={styles.titleContainer}>
              <h2 className={styles.title}>Seleccionar Lista</h2>
            </div>

            <select
              className={styles.select}
              value={selectedOption}
              onChange={handleSelectChange}
              disabled={loadingCodigos}
            >
              <option value="">
                {loadingCodigos ? "Cargando listas..." : "Seleccione una opción..."}
              </option>
              {codigosLista.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
            {!!errorCodigos && (
              <small className={styles.errorText} style={{ display: "block", marginTop: 6 }}>
                {errorCodigos}
              </small>
            )}

            <button
              className={styles.btn}
              disabled={!selectedOption}
              onClick={handleConfirmarSeleccion}
              style={{ marginBottom: 12 }}
            >
              Confirmar Selección
            </button>

            {isOptionConfirmed && (
              <>
                <button className={styles.btn} onClick={handleDescargarClick}>
                  Descargar Lista
                </button>
                <p className={styles.info}>Opción seleccionada: {selectedOption}</p>
              </>
            )}
          </>
        )}

        {activeSection === "importar" && (
          <>
            <div className={styles.titleContainer}>
              <h1 className={styles.title}>Importar Datos</h1>
            </div>

            <input
              type="file"
              className={styles.input}
              id="loadFile"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />

            <div className={styles.buttonsContainer}>
              <button className={styles.btn} onClick={handleCancel}>
                Limpiar
              </button>
              <button
                className={styles.btn}
                disabled={!isFileLoaded || !selectedOption}
                onClick={handleImportarClick}
              >
                Importar
              </button>
            </div>

            {estadoImportar ? (
              <p className={feedbackClass}>{mensajeImportacion || estadoImportar}</p>
            ) : null}

            {fileName && (
              <p className={styles.info}>
                Archivo seleccionado: <strong>{fileName}</strong>
              </p>
            )}
          </>
        )}

        {activeSection === "resultados" && (
          <>
            <div className={styles.titleContainer}>
              <h2 className={styles.title}>Resultados de la actualización</h2>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    <th>Lista</th>
                    <th>Cod.Gen</th>
                    <th>Ele1</th>
                    <th>Ele2</th>
                    <th>Ele3</th>
                    <th className={styles.num}>Precio Anterior</th>
                    <th className={styles.num}>Precio Nuevo</th>
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
                    <tr>
                      <td colSpan={8} className={styles.noResults}>
                        No hay resultados para mostrar aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ListaPreciosForm;