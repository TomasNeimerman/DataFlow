"use client";

import { useState } from "react";
import ui from "../../../pages/Modules/ActualizadordePrecios/styles.module.css";
import styles from "./styles.module.css";

export default function Importar({
  selectedOption = "",
  estadoImportar = "",
  mensajeImportacion = "",
  onImportarArchivo = () => {},
}) {
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const isFileLoaded = !!file;

  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setFileName(f ? f.name : "");
  };

  const onLimpiar = () => {
    setFile(null);
    setFileName("");
    const el = document?.getElementById("loadFile");
    if (el) el.value = "";
  };

  const statusLower = typeof estadoImportar === "string" ? estadoImportar.toLowerCase() : "";
  const feedbackClass = statusLower.includes("error")
    ? ui.errorBox
    : statusLower.includes("sin cambios")
    ? ui.info
    : ui.successBox;

  return (
    <>
      <div className={styles.titleWrap}><h2 className={ui.title}>Importar Datos</h2></div>

      <input
        type="file"
        className={ui.input}
        id="loadFile"
        accept=".xlsx, .xls"
        onChange={onFileChange}
      />

      <div className={ui.buttonsContainer}>
        <button className={ui.btn} onClick={onLimpiar}>Limpiar</button>
        <button
          className={ui.btn}
          disabled={!isFileLoaded || !selectedOption}
          onClick={() => onImportarArchivo(file)}
          title={selectedOption ? "" : "Seleccioná una lista en la solapa Descargar"}
        >
          Importar
        </button>
      </div>

      {estadoImportar ? (
        <p className={feedbackClass}>{mensajeImportacion || estadoImportar}</p>
      ) : null}

      {fileName && (
        <p className={ui.info}>
          Archivo Seleccionado: <strong>{fileName}</strong>
        </p>
      )}
    </>
  );
}
