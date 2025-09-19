// Modules/Precios/Actualizador/usePreciosActualizador.js
"use client";

import { useCallback, useState } from "react";

/**
 * Hook que encapsula:
 * - Import dinámico de XLSX (evita problemas de hidratar)
 * - Validación de encabezado contra plantilla
 * - Validación por fila (cod lista, cod genérico y precio)
 * - Llamadas a window.api para descargar/actualizar
 * - Mensajes de estado
 */

export default function usePreciosActualizador() {
  const [estadoImportar, setEstadoImportar] = useState("");
  const [mensajeImportacion, setMensajeImportacion] = useState("");

  // Plantilla exacta esperada para la primera fila del Excel
  const TEMPLATE_HEADER = [
    "lprdlp_Cod",
    "lprart_CodGen",
    "lprart_CodEle1",
    "lprart_CodEle2",
    "lprart_CodEle3",
    "art_DescGen",
    "lpr_Precio",
  ];

  const normalize = (v) => String(v ?? "").trim();

  const headerEquals = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (normalize(a[i]).toLowerCase() !== normalize(b[i]).toLowerCase()) return false;
    }
    return true;
  };

  // Campos mínimos por fila: cod lista, cod genérico y precio
  const hasRequiredRowFields = (row) => {
    const codLista = normalize(row.lprdlp_Cod ?? row["Lista"]);
    const codGen   = normalize(row.lprart_CodGen ?? row["Código"] ?? row["CodGen"]);
    const precio   = Number(row.lpr_Precio ?? row["Precio"] ?? row["Precio Nuevo"] ?? row["PrecioNuevo"]);
    return !!codLista && !!codGen && Number.isFinite(precio);
  };

  const mapRowToPayload = (row) => ({
    lprdlp_Cod: normalize(row.lprdlp_Cod ?? row["Lista"] ?? ""),
    lprart_CodGen: normalize(row.lprart_CodGen ?? row["Código"] ?? row["CodGen"] ?? ""),
    lprart_CodEle1: normalize(row.lprart_CodEle1 ?? row["CodEle1"] ?? ""),
    lprart_CodEle2: normalize(row.lprart_CodEle2 ?? row["CodEle2"] ?? ""),
    lprart_CodEle3: normalize(row.lprart_CodEle3 ?? row["CodEle3"] ?? ""),
    lpr_Precio: Number(row.lpr_Precio ?? row["Precio"] ?? row["Precio Nuevo"] ?? row["PrecioNuevo"] ?? NaN),
  });

  // ===== Descargar lista (el main genera el XLSX) =====
  const handleDescargarLista = useCallback(async (codLista) => {
    try {
      setEstadoImportar(""); setMensajeImportacion("");
      const res = await window.api?.descargarListaXlsx?.(codLista);
      if (!res?.success) throw new Error(res?.message || "No se pudo generar el archivo.");
      await window.api?.openPath?.(res.path);
      setEstadoImportar("Listo");
      setMensajeImportacion("Archivo generado.");
    } catch (e) {
      setEstadoImportar("Error");
      setMensajeImportacion(e?.message || "Error al descargar.");
    }
  }, []);

  // ===== Importar excel con validaciones =====
  const handleImportar = useCallback(async (file) => {
    try {
      setEstadoImportar(""); setMensajeImportacion("");

      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod.default || XLSXmod;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No se pudo leer la hoja del Excel.");

      // 1) Header exacto
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const firstRow = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        firstRow.push(cell ? String(cell.v) : "");
      }
      if (!headerEquals(firstRow, TEMPLATE_HEADER)) {
        throw new Error("El encabezado del Excel no coincide con la plantilla del módulo.");
      }

      // 2) Filas
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // 3) Validación por fila + mapeo
      const invalidRows = [];
      const items = [];
      for (const r of rows) {
        if (hasRequiredRowFields(r)) items.push(mapRowToPayload(r));
        else invalidRows.push(r);
      }
      if (!items.length) throw new Error("El archivo no contiene filas válidas (faltan claves o precio).");

      // 4) Envío al backend
      const res = await window.api?.actualizarPreciosExcel?.(items);
      if (!res) throw new Error("No hubo respuesta del backend.");

      const updated = Number(res.updated ?? 0);
      const invalid = Array.isArray(res.invalid) ? res.invalid.length : 0;

      if (!res.success) {
        setEstadoImportar("Error");
        setMensajeImportacion(res.message || "Error al actualizar.");
        return;
      }

      if (updated === 0 && invalid === 0) {
        setEstadoImportar("Importación sin cambios");
        setMensajeImportacion("Los datos importados coinciden con los existentes o no aplican cambios.");
      } else if (updated > 0 && invalid === 0) {
        setEstadoImportar("Importado correctamente");
        setMensajeImportacion(`Actualizados: ${updated}.`);
      } else if (updated > 0 && invalid > 0) {
        setEstadoImportar("Importado con advertencias");
        setMensajeImportacion(`Actualizados: ${updated}. Filas inválidas: ${invalid + invalidRows.length}.`);
      } else if (updated === 0 && (invalid > 0 || invalidRows.length > 0)) {
        setEstadoImportar("Error");
        setMensajeImportacion(`No se actualizaron filas. Filas inválidas: ${invalid + invalidRows.length}.`);
      } else {
        setEstadoImportar("Importado");
        setMensajeImportacion(res.message || `Actualizados: ${updated}.`);
      }
    } catch (e) {
      setEstadoImportar("Error");
      setMensajeImportacion(e?.message || "Error al importar.");
    }
  }, []);

  return { estadoImportar, mensajeImportacion, handleDescargarLista, handleImportar };
}
