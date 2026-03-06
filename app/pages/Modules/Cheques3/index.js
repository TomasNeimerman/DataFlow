"use client";

import { useState, useEffect, useCallback } from "react";
import pageStyles from "./styles.module.css";
import ChequesRechazados from "../../../components/CuadroChequesEdoR";

/* ================= Helpers ================= */
const pick = (o, keys, def = "") => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return def;
};

const parseDateLoose = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) return value;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    const dt = new Date(y < 100 ? 2000 + y : y, mm, d);
    return isNaN(dt) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
};

const fmtYYYYMMDD = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const numFromAny = (v) =>
  typeof v === "number"
    ? v
    : Number(String(v ?? "").replace(/\./g, "").replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;

const extractArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.cheque)) return res.cheque;
  if (Array.isArray(res?.cheques)) return res.cheques;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.result)) return res.result;
  if (Array.isArray(res?.data?.cheque)) return res.data.cheque;
  if (Array.isArray(res?.data?.cheques)) return res.data.cheques;
  for (const k of Object.keys(res || {})) {
    if (Array.isArray(res[k])) return res[k];
  }
  return [];
};

const mapChequeRecord = (ch) => {
  const idCheque = String(pick(ch, ["ch3_ID", "idCheque", "IDCheque", "chequeId", "id", "c3sch3_ID"]));
  const emp = pick(ch, ["ch3emp_Codigo", "emp", "Empresa", "emp_codigo"]);
  const nroDefinitivo = String(
    pick(ch, [
      "ch3_NroCheq",
      "NroCheq",
      "ch3_Nro",
      "numero",
      "Numero",
      "NroCheque",
      "nroCheque",
      "nroDefinitivo",
    ])
  );
  const fvtoRaw = parseDateLoose(
    pick(ch, ["ch3_FVto", "fvto", "FecVto", "FechaVencimiento", "fechaVto", "fecha_vto"])
  );
  const importeRaw = numFromAny(pick(ch, ["ch3_Importe", "Importe", "importe", "monto"]));
  const estado = pick(ch, ["ch3_Edo", "Estado", "estado"]);
  const situacion = pick(ch, ["ch3sit_Cod", "Situacion", "situacion", "sit_Cod"]);
  const fModRaw = parseDateLoose(pick(ch, ["FecMod", "fMod", "FechaModificacion", "c3s_FCmbio"]));
  const cliente = pick(ch, ["cliente", "Cliente", "cli_RazonSocial", "RazonSocial"]);

  return {
    idCheque,
    emp,
    nroDefinitivo,
    fvtoRaw,
    fvto: fvtoRaw ? fvtoRaw.toLocaleDateString() : "",
    fModRaw,
    fMod: fModRaw ? fModRaw.toLocaleDateString() : "",
    importeRaw,
    importe: importeRaw.toLocaleString(undefined, { style: "currency", currency: "ARS" }),
    estado,
    situacion,
    cliente,
  };
};
/* ============================================ */

export default function Cheques3() {
  const [idCliente, setIdCliente] = useState(null);
  const [chequesRechazados, setChequesRechazados] = useState([]);
  const [situaciones, setSituaciones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [cheques3Export, setCheques3Export] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [selectedChequesData, setSelectedChequesData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [runLogs, setRunLogs] = useState([]);
  const [runErrors, setRunErrors] = useState([]);

  const [fieldMode, setFieldMode] = useState("situacion");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalRows, setTotalRows] = useState(0);
  const [lastFilters, setLastFilters] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // idCliente
  useEffect(() => {
    (async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    })();
  }, []);

  // catálogos: Situación + Estado
  useEffect(() => {
    (async () => {
      try {
        if (window.api?.getSituacion) {
          const r = await window.api.getSituacion();
          setSituaciones(r?.success ? r.data || [] : []);
        }
      } catch {
        setSituaciones([]);
      }

      try {
        const res =
          (await window.api?.obtenerCheque3Rechazado?.()) ||
          (await window.api?.cheques3?.obtenerCheque3Rechazado?.()) ||
          null;

        if (res?.success && Array.isArray(res.cheque)) {
          const norm = Array.from(
            new Set(
              res.cheque
                .map((e) => String(e?.Estado || "").trim())
                .filter((code) => code !== "")
            )
          ).map((code) => ({ edo_Cod: code, edo_Desc: code }));

          console.log("Catálogo de Estados normalizado:", norm);
          setEstados(norm);
        } else {
          setEstados([]);
        }
      } catch {
        setEstados([]);
      }
    })();
  }, []);

  // BUSCAR (lazy + paginado)
  const handleBuscar = useCallback(
    async (filters, opts = {}) => {
      if (!idCliente) return;

      const nextPage = Math.max(1, Number(opts.page ?? 1));
      const nextPageSize = Math.max(5, Number(opts.pageSize ?? pageSize));

      setImportStatus("loading");
      setImportMessage("Buscando cheques...");
      setHasSearched(true);

      try {
        setLastFilters(filters);
        setPage(nextPage);
        setPageSize(nextPageSize);

        // ✅ Server-side paginado
        if (window.api?.obtenerCheque3RechazadoPaged) {
          const res = await window.api.obtenerCheque3RechazadoPaged({
            page: nextPage,
            pageSize: nextPageSize,
            filters,
          });

          const arr = Array.isArray(res?.rows) ? res.rows : [];
          setTotalRows(Number(res?.total ?? 0));

          const mapped = arr.map(mapChequeRecord);
          setChequesRechazados(mapped);

          const initial = {};
          mapped.forEach((row) => {
            initial[row.idCheque] = {
              isSelected: false,
              situacionId: "",
              situacionLabel: "",
              newValue: "",
              newValueLabel: "",
            };
          });
          setSelectedChequesData(initial);

          setImportStatus(null);
          setImportMessage("");
          return;
        }

        // 🔙 Fallback client-side (si no existe paginado server-side)
        let arr = [];
        if (window.api?.obtenerCheque3RechazadoFiltrado) {
          const r = await window.api.obtenerCheque3RechazadoFiltrado(idCliente, filters);
          arr = extractArray(r);
        } else if (window.api?.cheques3?.buscar) {
          const r = await window.api.cheques3.buscar(idCliente, filters);
          arr = extractArray(r);
        } else if (window.api?.obtenerCheque3Rechazado) {
          const r = await window.api.obtenerCheque3Rechazado(idCliente);
          const all = extractArray(r);
          arr = all
            .filter((ch) => {
              const idOk =
                !filters.idCheque ||
                String(ch.ch3_ID ?? ch.idCheque ?? "").includes(String(filters.idCheque));
              const nroOk =
                !filters.nroCheque ||
                String(ch.ch3_NroCheq ?? ch.NroCheq ?? "").includes(String(filters.nroCheque));
              return idOk && nroOk;
            })
            .slice(0, 3000);
        }

        setTotalRows(arr.length);

        const mapped = arr.map(mapChequeRecord);
        setChequesRechazados(mapped);

        const initial = {};
        mapped.forEach((row) => {
          initial[row.idCheque] = {
            isSelected: false,
            situacionId: "",
            situacionLabel: "",
            newValue: "",
            newValueLabel: "",
          };
        });
        setSelectedChequesData(initial);

        setImportStatus(null);
        setImportMessage("");
      } catch (e) {
        console.error(e);
        setChequesRechazados([]);
        setSelectedChequesData({});
        setTotalRows(0);
        setImportStatus("error");
        setImportMessage("Error al buscar cheques.");
      }
    },
    [idCliente, pageSize]
  );
  const normalize = (v) => String(v ?? "").trim().toLowerCase();

const applyCheques3Filters = (rows, filters) => {
  if (!filters) return rows || [];

  const idCheque = normalize(filters.idCheque);
  const nroCheque = normalize(filters.nroCheque);
  const estado = normalize(filters.estado);
  const situacion = normalize(filters.situacion);

  const desde = filters.desde ? new Date(filters.desde) : null;
  const hasta = filters.hasta ? new Date(filters.hasta) : null;
  if (hasta) hasta.setHours(23, 59, 59, 999);

  const min = filters.min !== null && filters.min !== undefined && String(filters.min).trim() !== ""
    ? Number(filters.min)
    : null;
  const max = filters.max !== null && filters.max !== undefined && String(filters.max).trim() !== ""
    ? Number(filters.max)
    : null;

  return (rows || []).filter((r) => {
    // En tu service actual: idCheque, NroCheque, FechaVencimiento, Importe, Estado, Situacion
    const rId = normalize(r.idCheque);
    const rNro = normalize(r.NroCheque ?? r.nroDefinitivo ?? r.nroCheque);
    const rEstado = normalize(r.Estado ?? r.estado);
    const rSit = normalize(r.Situacion ?? r.situacion);

    // id exacto
    if (idCheque && rId !== idCheque) return false;

    // nro contiene
    if (nroCheque && !rNro.includes(nroCheque)) return false;

    // estado exacto (ojo: algunos vienen con espacios)
    if (estado && rEstado !== estado) return false;

    // situacion exacta
    if (situacion && rSit !== situacion) return false;

    // fechas
    if (desde || hasta) {
      const fv = r.FechaVencimiento ?? r.fvto;
      const d = fv ? new Date(fv) : null;
      if (!d || isNaN(d.getTime())) return false;
      if (desde && d < desde) return false;
      if (hasta && d > hasta) return false;
    }

    // importes
    const imp = Number(r.Importe ?? r.importe);
    if (min !== null && (!Number.isFinite(imp) || imp < min)) return false;
    if (max !== null && (!Number.isFinite(imp) || imp > max)) return false;

    return true;
  });
};
  // ✅ NUEVO: Buscar “principal” (grilla paginada + export completo)
const onBuscar = async (filters) => {
  // ✅ AJUSTÁ ESTO a tus setters reales
  const SET_LIST = setChequesRechazados; // <-- tu setter real de la grilla
  const SET_EXPORT = setCheques3Export;  // <-- tu setter real del export
  const SET_TOTAL = setTotalRows;        // <-- tu setter real del total
  const SET_LAST = setLastFilters;       // <-- tu setter real

  try {
    SET_LAST(filters);

    // ===============================
    // 1) TRAER TODO (API ORIGINAL)
    // ===============================
    const resAll = await window.api.obtenerCheque3Rechazado();
    if (!resAll?.success) {
      SET_LIST([]);
      SET_EXPORT([]);
      SET_TOTAL(0);
      return;
    }

    const rows = resAll.cheque || [];

    // ===============================
    // Helpers
    // ===============================
    const norm = (v) => String(v ?? "").trim().toLowerCase();

    const toDateStr = (v) => {
      if (!v) return "";
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    };

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // ===============================
    // 2) NORMALIZAR FILTROS
    // ===============================
    const fId = norm(filters?.idCheque);
    const fNro = norm(filters?.nroCheque);
    const fEstado = norm(filters?.estado);
    const fSit = norm(filters?.situacion);

    const desde = filters?.desde ? new Date(filters.desde) : null;
    const hasta = filters?.hasta ? new Date(filters.hasta) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    const min =
      String(filters?.min ?? "").trim() !== "" ? Number(filters.min) : null;
    const max =
      String(filters?.max ?? "").trim() !== "" ? Number(filters.max) : null;

    // ===============================
    // 3) FILTRAR (con nombres reales del backend)
    // ===============================
    const filtradosRaw = rows.filter((r) => {
      const rId = norm(r.idCheque);
      const rNro = norm(r.NroCheque ?? r.nroDefinitivo ?? r.nroCheque);
      const rEstado = norm(r.Estado ?? r.estado);
      const rSit = norm(r.Situacion ?? r.situacion);

      if (fId && rId !== fId) return false;
      if (fNro && !rNro.includes(fNro)) return false;
      if (fEstado && rEstado !== fEstado) return false;
      if (fSit && rSit !== fSit) return false;

      if (desde || hasta) {
        const d = r.FechaVencimiento
          ? new Date(r.FechaVencimiento)
          : r.fvto
          ? new Date(r.fvto)
          : null;

        if (!d || isNaN(d.getTime())) return false;
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
      }

      const imp = Number(r.Importe ?? r.importe);
      if (min !== null && (!Number.isFinite(imp) || imp < min)) return false;
      if (max !== null && (!Number.isFinite(imp) || imp > max)) return false;

      return true;
    });

    // ===============================
    // 4) MAP A FORMATO UI (tabla)
    // ===============================
    const uiAll = filtradosRaw.map((r) => ({
      emp: r.Empresa ?? r.emp,
      idCheque: r.idCheque,
      cliente: typeof r.Cliente === "string" ? r.Cliente : String(r.Cliente ?? ""),
      nroDefinitivo: r.NroCheque ?? r.nroDefinitivo ?? "",
      fvto: toDateStr(r.FechaVencimiento ?? r.fvto),
      fMod: r.FecMod ? toDateStr(r.FecMod) : "Sin actualizar",
      importe: toNum(r.Importe ?? r.importe),
      estado: String(r.Estado ?? r.estado ?? ""),
      situacion: String(r.Situacion ?? r.situacion ?? ""),
    }));

    // ===============================
    // 5) MAP A FORMATO EXPORT (excel)
    // ===============================
    const exportAll = filtradosRaw.map((r) => ({
      Empresa: r.Empresa ?? "",
      idCheque: r.idCheque,
      Cliente:
        typeof r.Cliente === "string" ? r.Cliente : String(r.Cliente ?? ""),
      NroCheque: r.NroCheque ?? "",
      FechaVencimiento: toDateStr(r.FechaVencimiento),
      FechaModificacion: r.FecMod ? toDateStr(r.FecMod) : "",
      Importe: toNum(r.Importe),
      Estado: String(r.Estado ?? ""),
      Situacion: String(r.Situacion ?? ""),
    }));

    SET_EXPORT(exportAll);

    // ===============================
    // 6) PAGINADO MANUAL PARA GRILLA
    // ===============================
    const total = uiAll.length;
    SET_TOTAL(total);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    SET_LIST(uiAll.slice(start, end));
  } catch (err) {
    console.error("❌ Error en onBuscar:", err);
    SET_LIST([]);
    SET_EXPORT([]);
    SET_TOTAL(0);
  }
};
  
  /* ------- selección / edición helpers ------- */
  const primeDefaultsForField = useCallback(
    (row, mode) => {
      if (!row) return { value: "", label: "" };
      if (mode === "situacion") {
        const code = row.situacion ? String(row.situacion) : "";
        const s = (situaciones || []).find((x) => String(x.sit_Cod) === code);
        return { value: code, label: s ? s.sit_Desc : "" };
      }
      if (mode === "fvto") return { value: fmtYYYYMMDD(row.fvtoRaw), label: "" };
      if (mode === "numero")
        return { value: row.nroDefinitivo ? String(row.nroDefinitivo) : "", label: "" };
      return { value: "", label: "" };
    },
    [situaciones]
  );

  const handleChequeToggle = useCallback(
    (idCheque) => {
      setSelectedChequesData((prev) => {
        const curr =
          prev[idCheque] || {
            isSelected: false,
            situacionId: "",
            situacionLabel: "",
            newValue: "",
            newValueLabel: "",
          };
        const newState = !curr.isSelected;

        const row = chequesRechazados.find((ch) => String(ch.idCheque) === String(idCheque));
        const defaults = newState ? primeDefaultsForField(row, fieldMode) : { value: "", label: "" };

        const baseSit = row?.situacion ? String(row.situacion) : "";
        const found = (situaciones || []).find((s) => String(s.sit_Cod) === baseSit);
        const baseLabel = found ? found.sit_Desc : "";

        return {
          ...prev,
          [idCheque]: {
            ...curr,
            isSelected: newState,
            situacionId: newState ? curr.situacionId || baseSit : "",
            situacionLabel: newState ? curr.situacionLabel || baseLabel : "",
            newValue: defaults.value,
            newValueLabel: defaults.label,
          },
        };
      });
    },
    [chequesRechazados, situaciones, fieldMode, primeDefaultsForField]
  );

  const handleFieldModeChange = useCallback(
    (mode) => {
      setFieldMode(mode);
      setSelectedChequesData((prev) => {
        const clone = { ...prev };
        Object.keys(clone).forEach((id) => {
          if (!clone[id]?.isSelected) return;
          const row = chequesRechazados.find((ch) => String(ch.idCheque) === String(id));
          const d = primeDefaultsForField(row, mode);
          clone[id].newValue = d.value;
          clone[id].newValueLabel = d.label;
        });
        return clone;
      });
    },
    [chequesRechazados, primeDefaultsForField]
  );

  const handleRowValueChange = useCallback(
    (idCheque, value) => {
      setSelectedChequesData((prev) => {
        const curr = prev[idCheque] || {};
        let nv = String(value || "");
        let nvl = "";
        if (fieldMode === "situacion") {
          const s = (situaciones || []).find((x) => String(x.sit_Cod) === nv);
          nvl = s ? s.sit_Desc : "";
        }
        return { ...prev, [idCheque]: { ...curr, newValue: nv, newValueLabel: nvl } };
      });
    },
    [fieldMode, situaciones]
  );

  const handleGlobalValueChange = useCallback(
    (value) => {
      const nv = String(value || "");
      const s = fieldMode === "situacion" ? (situaciones || []).find((x) => String(x.sit_Cod) === nv) : null;
      const nvl = s ? s.sit_Desc : "";
      setSelectedChequesData((prev) => {
        const out = {};
        Object.keys(prev).forEach((id) => {
          const curr = prev[id] || {};
          out[id] = {
            ...curr,
            newValue: curr.isSelected ? nv : curr.newValue,
            newValueLabel: curr.isSelected ? nvl : curr.newValueLabel,
            situacionId: fieldMode === "situacion" && curr.isSelected ? nv : curr.situacionId,
            situacionLabel: fieldMode === "situacion" && curr.isSelected ? nvl : curr.situacionLabel,
          };
        });
        return out;
      });
    },
    [fieldMode, situaciones]
  );

  const selectAllCheques = useCallback(
    (checked) => {
      setSelectedChequesData((prev) => {
        const newData = {};
        chequesRechazados.forEach((ch) => {
          const defaults = checked ? primeDefaultsForField(ch, fieldMode) : { value: "", label: "" };
          newData[ch.idCheque] = {
            isSelected: checked,
            situacionId: checked ? prev[ch.idCheque]?.situacionId || (ch.situacion ? String(ch.situacion) : "") : "",
            situacionLabel: checked ? prev[ch.idCheque]?.situacionLabel || "" : "",
            newValue: defaults.value,
            newValueLabel: defaults.label,
          };
        });
        return newData;
      });
    },
    [chequesRechazados, fieldMode, primeDefaultsForField]
  );

  /* ------- comparación para “sin cambios” ------- */
  const isRowChanged = useCallback((row, mode, newVal) => {
    if (!row) return false;
    if (mode === "situacion") return String(row.situacion ?? "") !== String(newVal ?? "");
    if (mode === "fvto") return String(fmtYYYYMMDD(row.fvtoRaw)) !== String(newVal ?? "");
    if (mode === "numero") return String(row.nroDefinitivo ?? "") !== String(newVal ?? "");
    return false;
  }, []);

  /* ------- actualizar ------- */
  const handleImportarClick = async () => {
    setRunLogs([]);
    setRunErrors([]);

    const selected = Object.keys(selectedChequesData).filter(
      (id) => selectedChequesData[id]?.isSelected && selectedChequesData[id]?.newValue !== ""
    );

    const changedItems = [];
    const unchangedIds = [];
    selected.forEach((id) => {
      const row = chequesRechazados.find((r) => String(r.idCheque) === String(id));
      const nv = selectedChequesData[id].newValue;
      if (isRowChanged(row, fieldMode, nv)) {
        changedItems.push({ idCheque: parseInt(id, 10), value: nv, row });
      } else {
        unchangedIds.push(id);
      }
    });

    if (selected.length === 1 && changedItems.length === 0) {
      setImportStatus("info");
      setImportMessage("No hay cambios detectados.");
      setTimeout(() => {
        setImportStatus(null);
        setImportMessage("");
      }, 2500);
      return;
    }
    if (changedItems.length === 0) {
      setImportStatus("info");
      setImportMessage("No hay cambios para aplicar.");
      setTimeout(() => {
        setImportStatus(null);
        setImportMessage("");
      }, 2500);
      return;
    }

    setImportStatus("loading");
    setImportMessage("Actualizando cheques...");

    try {
      if (window.api?.updateCheque3Field) {
        const logs = [];
        const errs = [];

        await Promise.all(
          changedItems.map(async (it) => {
            try {
              const res = await window.api.updateCheque3Field(it.idCheque, fieldMode, it.value);
              if (!res?.success) {
                errs.push(`Cheque ${it.idCheque}: ${res?.message || "Fallo al actualizar."}`);
              } else {
                logs.push(`Cheque ${it.idCheque}: ${res.message || "Actualizado."}`);
                if (fieldMode === "situacion") {
                  const reg = await window.api.setRegistro(it.row?.emp, it.row?.suc, it.idCheque, it.value, it.row?.situacion);
                  if (reg?.success === false) {
                    errs.push(`Registro situación ${it.idCheque}: ${reg?.message || "Fallo registrando."}`);
                  } else if (reg?.message) {
                    logs.push(`Registro situación ${it.idCheque}: ${reg.message}`);
                  }
                }
              }
            } catch (e) {
              errs.push(`Cheque ${it.idCheque}: ${e?.message || "Error inesperado."}`);
            }
          })
        );

        if (unchangedIds.length > 0) logs.push(`Ignorados sin cambio: ${unchangedIds.length}`);

        setRunLogs(logs);
        setRunErrors(errs);

        if (errs.length === 0) {
          setImportStatus("success");
          setImportMessage("Actualización completada.");
        } else if (errs.length < changedItems.length) {
          setImportStatus("info");
          setImportMessage(`Con advertencias: ${errs.length} error(es).`);
        } else {
          setImportStatus("error");
          setImportMessage("No se pudo actualizar ninguno.");
        }

        setRefreshKey((k) => k + 1);
      } else {
        setImportStatus("error");
        setImportMessage("API no disponible.");
      }
    } catch (error) {
      console.error("Error al importar cheques:", error);
      setImportStatus("error");
      setImportMessage("Error inesperado al actualizar.");
    } finally {
      setTimeout(() => {
        setImportStatus(null);
        setImportMessage("");
      }, 3000);
    }
  };

  const isImportButtonDisabled = importStatus === "loading";

  return (
    <div className={pageStyles.body}>
      <ChequesRechazados
        chequesRechazados={chequesRechazados}
        situaciones={situaciones}
        estados={estados}
        onChequeToggle={handleChequeToggle}
        selectedChequesData={selectedChequesData}
        onImportarClick={handleImportarClick}
        isImportButtonDisabled={isImportButtonDisabled}
        importStatus={importStatus}
        importMessage={importMessage}
        onSelectAllChange={selectAllCheques}
        refreshKey={refreshKey}
        runLogs={runLogs}
        runErrors={runErrors}
        fieldMode={fieldMode}
        onFieldModeChange={handleFieldModeChange}
        onRowValueChange={handleRowValueChange}
        onGlobalValueChange={handleGlobalValueChange}
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        lastFilters={lastFilters}
        onPageChange={(nextPage) => {
          if (!lastFilters) return;
          handleBuscar(lastFilters, { page: nextPage, pageSize });
        }}
        onPageSizeChange={(nextSize) => {
          if (!lastFilters) return;
          handleBuscar(lastFilters, { page: 1, pageSize: nextSize });
        }}
        onBuscar={onBuscar}
        cheques3Export={cheques3Export}
        lazyMode={true}
      />
    </div>
  );
}
