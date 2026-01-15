// app/components/CuadroChequesEdoR.js
"use client";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";

export default function ChequesRechazados(props) {
  const {
    chequesRechazados = [],
    situaciones = [],
    onChequeToggle = () => {},
    selectedChequesData = {},
    onImportarClick = () => {},
    isImportButtonDisabled = false,
    importStatus = null,
    importMessage = "",
    runLogs = [],
    runErrors = [],
    onSelectAllChange = () => {},
    refreshKey = 0,

    fieldMode = "situacion",
    onFieldModeChange = () => {},
    onRowValueChange = () => {},
    onGlobalValueChange = () => {},
  } = props;

  // ====== FILTROS ======
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fId, setFId] = useState("");
  const [fNro, setFNro] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");

  const limpiar = () => {
    setFId(""); setFNro(""); setFDesde(""); setFHasta(""); setFMin(""); setFMax("");
  };

  const parseD = (s) => (s ? new Date(s) : null);
  const toNum = (v) =>
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/\./g, "").replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;

  const filtered = useMemo(() => {
    const d1 = parseD(fDesde);
    const d2 = parseD(fHasta);
    const n1 = fMin !== "" ? toNum(fMin) : null;
    const n2 = fMax !== "" ? toNum(fMax) : null;

    return (chequesRechazados || []).filter((c) => {
      const idok = !fId || String(c.idCheque || "").includes(fId.trim());
      const nrook = !fNro || String(c.nroDefinitivo || "").includes(fNro.trim());

      let fechaOk = true;
      if (d1 || d2) {
        const t = c.fvtoRaw instanceof Date && !isNaN(c.fvtoRaw) ? c.fvtoRaw.getTime() : NaN;
        const t1 = d1 ? d1.getTime() : -Infinity;
        const t2 = d2 ? d2.getTime() : +Infinity;
        fechaOk = !isNaN(t) && t >= t1 && t <= t2;
      }

      let impOk = true;
      const val = toNum(c.importeRaw ?? c.importe);
      if (n1 !== null && val < n1) impOk = false;
      if (n2 !== null && val > n2) impOk = false;

      return idok && nrook && fechaOk && impOk;
    });
  }, [chequesRechazados, fId, fNro, fDesde, fHasta, fMin, fMax]);

  // ====== ORDEN ======
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortCol) return arr;

    arr.sort((a, b) => {
      let A = a?.[sortCol];
      let B = b?.[sortCol];

      if (sortCol === "fvto") {
        A = a?.fvtoRaw instanceof Date ? a.fvtoRaw.getTime() : 0;
        B = b?.fvtoRaw instanceof Date ? b.fvtoRaw.getTime() : 0;
      } else if (sortCol === "importe") {
        A = toNum(a?.importeRaw ?? a?.importe);
        B = toNum(b?.importeRaw ?? b?.importe);
      } else if (sortCol === "idCheque" || sortCol === "nroDefinitivo") {
        A = parseInt(A, 10) || 0;
        B = parseInt(B, 10) || 0;
      }else if (sortCol === "fMod") {
        A = a?.fModRaw instanceof Date ? a.fModRaw.getTime() : 0;
        B = b?.fModRaw instanceof Date ? b.fModRaw.getTime() : 0;
      }

      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filtered, sortCol, sortDir]);

  const sortArrow = (name) => (
    <span style={{ marginLeft: 6 }}>
      <b style={{ opacity: sortCol === name && sortDir === "asc" ? 1 : 0.35 }}>▲</b>
      <b style={{ opacity: sortCol === name && sortDir === "desc" ? 1 : 0.35, marginLeft: 2 }}>▼</b>
    </span>
  );

  // ====== SELECCIÓN ======
  const selectedIds = Object.keys(selectedChequesData || {}).filter(
    (id) => selectedChequesData?.[id]?.isSelected
  );
  const allSelected =
    sorted.length > 0 && selectedIds.length === sorted.length;

  const toggleAll = (checked) => onSelectAllChange?.(!!checked);

  // ====== EXPORT XLSX ======
  const getSitDesc = (code) => {
    if (code === undefined || code === null || code === "") return "";
    const sit = Array.isArray(situaciones)
      ? situaciones.find((s) => String(s.sit_Cod) === String(code))
      : null;
    return sit ? sit.sit_Desc : String(code);
  };

  const handleExport = async () => {
  try {
    const payload = (chequesRechazados || []).map(r => ({
      emp: r.emp,
      idCheque: r.idCheque,
      cliente: r.cliente ?? '',           // viene del back; si no, dejá vacío
      nroDefinitivo: r.nroDefinitivo,
      importeRaw: r.importeRaw,
      estado: r.estado,
      fvto: r.fvto,
      fMod: r.fMod
    }));
    const res = await window.api?.exportChequesXLSX?.(payload);
    if (!res?.success) {
      alert(res?.message || 'No se pudo exportar');
    } else {
      alert(`Exportado OK (${res.count} filas).`);
    }
  } catch (e) {
    alert(e?.message || 'Error inesperado al exportar');
  }
};

  // ====== RENDER ======
  const renderGlobalEditor = () => {
    if (selectedIds.length === 0) return null;
    if (fieldMode === "situacion") {
      return (
        <select className={styles.select} defaultValue="" onChange={(e) => onGlobalValueChange(e.target.value)}>
          <option value="">Seleccionar...</option>
          {(situaciones || []).map((s) => (
            <option key={s.sit_Cod} value={s.sit_Cod}>
              {s.sit_Desc}
            </option>
          ))}
        </select>
      );
    }
    if (fieldMode === "fvto") {
      return <input type="date" className={styles.input} onChange={(e) => onGlobalValueChange(e.target.value)} />;
    }
    if (fieldMode === "numero") {
      return <input type="text" className={styles.input} onChange={(e) => onGlobalValueChange(e.target.value)} />;
    }
    return null;
  };

  const renderRowEditor = (row) => {
    const sel = !!selectedChequesData?.[row.idCheque]?.isSelected;
    if (!sel) return <span className={styles.muted}>—</span>;
    const val = selectedChequesData?.[row.idCheque]?.newValue || "";

    if (fieldMode === "situacion") {
      return (
        <select
          className={styles.select}
          value={val}
          onChange={(e) => onRowValueChange(row.idCheque, e.target.value)}
        >
          <option value="">Seleccionar...</option>
          {(situaciones || []).map((s) => (
            <option key={s.sit_Cod} value={s.sit_Cod}>
              {s.sit_Desc}
            </option>
          ))}
        </select>
      );
    }
    if (fieldMode === "fvto") {
      return (
        <input
          type="date"
          className={styles.input}
          value={val}
          onChange={(e) => onRowValueChange(row.idCheque, e.target.value)}
        />
      );
    }
    if (fieldMode === "numero") {
      return (
        <input
          type="text"
          className={styles.input}
          value={val}
          onChange={(e) => onRowValueChange(row.idCheque, e.target.value)}
        />
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Cheques de Terceros</h2>
        <EmpresaSelected />
      </div>

      {/* ====== FILTROS ====== */}
      <div className={styles.card}>
        <div className={styles.filtersHeader}>
          <button
            className={styles.filtersHeaderBtn}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            FILTROS
            <span className={styles.chev}>{filtersOpen ? "▾" : "▸"}</span>
          </button>
          <button className={styles.smallBtn} onClick={limpiar}>Limpiar</button>
        </div>

        {filtersOpen && (
          <div className={styles.filtersBar}>
            <div className={styles.filterItem}>
              <label className={styles.label}>IdCheque</label>
              <input className={styles.input} value={fId} onChange={(e) => setFId(e.target.value)} placeholder="Ej: 10234" />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.label}>Nro. Cheque</label>
              <input className={styles.input} value={fNro} onChange={(e) => setFNro(e.target.value)} placeholder="Buscar por número..." />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.label}>Fecha Vto. (Desde)</label>
              <input type="date" className={styles.input} value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.label}>Fecha Vto. (Hasta)</label>
              <input type="date" className={styles.input} value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.label}>Importe Mín.</label>
              <input className={styles.input} value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="0.00" />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.label}>Importe Máx.</label>
              <input className={styles.input} value={fMax} onChange={(e) => setFMax(e.target.value)} placeholder="999999.99" />
            </div>
            <div className={styles.filterFull}>
              <span className={styles.summaryLine}>Total: {chequesRechazados.length} | Filtrados: <b>{filtered.length}</b></span>
            </div>
          </div>
        )}
      </div>

      {/* ====== BARRA CAMPO / VALOR GLOBAL ====== */}
      <div className={styles.massBar}>
        <div className={styles.massLeft}>
          <label className={styles.label}>Campo a Actualizar:</label>
          <select className={styles.select} value={fieldMode} onChange={(e) => onFieldModeChange(e.target.value)}>
            <option value="situacion">Situación</option>
            <option value="fvto">Fecha de Vencimiento</option>
            <option value="numero">Número de Cheque</option>
          </select>
        </div>
        <div className={styles.massRight}>
          {selectedIds.length > 0 && (
            <>
              <label className={styles.label}>
                {fieldMode === "situacion" ? "Nueva Situación" : fieldMode === "fvto" ? "Nueva Fecha Vto." : "Nuevo Número"}:
              </label>
              {renderGlobalEditor()}
            </>
          )}
        </div>
      </div>

      {/* ====== TABLA ====== */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  title="Seleccionar todos"
                />
              </th>
              <th>Empresa</th>
              <th className={styles.sortableHeader} onClick={() => {
                setSortCol("idCheque");
                setSortDir((d) => (sortCol === "idCheque" ? (d === "asc" ? "desc" : "asc") : "asc"));
              }}>
                ID Cheque {sortArrow("idCheque")}
              </th>
              <th className={styles.sortableHeader} onClick={() => {
                setSortCol("nroDefinitivo");
                setSortDir((d) => (sortCol === "nroDefinitivo" ? (d === "asc" ? "desc" : "asc") : "asc"));
              }}>
                Número {sortArrow("nroDefinitivo")}
              </th>
              <th>Cliente</th>
              <th className={styles.sortableHeader} onClick={() => {
                setSortCol("fvto");
                setSortDir((d) => (sortCol === "fvto" ? (d === "asc" ? "desc" : "asc") : "asc"));
              }}>
                Fecha Vencimiento {sortArrow("fvto")}
              </th>
              <th className={styles.sortableHeader} onClick={() => {
                setSortCol("fMod");
                setSortDir((d) => (sortCol === "fMod" ? (d === "asc" ? "desc" : "asc") : "asc"));
              }}
              >Fecha Modificación {sortArrow("fMod")}</th>
              <th className={styles.sortableHeader} onClick={() => {
                setSortCol("importe");
                setSortDir((d) => (sortCol === "importe" ? (d === "asc" ? "desc" : "asc") : "asc"));
              }}>
                Importe {sortArrow("importe")}
              </th>
              <th>Estado</th>
              <th>Situación</th>
              <th>Editar</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td className={styles.noResults} colSpan="10">No hay cheques para mostrar</td></tr>
            ) : (
              sorted.map((row) => {
                const sel = !!selectedChequesData?.[row.idCheque]?.isSelected;
                const sit = selectedChequesData?.[row.idCheque]?.situacionId || row.situacion || "";
                return (
                  <tr key={row.idCheque}>
                    <td><input type="checkbox" checked={sel} onChange={() => onChequeToggle(row.idCheque)} /></td>
                    <td>{row.emp}</td>
                    <td>{row.idCheque}</td>
                    <td>{row.nroDefinitivo}</td>
                    <td>{row.cliente ?? ""}</td>
                    <td>{row.fvto}</td>
                    <td>{row.fMod || "Sin actualizar"}</td>
                    <td>{row.importe}</td>
                    <td>{row.estado}</td>
                    <td><span className={styles.situacionText}>{getSitDesc(sit)}</span></td>
                    <td className={styles.editCell}>{renderRowEditor(row)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ====== BOTONERA FINAL ====== */}
      <div className={styles.importButtonContainer}>
        {/* Exportar ARRIBA del Actualizar */}
  <button className={styles.btn} onClick={handleExport}>
    Exportar a Excel (.xlsx)
  </button>
        {importStatus && (
          <p className={`${styles.footerMsg} ${importStatus === "error" ? styles.error : importStatus === "success" ? styles.ok : ""}`}>
            {importMessage}
          </p>
        )}
        <button className={styles.btn} disabled={!!isImportButtonDisabled} onClick={onImportarClick}>
          Actualizar Cheques Seleccionados
        </button>
      </div>
    </div>
  );
}
