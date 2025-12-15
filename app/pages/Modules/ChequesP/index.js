// app/pages/Modules/ChequesP/index.js
"use client";

import { useEffect, useState } from "react";
import styles from "./styles.module.css";        // 👈 usa tu .body y .img
import ChequesPForm from "../../components/ChequesPForm";
import ChequesPModificar from "../../components/ChequesPModificar";
import useChequesError from "../../../public/hooks/chequesPError";
import * as XLSX from "xlsx";
import EmpresaSelected from "../../components/EmpresaSelected";

export default function ChequesPContainer() {
  const [activeTab, setActiveTab] = useState("modificar"); // "modificar" | "excel"

  const [idCliente, setIdCliente] = useState(null);
  useEffect(() => {
    (async () => {
      if (window.api?.getStoreValue) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    })();
  }, []);

  // ======== lógica de "Actualizar Cheques Excel" ========
  const { importStatus, importMessage, validateExcelColumns, processChequeUpdates } =
    useChequesError();

  const [cheques, setCheques] = useState([]);
  const [validar, setValidar] = useState(false);

  const formatFecha = (excelDateStr) => {
    if (!excelDateStr || typeof excelDateStr !== "string") return "";
    const [d, m, y] = excelDateStr.split("/");
    if (!d || !m || !y) return "";
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  };

  const parseChequePRow = (row, idCliente) => ({
    codEmp: row[0],
    emp: row[1],
    idCheque: parseInt(row[2] || 0, 10),
    fechaEmision: formatFecha(row[3]),
    movimiento: row[4],
    tipoCheque: row[5],
    estado: row[6],
    fechaVenc: formatFecha(row[7]),
    chequeCodigo: row[8],
    nroDefinitivo: row[9],
    importe: row[10],
    idCliente,
  });

  const handleImportarExcel = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (!json || json.length === 0) {
          validateExcelColumns([]);
          return;
        }

        const headers = json[0];
        if (!validateExcelColumns(headers)) return;

        const rows = json.slice(1).filter((row) => row.length > 0 && row[0]);
        const parsed = rows.map((row) => parseChequePRow(row, idCliente));

        const summary = await processChequeUpdates(
          parsed,
          window.api.obtenerCheques,
          window.api.updateCheques,
          idCliente
        );

        setCheques(summary.chequesProcesados);
        setValidar(summary.huboCambios);
      } catch (error) {
        console.error("Error al procesar el archivo en ChequesP:", error);
        setCheques([]);
        setValidar(false);
      }
    };
    reader.onerror = () => {
      setCheques([]);
      setValidar(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // UI tabs (dejo inline para no tocar tu CSS del index)
  return (
    <div className={styles.body}>


      <div
        className={styles.container}
      >
        
        <div className={styles.titleContainer}>
        <h1 className={styles.title}>Renumerador de Cheques Propios</h1>
        <EmpresaSelected />
        </div>
        <div className={styles.toggleContainer}>
          <button
          className={`${styles.toggleButton} ${activeTab === "modificar" ? styles.active : ""}`}
          onClick={() => setActiveTab("modificar")}
        >
          Modificar Cheques
        </button>
        <button
          className={`${styles.toggleButton} ${activeTab === "excel" ? styles.active : ""}`}
          onClick={() => setActiveTab("excel")}
        >
          Renumeración Masiva
        </button>
        
        </div>
      
      <div>
        {activeTab === "excel" ? (
          <ChequesPForm
            idCliente={idCliente}
            nombreModulo="Cheques Propios"
            onImportar={handleImportarExcel}
            estadoImportar={importStatus}
            mensajeImportacion={importMessage}
            resultadosCheques={cheques}
            validarResultados={validar}
          />
          
        ) : (
          <ChequesPModificar />
        )}
      </div>
      </div>
    </div>
  );
}
