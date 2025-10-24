"use client";

import { useCallback, useState } from "react";

/**
 * Hook: descarga XLSX, importa y valida Excel de Actualizador de Precios
 * - Abre archivo descargado (front hace openPath)
 * - Valida encabezado normalizando
 * - Requiere lista seleccionada y que coincida con la del Excel
 * - Valida por fila (lista, cod genérico y precio)
 * - Expone resultados y un flag para habilitar la sección de resultados
 */
export default function usePreciosActualizador() {
  const [estadoImportar, setEstadoImportar] = useState("");
  const [mensajeImportacion, setMensajeImportacion] = useState("");

  // NUEVO: resultados y flag
  const [resultados, setResultados] = useState([]);
  const [puedeVerResultados, setPuedeVerResultados] = useState(false);

  // Encabezado EXACTO del template (12 columnas, incluye Moneda)
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
    "Moneda",
    "Precio",
  ];

  // normaliza títulos leídos desde Excel (NBSP, espacios, case)
  const CLEAN = (s) =>
    String(s ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const headerEquals = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (CLEAN(a[i]) !== CLEAN(b[i])) return false;
    }
    return true;
  };

  /**
   * Parser robusto de precios con formatos AR / US / mixtos.
   */
  const parsePrecioAR = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;

    let s = String(v ?? "").trim();
    if (!s) return NaN;

    s = s.replace(/\u00A0/g, " ").replace(/\s+/g, "");

    const hasDot = s.includes(".");
    const hasComma = s.includes(",");

    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf(".");
      const lastComma = s.lastIndexOf(",");
      if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(/,/g, ".");
      } else {
        s = s.replace(/,/g, "");
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    }

    if (hasComma && !hasDot) {
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, ".");
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    }

    if (hasDot && !hasComma) {
      const parts = s.split(".");
      if (parts.length > 2) {
        const last = parts[parts.length - 1];
        if (/^\d{1,2}$/.test(last)) {
          const intPart = parts.slice(0, -1).join("");
          s = `${intPart}.${last}`;
        } else {
          s = parts.join("");
        }
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const normalize = (v) => String(v ?? "").trim();

  // ===== Descargar lista (backend genera XLSX y front lo abre) =====
  const openWithRetry = async (p, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      const r = await window.api.openPath(p);
      if (r?.success) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    await window.api.revealPath(p);
    return false;
  };

  const handleDescargarLista = async (selectedOption) => {
    if (!selectedOption) return;
    const r = await window.api.descargarListaXlsx(selectedOption);
    if (!r?.success || !r.path) {
      alert(r?.message || "No se pudo generar el Excel.");
      return;
    }
    await openWithRetry(r.path);
  };

  // ===== Importar excel con validaciones =====
  const handleImportar = useCallback(async (file, expectedListaCod) => {
    try {
      setEstadoImportar("");
      setMensajeImportacion("");
      // limpiar resultados previos
      setPuedeVerResultados(false);
      setResultados([]);

      if (!file) throw new Error("Debe seleccionar un Archivo Excel.");
      if (!expectedListaCod) throw new Error("Seleccione una Lista antes de importar.");

      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod.default || XLSXmod;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No se pudo leer la hoja del Excel.");

      // leer encabezado
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const firstRow = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        firstRow.push(cell ? String(cell.v) : "");
      }
      if (!headerEquals(firstRow, TEMPLATE_HEADER)) {
        throw new Error("El encabezado del Excel no coincide con la plantilla del módulo.");
      }

      // filas (raw:true conserva 'number' cuando la celda es numérica)
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
      if (!rows.length) throw new Error("El Excel no contiene filas de datos.");

      const items = [];
      const invalidRows = [];

      for (const r of rows) {
        const lprdlp_Cod = normalize(r["Lista de Precios - Cód."]);
        const lprart_CodGen = normalize(r["Artículo - Cód. Genérico"]);
        const lprart_CodEle1 = normalize(r["Artículo - Cód. Elemento 1"]);
        const lprart_CodEle2 = normalize(r["Artículo - Cód. Elemento 2"]);
        const lprart_CodEle3 = normalize(r["Artículo - Cód. Elemento 3"]);
        const lpr_Precio = parsePrecioAR(r["Precio"]);

        if (
          !lprdlp_Cod ||
          !lprart_CodGen ||
          !Number.isFinite(lpr_Precio) ||
          lprdlp_Cod !== String(expectedListaCod)
        ) {
          invalidRows.push(r);
          continue;
        }

        items.push({
          lprdlp_Cod,
          lprart_CodGen,
          lprart_CodEle1,
          lprart_CodEle2,
          lprart_CodEle3,
          lpr_Precio,
        });
      }

      if (!items.length) {
        throw new Error(
          "No hay filas válidas para actualizar (verifique lista, códigos y precio)."
        );
      }

      // backend
      const res = await window.api?.actualizarPreciosExcel?.(items);
      if (!res) throw new Error("No hubo respuesta del backend.");

      const updated = Number(res.updated ?? 0);
      const attempted = Number(res.attempted ?? items.length);
      const notFound = Number(res.notFound ?? 0);
      const detalle = Array.isArray(res.resultados) ? res.resultados : [];

      // guardar resultados para la tabla
      setResultados(detalle);
      setPuedeVerResultados((updated > 0) || detalle.length > 0);

      if (!res.success) {
        setEstadoImportar("Error");
        setMensajeImportacion(res.message || "Error al actualizar.");
        return res;
      }

      if (updated === 0 && notFound === 0) {
        setEstadoImportar("Importación sin cambios");
        setMensajeImportacion(
          "Los datos importados coinciden con los existentes o no aplican cambios."
        );
      } else if (updated > 0 && notFound === 0) {
        setEstadoImportar("Importado correctamente");
        setMensajeImportacion(`Actualizados: ${updated} de ${attempted}.`);
      } else if (updated > 0 && notFound > 0) {
        setEstadoImportar("Importado con advertencias");
        setMensajeImportacion(`Actualizados: ${updated}. No encontrados: ${notFound}.`);
      } else {
        setEstadoImportar("Error");
        setMensajeImportacion("No se actualizó ninguna fila válida.");
      }
      return res;
    } catch (e) {
      setPuedeVerResultados(false);
      setResultados([]);
      setEstadoImportar("Error");
      setMensajeImportacion(e?.message || "Error al importar.");
      return { success: false, message: e?.message || "Error al importar." };
    }
  }, []);

  return {
    estadoImportar,
    mensajeImportacion,
    resultados,
    puedeVerResultados,
    handleDescargarLista,
    handleImportar,
  };
}
