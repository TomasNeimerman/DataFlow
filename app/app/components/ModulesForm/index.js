"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

const ModuleForm = ({ nombreModulo, onImportar }) => {
  const [modulos, setModulos] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    const storedIdCliente = localStorage.getItem("idCliente");
    setIdCliente(storedIdCliente);
  }, []);

  useEffect(() => {
    const fetchModulos = async () => {
      if (!idCliente) return;
      try {
        const response = await window.api.getModules(idCliente);
        if (response.success) {
          const modulosFiltrados = response.modulos.filter(
            (modulo) => modulo.nombre === nombreModulo
          );
          setModulos(modulosFiltrados);
        }
      } catch (err) {
        console.error("Fallo al obtener módulos:", err);
      }
    };

    fetchModulos();
  }, [idCliente, nombreModulo]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFile(file);
      setFileName(file.name);
      setIsFileLoaded(true);
    } else {
      setFile(null);
      setFileName("");
      setIsFileLoaded(false);
    }
  };

  const handleVerify = () => {
    if (!fileName || !modulos.length) return;
    const expected = modulos[0].pathExcel;
    const isValid = fileName === expected;
    const statusEl = document.getElementById("fileStatus");
    statusEl.innerText = isValid ? "Archivo válido" : "Archivo inválido";
  };

  const handleCancel = () => {
    setFile(null);
    setFileName("");
    setIsFileLoaded(false);
    document.getElementById("loadFile").value = "";
    document.getElementById("fileStatus").innerText = "";
  };

  const handleImportar = () => {
    if (file && onImportar) {
      onImportar(file);
    }
  };

  const titulo = modulos.length > 0 ? modulos[0].texto : "Cargando...";

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{titulo}</h1>
      <input
        type="file"
        className={styles.input}
        id="loadFile"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
      />
      <div className={styles.buttonsContainer}>
        <button className={styles.btn2} id="cancel" onClick={handleCancel}>
          Cancelar
        </button>
        <button
          className={styles.btn2}
          id="verifyButton"
          disabled={!isFileLoaded}
          onClick={handleVerify}
        >
          Verificar
        </button>
        <button
          className={styles.btn}
          id="saveButton"
          disabled={!isFileLoaded}
          onClick={handleImportar}
        >
          Importar
        </button>
      </div>
      <p className={styles.error} id="fileStatus"></p>
    </div>
  );
};

export default ModuleForm;
