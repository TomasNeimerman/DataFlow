// ModuleForm.js
"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import * as XLSX from 'xlsx';

const ModuleForm = ({ nombreModulo, onImportar, excelRows }) => {
  const [modulos, setModulos] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [file, setFile] = useState(null);
  const [esValido, setEsValido] = useState(false);
  const [mensajeValidacion, setMensajeValidacion] = useState("");

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
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setIsFileLoaded(true);
      setEsValido(false); // Resetear la validez al cargar un nuevo archivo
      setMensajeValidacion("");
    } else {
      setFile(null);
      setFileName("");
      setIsFileLoaded(false);
      setEsValido(false);
      setMensajeValidacion("");
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setMensajeValidacion("Por favor, selecciona un archivo.");
      setEsValido(false);
      return;
    }

    if (!excelRows || excelRows.length === 0) {
      setMensajeValidacion("No se proporcionaron las columnas esperadas para la validación.");
      setEsValido(false);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const binaryString = e.target.result;
        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const headers = XLSX.utils.sheet_to_row_object_array(worksheet, { header: 1 })[0] || [];

        let sonColumnasCorrectas = true;

        if (headers.length !== excelRows.length) {
          sonColumnasCorrectas = false;
          console.log("No coincide la longitud")
        } else {
          for (let i = 0; i < headers.length; i++) {
            console.log(`${headers[i]} // ${excelRows[i]}`)
            if (headers[i] !== excelRows[i]) {
              console.log(`El valor ${headers[i]} no coincide con ${excelRows[i]}`)
              sonColumnasCorrectas = false;
              break; // Salir del bucle tan pronto como se encuentre una diferencia
            }
          }
        }

        setEsValido(sonColumnasCorrectas);
        setMensajeValidacion(
          sonColumnasCorrectas ? "Las columnas del archivo son correctas." : "Las columnas del archivo no coinciden con el formato esperado."
        );
      };
      reader.onerror = () => {
        setMensajeValidacion("Error al leer el archivo.");
        setEsValido(false);
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      setMensajeValidacion("Error al procesar el archivo.");
      setEsValido(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setFileName("");
    setIsFileLoaded(false);
    setEsValido(false);
    setMensajeValidacion("");
    document.getElementById("loadFile").value = "";
  };

  const handleImportar = () => {
    if (file && esValido && onImportar) {
      onImportar(file);
    } else if (!esValido) {
      setMensajeValidacion("Por favor, verifica que las columnas del archivo sean correctas antes de importar.");
    } else if (!file) {
      setMensajeValidacion("Por favor, selecciona un archivo para importar.");
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
          disabled={!isFileLoaded || !esValido}
          onClick={handleImportar}
        >
          Importar
        </button>
      </div>
      <p className={styles.error} id="fileStatus">{mensajeValidacion}</p>
    </div>
  );
};

export default ModuleForm;