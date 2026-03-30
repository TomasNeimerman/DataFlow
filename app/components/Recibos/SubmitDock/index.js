// components/Recibos/SubmitDock/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function SubmitDock({
  ready,
  canConfirm,
  onConfirmar,
  esReciboACuenta = false,
  valorFacturas = 0,
}) {
  const buttonText = esReciboACuenta
    ? "Confirmar Recibo a Cuenta"
    : "Confirmar Recibos";

  return (
    <div className={styles.submitDock}>
      <button
        className={styles.submitBtn}
        disabled={!ready || !canConfirm}
        onClick={onConfirmar}
        title={!ready ? "Completa los datos requeridos" : !canConfirm ? "El monto no cubre las facturas" : ""}
      >
        {buttonText}
      </button>
    </div>
  );
}