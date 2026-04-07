// components/Recibos/Tabs/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function Tabs({ 
  activeTab, 
  setActiveTab, 
  esFinanzas = false,
  puedeMostrarMedios = false 
}) {
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
      
      {/* Mostrar pestaña Medios SOLO si se confirmó aplicación o es recibo a cuenta */}
      {puedeMostrarMedios && (
        <button
          className={`${styles.toggleButton} ${activeTab === "medios" ? styles.active : ""}`}
          onClick={() => setActiveTab("medios")}
        >
          Medios de Cobro {esFinanzas ? "(Fondos)" : ""}
        </button>
      )}
    </div>
  );
}