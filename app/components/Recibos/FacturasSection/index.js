// app/components/Recibos/FacturasSection/index.js
"use client";

import React, { useMemo } from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function FacturasSection({
  facturas,
  aplicaFact,
  setAplicaFact,
  seleccionadoFacturas,
  aplicarFacturas,
  totalSeleccionadoExcept,
  saldoMostrado,
  nfmt,
  dfmt,
}) {
  const esReciboACuenta = Number(seleccionadoFacturas || 0) <= 0;
  const restanteVsFact = Number(saldoMostrado || 0) - Number(seleccionadoFacturas || 0);

  // Helper para togglear factura
  const toggleFactura = (index) => {
    setAplicaFact((prev) => {
      const current = prev[index] || { checked: false, monto: 0 };
      const willCheck = !current.checked;

      // ✅ SI SE CHEQUEA: auto-llenar con el saldo de la factura
      // SI SE DESCHEQUEA: limpiar
      if (willCheck && facturas[index]) {
        const factura = facturas[index];
        const saldo = Number(factura.Saldo || factura.saldo || 0);
        return {
          ...prev,
          [index]: { checked: true, monto: saldo },
        };
      }

      return {
        ...prev,
        [index]: { checked: false, monto: 0 },
      };
    });
  };

  // Helper para cambiar monto manualmente
  const handleMontoChange = (index, newMonto) => {
    const numMonto = Number(newMonto) || 0;
    const factura = facturas[index];
    const saldo = Number(factura.Saldo || factura.saldo || 0);

    // Topear: no puede ser mayor al saldo de la factura ni al saldo disponible del cliente
    const otrosSeleccionados = totalSeleccionadoExcept(index);
    const disponibleCliente = Number(saldoMostrado || 0) - otrosSeleccionados;

    // Tomar el mínimo entre: saldo de factura, disponible del cliente, y lo que el usuario escribe
    const montoFinal = Math.min(numMonto, saldo, Math.max(0, disponibleCliente));

    setAplicaFact((prev) => ({
      ...prev,
      [index]: { checked: numMonto > 0, monto: montoFinal },
    }));
  };

  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} type="button">
        <span className={styles.cardTitle}>Facturas</span>
      </button>

      <div className={styles.cardBody}>
        {!facturas || facturas.length === 0 ? (
          <div className={styles.muted}>Sin facturas pendientes para este cliente y moneda.</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    <th style={{ width: "40px" }}>Sel</th>
                    <th>Comprobante</th>
                    <th>Emisión</th>
                    <th>Importe Original</th>
                    <th>Saldo</th>
                    <th>Monto a aplicar</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((factura, index) => {
                    const aplicado = aplicaFact[index] || { checked: false, monto: 0 };
                    const saldo = Number(factura.Saldo || factura.saldo || 0);
                    const original = Number(factura["Importe Original"] || factura.importe || 0);

                    return (
                      <tr key={index} className={styles.row}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={aplicado.checked}
                            onChange={() => toggleFactura(index)}
                          />
                        </td>
                        <td>{factura.Comprobante || factura.comprobante || ""}</td>
                        <td>{dfmt(factura["Fecha Emision"] || factura.fechaEmision)}</td>
                        <td className={styles.tdRight}>
                          $ {nfmt(original)}
                        </td>
                        <td className={styles.tdRight}>
                          <span style={saldo < 0 ? { color: "#c00", fontWeight: "bold" } : {}}>
                            $ {nfmt(saldo)}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className={styles.input}
                            step="0.01"
                            min="0"
                            max={saldo}
                            value={aplicado.monto || 0}
                            onFocus={(e) => {
                              if ((e.target.value || "") === "0") e.target.select();
                            }}
                            onChange={(e) => handleMontoChange(index, e.target.value)}
                            disabled={!aplicado.checked}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.summaryBlock}>
              <div>
                {!esReciboACuenta && (
                  <span>
                    Facturas seleccionadas: <strong>{facturas.length}</strong>
                  </span>
                )}
              </div>

              <div>
                Seleccionado: <strong>$ {nfmt(seleccionadoFacturas)}</strong> ·{" "}
                {esReciboACuenta ? (
                  <>
                    Saldo Total: <strong>$ {nfmt(saldoMostrado)}</strong>
                  </>
                ) : (
                  <>
                    Restante:{" "}
                    <strong className={restanteVsFact < 0 ? styles.saldoFavor : ""}>
                      $ {nfmt(restanteVsFact)}
                    </strong>
                  </>
                )}
              </div>

              <button className={styles.btn} onClick={aplicarFacturas}>
                Confirmar Facturas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}