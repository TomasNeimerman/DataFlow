// app/PreciosActualizador/page.js
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import styles from "./styles.module.css";

import ModuleForm from "../../../components/ModulesForm";
import PreciosActualizados from "../../../components/PreciosActualizados";
import usePreciosActualizador from "../../../../public/hooks/preciosActualizador";

export default function PreciosActualizador() {
  const [idCliente, setIdCliente] = useState(null);
  const [precios, setPrecios] = useState([]);
  const [validar, setValidar] = useState(false);
  const [mostrarPreciosActualizados, setMostrarPreciosActualizados] = useState(false);

  const {
    importStatus,
    importMessage,
    validateExcelColumns,
    processPriceUpdates,
  } = usePreciosActualizador();

  useEffect(() => {
    (async () => {
      try {
        const storedId = await window?.api?.getStoreValue?.("idCliente");
        setIdCliente(storedId ?? null);
      } catch {
        setIdCliente(null);
      }
    })();
  }, []);

  const handleImportar = async (file) => {
    // Reset de la vista de resultados
    setMostrarPreciosActualizados(false);
    setPrecios([]);
    setValidar(false);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // defval: '' para no obtener undefined en celdas vacías
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

        if (!json || json.length === 0) {
          // Fuerza mensaje de columnas faltantes
          validateExcelColumns([]);
          return;
        }

        // ✅ Validación SOLO de la primera fila (encabezados) por “contiene”
        const headers = json[0];
        if (!validateExcelColumns(headers)) return;

        // ✅ Procesamiento: valida filas, busca precio actual y actualiza si corresponde
        const result = await processPriceUpdates(
          json,
          (keys) => window?.api?.obtenerPrecioActualizador?.(keys),   // { lprdlp_Cod, lprart_CodGen, Ele1..3 }
          (payload) => window?.api?.updatePrecioActualizador?.(payload) // { ...keys, precio }
        );

        setPrecios(result?.preciosProcesados || []);
        setValidar(!!result?.huboCambios);
        setMostrarPreciosActualizados(true);
      } catch (err) {
        console.error("Error al procesar Excel (PreciosActualizador):", err);
        setPrecios([]);
        setValidar(false);
        setMostrarPreciosActualizados(false);
      }
    };

    reader.onerror = (err) => {
      console.error("Error leyendo el archivo:", err);
      setPrecios([]);
      setValidar(false);
      setMostrarPreciosActualizados(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <ModuleForm
        idCliente={idCliente}
        nombreModulo="Actualizador de listas de precios"
        onImportar={handleImportar}
        estadoImportar={importStatus}
        mensajeImportacion={importMessage}
      />

      {mostrarPreciosActualizados && (
        <PreciosActualizados precios={precios} validar={validar} />
      )}
    </div>
  );
}
