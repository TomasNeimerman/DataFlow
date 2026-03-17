//components/CuadroChequesEdoR/index.js
"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected";
import PaginationBar from "../PaginationBar";

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
    onSelectAllChange = () => {},
    refreshKey = 0,

    cheques3Export = [],

    fieldMode = "situacion",
    onFieldModeChange = () => {},
    onRowValueChange = () => {},
    onGlobalValueChange = () => {},

    onBuscar = null,

    page = 1,
    pageSize = 15,
    totalRows = null,
    onPageChange = null,
    onPageSizeChange = null,
    lastFilters = null,
    lazyMode = true,
  } = props;

  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const lastHeightRef = useRef(null);

  const TABLE_MIN_H = 180;
  const TABLE_MAX_H = 520;
  const EXPAND_RANGE = 260;

  const [tableHeight, setTableHeight] = useState(TABLE_MIN_H);

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const y = el.scrollTop || 0;
      const t = clamp(y / EXPAND_RANGE, 0, 1);
      const h = Math.round(TABLE_MIN_H + t * (TABLE_MAX_H - TABLE_MIN_H));

      if (lastHeightRef.current === null || Math.abs(h - lastHeightRef.current) >= 3) {
        lastHeightRef.current = h;
        setTableHeight(h);
      }
    };

    compute();

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [refreshKey]);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fId, setFId] = useState("");
  const [fNro, setFNro] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [fEdo, setFEdo] = useState("");
  const [fSit, setFSit] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const limpiar = () => {
    setFId("");
    setFNro("");
    setFDesde("");
    setFHasta("");
    setFMin("");
    setFMax("");
    setFEdo("");
    setFSit("");
    setHasSearched(false);

    if (typeof onPageChange === "function") onPageChange(1);
  };

  const hasAnyFilter = useMemo(() => {
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

  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sortArrow = (name) => (
    <span style={{ marginLeft: 6 }}>
      <b style={{ opacity: sortCol === name && sortDir === "asc" ? 1 : 0.35 }}>▲</b>
      <b style={{ opacity: sortCol === name && sortDir === "desc" ? 1 : 0.35, marginLeft: 2 }}>▼</b>
    </span>
  );

  const onHeaderSort = (col) => {
    setSortCol(col);
    setSortDir((d) => (sortCol === col ? (d === "asc" ? "desc" : "asc") : "asc"));
    if (typeof onPageChange === "function") onPageChange(1);
  };

  const toNumberLoose = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/\s/g, "");
    const norm = s
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) ? n : 0;
  };

  const toDateLoose = (v) => {
    if (!v) return new Date(0);
    if (v instanceof Date && !isNaN(v)) return v;

    const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      const dt = new Date(y, mm, d);
      return isNaN(dt) ? new Date(0) : dt;
    }

    const dt = new Date(v);
    return isNaN(dt) ? new Date(0) : dt;
  };

  const getSortValue = (row, col) => {
    switch (col) {
      case "idCheque":
        return toNumberLoose(row?.idCheque);
      case "nroDefinitivo":
        return toNumberLoose(row?.nroDefinitivo);
      case "importe":
        return toNumberLoose(row?.importeRaw ?? row?.importe);
      case "fvto":
        return row?.fvtoRaw ? new Date(row.fvtoRaw) : toDateLoose(row?.fvto);
      case "fMod":
        return row?.fModRaw ? new Date(row.fModRaw) : toDateLoose(row?.fMod);
      default:
        return String(row?.[col] ?? "").toLowerCase();
    }
  };

  const rowsSorted = useMemo(() => {
    const src = Array.isArray(chequesRechazados) ? chequesRechazados : [];
    if (!sortCol) return src;

    const dir = sortDir === "desc" ? -1 : 1;
    const copy = [...src];

    copy.sort((a, b) => {
      const va = getSortValue(a, sortCol);
      const vb = getSortValue(b, sortCol);

      if (va instanceof Date && vb instanceof Date) return (va - vb) * dir;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;

      return String(va).localeCompare(String(vb), "es", { numeric: true }) * dir;
    });

    return copy;
  }, [chequesRechazados, sortCol, sortDir]);

  const selectedIds = Object.keys(selectedChequesData || {}).filter(
    (id) => selectedChequesData?.[id]?.isSelected
  );

  const allSelected =
    chequesRechazados.length > 0 && selectedIds.length === chequesRechazados.length;

  const toggleAll = (checked) => onSelectAllChange?.(!!checked);

  const getSitDesc = (code) => {
    if (code === undefined || code === null || code === "") return "";
    const sit = Array.isArray(situaciones)
      ? situaciones.find((s) => String(s.sit_Cod) === String(code))
      : null;
    return sit ? sit.sit_Desc : String(code);
  };

  const handleExport = async () => {
    try {
      if (!cheques3Export?.length) {
        alert("No hay datos para exportar. Primero realizá una búsqueda con filtros.");
        return;
      }

      const payload = cheques3Export.map((r) => ({
        emp: r.emp,
        idCheque: r.idCheque,
        cliente: r.cliente ?? "",
        nroDefinitivo: r.nroDefinitivo,
        importe: r.importe,
        estado: r.estado,
        fvto: r.fvto,
        fMod: r.fMod,
        situacion: r.situacion,
      }));

      const res = await window.api?.exportChequesXLSX?.(payload);

      if (!res?.success) {
        alert(res?.message || "No se pudo exportar");
        return;
      }

      alert(`Exportado OK (${payload.length} filas).`);
    } catch (e) {
      alert(e?.message || "Error inesperado al exportar");
    }
  };

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
        <select className={styles.select} value={val} onChange={(e) => onRowValueChange(row.idCheque, e.target.value)}>
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
      estado: fEdo === "*" ? null : fEdo || null,
      situacion: fSit === "*" ? null : fSit || null,
    };

    await onBuscar(filters);
  };

  const total = Number.isFinite(totalRows) && totalRows !== null ? Number(totalRows) : chequesRechazados?.length || 0;
  const ps = Number(pageSize) || 15;
  const p = Math.max(1, Number(page) || 1);

  const pageControlsEnabled =
    typeof onPageChange === "function" && typeof onPageSizeChange === "function";

  return (
    <div ref={containerRef} className={styles.container} data-key={refreshKey}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Cheques de Terceros</h2>
        <EmpresaSelected />
      </div>

      <div className={styles.card}>
        <div className={styles.filtersHeader}>
          <button
            className={styles.filtersHeaderBtn}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            FILTROS <span className={styles.chev}>{filtersOpen ? "▾" : "▸"}</span>
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button className={styles.smallBtn} onClick={limpiar}>
              Limpiar
            </button>
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

            <div className={styles.filterItem}>
              <label className={styles.label}>Estado</label>
              <select className={styles.select} value={fEdo} onChange={(e) => setFEdo(e.target.value)}>
                <option value=""></option>
                <option value="*">Todos</option>
                {(estados || []).map((e) => (
                  <option key={e.edo_Cod} value={e.edo_Cod}>
                    {e.edo_Desc}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Situación</label>
              <select className={styles.select} value={fSit} onChange={(e) => setFSit(e.target.value)}>
                <option value=""></option>
                <option value="*">Todos</option>
                {(situaciones || []).map((s) => (
                  <option key={s.sit_Cod} value={String(s.sit_Cod)}>
                    {s.sit_Desc}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterFull}>
              <span className={styles.summaryLine}>
                {hasSearched ? (
                  <>
                    Resultados: <b>{total}</b>
                  </>
                ) : (
                  <>
                    Usá los filtros y presioná <b>Buscar</b>
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

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

      {hasSearched && (
        <div className={styles.tableContainer} style={{ maxHeight: `${tableHeight}px` }}>
          <div className={styles.tableScroll}>
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
                  <th className={styles.sortableHeader} onClick={() => onHeaderSort("idCheque")}>
                    ID Cheque {sortArrow("idCheque")}
                  </th>
                  <th className={styles.sortableHeader} onClick={() => onHeaderSort("nroDefinitivo")}>
                    Número {sortArrow("nroDefinitivo")}
                  </th>
                  <th>Cliente</th>
                  <th className={styles.sortableHeader} onClick={() => onHeaderSort("fvto")}>
                    Fecha Vencimiento {sortArrow("fvto")}
                  </th>
                  <th className={styles.sortableHeader} onClick={() => onHeaderSort("fMod")}>
                    Fecha Modificación {sortArrow("fMod")}
                  </th>
                  <th className={styles.sortableHeader} onClick={() => onHeaderSort("importe")}>
                    Importe {sortArrow("importe")}
                  </th>
                  <th>Estado</th>
                  <th>Situación</th>
                  <th>Editar</th>
                </tr>
              </thead>

              <tbody>
                {!rowsSorted.length ? (
                  <tr>
                    <td className={styles.noResults} colSpan="11">
                      No hay cheques para mostrar
                    </td>
                  </tr>
                ) : (
                  rowsSorted.map((row) => {
                    const sel = !!selectedChequesData?.[row.idCheque]?.isSelected;
                    const sit = selectedChequesData?.[row.idCheque]?.situacionId || row.situacion || "";
                    return (
                      <tr key={row.idCheque}>
                        <td>
                          <input type="checkbox" checked={sel} onChange={() => onChequeToggle(row.idCheque)} />
                        </td>
                        <td>{row.emp}</td>
                        <td>{row.idCheque}</td>
                        <td>{row.nroDefinitivo}</td>
                        <td>{row.cliente ?? ""}</td>
                        <td>{row.fvto}</td>
                        <td>{row.fMod || "Sin actualizar"}</td>
                        <td>{row.importe}</td>
                        <td>{row.estado}</td>
                        <td>
                          <span className={styles.situacionText}>{getSitDesc(sit)}</span>
                        </td>
                        <td className={styles.editCell}>{renderRowEditor(row)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalRows={total}
            page={p}
            pageSize={ps}
            onPageChange={(nextPage) =>
              typeof onPageChange === "function" && onPageChange(nextPage)
            }
            onPageSizeChange={(nextSize) =>
              typeof onPageSizeChange === "function" && onPageSizeChange(nextSize)
            }
            pageSizeOptions={[15, 30, 60, 90, 120]}
            disabled={!pageControlsEnabled || (lastFilters === null && lazyMode)}
            labels={{ items: "cheques" }}
          />
        </div>
      )}

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