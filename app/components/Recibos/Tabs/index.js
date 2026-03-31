// components/Recibos/Tabs/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function Tabs({ activeTab, setActiveTab, esFinanzas = false }) {
  return (
    <div className={styles.toggleContainer}>
      {/* Mostrar pestaña Facturas solo si es Ventas */}
      {!esFinanzas && (
        <button
          className={`${styles.toggleButton} ${activeTab === "facturas" ? styles.active : ""}`}
          onClick={() => setActiveTab("facturas")}
        >
          Aplicación
        </button>
      )}
      
      <button
        className={`${styles.toggleButton} ${activeTab === "medios" ? styles.active : ""}`}
        onClick={() => setActiveTab("medios")}
      >
        Medios de Cobro {esFinanzas ? "(Fondos)" : ""}
      </button>
    </div>
  );
}