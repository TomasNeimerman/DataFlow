"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";

/* Helpers */
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
const money = (v) =>
  Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STORAGE_KEY = "chequesp_updated_ids";

const loadUpdatedIds = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? new Set(arr.map(Number)) : new Set();
  } catch {
    return new Set();
  }
};
const persistUpdatedIds = (setOfIds) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(setOfIds)));
  } catch {}
};
const sanitizeNumero = (v) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

export default function ChequesPModificar() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // selección, borradores y orden
  const [selected, setSelected] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [draft, setDraft] = useState({});
  const [sortBy, setSortBy] = useState({ key: "ID_Cheque", dir: "asc" });

  // ids actualizados (persisten en la sesión → sessionStorage)
  const [updatedIds, setUpdatedIds] = useState(() => loadUpdatedIds());

  const fetchPreview = useCallback(async () => {
    try {
      setErr("");
      setOkMsg("");
      setLoading(true);
      const res = await window.api?.chequespPreview?.();
      if (!res?.success) throw new Error(res?.message || "No se pudo obtener cheques.");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErr(e?.message || "Error cargando cheques.");
      setRows([]);
    } finally {
      setLoading(false);
      setSelected({});
      setSelectAll(false);
      setDraft({});
    }
  }, []);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // Persistencia de IDs actualizados
  useEffect(() => { persistUpdatedIds(updatedIds); }, [updatedIds]);

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
      const checked = !prev[id];
      const next = { ...prev, [id]: checked };
      if (!checked) {
        delete next[id];
        // limpiamos el draft si se desmarca
        setDraft((d) => {
          const nd = { ...d };
          delete nd[id];
          return nd;
        });
      }
      return next;
    });
  };

  const onChangeNuevoNumero = (id, val) => setDraft((d) => ({ ...d, [id]: val }));

  // Ordenamiento
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sortBy;
       arr.sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
    // 🔢 ordenar ID_Cheque como número (no string)
     if (key === "ID_Cheque") {
       const na = Number(va);
       const nb = Number(vb);
      return dir === "asc" ? na - nb : nb - na;
     }
      if (key === "Importe") {
        const na = Number(va);
        const nb = Number(vb);
        return dir === "asc" ? na - nb : nb - na;
      }
      if (key === "ChequeFVto" || key === "Mov_FEmision" || key === "FechaMod") {
        const da = new Date(va).getTime() || 0;
        const db = new Date(vb).getTime() || 0;
        return dir === "asc" ? da - db : db - da;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return dir === "asc" ? -1 : 1;
      if (sa > sb) return dir === "asc" ?  1 : -1;
      return 0;
    });

    return arr;
  }, [rows, sortBy]);

  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const selectedIds = useMemo(() => Object.keys(selected).map(Number), [selected]);
  const selectedCount = selectedIds.length;

  // Sólo permitimos actualizar los que tienen un draft válido y distinto del actual
  const readyIds = useMemo(() => {
    const idxById = new Map(rows.map(r => [r.ID_Cheque, r]));
    return selectedIds.filter((id) => {
      const newN = sanitizeNumero(draft[id]);
      const curN = sanitizeNumero(idxById.get(id)?.NumeroActual);
      return newN !== null && newN !== curN;
    });
  }, [selectedIds, draft, rows]);

  const [updating, setUpdating] = useState(false);

  const handleUpdateSelected = async () => {
    if (!readyIds.length) {
      setOkMsg("");
      setErr("Seleccioná cheques y cargá un número válido distinto al actual.");
      return;
    }
    try {
      setUpdating(true);
      setErr("");
      setOkMsg("");

      // Ejecuta en paralelo
      const results = await Promise.all(
        readyIds.map(async (idCheque) => {
          const nro = sanitizeNumero(draft[idCheque]);
          try {
            const res = await window.api?.updateCheques?.({ idCheque, nroDefinitivo: nro });
            return { idCheque, nro, ok: !!res?.success, message: res?.message || "" };
          } catch (e) {
            return { idCheque, nro, ok: false, message: e?.message || "Error al actualizar." };
          }
        })
      );

      const ok = results.filter(r => r.ok);
      const fail = results.filter(r => !r.ok);

      // 🟢 Actualización “en vivo” (optimista) en la tabla
      if (ok.length) {
        const nowIso = new Date().toISOString();
        setRows(prev =>
          prev.map(row => {
            const hit = ok.find(k => k.idCheque === row.ID_Cheque);
            return hit
              ? {
                  ...row,
                  NumeroActual: hit.nro ?? row.NumeroActual,
                  FechaMod: nowIso, // mostramos última actualización al instante
                }
              : row;
          })
        );
        // Marcar en negrita y verde (persistente en la sesión)
        setUpdatedIds(prev => {
          const next = new Set(prev);
          ok.forEach(k => next.add(k.idCheque));
          return next;
        });
      }

      // Limpiar selección y drafts sólo de los que salieron OK
      setSelected(prev => {
        const n = { ...prev };
        ok.forEach(k => delete n[k.idCheque]);
        return n;
      });
      setDraft(prev => {
        const n = { ...prev };
        ok.forEach(k => delete n[k.idCheque]);
        return n;
      });

      // Mensajes
      if (ok.length && !fail.length) {
        setOkMsg(`Actualizados ${ok.length} cheque(s).`);
      } else if (ok.length && fail.length) {
        setOkMsg(`Actualizados ${ok.length}. Fallaron ${fail.length}.`);
        setErr(fail[0]?.message || "Algunos cheques no pudieron actualizarse.");
      } else {
        setErr(fail[0]?.message || "No se pudieron actualizar los cheques seleccionados.");
      }

      // (Opcional) Refetch para reconfirmar con DB:
      // await fetchPreview();

    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer} style={{ marginBottom: 8 }}>
        <h1 className={styles.title}>Modificar Cheques</h1>
      </div>

      

      {!!okMsg && <div className={styles.okMsg}>{okMsg}</div>}
      {!!err && <div className={styles.error}>{err}</div>}

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
              <th style={{ cursor: "pointer" }} onClick={() => setSort("FechaMod")}>
                Últ. Mod. {sortBy.key === "FechaMod" ? (sortBy.dir === "asc" ? "▲" : "▼") : "▲▼"}
              </th>
              <th>Estado</th>
              <th>Nuevo número</th>
              <th>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  title="Seleccionar todos"
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 16 }}>Cargando…</td></tr>
            ) : err && rows.length === 0 ? (
              <tr><td colSpan={9} className={styles.error}>No se pudieron cargar cheques.</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={9} className={styles.noResults}>No hay cheques para mostrar.</td></tr>
            ) : (
              sortedRows.map((r) => {
                const isUpdated = updatedIds.has(Number(r.ID_Cheque));
                return (
                  <tr
                    key={r.ID_Cheque}
                    className={`${styles.row} ${isUpdated ? styles.rowUpdated : ""}`}
                    title={isUpdated ? "Actualizado en esta sesión" : ""}
                  >
                    <td>{r.CodEmpresa || r.Empresa || ""}</td>
                    <td>{r.ID_Cheque}</td>
                    <td className={`${isUpdated ? `${styles.cellStrong} ${styles.cellUpdatedGreen}` : ""}`}>
                      {r.NumeroActual || ""}
                    </td>
                    <td>{toDMY(r.ChequeFVto)}</td>
                    <td className={styles.num}>${money(r.Importe)}</td>
                    <td>{toDMY(r.FechaMod)}</td>
                    <td>{r.Estado || ""}</td>
                    <td>
                      <input
                        type="text"
                        value={draft[r.ID_Cheque] ?? ""}
                        onChange={(e) => onChangeNuevoNumero(r.ID_Cheque, e.target.value)}
                        placeholder={selected[r.ID_Cheque] ? "Nuevo nº…" : "Seleccioná la fila"}
                        className={`${styles.input} ${!selected[r.ID_Cheque] ? styles.inputDisabled : ""}`}
                        style={{ maxWidth: 120 }}
                        disabled={!selected[r.ID_Cheque]}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          className={styles.btn}
          onClick={handleUpdateSelected}
          disabled={updating || !readyIds.length}
          style={{ width: "100%" }}
          title={
            updating
              ? "Actualizando…"
              : readyIds.length
              ? `Actualizar ${readyIds.length} cheque(s)`
              : "Seleccioná cheques y cargá un número válido distinto"
          }
        >
          {updating ? "Actualizando…" : "Actualizar Cheques Seleccionados"}
        </button>
      </div>
    </div>
  );
}
/*
<div style={{ marginBottom: 8 }}>
        //  <label style={{ fontWeight: 600, marginRight: 8 }}>Campo a actualizar:</label>
        <select className={styles.select} disabled value="numero">
          <option value="numero">Número de Cheque</option>
        </select>
      </div>
*/ 