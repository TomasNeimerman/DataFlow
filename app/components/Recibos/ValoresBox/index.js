// components/Recibos/ValoresBox/index.js
"use client";
import React, { useMemo } from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function ValoresBox({
  valorFacturas,      // monto de facturas aplicadas
  aplicadoMedios,     // total de medios de cobro agregados
  mostrarPendiente,   // boolean: mostrar cuadro de saldo pendiente
  nfmt,
}) {
  // Cuadro 1: Facturas aplicadas - aparece cuando valorFacturas > 0
  const mostrarFacturas = Number(valorFacturas || 0) > 0;

  // Cuadro 2: Saldo por cobrar (facturas - medios) - aparece cuando mostrarPendiente = true
  const saldoPorCobrar = Number(valorFacturas || 0) - Number(aplicadoMedios || 0);
  const mostrarSaldoPorCobrar = mostrarPendiente && Number(aplicadoMedios || 0) > 0;

  // Semáforo para saldo por cobrar
  const estadoSaldo = useMemo(() => {
    if (saldoPorCobrar < 0) return "verde"; // Exceso a favor
    if (saldoPorCobrar > 0) return "rojo";  // Falta
    return "verde"; // Exacto
  }, [saldoPorCobrar]);

  const saldoClass = 
    estadoSaldo === "rojo" ? styles.saldoRojo :
    estadoSaldo === "verde" ? styles.saldoVerde :
    "";

  // Determinar label y valor
  const esASuFavor = saldoPorCobrar < 0;
  const labelSaldo = esASuFavor ? "Saldo a Favor" : "Saldo por Cobrar";

  return (
    <div className={styles.valoresBoxContainer}>
      <div className={styles.valoresBoxInner}>
        {/* CUADRO 1: Facturas Aplicadas */}
        {mostrarFacturas && (
          <div className={styles.valoresSection}>
            <div className={styles.label}>Facturas Aplicadas</div>
            <div className={styles.value}>$ {nfmt(valorFacturas)}</div>
          </div>
        )}

        {/* CUADRO 2: Saldo por Cobrar / Saldo a Favor */}
        {mostrarSaldoPorCobrar && (
          <div className={styles.valoresSection}>
            <div className={styles.label}>{labelSaldo}</div>
            <div className={`${styles.value} ${saldoClass}`}>
              {esASuFavor ? "+" : ""} $ {nfmt(Math.abs(saldoPorCobrar))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}