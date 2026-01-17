// pages/components/Recibos/FacturasSection/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css"; // <<< IMPORT CORREGIDO

export default function FacturasSection({
  facturas, aplicaFact, setAplicaFact,
  saldoBase, valorFacturas, setValorFacturas,
  seleccionadoFacturas, aplicarFacturas,
  restanteVsFact, nfmt, dfmt
}) {

  const totalSeleccionadoExcept = (index) =>
    Object.entries(aplicaFact).reduce((acc, [k, v]) => {
      if (Number(k) === Number(index)) return acc;
      return acc + (v?.checked ? (Number(v.monto) || 0) : 0);
    }, 0);

  const saldoMostrado = Math.max(0, saldoBase - valorFacturas);

  return (
    <div className={styles.tabInner}>
      <div className={styles.saldoHeader}>
        <div><strong>Saldo Disponible:</strong> $ {nfmt(saldoMostrado)}</div>
        <div className={styles.favorRow}>
          <span>
            <strong>Valor Facturas:</strong> $ {nfmt(valorFacturas)} ·{" "}
            Restante: <strong className={restanteVsFact < 0 ? styles.saldoFavor : ""}>$ {nfmt(saldoMostrado)}</strong>
          </span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Facturas</span>
          <div className={styles.cardHeaderRight}>
            <span className={styles.muted}>
              Seleccionado: <strong>$ {nfmt(seleccionadoFacturas)}</strong>
            </span>
            <button className={styles.smallBtn} onClick={aplicarFacturas} disabled={seleccionadoFacturas <= 0}>
              Aplicar selección
            </button>
          </div>
        </div>

        <div className={`${styles.cardBody} ${styles.tableContainer}`}>
          <table className={styles.table}>
            <thead className={styles.headerRow}>
              <tr>
                <th className={styles.checkCell}>Sel</th>
                <th>Comprobante</th>
                <th>Emisión</th>
                <th className={styles.tdRight}>Importe Original</th>
                <th className={styles.tdRight}>Saldo</th>
                <th className={styles.tdRight}>Monto a aplicar</th>
              </tr>
            </thead>
            <tbody>
              {!facturas?.length ? (
                <tr><td className={styles.noResults} colSpan={6}>No hay facturas con saldo.</td></tr>
              ) : (
                facturas.map((f, idx) => {
                  const st = aplicaFact[idx] || { checked: false, monto: 0 };
                  return (
                    <tr key={idx} className={styles.row}>
                      <td className={styles.checkCell}>
                        <input
                          type="checkbox"
                          checked={!!st.checked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (!checked) {
                              setAplicaFact((p) => ({ ...p, [idx]: { checked: false, monto: 0 } }));
                              return;
                            }
                            const otros = totalSeleccionadoExcept(idx);
                            const restanteCliente = Math.max(0, saldoBase - otros);
                            const maxFila = Math.min(Number(f["Saldo"]) || 0, restanteCliente);
                            setAplicaFact((p) => ({ ...p, [idx]: { checked: true, monto: maxFila } }));
                          }}
                        />
                      </td>
                      <td>{f.Comprobante}</td>
                      <td>{dfmt(f["Fecha Emision"])}</td>
                      <td className={styles.tdRight}>$ {nfmt(f["Importe Original"])}</td>
                      <td className={styles.tdRight}>$ {nfmt(f["Saldo"])}</td>
                      <td className={styles.tdRight}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={styles.input}
                          disabled={!st.checked}
                          value={st.monto ?? ""}
                          onFocus={(e) => { if ((e.target.value || "") === "0") e.target.select(); }}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const topeFactura = Number(f["Saldo"]) || 0;
                            const otros = totalSeleccionadoExcept(idx);
                            const restanteCliente = Math.max(0, saldoBase - otros);
                            const cap = Math.max(0, Math.min(val, topeFactura, restanteCliente));
                            setAplicaFact((prev) => ({ ...prev, [idx]: { checked: true, monto: cap } }));
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
