"use client";
import React, { useMemo } from "react";
import styles from "../../../Modules/Recibos/styles.module.css";

export default function ValoresBox({
  // números base
  saldoTotalCliente,        // saldoBase (gris, no cambia con selección)
  saldoDisponible,          // saldoMostrado (saldoBase - valorFacturas aplicado)
  valorFacturas,            // valor aplicado (congelado)
  seleccionadoFacturas,     // selección actual (sin congelar)
  cantFacturasAplicadas,    // cantidad aplicada (si usás snapshot) o calculada
  totalValores,             // aplicadoMedios
  esReciboACuenta,          // boolean
  nfmt,
}) {
  const restanteFacturas = useMemo(() => (Number(valorFacturas) || 0) - (Number(totalValores) || 0), [valorFacturas, totalValores]);
  const excedente = useMemo(() => Math.max(0, (Number(totalValores) || 0) - (Number(valorFacturas) || 0)), [valorFacturas, totalValores]);

  // semáforo por saldo (según doc)
  // rojo: falta cubrir, verde: cubre exacto o más, naranja: excede (saldo a favor)
  const estado = useMemo(() => {
    if ((Number(valorFacturas) || 0) <= 0) return "cuenta";
    if ((Number(totalValores) || 0) < (Number(valorFacturas) || 0)) return "rojo";
    if ((Number(totalValores) || 0) > (Number(valorFacturas) || 0)) return "naranja";
    return "verde";
  }, [valorFacturas, totalValores]);

  const colorClass =
    estado === "rojo" ? styles.error :
    estado === "verde" ? styles.ok :
    estado === "naranja" ? styles.parenGreen :
    "";

  return (
    <div className={styles.saldoHeader} style={{ gap: 12, flexWrap: "wrap" }}>
      {/* lado izq */}
      <div className={styles.favorRow} style={{ flexWrap: "wrap" }}>
        <span style={{ opacity: 0.75 }}>
          <strong>Saldo Total:</strong> $ {nfmt(saldoTotalCliente)}
        </span>

        <span>·</span>

        <span>
          <strong>Saldo Disponible:</strong> $ {nfmt(saldoDisponible)}
        </span>
      </div>

      {/* lado der */}
      <div className={styles.favorRow} style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        {esReciboACuenta ? (
          <span className={styles.muted}>
            <strong>Recibo a cuenta</strong> · Total valores: <strong>$ {nfmt(totalValores)}</strong>
          </span>
        ) : (
          <>
            <span>
              <strong>Cant. facturas:</strong> {cantFacturasAplicadas}
            </span>

            <span>·</span>

            <span>
              <strong>Valor Facturas:</strong> $ {nfmt(valorFacturas)}
            </span>

            <span>·</span>

            <span>
              <strong>Total valores:</strong> $ {nfmt(totalValores)}
            </span>

            <span>·</span>

            <span>
              <strong>Saldo Restante:</strong>{" "}
              <strong className={colorClass}>
                $ {nfmt(restanteFacturas)}
              </strong>
              {estado === "naranja" && (
                <span className={styles.parenGreen} style={{ marginLeft: 6 }}>
                  (a favor: {nfmt(excedente)})
                </span>
              )}
            </span>

            {/* info útil: selección en vivo */}
            <span className={styles.muted} style={{ marginLeft: 8 }}>
              (selección: <strong>$ {nfmt(seleccionadoFacturas)}</strong>)
            </span>
          </>
        )}
      </div>
    </div>
  );
}