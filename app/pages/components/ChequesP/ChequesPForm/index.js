"use client";
import { useEffect, useState, useCallback } from "react";
import styles from "./styles.module.css";
import DownloadIcon from "../../DownloadButton";


const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(1100px, 95vw)",
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} className={styles.template} title="Cerrar">
            ✕
          </button>
        </div>
        <div style={{ padding: 12, overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
};

/* ────────── Helpers ────────── */
const toDMY = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  const d = new Date(val);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const trim = (v) => (v == null ? "" : String(v)).trim();

/* ────────── Cuadro de Resultados ────────── */
const ChequesActualizados = ({ cheques = [], validar = false }) => {
  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Cheques Actualizados</h2>
      </div>

      {!validar || cheques.length === 0 ? (
        <p className={styles.noResults}>No hay cheques para actualizar.</p>
      ) : (
        <div className={styles.resultsScroll}>
          <table className={styles.resultsTable}>
            <thead>
              <tr className={styles.headerRow}>
                <th>Empresa</th>
                <th>Fecha Movimiento</th>
                <th>Nro Definitivo</th>
                <th>Importe</th>
                <th>Tipo</th>
                <th>Movimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map(({ cheque, actualizado }) => (
                <tr key={cheque.idCheque} className={actualizado ? styles.rowOkBg : ""}>
                  <td>{cheque.codEmp}</td>
                  <td>{cheque.fechaEmision}</td>
                  <td className={actualizado ? styles.ok : ""}>{cheque.nroDefinitivo}</td>
                  <td>{cheque.importe}</td>
                  <td>{cheque.tipoCheque}</td>
                  <td>{cheque.movimiento}</td>
                  <td>{actualizado ? "Se actualizó correctamente ✅" : "No se actualizó"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ────────── Form ────────── */
const ChequesPForm = ({
  idCliente,
  nombreModulo,
  onImportar,
  estadoImportar,
  mensajeImportacion,

  // Datos para la sección Resultados (vienen de la page)
  resultadosCheques = [],
  validarResultados = false,
}) => {
  const [modulos, setModulos] = useState([]);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState("");
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [template, setTemplate] = useState("");

  // tabs
  const [activeSection, setActiveSection] = useState("importar"); // importar | resultados
  const [importTried, setImportTried] = useState(false); // habilita la pestaña Resultados

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // ❗ Error de “pre-chequeo” (duplicados)
  const [preCheckError, setPreCheckError] = useState("");

  useEffect(() => {
    const fetchModulos = async () => {
      if (!idCliente) return;
      try {
        const response = await window.api.getModules(idCliente);
        if (response?.success) {
          const filtrados = response.modulos.filter((m) => m.nombre === nombreModulo);
          setModulos(filtrados);
          setTemplate(filtrados[0]?.pathExcel);
        }
      } catch (err) {
        console.error("Fallo al obtener módulos:", err);
      }
    };
    fetchModulos();
  }, [idCliente, nombreModulo]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setIsFileLoaded(true);
      setPreCheckError("");
    } else {
      setFile(null);
      setFileName("");
      setIsFileLoaded(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setFileName("");
    setIsFileLoaded(false);
    setPreCheckError("");
    const input = document.getElementById("loadFile");
    if (input) input.value = "";
  };

  // ====== Descarga rápida de planilla ChequesP ======
  const openWithRetry = async (p, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      const r = await window.api.openPath(p);
      if (r?.success) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    await window.api.revealPath(p);
    return false;
  };
  const handleDescargarPlanillaChequesP = async () => {
    try {
      if (!window.api?.chequespDescargarPlanilla) {
        alert("Función de descarga no disponible.");
        return;
      }
      const r = await window.api.chequespDescargarPlanilla();
      if (!r?.success || !r.path) {
        alert(r?.message || "No se pudo generar la planilla.");
        return;
      }
      await openWithRetry(r.path);
    } catch (e) {
      console.error(e);
      alert("Error al descargar/abrir la planilla.");
    }
  };

  // ====== Vista previa (modal) ======
  const handleOpenPreview = useCallback(async () => {
    try {
      setPreviewError("");
      setPreviewLoading(true);
      const res = await window.api?.chequespPreview?.();
      if (!res?.success) {
        setPreviewError(res?.message || "No se pudo obtener la vista previa.");
        setPreviewRows([]);
      } else {
        setPreviewRows(Array.isArray(res.data) ? res.data : []);
      }
      setPreviewOpen(true);
    } catch (e) {
      setPreviewError(e?.message || "Error en vista previa.");
      setPreviewRows([]);
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ====== PRE-CHEQUEO de duplicados (antes de llamar a onImportar) ======
  const handleImportarClick = async () => {
    if (!file || !onImportar) return;

    try {
      setPreCheckError(""); // limpiar errores previos

      // 1) Parse rápido del Excel para extraer: "ID Cheque" y "Nro Definitivo"
      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod.default || XLSXmod;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No se pudo leer la hoja del Excel.");
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows.length) throw new Error("El Excel no contiene filas.");

      const ID_COL = "ID Cheque";
      const NRO_DEF_COL = "Nro Definitivo";

      if (!Object.prototype.hasOwnProperty.call(rows[0], ID_COL) ||
          !Object.prototype.hasOwnProperty.call(rows[0], NRO_DEF_COL)) {
        throw new Error("Encabezado inválido para pre-chequeo.");
      }

      // Recolectar pares id/nuevo (solo con Nro Definitivo no vacío)
      const incoming = [];
      for (const r of rows) {
        const id = Number(r[ID_COL]);
        const nuevo = trim(r[NRO_DEF_COL]);
        if (!Number.isFinite(id) || !nuevo) continue;
        incoming.push({ id, nuevo });
      }

      if (!incoming.length) {
        // Nada que actualizar: dejamos que el flujo normal avise "sin cambios"
        await onImportar(file);
        setImportTried(true);
        return;
      }

      // 2) Duplicados dentro del propio Excel
      const firstSeen = new Map(); // nro -> id
      const duplicatesInFile = [];
      for (const { id, nuevo } of incoming) {
        if (firstSeen.has(nuevo) && firstSeen.get(nuevo) !== id) {
          duplicatesInFile.push(`nº ${nuevo} (IDs ${firstSeen.get(nuevo)} y ${id})`);
        } else {
          firstSeen.set(nuevo, id);
        }
      }
      if (duplicatesInFile.length) {
        setPreCheckError(`ID repetido: ${duplicatesInFile.join(", ")}.`);
        // ❌ no habilitamos resultados
        return;
      }

      // 3) Duplicados contra la base
      //    armamos índice numero -> Set(ids)
      let dbIndex = new Map();
      try {
        const res = await window.api?.chequespPreview?.();
        if (res?.success && Array.isArray(res.data)) {
          dbIndex = res.data.reduce((map, row) => {
            const n = trim(row?.NumeroActual);
            const id = Number(row?.ID_Cheque);
            if (!n || !Number.isFinite(id)) return map;
            if (!map.has(n)) map.set(n, new Set());
            map.get(n).add(id);
            return map;
          }, new Map());
        }
      } catch {
        // si falla la preview, seguimos sin index (no bloquea)
      }

      const duplicatesInDb = [];
      for (const { id, nuevo } of incoming) {
        const setIds = dbIndex.get(nuevo);
        if (setIds && (!setIds.has(id) || setIds.size > 1)) {
          // ese número ya lo tiene otro ID
          const otros = Array.from(setIds).filter((x) => x !== id);
          duplicatesInDb.push(`nº ${nuevo} (ya existe en ID${otros.length > 1 ? "s" : ""} ${otros.join(", ")})`);
        }
      }
      if (duplicatesInDb.length) {
        setPreCheckError(`ID repetido: ${duplicatesInDb.join(", ")}.`);
        // ❌ no habilitamos resultados
        return;
      }

      // 4) OK, sin duplicados → procedemos con el import real
      await onImportar(file);
      setImportTried(true); // ahora sí habilitamos Resultados
    } catch (e) {
      setPreCheckError(e?.message || "Error al verificar duplicados.");
    }
  };

  const titulo = modulos.length > 0 ? modulos[0].texto : "Cargando...";

  const lower = (estadoImportar || "").toLowerCase();
  const feedbackClass =
    lower.includes("error")
      ? styles.error
      : lower.includes("sin cambios")
      ? styles.info
      : styles.success;

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h2 className={styles.title}>Renumeración Masiva por Excel</h2>

        {/* Descargar planilla ChequesP con datos */}
        {template && (
          <button
            className={styles.template}
            onClick={handleDescargarPlanillaChequesP}
            title="Descargar planilla de ChequesP con datos"
            style={{ marginLeft: 8 }}
          >
            <DownloadIcon variant="svg" size={28} stroke={2.6} headSpread={5} pointDepth={4} compact />
          </button>
        )}
      </div>

      {/* Tabs: Importar | Resultados */}
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${activeSection === "importar" ? styles.active : ""}`}
          onClick={() => setActiveSection("importar")}
        >
          Importar
        </button>

        {(importTried || estadoImportar || resultadosCheques.length > 0) && (
          <button
            className={`${styles.toggleButton} ${activeSection === "resultados" ? styles.active : ""}`}
            onClick={() => setActiveSection("resultados")}
            title="Ver resultados de la última importación"
          >
            Resultados
          </button>
        )}
      </div>

      {/* ─────── Importar ─────── */}
      {activeSection === "importar" && (
        <>
          <input
            type="file"
            className={styles.input}
            id="loadFile"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
          />

          {/* Botón de vista previa */}
          <button
            className={styles.btn}
            onClick={handleOpenPreview}
            title="Ver vista previa de todos los cheques en la base"
          >
            Vista Previa de Cheques
          </button>

          {/* Feedback del pre-chequeo (duplicados) */}
          

          <div className={styles.buttonsContainer}>
            <button className={styles.btn} id="cancel" onClick={handleCancel}>
              Limpiar
            </button>

            <button
              className={styles.btn}
              id="saveButton"
              disabled={!isFileLoaded}
              onClick={handleImportarClick}
            >
              Importar
            </button>
          </div>

          {/* Feedback del import real (backend) */}
          {preCheckError ? <p className={styles.error}>{preCheckError}</p> : null}
          {estadoImportar ? (
            <p className={feedbackClass}>{mensajeImportacion || estadoImportar}</p>
            
          ) : null}

          {fileName && (
            <p className={styles.info}>
              Archivo seleccionado: <strong>{fileName}</strong>
            </p>
          )}
        </>
      )}

      {/* ─────── Resultados ─────── */}
      {activeSection === "resultados" && (
        <ChequesActualizados cheques={resultadosCheques} validar={validarResultados} />
      )}

      {/* Modal Vista previa */}
      <Modal
        open={previewOpen}
        title="Vista previa de Cheques"
        onClose={() => setPreviewOpen(false)}
      >
        {previewLoading ? (
          <p>Cargando cheques…</p>
        ) : previewError ? (
          <p className={styles.error}>{previewError}</p>
        ) : previewRows.length === 0 ? (
          <p className={styles.noResults}>No hay cheques para mostrar.</p>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table className={styles.resultsTable}>
              <thead>
                <tr className={styles.headerRow}>
                  <th>ID</th>
                  <th>Empresa</th>
                  <th>Cod. Emp</th>
                  <th>Nº Actual</th>
                  <th>F. Emisión</th>
                  <th>F. Vto</th>
                  <th className={styles.num}>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.ID_Cheque}>
                    <td>{r.ID_Cheque}</td>
                    <td>{r.Empresa || ""}</td>
                    <td>{r.CodEmpresa || ""}</td>
                    <td>{r.NumeroActual || ""}</td>
                    <td>{toDMY(r.Mov_FEmision)}</td>
                    <td>{toDMY(r.ChequeFVto)}</td>
                    <td className={styles.num}>{money(r.Importe)}</td>
                    <td>{r.Estado || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChequesPForm;
