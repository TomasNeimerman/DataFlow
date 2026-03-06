"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";

const Script = ({ precios, scriptInfo, onActualizar, isUpdating, progress, error, successMessage }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (columnName) => {
    if (sortColumn === columnName) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else {
      setSortColumn(columnName);
      setSortDirection("asc");
    }
  };

  const renderSortArrow = (columnName) => (
    <span style={{ marginLeft: 5 }}>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === "asc" ? "bold" : "normal" }}>▲</span>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === "desc" ? "bold" : "normal" }}>▼</span>
    </span>
  );

  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Ejecutar Script SQL</h2>
      </div>

      {/* ✅ Documentación del script (sale del SQL) */}
      {scriptInfo?.description && (
        <div className={styles.docBox}>
          <div className={styles.docTitle}>📌 ¿Qué hace este script?</div>
          <div className={styles.docText}>{scriptInfo.description}</div>
        </div>
      )}

      {/* Botón + barra de progreso */}
      <div className={styles.actionsRow}>
        <button className={styles.btnPrimary} onClick={onActualizar} disabled={isUpdating}>
          {isUpdating ? "Generando..." : "Aceptar"}
        </button>

        {progress && (
          <div className={styles.progressWrap}>
            <div className={styles.progressTop}>
              <span className={styles.progressStage}>{progress.stage || "Procesando"}</span>
              <span className={styles.progressPct}>{Math.round(pct)}%</span>
            </div>

            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${pct}%`,
                }}
              />
            </div>

            {progress.message && <div className={styles.progressMsg}>{progress.message}</div>}
          </div>
        )}
      </div>

      {/* Mensajes de estado */}
      <div className={styles.statusMessages}>
        {error && <div className={styles.errorBox}>{error}</div>}
        {successMessage && <div className={styles.successBox}>{successMessage}</div>}
      </div>
    </div>
  );
};

export default Script;
