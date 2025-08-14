// app/components/ModulesForm.js
"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

// Añadimos mensajeImportacion como prop
const ModuleForm = ({ idCliente,nombreModulo, onImportar, estadoImportar, mensajeImportacion }) => {
  const [modulos, setModulos] = useState([]);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState("");
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [template, setTemplate] = useState("");



  useEffect(() => {
    const fetchModulos = async () => {
      if (!idCliente) return;
      try {
        const response = await window.api.getModules(idCliente);
        console.log("Módulos obtenidos:", response);
        if (response.success) {
          const modulosFiltrados = response.modulos.filter(
            (modulo) => modulo.nombre === nombreModulo
          );
          console.log("Módulos filtrados:", modulosFiltrados, "por el nombre:", nombreModulo );
          setModulos(modulosFiltrados);

          setTemplate(modulosFiltrados[0]?.pathExcel);
        }
      } catch (err) {
        console.error("Fallo al obtener módulos:", err);
      }
    };

    fetchModulos();
  }, [idCliente, nombreModulo]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
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
    document.getElementById("loadFile").value = "";
  };

  const handleImportarClick = () => {
    if (file && onImportar) {
      onImportar(file);
    }
  };

  // Función para manejar la descarga de la plantilla
  const handleDownloadAndOpenTemplate = async () => {
    if (template && window.api && window.api.downloadAndOpenExcel) {
      try {
        // Assuming 'template' is the direct URL to the Excel file
        const result = await window.api.downloadAndOpenExcel(template);
        if (result.success) {
          console.log(result.message);
          // Optionally, show a success message to the user
        } else {
          console.error(result.message);
          alert(result.message); // Inform the user about the error
        }
      } catch (error) {
        console.error("Error calling Electron API:", error);
        alert("Ocurrió un error al intentar abrir la plantilla.");
      }
    } else {
      console.warn("No se proporcionó una ruta de plantilla de Excel o la API de Electron no está disponible.");
      // Fallback for web browser or if template is missing
      alert("La funcionalidad de apertura directa no está disponible en este entorno o la plantilla no fue especificada.");
    }
  };

  
  const titulo = modulos.length > 0 ? modulos[0].texto : "Cargando...";
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>{titulo}</h1>
        {template && (
          <button
            className={styles.template}
            onClick={handleDownloadAndOpenTemplate}
            title="Descargar Excel modelo"
          >
            ⇩
          </button>
        )}
      </div>

      <input
        type="file"
        className={styles.input}
        id="loadFile"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
      />
      <div className={styles.buttonsContainer}>
        <button className={styles.btn} id="cancel" onClick={handleCancel}>
          Limpiar
        </button>
        <button
          className={styles.btn}
          id="saveButton"
          disabled={!isFileLoaded}
          onClick={handleImportarClick}
        >
          Importar
        </button>
      </div>
      {/* Mostrar el mensaje de importación aquí */}
      {estadoImportar && (
        <p
          className={estadoImportar === "Importado correctamente" ? styles.success : estadoImportar === "Importación sin cambios" ? styles.info : styles.error}
        >
          {mensajeImportacion}
        </p>
      )}
    </div>
  );
};

export default ModuleForm;