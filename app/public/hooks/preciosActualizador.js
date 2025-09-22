// Modules/Precios/Actualizador/usePreciosActualizador.js
"use client";

import { useCallback, useState } from "react";

/**
 * Hook de Actualización de Precios por Excel
 * - Valida encabezado EXACTO (11 columnas)
 * - Valida filas mínimas (lista, código genérico y precio)
 * - Descarga XLSX de una lista seleccionada
 * - Importa XLSX, envía al backend y expone resultados para mostrarlos en UI
 */

export default function usePreciosActualizador() {
  const [estadoImportar, setEstadoImportar] = useState("");
  const [mensajeImportacion, setMensajeImportacion] = useState("");

  // Resultados que vuelve el backend
  const [resultados, setResultados] = useState([]);           
  const [puedeVerResultados, setPuedeVerResultados] = useState(false);

  // Plantilla EXACTA (en el orden indicado)
  const TEMPLATE_HEADER = [
    "Lista de Precios - Cód.",
    "Lista de Precios",
    "Artículo - Cód. Genérico",
    "Artículo - Cód. Elemento 1",
    "Artículo - Cód. Elemento 2",
    "Artículo - Cód. Elemento 3",
    "Artículo - Desc.Genérica",
    "Artículo - Elemento 1",
    "Artículo - Elemento 2",
    "Artículo - Elemento 3",
    "Precio",
  ];

  const normalize = (v) => String(v ?? "").trim();

  const headerEquals = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (normalize(a[i]).toLowerCase() !== normalize(b[i]).toLowerCase()) return false;
    }
    return true;
  };

  // Validaciones de fila según plantilla
  const hasRequiredRowFields = (row) => {
    const codLista = normalize(row["Lista de Precios - Cód."]);
    const codGen   = normalize(row["Artículo - Cód. Genérico"]);
    const precio   = Number(row["Precio"]);
    return !!codLista && !!codGen && Number.isFinite(precio);
  };

  // Mapea Excel → payload backend
  const mapRowToPayload = (row) => ({
    lprdlp_Cod:     normalize(row["Lista de Precios - Cód."] ?? ""),
    lprart_CodGen:  normalize(row["Artículo - Cód. Genérico"] ?? ""),
    lprart_CodEle1: normalize(row["Artículo - Cód. Elemento 1"] ?? ""),
    lprart_CodEle2: normalize(row["Artículo - Cód. Elemento 2"] ?? ""),
    lprart_CodEle3: normalize(row["Artículo - Cód. Elemento 3"] ?? ""),
    lpr_Precio: Number(row["Precio"] ?? NaN),
  });

  // Descargar lista (XLSX)
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

  // Importar XLSX con validaciones
  const handleImportar = useCallback(async (file) => {
    try {
      if (!file) {
        setEstadoImportar("Error");
        setMensajeImportacion("Seleccione un archivo XLSX.");
        return;
      }

      // limpiar resultados previos
      setResultados([]);
      setPuedeVerResultados(false);
      setEstadoImportar(""); 
      setMensajeImportacion("");

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
      if (!items.length) {
        setEstadoImportar("Importación sin cambios");
        setMensajeImportacion("El archivo no contiene filas válidas.");
        return;
      }

      // 4) Envío al backend
      const res = await window.api?.actualizarPreciosExcel?.(items);
      if (!res) throw new Error("No hubo respuesta del backend.");

      const updated   = Number(res.updated ?? 0);
      const attempted = Number(res.attempted ?? items.length);
      const notFound  = Number(res.notFound ?? 0);
      const det       = Array.isArray(res.resultados) ? res.resultados : [];

      // guardar resultados (para la sección “Resultados lista”)
      setResultados(det);
      setPuedeVerResultados(updated > 0);

      if (!res.success) {
        setEstadoImportar("Error");
        setMensajeImportacion(res.message || "Error al actualizar.");
        return;
      }

      if (updated === 0) {
        setEstadoImportar("Importación sin cambios");
        setMensajeImportacion(`Actualizados: 0 / Intentados: ${attempted} • No encontrados: ${notFound}`);
      } else {
        setEstadoImportar("Importado correctamente");
        setMensajeImportacion(`Actualizados: ${updated} / Intentados: ${attempted} • No encontrados: ${notFound}`);
      }
    } catch (e) {
      setEstadoImportar("Error");
      setMensajeImportacion(e?.message || "Error al importar.");
    }
  }, []);

  return {
    estadoImportar,
    mensajeImportacion,
    resultados,
    puedeVerResultados,
    handleDescargarLista,
    handleImportar
  };
}
