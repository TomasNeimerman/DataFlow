// components/Recibos/ValoresBox/index.js
"use client";
import React, { useMemo } from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function ValoresBox({
  saldoTotalCliente,        // saldoBase (gris, informativo)
  saldoDisponible,          // saldoMostrado
  valorFacturas,            // valor aplicado
  seleccionadoFacturas,     // selección actual sin aplicar
  cantFacturasAplicadas,    // cantidad aplicada
  totalValores,             // aplicadoMedios
  esReciboACuenta,          // boolean
  excedentePos,             // monto a favor
  restanteVsFact,           // monto pendiente
  nfmt,
}) {
  // Semáforo: rojo (falta), verde (exacto/cubre), naranja (excede)
  const estadoSaldo = useMemo(() => {
    if ((Number(valorFacturas) || 0) <= 0) return "cuenta";
    const total = Number(totalValores) || 0;
    const valor = Number(valorFacturas) || 0;
    
    if (total < valor) return "rojo";
    if (total > valor) return "naranja";
    return "verde";
  }, [valorFacturas, totalValores]);

  const saldoClass = 
    estadoSaldo === "rojo" ? styles.saldoRojo :
    estadoSaldo === "verde" ? styles.saldoVerde :
    estadoSaldo === "naranja" ? styles.saldoNaranja :
    "";

  return (
    <div className={styles.valoresBoxContainer}>
      <div className={styles.valoresBoxInner}>
        {/* LADO IZQUIERDO: Saldo del Cliente (informativo, grisado) */}
        <div className={styles.valoresSection}>
          <div className={styles.saldoTotalRow}>
            <span className={styles.saldoLabel}>Saldo Total Cliente:</span>
            <span className={styles.saldoTotalGris}>$ {nfmt(saldoTotalCliente)}</span>
            <span className={styles.saldoInfo}>(informativo - no se modifica)</span>
          </div>
        </div>

        {/* CENTRO: Facturas (solo si NO es a cuenta) */}
        {!esReciboACuenta && (
          <div className={styles.valoresSection}>
            <div className={styles.facturaRow}>
              <span className={styles.label}>Cant. Facturas:</span>
              <span className={styles.value}>{cantFacturasAplicadas}</span>
            </div>
            <div className={styles.facturaRow}>
              <span className={styles.label}>Valor Facturas:</span>
              <span className={styles.value}>$ {nfmt(valorFacturas)}</span>
            </div>
          </div>
        )}

        {/* LADO DERECHO: Totales y Saldo Resultante */}
        <div className={styles.valoresSection}>
          <div className={styles.valoresRow}>
            <span className={styles.label}>Total Valores:</span>
            <span className={styles.value}>$ {nfmt(totalValores)}</span>
          </div>

          {/* Saldo Restante con código de color */}
          {!esReciboACuenta && (
            <div className={styles.valoresRow}>
              <span className={styles.label}>Saldo Restante:</span>
              <span className={`${styles.value} ${saldoClass}`}>
                $ {nfmt(restanteVsFact)}
                {estadoSaldo === "naranja" && (
                  <span className={styles.aFavor}>(a favor: $ {nfmt(excedentePos)})</span>
                )}
              </span>
            </div>
          )}

          {/* Para Recibos a Cuenta */}
          {esReciboACuenta && (
            <div className={styles.valoresRow}>
              <span className={styles.label}>Recibo a Cuenta:</span>
              <span className={styles.valueMuted}>Total aplicado: $ {nfmt(totalValores)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Indicador visual de semáforo */}
      {!esReciboACuenta && (
        <div className={`${styles.semaforoBar} ${styles[`semaforo_${estadoSaldo}`]}`} />
      )}
    </div>
  );
}