// app/Cheques3/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import pageStyles from "./styles.module.css";
import ChequesRechazados from "../../../components/CuadroChequesEdoR";

/* ================= Helpers robustos ================= */
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
  const idCheque = String(
    pick(ch, ["ch3_ID", "idCheque", "IDCheque", "chequeId", "id", "c3sch3_ID"])
  );

  const emp = pick(ch, ["ch3emp_Codigo", "emp", "Empresa", "emp_codigo"]);

  const cliente = pick(ch, ["Cliente", "cliente", "cli_RazSoc", "cl_RazSoc", "cli_RazSoc."]);

  const nroDefinitivo = String(
    pick(ch, ["ch3_NroCheq", "NroCheque", "NroCheq", "ch3_Nro", "numero", "Numero"])
  );

  const fvtoRaw = parseDateLoose(
    pick(ch, ["ch3_FVto", "fvto", "FecVto", "FechaVencimiento", "fechaVto", "fecha_vto"])
  );

  // ⬇ NUEVO: soporta FecMod del back, y variantes
  const fModRaw = parseDateLoose(
    pick(ch, ["FecMod", "ch3_FCmbio", "FechaModificacion", "fMod", "c3s_FCmbio"])
  );

  const importeRaw = numFromAny(pick(ch, ["ch3_Importe", "Importe", "importe", "monto"]));

  const estado = pick(ch, ["ch3_Edo", "Estado", "estado"]);

  const situacion = pick(ch, ["ch3sit_Cod", "Situacion", "situacion", "sit_Cod"]);

  return {
    idCheque,
    emp,
    cliente,
    nroDefinitivo,
    fvtoRaw,
    fvto: fvtoRaw ? fvtoRaw.toLocaleDateString() : "",
    // ⬇ fecha/hora legible (si trae hora)
    fModRaw,
    fMod: fModRaw
      ? `${fModRaw.toLocaleDateString()} ${fModRaw.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : "",
    importeRaw,
    importe: importeRaw.toLocaleString(undefined, { style: "currency", currency: "ARS" }),
    estado,
    situacion,
  };
};
/* ===================================================== */

export default function Cheques3() {
  const [idCliente, setIdCliente] = useState(null);
  const [chequesRechazados, setChequesRechazados] = useState([]);
  const [situaciones, setSituaciones] = useState([]);
  const [selectedChequesData, setSelectedChequesData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [runLogs, setRunLogs] = useState([]);
  const [runErrors, setRunErrors] = useState([]);

  const [fieldMode, setFieldMode] = useState("situacion"); // 'situacion' | 'fvto' | 'numero'

  useEffect(() => {
    const fetchIdCliente = async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    };
    fetchIdCliente();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!idCliente) return;

      setImportStatus("loading");
      setImportMessage("Cargando datos...");

      try {
        if (window.api?.getSituacion) {
          const response = await window.api.getSituacion();
          setSituaciones(response?.success ? response.data || [] : []);
        }

        if (window.api?.obtenerCheque3Rechazado) {
          const r = await window.api.obtenerCheque3Rechazado(idCliente);
          const arr = extractArray(r);
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
        }

        setImportStatus(null);
        setImportMessage("");
      } catch (error) {
        console.error("Error en la carga inicial de datos:", error);
        setImportStatus("error");
        setImportMessage("Error general al cargar los datos.");
        setChequesRechazados([]);
        setSituaciones([]);
        setSelectedChequesData({});
      }
    };

    fetchData();
  }, [idCliente]);

  const primeDefaultsForField = useCallback(
    (row, mode) => {
      if (!row) return { value: "", label: "" };
      if (mode === "situacion") {
        const code = row.situacion ? String(row.situacion) : "";
        const s = (situaciones || []).find((x) => String(x.sit_Cod) === code);
        return { value: code, label: s ? s.sit_Desc : "" };
      }
      if (mode === "fvto") {
        return { value: fmtYYYYMMDD(row.fvtoRaw), label: "" };
      }
      if (mode === "numero") {
        return { value: row.nroDefinitivo ? String(row.nroDefinitivo) : "", label: "" };
      }
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

  const reloadAfterUpdate = useCallback(async () => {
    try {
      if (window.api?.obtenerCheque3Rechazado && idCliente) {
        const r = await window.api.obtenerCheque3Rechazado(idCliente);
        const arr = extractArray(r);
        const mapped = arr.map(mapChequeRecord);

        setChequesRechazados(mapped);

        const initialSelected = {};
        mapped.forEach((row) => {
          initialSelected[row.idCheque] = {
            isSelected: false,
            situacionId: "",
            situacionLabel: "",
            newValue: "",
            newValueLabel: "",
          };
        });
        setSelectedChequesData(initialSelected);
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      console.error("Error al recargar datos:", e);
    }
  }, [idCliente]);

  const handleImportarClick = async () => {
    setRunLogs([]);
    setRunErrors([]);

    const items = Object.keys(selectedChequesData)
      .filter((id) => selectedChequesData[id]?.isSelected && selectedChequesData[id]?.newValue !== "")
      .map((id) => ({ idCheque: parseInt(id, 10), value: selectedChequesData[id].newValue }));

    if (items.length === 0) {
      setImportStatus("info");
      setImportMessage("Seleccioná al menos un cheque y cargá el valor para actualizar.");
      setTimeout(() => { setImportStatus(null); setImportMessage(""); }, 2500);
      return;
    }

    setImportStatus("loading");
    setImportMessage("Actualizando cheques...");

    try {
      if (window.api?.updateCheque3Field) {
        const logs = [];
        const errs = [];

        await Promise.all(
          items.map(async (it) => {
            try {
              const res = await window.api.updateCheque3Field(it.idCheque, fieldMode, it.value);
              if (!res?.success) {
                errs.push(`Cheque ${it.idCheque}: ${res?.message || "Fallo al actualizar."}`);
              } else {
                logs.push(`Cheque ${it.idCheque}: ${res.message || "Actualizado."}`);
              }
            } catch (e) {
              errs.push(`Cheque ${it.idCheque}: ${e?.message || "Error inesperado."}`);
            }
          })
        );

        setRunLogs(logs);
        setRunErrors(errs);
        if (errs.length === 0) {
          setImportStatus("success");
          setImportMessage("Actualización completada.");
        } else if (errs.length < items.length) {
          setImportStatus("info");
          setImportMessage(`Con advertencias: ${errs.length} error(es).`);
        } else {
          setImportStatus("error");
          setImportMessage("No se pudo actualizar ninguno.");
        }

        await reloadAfterUpdate();
      } else {
        setImportStatus("error");
        setImportMessage("API no disponible.");
      }
    } catch (error) {
      console.error("Error al importar cheques:", error);
      setImportStatus("error");
      setImportMessage("Error inesperado al actualizar.");
    } finally {
      setTimeout(() => { setImportStatus(null); setImportMessage(""); }, 3000);
    }
  };

  const isImportButtonDisabled = importStatus === "loading";

  return (
    <div className={pageStyles.body}>
      <ChequesRechazados
        chequesRechazados={chequesRechazados}
        situaciones={situaciones}
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
      />
    </div>
  );
}
