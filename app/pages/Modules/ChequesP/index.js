// app/ChequesP/page.js
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import styles from "./styles.module.css";
import ChequesPForm from "../../components/ChequesPForm";
import useChequesError from "../../../public/hooks/chequesPError";

export default function ChequesP() {
  const [cheques, setCheques] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [validar, setValidar] = useState(false);

  const {
    importStatus,
    importMessage,
    validateExcelColumns,
    processChequeUpdates,
  } = useChequesError();

  useEffect(() => {
    const fetchIdCliente = async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    };
    fetchIdCliente();
  }, []);

  // Mantengo el formato de fecha DD/MM/YYYY que espera tu flujo
  const formatFecha = (excelDateStr) => {
    if (!excelDateStr) return "";
    // Si viene como Date de Excel o número serial:
    if (excelDateStr instanceof Date) {
      const d = excelDateStr;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    }
    if (typeof excelDateStr === "number") {
      // Convertir número serial Excel a fecha
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + excelDateStr * 86400000);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
    // Si ya viene como "dd/mm/yyyy" lo normalizamos
    if (typeof excelDateStr === "string") {
      const [d, m, y] = excelDateStr.split("/");
      if (d && m && y) {
        return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      }
    }
    return "";
  };

  // Mapea la fila según el ORDEN EXACTO del header de la plantilla chequesp.xlsx:
  // 0 CodEmpresa
  // 1 Emp.
  // 2 ID Cheque
  // 3 Mov. - F. Emisión
  // 4 Mov.
  // 5 Cheque - Tipo Valor - Cód.
  // 6 Cheq. / Doc. / Obl. - Estado
  // 7 Cheq. / Doc. / Obl. - F. Vto.
  // 8 Cheq. / Doc. / Obl. - Nro.
  // 9 Nro Definitivo
  // 10 IMPORTE
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

  const handleImportar = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

        if (!json || json.length === 0) {
          validateExcelColumns([]); // dispara error via hook
          return;
        }

        // Validar encabezados EXACTOS contra el hook
        const headers = json[0];
        if (!validateExcelColumns(headers)) return;

        // Filas útiles
        const rows = json.slice(1).filter((row) => row && row.length > 0 && row[0] !== undefined && row[0] !== "");
        const parsed = rows.map((row) => parseChequePRow(row, idCliente));

        // Procesar actualizaciones (usa window.api.obtenerCheques y window.api.updateCheques)
        const summary = await processChequeUpdates(
          parsed,
          window.api.obtenerCheques,
          window.api.updateCheques,
          idCliente
        );
        setCheques(summary.chequesProcesados); // ahora trae SOLO actualizados
        setValidar(summary.huboCambios);       // muestra resultados solo si hubo cambios
      } catch (error) {
        console.error("Error al procesar el archivo en ChequesP:", error);
        setCheques([]);
        setValidar(false);
      }
    };
    reader.onerror = (err) => {
      console.error("Error al leer el archivo:", err);
      setCheques([]);
      setValidar(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <ChequesPForm
        idCliente={idCliente}
        nombreModulo="Cheques Propios"
        onImportar={handleImportar}
        estadoImportar={importStatus}
        mensajeImportacion={importMessage}
        // Resultados (para la pestaña Resultados)
        resultadosCheques={cheques}
        validarResultados={validar}
      />
    </div>
  );
}