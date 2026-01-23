"use client";
import React, { useMemo, useState } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";

export default function ChequesRechazados(props) {
  const {
    chequesRechazados = [],
    situaciones = [],
    estados = [],
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

    // lazy
    onBuscar = null,
    lazyMode = true,
  } = props;

  // ====== FILTROS ======
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fId, setFId] = useState("");
  const [fNro, setFNro] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [fEdo, setFEdo] = useState("");      // "" (vacío), "*" (Todos) o código
  const [fSit, setFSit] = useState("");      // "" (vacío), "*" (Todos) o código
  const [hasSearched, setHasSearched] = useState(false);

  const limpiar = () => {
    setFId(""); setFNro(""); setFDesde(""); setFHasta("");
    setFMin(""); setFMax(""); setFEdo(""); setFSit("");
    setHasSearched(false);
  };

  const toNum = (v) =>
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/\./g, "").replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;

  const hasAnyFilter = useMemo(() => {
    // si hay algo escrito o selects con algo distinto de vacío ("")
    return (
      (fId?.trim() || "") !== "" ||
      (fNro?.trim() || "") !== "" ||
      (fDesde || "") !== "" ||
      (fHasta || "") !== "" ||
      (fMin?.trim() || "") !== "" ||
      (fMax?.trim() || "") !== "" ||
      (fEdo || "") !== "" ||
      (fSit || "") !== ""
    );
  }, [fId, fNro, fDesde, fHasta, fMin, fMax, fEdo, fSit]);

  // ORDER
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sortArrow = (name) => (
    <span style={{ marginLeft: 6 }}>
      <b style={{ opacity: sortCol === name && sortDir === "asc" ? 1 : 0.35 }}>▲</b>
      <b style={{ opacity: sortCol === name && sortDir === "desc" ? 1 : 0.35, marginLeft: 2 }}>▼</b>
    </span>
  );

  // SELECCIÓN
  const selectedIds = Object.keys(selectedChequesData || {}).filter(
    (id) => selectedChequesData?.[id]?.isSelected
  );
  const allSelected =
    chequesRechazados.length > 0 && selectedIds.length === chequesRechazados.length;

  const toggleAll = (checked) => onSelectAllChange?.(!!checked);

  // SITUACIÓN (pill helper)
  const getSitDesc = (code) => {
    if (code === undefined || code === null || code === "") return "";
    const sit = Array.isArray(situaciones)
      ? situaciones.find((s) => String(s.sit_Cod) === String(code))
      : null;
    return sit ? sit.sit_Desc : String(code);
  };

  // EXPORT
  const handleExport = async () => {
    try {
      const payload = (chequesRechazados || []).map(r => ({
        emp: r.emp,
        idCheque: r.idCheque,
        cliente: r.cliente ?? "",
        nroDefinitivo: r.nroDefinitivo,
        importeRaw: r.importeRaw,
        estado: r.estado,
        fvto: r.fvto,
        fMod: r.fMod
      }));
      const res = await window.api?.exportChequesXLSX?.(payload);
      if (!res?.success) {
        alert(res?.message || "No se pudo exportar");
      } else {
        alert(`Exportado OK (${res.count} filas).`);
      }
    } catch (e) {
      alert(e?.message || "Error inesperado al exportar");
    }
  };

  // EDITOR GLOBAL / FILA
  const renderGlobalEditor = () => {
    if (selectedIds.length === 0) return null;
    if (fieldMode === "situacion") {
      return (
        <select className={styles.select} defaultValue="" onChange={(e) => onGlobalValueChange(e.target.value)}>
          <option value=""></option>
          <option value="*">Todos</option>
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
          <option value=""></option>
          <option value="*">Todos</option>
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

  // BUSCAR (solo si hay onBuscar y hay algún filtro seleccionado)
  const doBuscar = async () => {
    if (!onBuscar) return;
    if (!hasAnyFilter) return;
    setHasSearched(true);

    const filters = {
      idCheque: fId?.trim() || null,
      nroCheque: fNro?.trim() || null,
      desde: fDesde || null,
      hasta: fHasta || null,
      min: fMin?.trim() || null,
      max: fMax?.trim() || null,
      estado: fEdo === "*" ? null : (fEdo || null),         // "*" => “Todos” (sin filtrar)
      situacion: fSit === "*" ? null : (fSit || null),      // "*" => “Todos” (sin filtrar)
    };
    await onBuscar(filters);
  };

  return (
    <div className={styles.container} data-key={refreshKey}>
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
          <div style={{display:"flex", gap:8}}>
            <button className={styles.smallBtn} onClick={limpiar}>Limpiar</button>
            <button
              className={styles.smallBtn}
              onClick={doBuscar}
              disabled={!hasAnyFilter || !onBuscar}
              title={!hasAnyFilter ? "Elegí al menos un filtro" : "Buscar"}
            >
              Buscar
            </button>
          </div>
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

            {/* Estado */}
            <div className={styles.filterItem}>
              <label className={styles.label}>Estado</label>
              <select className={styles.select} value={fEdo} onChange={(e)=>setFEdo(e.target.value)}>
                <option value=""></option>
                <option value="*">Todos</option>
                {(estados || []).map(e => (
                  <option key={e.edo_Cod} value={e.edo_Cod}>{e.edo_Desc}</option>
                ))}
              </select>
            </div>

            {/* Situación */}
            <div className={styles.filterItem}>
              <label className={styles.label}>Situación</label>
              <select className={styles.select} value={fSit} onChange={(e)=>setFSit(e.target.value)}>
                <option value=""></option>
                <option value="*">Todos</option>
                {(situaciones || []).map(s => (
                  <option key={s.sit_Cod} value={String(s.sit_Cod)}>{s.sit_Desc}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterFull}>
              <span className={styles.summaryLine}>
                {hasSearched ? (
                  <>Resultados: <b>{chequesRechazados.length}</b></>
                ) : (
                  <>Usá los filtros y presioná <b>Buscar</b></>
                )}
              </span>
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

      {/* ====== TABLA (se oculta si no hay filtros o no se buscó) ====== */}
      {(hasAnyFilter && hasSearched) && (
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
                <th
                  className={styles.sortableHeader}
                  onClick={() => {
                    setSortCol("idCheque");
                    setSortDir((d) => (sortCol === "idCheque" ? (d === "asc" ? "desc" : "asc") : "asc"));
                  }}
                >
                  ID Cheque {sortArrow("idCheque")}
                </th>
                <th
                  className={styles.sortableHeader}
                  onClick={() => {
                    setSortCol("nroDefinitivo");
                    setSortDir((d) => (sortCol === "nroDefinitivo" ? (d === "asc" ? "desc" : "asc") : "asc"));
                  }}
                >
                  Número {sortArrow("nroDefinitivo")}
                </th>
                <th>Cliente</th>
                <th
                  className={styles.sortableHeader}
                  onClick={() => {
                    setSortCol("fvto");
                    setSortDir((d) => (sortCol === "fvto" ? (d === "asc" ? "desc" : "asc") : "asc"));
                  }}
                >
                  Fecha Vencimiento {sortArrow("fvto")}
                </th>
                <th
                  className={styles.sortableHeader}
                  onClick={() => {
                    setSortCol("fMod");
                    setSortDir((d) => (sortCol === "fMod" ? (d === "asc" ? "desc" : "asc") : "asc"));
                  }}
                >
                  Fecha Modificación {sortArrow("fMod")}
                </th>
                <th
                  className={styles.sortableHeader}
                  onClick={() => {
                    setSortCol("importe");
                    setSortDir((d) => (sortCol === "importe" ? (d === "asc" ? "desc" : "asc") : "asc"));
                  }}
                >
                  Importe {sortArrow("importe")}
                </th>
                <th>Estado</th>
                <th>Situación</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {!chequesRechazados.length ? (
                <tr><td className={styles.noResults} colSpan="11">No hay cheques para mostrar</td></tr>
              ) : (
                chequesRechazados.map((row) => {
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
      )}

      {/* ====== BOTONERA ====== */}
      <div className={styles.importButtonContainer}>
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
