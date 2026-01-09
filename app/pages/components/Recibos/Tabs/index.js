// pages/components/Recibos/Tabs/index.js
"use client";
import React from "react";
import styles from "../../../Modules/Recibos/styles.module.css"; // <<< IMPORT CORREGIDO

export default function Tabs({ activeTab, setActiveTab }) {
  return (
    <div className={styles.toggleContainer}>
      <button
        className={`${styles.toggleButton} ${activeTab === "facturas" ? styles.active : ""}`}
        onClick={() => setActiveTab("facturas")}
      >
        Facturas
      </button>
      <button
        className={`${styles.toggleButton} ${activeTab === "medios" ? styles.active : ""}`}
        onClick={() => setActiveTab("medios")}
      >
        Medios de Cobro
      </button>
    </div>
  );
}
