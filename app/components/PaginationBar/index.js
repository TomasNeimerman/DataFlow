//components/PaginationBar/index.js
"use client";
import React from "react";
import styles from "./styles.module.css";

export default function PaginationBar({
  totalRows = 0,
  page = 1,
  pageSize = 15,
  onPageChange = () => {},
  onPageSizeChange = () => {},
  pageSizeOptions = [15, 30, 60, 90, 120],
  disabled = false,
  className = "",
  labels = {},
}) {
  const {
    previous = "Anterior",
    next = "Siguiente",
    results = "Resultados",
    pageText = "Página",
    perPage = "Por página",
    items = "cheques",
  } = labels;

  const total = Number(totalRows) || 0;
  const ps = Number(pageSize) || 15;
  const p = Math.max(1, Number(page) || 1);

  const totalPages = Math.max(1, Math.ceil(total / ps));
  const canPrev = p > 1 && !disabled;
  const canNext = p < totalPages && !disabled;

  const start = total === 0 ? 0 : (p - 1) * ps + 1;
  const end = total === 0 ? 0 : Math.min(p * ps, total);

  return (
    <div className={`${styles.paginationBar} ${className}`.trim()}>
      <button
        type="button"
        className={styles.pageBtn}
        disabled={!canPrev}
        onClick={() => canPrev && onPageChange(p - 1)}
      >
        {previous}
      </button>

      <div className={styles.paginationCenter}>
        <span className={styles.paginationText}>
          {results}: <b>{total}</b>
        </span>

        <span className={styles.paginationText}>
          {pageText} <b>{p}</b> / <b>{totalPages}</b>
        </span>

        <span className={styles.paginationText}>
          <b>{start}-{end}</b> de <b>{total}</b> {items}
        </span>

        <span className={styles.paginationText}>{perPage}:</span>

        <select
          className={styles.pageSelect}
          value={String(ps)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={String(opt)}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className={styles.pageBtn}
        disabled={!canNext}
        onClick={() => canNext && onPageChange(p + 1)}
      >
        {next}
      </button>
    </div>
  );
}