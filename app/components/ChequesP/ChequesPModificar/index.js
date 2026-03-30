// app/components/ChequesP/ChequesPModificar/index.js
// ✅ MEJORADO: Agregados filtros horizontales
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import PaginationBar from "../../PaginationBar";

const toDMY = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val.split("T")[0]?.split(" ")?.[0] || val;
  const d = new Date(val);
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const money = (v) =>
  Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ChequesPModificar() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [draft, setDraft] = useState({});

  // ⬇️ Default: ordenar por ID ascendente (numérico)
  const [sortBy, setSortBy] = useState({ key: "ID_Cheque", dir: "asc" });

  // ✅ NUEVO: Estados de filtros (horizontales)
  const [fIdCheque, setFIdCheque] = useState("");
  const [fNroCheque, setFNroCheque] = useState("");
  const [fFechaVtoDe, setFFechaVtoDe] = useState("");
  const [fFechaVtoHasta, setFFechaVtoHasta] = useState("");
  const [fImporteMin, setFImporteMin] = useState("");
  const [fImporteMax, setFImporteMax] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Estados de paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchPreview = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);
      const res = await window.api?.chequespPreview?.();
      if (!res?.success) throw new Error(res?.message || "No se pudo obtener cheques.");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setRows([]);
      setErr(e?.message || "Error cargando cheques.");
    } finally {
      setLoading(false);
      setSelected({});
      setSelectAll(false);
      setDraft({});
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const updatedIds = useMemo(() => {
    try {
      const arr = JSON.parse(sessionStorage.getItem("chequespUpdatedIds") || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, [rows]);

  // ✅ NUEVO: Aplicar filtros
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // ID Cheque (exacto)
      if (fIdCheque && String(r.ID_Cheque).trim() !== fIdCheque.trim()) return false;

      // Nro Cheque (contains)
      if (fNroCheque && !String(r.NumeroActual || "").toLowerCase().includes(fNroCheque.toLowerCase())) return false;

      // Fecha Vencimiento (rango)
      if (fFechaVtoDe || fFechaVtoHasta) {
        const fvto = r.ChequeFVto ? new Date(r.ChequeFVto) : null;
        if (!fvto || isNaN(fvto.getTime())) return false;

        if (fFechaVtoDe) {
          const desde = new Date(fFechaVtoDe);
          if (fvto < desde) return false;
        }
        if (fFechaVtoHasta) {
          const hasta = new Date(fFechaVtoHasta);
          hasta.setHours(23, 59, 59, 999);
          if (fvto > hasta) return false;
        }
      }

      // Importe (rango)
      if (fImporteMin || fImporteMax) {
        const imp = Number(r.Importe || 0);
        if (fImporteMin && imp < Number(fImporteMin)) return false;
        if (fImporteMax && imp > Number(fImporteMax)) return false;
      }

      return true;
    });
  }, [rows, fIdCheque, fNroCheque, fFechaVtoDe, fFechaVtoHasta, fImporteMin, fImporteMax]);

  const toggleSelectAll = () => {
    const checked = !selectAll;
    setSelectAll(checked);
    if (!checked) setSelected({});
    else {
      const acc = {};
      for (const r of paginatedRows) acc[r.ID_Cheque] = true;
      setSelected(acc);
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const n = { ...prev, [id]: !prev[id] };
      if (!n[id]) delete n[id];
      return n;
    });
  };

  const onChangeNuevoNumero = (id, val) => setDraft((d) => ({ ...d, [id]: val }));

  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  // 🔧 ORDENAMIENTO NUMÉRICO para ID y Número; fechas y monto ya se tratan; resto alfabético
  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    const { key, dir } = sortBy;
    const sign = dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];

      // ID de cheque: SIEMPRE numérico
      if (key === "ID_Cheque") {
        const na = Number(va) || 0;
        const nb = Number(vb) || 0;
        return (na - nb) * sign;
      }

      // Número actual: intentar comparar numéricamente si ambos son dígitos
      if (key === "NumeroActual") {
        const sa = String(va ?? "");
        const sb = String(vb ?? "");
        const da = /^\d+$/.test(sa) ? Number(sa) : NaN;
        const db = /^\d+$/.test(sb) ? Number(sb) : NaN;
        if (!Number.isNaN(da) && !Number.isNaN(db)) return (da - db) * sign;
        return sa.localeCompare(sb) * sign;
      }

      // Importes: numérico
      if (key === "Importe") {
        const na = Number(va) || 0;
        const nb = Number(vb) || 0;
        return (na - nb) * sign;
      }

      // Fechas: por timestamp
      if (key === "ChequeFVto" || key === "Mov_FEmision" || key === "FecMod") {
        const da = new Date(va).getTime() || 0;
        const db = new Date(vb).getTime() || 0;
        return (da - db) * sign;
      }

      // Resto: alfabético
      const sa = String(va ?? "").toLowerCase();
      const sb = String(vb ?? "").toLowerCase();
      return sa.localeCompare(sb) * sign;
    });

    return arr;
  }, [filteredRows, sortBy]);

  // Paginación de datos filtrados
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedRows.slice(start, end);
  }, [sortedRows, page, pageSize]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  // ✅ NUEVO: Limpiar filtros
  const limpiarFiltros = useCallback(() => {
    setFIdCheque("");
    setFNroCheque("");
    setFFechaVtoDe("");
    setFFechaVtoHasta("");
    setFImporteMin("");
    setFImporteMax("");
    setPage(1);
  }, []);

  const selectedCount = Object.keys(selected).length;

  const hasFilters = !!(fIdCheque || fNroCheque || fFechaVtoDe || fFechaVtoHasta || fImporteMin || fImporteMax);

  return (
    <div className={styles.container}>
      {/* ✅ NUEVO: Sección de Filtros Horizontales */}
      <div className={styles.filtersSection}>
        <div className={styles.filterHeader}>
          <button
            className={styles.filterToggle}
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
          >
            🔍 FILTROS {filtersOpen ? "▾" : "▸"}
          </button>
          {hasFilters && (
            <button className={styles.smallBtn} onClick={limpiarFiltros}>
              Limpiar
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label>ID Cheque</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: 123"
                value={fIdCheque}
                onChange={(e) => {
                  setFIdCheque(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className={styles.filterItem}>
              <label>Nro Cheque</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: 1000"
                value={fNroCheque}
                onChange={(e) => {
                  setFNroCheque(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className={styles.filterItem}>
              <label>Fecha Vto (Desde)</label>
              <input
                type="date"
                className={styles.input}
                value={fFechaVtoDe}
                onChange={(e) => {
                  setFFechaVtoDe(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className={styles.filterItem}>
              <label>Fecha Vto (Hasta)</label>
              <input
                type="date"
                className={styles.input}
                value={fFechaVtoHasta}
                onChange={(e) => {
                  setFFechaVtoHasta(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className={styles.filterItem}>
              <label>Importe (Min)</label>
              <input
                type="number"
                className={styles.input}
                placeholder="0"
                value={fImporteMin}
                onChange={(e) => {
                  setFImporteMin(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className={styles.filterItem}>
              <label>Importe (Max)</label>
              <input
                type="number"
                className={styles.input}
                placeholder="999999"
                value={fImporteMax}
                onChange={(e) => {
                  setFImporteMax(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info de resultados */}
      <div className={styles.resultInfo}>
        <span>
          {filteredRows.length} de {rows.length} cheques
          {hasFilters && " (filtrado)"}
        </span>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th>Empresa</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("ID_Cheque")}>
                ID {sortBy.key === "ID_Cheque" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("NumeroActual")}>
                Número {sortBy.key === "NumeroActual" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("ChequeFVto")}>
                Fecha Vencimiento {sortBy.key === "ChequeFVto" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("Importe")}>
                Importe {sortBy.key === "Importe" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("FecMod")}>
                Últ. Mod. {sortBy.key === "FecMod" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th>Estado</th>
              <th>Nuevo número</th>
              <th>
                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} title="Seleccionar todos" />
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 16 }}>Cargando…</td></tr>
            ) : paginatedRows.length === 0 ? (
              <tr><td colSpan={9} className={styles.noResults}>No hay cheques para mostrar.</td></tr>
            ) : (
              paginatedRows.map((r) => (
                <tr key={r.ID_Cheque} className={styles.row}>
                  <td>{r.CodEmpresa || r.Empresa || ""}</td>
                  <td>{r.ID_Cheque}</td>
                  <td className={updatedIds.has(r.ID_Cheque) ? styles.numUpdated : ""}>
                    {r.NumeroActual || ""}
                  </td>
                  <td>{toDMY(r.ChequeFVto)}</td>
                  <td className={styles.num}>${money(r.Importe)}</td>
                  <td>{toDMY(r.FecMod || r.chp_FecMod || r.UltMod)}</td>
                  <td>{r.Estado || ""}</td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      value={draft[r.ID_Cheque] ?? ""}
                      onChange={(e) => onChangeNuevoNumero(r.ID_Cheque, e.target.value)}
                      placeholder={selected[r.ID_Cheque] ? "Nuevo nº…" : "Seleccioná"}
                      className={styles.input}
                      style={{ maxWidth: 120 }}
                      disabled={!selected[r.ID_Cheque]}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[r.ID_Cheque]}
                      onChange={() => toggleOne(r.ID_Cheque)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        totalRows={filteredRows.length}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        pageSizeOptions={[15, 30, 60, 90, 120]}
        labels={{ items: "cheques" }}
      />

      {err && <div className={styles.alert}>{err}</div>}

      <div style={{ marginTop: 12 }}>
        <button
          className={styles.btn}
          onClick={() => console.log("Actualizar", Object.keys(selected))}
          disabled={selectedCount === 0}
          style={{ width: "100%" }}
        >
          Actualizar {selectedCount} Cheque{selectedCount !== 1 ? "s" : ""} Seleccionado{selectedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}