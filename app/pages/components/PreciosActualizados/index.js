"use client";
import React from "react";
import * as XLSX from "xlsx";
import styles from "./styles.module.css";

const PreciosActualizados = ({ precios, onVolver, successMessage, error }) => {
  const data = Array.isArray(precios) ? precios : [];

  const money = (v) => {
    const n = Number(v);
    if (!isFinite(n)) return "$ 0,00";
    return n.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const num = (v) => {
    const n = Number(v);
    if (!isFinite(n)) return "0,00";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const pct = (v) => {
    const n = Number(v);
    if (!isFinite(n)) return "0,00 %";
    return `${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  };
  const fdt = (v) => {
    try { return new Date(v).toLocaleString("es-AR"); } catch { return "-"; }
  };

  // 👉 Exportar a Excel
  const handleExportExcel = () => {
    if (!data.length) return;

    const header = [
      "Fecha",
      "Lista",
      "Código",
      "Descripción",
      "Moneda",
      "Costo",
      "Cotización",
      "Costo en $",
      "MarkUp (%)",
      "Precio Anterior",
      "Precio Nuevo",
      "InclEnLisP",
      "CircVta",
      "Actualizar",
    ];

    const rows = data.map((p) => ([
      p.FechaEjecucion ? new Date(p.FechaEjecucion) : "",
      p.ListaPrecioCod ?? "",
      p.CodArticulo ?? "",
      p.Descripcion ?? "",
      p.MonedaCosto ?? "",
      Number(p.CostoOriginal) || 0,
      Number(p.Cotizacion) || 0,
      Number(p.CostoBasePesos) || 0,
      Number(p.MarkUp) || 0,
      Number(p.PrecioAnterior) || 0,
      Number(p.PrecioNuevo) || 0,
      p.art_InclEnLisP ?? "",
      p.art_CircVta ?? "",
      p.Dart_ActualizarListaPrec ?? "",
    ]));

    const aoa = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Anchos de columna aproximados
    ws["!cols"] = [
      { wch: 18 }, // Fecha
      { wch: 6  }, // Lista
      { wch: 24 }, // Código
      { wch: 50 }, // Descripción
      { wch: 8  }, // Moneda
      { wch: 14 }, // Costo
      { wch: 12 }, // Cotización
      { wch: 16 }, // Costo $
      { wch: 12 }, // MarkUp
      { wch: 16 }, // Precio Ant
      { wch: 16 }, // Precio Nuevo
      { wch: 10 }, // Incl
      { wch: 8  }, // Circ
      { wch: 10 }, // Actualizar
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actualizados");

    const now = new Date();
    const pad = (n) => `${n}`.padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `PreciosActualizados_${stamp}.xlsx`;

    XLSX.writeFile(wb, filename); // en Electron abre el diálogo/descarga
  };

  if (!data.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>
          Resultados de la Última Actualización
          <span style={{ fontSize: 14, color: "#666", marginLeft: 8 }}>
            ({data.length} ítems)
          </span>
        </h2>

        <div className={styles.headerActions}>
          {typeof onVolver === "function" && (
            <button className={styles.toggleButton} onClick={onVolver} title="Volver">
              ← Volver
            </button>
          )}
          <button
            className={styles.exportBtn}
            onClick={handleExportExcel}
            title="Exportar a Excel"
            aria-label="Exportar a Excel"
          >
            ⇩
          </button>
        </div>
      </div>

      {successMessage && <div className={styles.successBox}>{successMessage}</div>}
      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th>Fecha</th>
              <th>Lista</th>
              <th>Código</th>
              <th>Descripción</th>
              <th>Moneda</th>
              <th className={styles.num}>Costo</th>
              <th className={styles.num}>Cotización</th>
              <th className={styles.num}>Costo en $</th>
              <th className={styles.num}>MarkUp</th>
              <th className={styles.num}>Precio Anterior</th>
              <th className={styles.num}>Precio Nuevo</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={`${p.CodArticulo ?? i}`} className={styles.row}>
                <td>{fdt(p.FechaEjecucion)}</td>
                <td>{p.ListaPrecioCod ?? "-"}</td>
                <td>{p.CodArticulo ?? "-"}</td>
                <td>{p.Descripcion ?? "-"}</td>
                <td>{p.MonedaCosto ?? "-"}</td>
                <td className={styles.num}>{money(p.CostoOriginal)}</td>
                <td className={styles.num}>{num(p.Cotizacion)}</td>
                <td className={styles.num}>{money(p.CostoBasePesos)}</td>
                <td className={styles.num}>{pct(p.MarkUp)}</td>
                <td className={styles.num}>{money(p.PrecioAnterior)}</td>
                <td className={styles.num}>{money(p.PrecioNuevo)}</td>
                <td>
                  <span className={`${styles.badge} ${(p.art_InclEnLisP==='1' || (p.art_InclEnLisP||'').toUpperCase()==='S')?styles.badgeOk:styles.badgeWarn}`}>InclEnLisP</span>
                  <span className={`${styles.badge} ${(p.art_CircVta==='1' || (p.art_CircVta||'').toUpperCase()==='S')?styles.badgeOk:styles.badgeWarn}`}>CircVta</span>
                  <span className={`${styles.badge} {((p.Dart_ActualizarListaPrec||'').toUpperCase()==='S')?styles.badgeOk:styles.badgeWarn}`}>Actualizar</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreciosActualizados;
