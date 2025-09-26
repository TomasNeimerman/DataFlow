"use client";

import { useCallback, useState } from "react";

export default function usePreciosActualizador() {
  const [estadoImportar, setEstadoImportar] = useState("");
  const [mensajeImportacion, setMensajeImportacion] = useState("");

  // 👉 NUEVO: resultados y flag para habilitar la sección
  const [resultados, setResultados] = useState([]);
  const [puedeVerResultados, setPuedeVerResultados] = useState(false);

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

  const parsePrecioAR = (v) => {
    if (typeof v === "number") return v;
    const s = String(v ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/[^\d.,-]/g, "")
      .trim();
    if (!s) return NaN;
    const n = Number(s.replace(/\./g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const normalize = (v) => String(v ?? "").trim();

  // ===== Descargar =====
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
    const r = await window.api.descargarListaXlsx(String(selectedOption));
    if (!r?.success || !r.path) {
      alert(r?.message || "No se pudo generar el Excel.");
      return;
    }
    await openWithRetry(r.path);
  };

  // ===== Importar =====
  const handleImportar = useCallback(async (file, expectedListaCod) => {
    try {
      setEstadoImportar("");
      setMensajeImportacion("");
      // al iniciar una importación, limpiamos resultados previos
      setResultados([]);
      setPuedeVerResultados(false);

      if (!file) throw new Error("Debe seleccionar un archivo Excel.");
      if (!expectedListaCod) throw new Error("Seleccione una lista antes de importar.");

      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod.default || XLSXmod;

      // Lectura robusta del archivo
      let buf;
      try {
        buf = await file.arrayBuffer();
      } catch (e) {
        try {
          buf = await file.slice(0, file.size).arrayBuffer();
        } catch {
          const msg =
            e?.name === "NotReadableError" || e?.name === "SecurityError"
              ? "El archivo no pudo leerse. Volvé a seleccionarlo e intentá nuevamente."
              : (e?.message || "No se pudo leer el archivo.");
          throw new Error(msg);
        }
      }

      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No se pudo leer la hoja del Excel.");

      // Buscar la fila de encabezado en las primeras 10 filas
      const rng = XLSX.utils.decode_range(ws["!ref"]);
      const readRow = (rowIdx) => {
        const out = [];
        for (let C = rng.s.c; C <= rng.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: C })];
          out.push(cell ? String(cell.v) : "");
        }
        return out;
      };

      let headerRow = null;
      const MAX_SCAN = Math.min(10, rng.e.r - rng.s.r + 1);
      for (let i = 0; i < MAX_SCAN; i++) {
        const rowIdx = rng.s.r + i;
        if (headerEquals(readRow(rowIdx), TEMPLATE_HEADER)) {
          headerRow = rowIdx;
          break;
        }
      }
      if (headerRow == null) {
        throw new Error("El encabezado del Excel no coincide con la plantilla del módulo.");
      }

      // Transformar filas con claves exactas
      const dataRange = {
        s: { r: headerRow + 1, c: rng.s.c },
        e: { r: rng.e.r,       c: rng.e.c },
      };

      const rows = XLSX.utils.sheet_to_json(ws, {
        header: TEMPLATE_HEADER,
        range: dataRange,
        defval: "",
        raw: false,
      });

      if (!rows.length) throw new Error("El Excel no contiene filas de datos.");

      const items = [];
      for (const r of rows) {
        const lprdlp_Cod     = normalize(r["Lista de Precios - Cód."]);
        const lprart_CodGen  = normalize(r["Artículo - Cód. Genérico"]);
        const lprart_CodEle1 = normalize(r["Artículo - Cód. Elemento 1"]);
        const lprart_CodEle2 = normalize(r["Artículo - Cód. Elemento 2"]);
        const lprart_CodEle3 = normalize(r["Artículo - Cód. Elemento 3"]);
        const lpr_Precio     = parsePrecioAR(r["Precio"]);

        // Requeridos + lista debe coincidir
        if (!lprdlp_Cod || !lprart_CodGen || !Number.isFinite(lpr_Precio) || lprdlp_Cod !== String(expectedListaCod)) {
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
        throw new Error("No hay filas válidas para actualizar (verifique lista, códigos y precio).");
      }

      // Envío al backend
      const res = await window.api?.actualizarPreciosExcel?.(items);
      if (!res) throw new Error("No hubo respuesta del backend.");

      const updated   = Number(res.updated ?? 0);
      const attempted = Number(res.attempted ?? items.length);
      const notFound  = Number(res.notFound ?? 0);
      const det       = Array.isArray(res.resultados) ? res.resultados : [];

      if (!res.success) {
        setEstadoImportar("Error");
        setMensajeImportacion(res.message || "Error al actualizar.");
        setResultados([]);
        setPuedeVerResultados(false);
        return res;
      }

      // Guardamos resultados y habilitamos sección si hay cambios
      setResultados(det);
      setPuedeVerResultados(updated > 0 && det.length > 0);

      if (updated === 0 && notFound === 0) {
        setEstadoImportar("Importación sin cambios");
        setMensajeImportacion("Los datos importados coinciden con los existentes o no aplican cambios.");
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
      setResultados([]);
      setPuedeVerResultados(false);
      setEstadoImportar("Error");
      setMensajeImportacion(e?.message || "Error al importar.");
      return { success: false, message: e?.message || "Error al importar." };
    }
  }, []);

  return {
    estadoImportar,
    mensajeImportacion,
    resultados,           // 👉 ahora lo exponemos
    puedeVerResultados,   // 👉 ahora lo exponemos
    handleDescargarLista,
    handleImportar,
  };
}
