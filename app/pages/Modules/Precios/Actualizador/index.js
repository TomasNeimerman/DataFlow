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
      const storedId = await window.api?.getStoreValue?.("idCliente");
      setIdCliente(storedId || null);
    })();
  }, []);

  const handleImportar = async (file) => {
    setMostrarPreciosActualizados(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (!json || !json.length) {
          validateExcelColumns([]);
          return;
        }

        const headers = json[0];
        if (!validateExcelColumns(headers)) return;

        const res = await processPriceUpdates(
          json,
          // APIs del preload
          (keys) => window.api.obtenerPrecioActualizador(keys),
          (payload) => window.api.updatePrecioActualizador(payload)
        );

        setPrecios(res.preciosProcesados || []);
        setValidar(!!res.huboCambios);
        setMostrarPreciosActualizados(true);
      } catch (err) {
        console.error("Error al procesar Excel (Actualizador):", err);
        setPrecios([]);
        setValidar(false);
        setMostrarPreciosActualizados(false);
      }
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
