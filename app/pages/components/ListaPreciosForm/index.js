// Modules/Precios/Actualizador/ListaPreciosForm.js
"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";

const ListaPreciosForm = ({
  nombreModulo = "Actualizador por Excel",
  onImportar,
  onDescargarLista,
  estadoImportar,
  mensajeImportacion,
  idCliente,
}) => {
  // ----- estado base -----
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [isOptionConfirmed, setIsOptionConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState("descargar");

  // ----- módulos (para resolver título) -----
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
    return () => {
      mounted = false;
    };
  }, [idCliente]);

  // Comparación directa (sin normalizar)
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
      : moduloSeleccionado?.displayName || moduloSeleccionado?.nombre) ||
    nombreModulo;

  // ----- códigos de lista (Código - Descripción) -----
  const [codigosLista, setCodigosLista] = useState([]); // [{ value, label }]
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [errorCodigos, setErrorCodigos] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window === "undefined" || !window.api?.getCodigosLista) return;
        setLoadingCodigos(true);
        setErrorCodigos("");
        const res = await window.api.getCodigosLista(); // -> { success, data: [{ lprdlp_Cod, dlp_Desc }] }
        if (!mounted) return;

        if (res?.success && Array.isArray(res?.data)) {
          const mapped = res.data.map(({ lprdlp_Cod, dlp_Desc }) => {
            const code = String(lprdlp_Cod || "").trim();
            const desc = String(dlp_Desc || "").trim();
            return { value: code, label: desc ? `${code} - ${desc}` : code };
          });
          setCodigosLista(mapped);
        } else if (Array.isArray(res)) {
          // fallback si viniera array simple
          const mapped = res.map((code) => ({
            value: String(code),
            label: String(code),
          }));
          setCodigosLista(mapped);
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
    return () => {
      mounted = false;
    };
  }, []);

  // ----- handlers -----
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

  const handleImportarClick = () => {
    if (file && onImportar) onImportar(file);
  };

  const handleConfirmarSeleccion = () => {
    if (selectedOption) setIsOptionConfirmed(true);
  };

  const handleDescargarLista = () => {
    if (selectedOption && onDescargarLista) onDescargarLista(selectedOption);
  };

  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
    setIsOptionConfirmed(false);
  };

  const statusLower = typeof estadoImportar === "string" ? estadoImportar.toLowerCase() : "";
  const feedbackClass = statusLower.includes("error")
    ? styles.errorBox
    : statusLower.includes("sin cambios")
    ? styles.info
    : styles.successBox;

  return (
    <div className={styles.container}>
      {/* Título */}
      <div className={styles.titleContainer} style={{ marginBottom: "0.75rem" }}>
        <h1 className={styles.title}>{tituloModuloResuelto}</h1>
        {!!errorModulos && <small className={styles.errorText}>{errorModulos}</small>}
      </div>

      {/* Tabs */}
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${
            activeSection === "descargar" ? `${styles.active} ${styles.activeDownload}` : ""
          }`}
          onClick={() => setActiveSection("descargar")}
        >
          Descargar lista
        </button>
        <button
          className={`${styles.toggleButton} ${
            activeSection === "importar" ? `${styles.active} ${styles.activeImport}` : ""
          }`}
          onClick={() => setActiveSection("importar")}
        >
          Importar lista
        </button>
      </div>

      {/* Contenido */}
      <div className={styles.sectionContent}>
        {activeSection === "descargar" && (
          <>
            <div className={styles.titleContainer}>
              <h1 className={styles.title}>Seleccionar Lista</h1>
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

            <button className={styles.btn} disabled={!selectedOption} onClick={handleConfirmarSeleccion}>
              Confirmar Selección
            </button>

            {isOptionConfirmed && (
              <>
                <button className={styles.btn} onClick={handleDescargarLista}>
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
              <button className={styles.btn} disabled={!isFileLoaded} onClick={handleImportarClick}>
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
      </div>
    </div>
  );
};

export default ListaPreciosForm;
