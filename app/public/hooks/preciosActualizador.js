// public/hooks/preciosActualizador.js
import { useState } from "react";

const usePreciosActualizador = () => {
  const [importStatus, setImportStatus] = useState("");
  const [importMessage, setImportMessage] = useState("");

  // -------------------------
  // Normalización y helpers
  // -------------------------
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita acentos
      .replace(/[$]/g, "")             // quita símbolo moneda
      .replace(/[.\-_/]/g, " ")        // separadores → espacio
      .replace(/\s+/g, " ")
      .trim();

  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    // soporta "12.345,67" / "$ 12.345,67"
    const cleaned = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const nowIso = () => new Date().toISOString();

  // ---------------------------------------
  // Etiquetas (flexibles/sinónimos aceptados)
  // ---------------------------------------
  const HEADERS = {
    LISTA_NOMBRE: [
      "lista de precios",
      "lista precios",
    ],
    LISTA_COD: [
      "lista de precios - cod",
      "lista de precios - cód",
      "lista cod",
      "lprdlp_cod",
    ],
    COD_GEN: [
      "art - cod generico",
      "art - cod. generico",
      "art - cod. gen",
      "art - cod generico",
      "articulo - cod generico",
      "articulo - cod. generico",
      "articulo - cod. gen",
      "articulo - cod gen",
      "artículo - cód. genérico",
      "lprart_codgen",
      "cod generico",
      "cód. genérico",
    ],
    ELE1: [
      "art - cod elem 1",
      "art - cod. elem 1",
      "articulo - cod elem 1",
      "artículo - cód. elem. 1",
      "elem 1",
      "lprart_codele1",
    ],
    ELE2: [
      "art - cod elem 2",
      "art - cod. elem 2",
      "articulo - cod elem 2",
      "artículo - cód. elem. 2",
      "elem 2",
      "lprart_codele2",
    ],
    ELE3: [
      "art - cod elem 3",
      "art - cod. elem 3",
      "articulo - cod elem 3",
      "artículo - cód. elem. 3",
      "elem 3",
      "lprart_codele3",
    ],
    PRECIO: [
      "precio",
      "importe",
      "valor",
      "precio final",
      "lpr_precio",
    ],
  };

  const REQUIRED_KEYS = ["LISTA_COD", "COD_GEN", "PRECIO"]; // obligatorias
  const OPTIONAL_VALUE_KEYS = ["LISTA_NOMBRE", "ELE1", "ELE2", "ELE3"]; // valores pueden faltar

  const containsAny = (cell, options) => {
    const c = norm(cell);
    return options.some((opt) => c.includes(opt));
  };

  const buildIndex = (headers) => {
    const idxOfAny = (labels) =>
      headers.findIndex((h) => containsAny(h, labels.map(norm)));
    return {
      LISTA_NOMBRE: idxOfAny(HEADERS.LISTA_NOMBRE),
      LISTA_COD: idxOfAny(HEADERS.LISTA_COD),
      COD_GEN: idxOfAny(HEADERS.COD_GEN),
      ELE1: idxOfAny(HEADERS.ELE1),
      ELE2: idxOfAny(HEADERS.ELE2),
      ELE3: idxOfAny(HEADERS.ELE3),
      PRECIO: idxOfAny(HEADERS.PRECIO),
    };
  };

  // -------------------------
  // Validación de encabezados
  // -------------------------
  const validateExcelColumns = (actualHeaders = []) => {
    setImportStatus("");
    setImportMessage("");
    if (!Array.isArray(actualHeaders) || actualHeaders.length === 0) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage("La primera fila (encabezados) está vacía.");
      return false;
    }

    const idx = buildIndex(actualHeaders);
    const missing = REQUIRED_KEYS.filter((k) => idx[k] === -1);

    if (missing.length) {
      const human = {
        LISTA_COD: "Lista de Precios - Cód.",
        COD_GEN: "Art. - Cód. Genérico",
        PRECIO: "Precio",
      };
      setImportStatus("hubo un error en la importacion");
      setImportMessage(
        `Faltan columnas obligatorias en la primera fila: ${missing
          .map((k) => human[k])
          .join(", ")}.`
      );
      return false;
    }
    return true;
  };

  // -------------------------
  // Validación por fila (valores)
  // -------------------------
  const validateRowValues = (row, headers, idxMap) => {
    const missing = [];
    for (const key of REQUIRED_KEYS) {
      const cidx = idxMap[key];
      const val = cidx >= 0 ? row[cidx] : undefined;
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "");
      if (isEmpty) {
        // busca el header original para mensaje
        const headerName = headers[cidx] ?? key;
        missing.push(headerName);
      }
    }
    // PRECIO numérico válido
    const precioIdx = idxMap.PRECIO;
    const precioVal = precioIdx >= 0 ? row[precioIdx] : null;
    const precioNum = toNumber(precioVal);
    if (precioNum === null) {
      const headerName = headers[precioIdx] ?? "Precio";
      missing.push(`${headerName} (inválido)`);
    }

    return missing;
  };

  // -------------------------------------------
  // Proceso principal: obtener y actualizar
  // -------------------------------------------
  const processPriceUpdates = async (json, obtenerFn, updateFn) => {
    setImportStatus("");
    setImportMessage("");

    const preciosProcesados = [];
    let huboCambios = false;
    let errorEnActualizacion = false;
    let actualizadosCount = 0;
    let sinCambiosCount = 0;
    let noEncontradosCount = 0;
    let filasInvalidas = 0;

    if (!Array.isArray(json) || json.length === 0) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage("El archivo está vacío o no se pudo leer.");
      return {
        preciosProcesados,
        huboCambios,
        errorEnActualizacion: true,
        actualizadosCount,
        sinCambiosCount,
        noEncontradosCount,
        filasInvalidas,
      };
    }

    const headers = json[0];
    const rows = json.slice(1).filter((r) => r && r.length > 0);
    const idx = buildIndex(headers);

    // Validación de encabezados obligatorios (por si viene sin pasar validateExcelColumns afuera)
    const missingRequired = REQUIRED_KEYS.filter((k) => idx[k] === -1);
    if (missingRequired.length) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage("Encabezados obligatorios ausentes.");
      return {
        preciosProcesados,
        huboCambios,
        errorEnActualizacion: true,
        actualizadosCount,
        sinCambiosCount,
        noEncontradosCount,
        filasInvalidas,
      };
    }

    for (const r of rows) {
      // 1) Validación de valores obligatorios por fila
      const missingVals = validateRowValues(r, headers, idx);
      if (missingVals.length > 0) {
        filasInvalidas++;
        preciosProcesados.push({
          fecha: nowIso(),
          lista: idx.LISTA_COD >= 0 ? r[idx.LISTA_COD] ?? "—" : "—",
          codArticulo: idx.COD_GEN >= 0 ? r[idx.COD_GEN] ?? "—" : "—",
          descripcion: "",
          precioAnterior: null,
          precioNuevo: idx.PRECIO >= 0 ? toNumber(r[idx.PRECIO]) : null,
          actualizado: false,
          motivo: `Faltan/Inválidos: ${missingVals.join(", ")}`,
          precio: {
            lprdlp_Cod: idx.LISTA_COD >= 0 ? (r[idx.LISTA_COD] ?? null) : null,
            lprart_CodGen: idx.COD_GEN >= 0 ? (r[idx.COD_GEN] ?? null) : null,
            lprart_CodEle1: idx.ELE1 >= 0 ? (r[idx.ELE1] ?? null) : null,
            lprart_CodEle2: idx.ELE2 >= 0 ? (r[idx.ELE2] ?? null) : null,
            lprart_CodEle3: idx.ELE3 >= 0 ? (r[idx.ELE3] ?? null) : null,
            precio: idx.PRECIO >= 0 ? toNumber(r[idx.PRECIO]) : null,
            precioAnterior: null,
          },
        });
        continue; // no llamamos la API
      }

      // 2) Keys + nuevo precio
      const keys = {
        lprdlp_Cod: String(r[idx.LISTA_COD]).trim(),
        lprart_CodGen: String(r[idx.COD_GEN]).trim(),
        lprart_CodEle1: idx.ELE1 >= 0 ? String(r[idx.ELE1] ?? "").trim() : "",
        lprart_CodEle2: idx.ELE2 >= 0 ? String(r[idx.ELE2] ?? "").trim() : "",
        lprart_CodEle3: idx.ELE3 >= 0 ? String(r[idx.ELE3] ?? "").trim() : "",
      };
      const precioNuevo = toNumber(r[idx.PRECIO]);

      // 3) Obtener registro actual
      let precioAnterior = null;
      let descripcion = "";
      let encontrado = false;

      try {
        const res = await obtenerFn(keys);
        // el servicio devuelve { success, row } (y también { precio: row })
        const base = res?.row || res?.precio || res?.data || null;

        // candidatos comunes para el valor actual
        const candidates = [
          base?.precioAnterior,
          base?.precioActual,
          base?.precio,
          base?.lpr_Precio,
          base?.importe,
          base?.valor,
          base?.Precio,
        ];
        for (const c of candidates) {
          const n = toNumber(c);
          if (n !== null) {
            precioAnterior = n;
            break;
          }
        }
        descripcion =
          base?.descripcion || base?.artDescripcion || base?.desc || "";
        encontrado = !!base;
      } catch {
        encontrado = false;
      }

      if (!encontrado) {
        noEncontradosCount++;
        preciosProcesados.push({
          fecha: nowIso(),
          lista: keys.lprdlp_Cod,
          codArticulo: keys.lprart_CodGen,
          descripcion,
          precioAnterior: null,
          precioNuevo,
          actualizado: false,
          motivo: "No encontrado",
          precio: { ...keys, precio: precioNuevo, precioAnterior: null, descripcion },
        });
        continue;
      }

      const requiereUpdate =
        precioAnterior === null ? true : Number(precioAnterior) !== Number(precioNuevo);

      if (requiereUpdate) {
        try {
          const payload = { ...keys, precio: precioNuevo };
          const up = await updateFn(payload);
          if (up?.error || up?.success === false) {
            errorEnActualizacion = true;
            preciosProcesados.push({
              fecha: nowIso(),
              lista: keys.lprdlp_Cod,
              codArticulo: keys.lprart_CodGen,
              descripcion,
              precioAnterior,
              precioNuevo,
              actualizado: false,
              motivo: up?.message || up?.error || "Error al actualizar",
              precio: { ...keys, precio: precioNuevo, precioAnterior, descripcion },
            });
          } else {
            huboCambios = true;
            actualizadosCount++;
            preciosProcesados.push({
              fecha: nowIso(),
              lista: keys.lprdlp_Cod,
              codArticulo: keys.lprart_CodGen,
              descripcion,
              precioAnterior,
              precioNuevo,
              actualizado: true,
              motivo: null,
              precio: { ...keys, precio: precioNuevo, precioAnterior, descripcion },
            });
          }
        } catch (e) {
          errorEnActualizacion = true;
          preciosProcesados.push({
            fecha: nowIso(),
            lista: keys.lprdlp_Cod,
            codArticulo: keys.lprart_CodGen,
            descripcion,
            precioAnterior,
            precioNuevo,
            actualizado: false,
            motivo: e?.message || "Error al actualizar",
            precio: { ...keys, precio: precioNuevo, precioAnterior, descripcion },
          });
        }
      } else {
        sinCambiosCount++;
        preciosProcesados.push({
          fecha: nowIso(),
          lista: keys.lprdlp_Cod,
          codArticulo: keys.lprart_CodGen,
          descripcion,
          precioAnterior,
          precioNuevo,
          actualizado: false,
          motivo: "Sin cambios",
          precio: { ...keys, precio: precioNuevo, precioAnterior, descripcion },
        });
      }
    }

    // -------------------------
    // Mensaje final de resumen
    // -------------------------
    let finalMsg = "";
    if (filasInvalidas > 0)
      finalMsg += `${filasInvalidas} fila(s) con datos faltantes/invalidos fueron omitidas. `;
    if (errorEnActualizacion) {
      finalMsg += "Hubo errores al actualizar algunos precios.";
      setImportStatus("hubo un error en la importacion");
    } else if (huboCambios) {
      finalMsg += `Importado correctamente. ${actualizadosCount} precio(s) actualizado(s).`;
      if (sinCambiosCount > 0) finalMsg += ` ${sinCambiosCount} sin cambios.`;
      if (noEncontradosCount > 0) finalMsg += ` ${noEncontradosCount} no encontrados.`;
      setImportStatus("Importado correctamente");
    } else {
      finalMsg += `Importación completada. No se encontraron cambios para actualizar.`;
      if (noEncontradosCount > 0) finalMsg += ` ${noEncontradosCount} no encontrados.`;
      setImportStatus("Importación sin cambios");
    }
    setImportMessage(finalMsg.trim());

    return {
      preciosProcesados,
      huboCambios,
      errorEnActualizacion,
      actualizadosCount,
      sinCambiosCount,
      noEncontradosCount,
      filasInvalidas,
    };
  };

  return {
    importStatus,
    importMessage,
    validateExcelColumns,
    processPriceUpdates,
  };
};

export default usePreciosActualizador;
