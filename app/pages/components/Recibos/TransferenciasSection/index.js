import React from "react";
import local from "./styles.module.css";

export default function TransferenciasSection({
  styles,
  nfmt,
  optsTransf,
  transfSel,
  setTransfSel,
  transfMonto,
  setTransfMonto,
  addTransf,
  aplicTransf,
  delTransf,
}) {
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader}>
        <span className={styles.cardTitle}>Transferencias bancarias</span>
      </button>
      <div className={styles.cardBody}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Cuenta</label>
            <select className={styles.select} value={transfSel} onChange={(e) => setTransfSel(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsTransf.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>Monto</label>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={transfMonto}
              onFocus={(e) => {
                if ((e.target.value || "") === "0") e.target.select();
              }}
              onChange={(e) => setTransfMonto(e.target.value)}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>&nbsp;</label>
            <button className={styles.btn} onClick={addTransf} disabled={!transfSel || !transfMonto}>
              Agregar
            </button>
          </div>
        </div>

        {aplicTransf.length > 0 && (
          <ul className={styles.listSimple}>
            {aplicTransf.map((t, i) => (
              <li key={i}>
                <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                <button className={styles.smallBtn} onClick={() => delTransf(i)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
