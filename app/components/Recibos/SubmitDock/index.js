// components/Recibos/SubmitDock/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function SubmitDock({
  ready,
  canConfirm,
  onConfirmar,
  onCancelar,
  esReciboACuenta = false,
  valorFacturas = 0,
  seleccionadoFacturas = 0,
}) {
  const buttonText = esReciboACuenta
    ? "Confirmar Recibo a Cuenta"
    : "Confirmar Recibo";

  // Mostrar dock SOLO si valorFacturas > 0 (después de aplicar facturas)
  const mostrarDock = valorFacturas > 0 || esReciboACuenta;

  return (
    <div className={styles.submitDock}>
      {mostrarDock && (
        <div className={styles.submitDockLayout}>
          <button
            className={styles.submitBtn}
            disabled={!ready || !canConfirm}
            onClick={onConfirmar}
            title={!ready ? "Completa los datos requeridos" : !canConfirm ? "El monto no cubre las facturas" : ""}
          >
            {buttonText}
          </button>
          <button
            className={styles.submitBtn}
            style={{ background: "#666" }}
            onMouseEnter={(e) => !e.target.disabled && (e.target.style.background = "#444")}
            onMouseLeave={(e) => (e.target.style.background = "#666")}
            onClick={onCancelar}
            title="Cancelar y limpiar todo"
          >
            Cancelar Recibo
          </button>
        </div>
      )}
    </div>
  );
}