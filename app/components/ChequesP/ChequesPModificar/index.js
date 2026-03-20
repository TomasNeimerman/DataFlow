//components/ChequesP/ChequesPModificar/index.js
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

  const toggleSelectAll = () => {
    const checked = !selectAll;
    setSelectAll(checked);
    if (!checked) setSelected({});
    else {
      const acc = {};
      for (const r of rows) acc[r.ID_Cheque] = true;
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
    const arr = [...rows];
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
  }, [rows, sortBy]);

  // Paginación de datos
  const totalRows = sortedRows.length;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedRows.slice(start, end);
  }, [sortedRows, page, pageSize]);

  const selectedCount = Object.keys(selected).length;

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1); // Reset a la primera página
  };

  const getExistingNumbers = () => {
    const s = new Set();
    for (const r of rows) {
      const n = String(r?.NumeroActual ?? "").trim();
      if (n) s.add(n);
    }
    return s;
  };

  const handleUpdateSelected = async () => {
    setErr("");

    const candidates = Object.keys(selected).map((idStr) => {
      const id = Number(idStr);
      return {
        id,
        newNum: String(draft[idStr] ?? "").trim(),
        current: String(rows.find((x) => x.ID_Cheque === id)?.NumeroActual ?? "").trim(),
      };
    });

    const toProcess = candidates.filter((c) => c.newNum && /^\d+$/.test(c.newNum));
    if (!toProcess.length) {
      setErr("Seleccioná cheques y cargá un nuevo número válido (solo dígitos).");
      return;
    }

    const existing = getExistingNumbers();
    const reserved = new Set();
    const conflicts = [];
    const payload = [];

    for (const c of toProcess) {
      if (c.newNum === c.current) continue;
      if (existing.has(c.newNum)) {
        conflicts.push(`ID ${c.id} → ${c.newNum} (ya existe)`);
        continue;
      }
      if (reserved.has(c.newNum)) {
        conflicts.push(`ID ${c.id} → ${c.newNum} (duplicado en selección)`);
        continue;
      }
      reserved.add(c.newNum);
      payload.push({ idCheque: c.id, nroDefinitivo: Number(c.newNum) });
    }

    if (conflicts.length) {
      setErr("ID repetido: " + conflicts.join(", "));
      return;
    }
    if (!payload.length) {
      setErr("No hay cambios válidos para actualizar.");
      return;
    }

    const okIds = [];
    for (const item of payload) {
      const res = await window.api.updateCheques(item);
      if (res?.success) {
        okIds.push(item.idCheque);
        try {
          const prev = JSON.parse(sessionStorage.getItem("chequespUpdatedIds") || "[]");
          const next = Array.from(new Set([...prev, item.idCheque]));
          sessionStorage.setItem("chequespUpdatedIds", JSON.stringify(next));
        } catch {}
      }
    }

    await fetchPreview();

    if (!okIds.length) setErr("No se pudo actualizar ningún cheque.");
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer} style={{ marginBottom: 8 }}>
        <h1 className={styles.title}>Modificar Cheques</h1>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontWeight: 600, marginRight: 8 }}>Campo a actualizar:</label>
        <select className={styles.select} disabled value="numero">
          <option value="numero">Número de Cheque</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.resultsTable}>
          <thead>
            <tr className={styles.headerRow}>
              <th>Empresa</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("ID_Cheque")}>
                ID Cheque {sortBy.key === "ID_Cheque" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
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
                      placeholder={selected[r.ID_Cheque] ? "Nuevo nº…" : "Seleccioná la fila"}
                      className={styles.input}
                      style={{ maxWidth: 120 }}
                      disabled={!selected[r.ID_Cheque]}
                      title={!selected[r.ID_Cheque] ? "Primero seleccioná la fila" : "Nuevo número"}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[r.ID_Cheque]}
                      onChange={() => toggleOne(r.ID_Cheque)}
                      title="Actualizar este cheque"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        totalRows={totalRows}
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
          onClick={handleUpdateSelected}
          disabled={selectedCount === 0}
          style={{ width: "100%" }}
          title={selectedCount ? "Actualizar Cheques Seleccionados" : "Seleccioná al menos uno"}
        >
          Actualizar Cheques Seleccionados
        </button>
      </div>
    </div>
  );
}
