import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css"

export default function AplicacionesSection({
  nfmt,
  optsAp,
  apSel,
  setApSel,
  apMonto,
  setApMonto,
  addAp,
  aplicAps,
  delAp,
}) {
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader}>
        <span className={styles.cardTitle}>Aplicaciones</span>
      </button>
      <div className={styles.cardBody}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Aplicación</label>
            <select className={styles.select} value={apSel} onChange={(e) => setApSel(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsAp.map((o) => (
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
              value={apMonto}
              onFocus={(e) => {
                if ((e.target.value || "") === "0") e.target.select();
              }}
              onChange={(e) => setApMonto(e.target.value)}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>&nbsp;</label>
            <button className={styles.btn} onClick={addAp} disabled={!apSel || !apMonto}>
              Agregar
            </button>
          </div>
        </div>

        {aplicAps.length > 0 && (
          <ul className={styles.listSimple}>
            {aplicAps.map((t, i) => (
              <li key={i}>
                <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                <button className={styles.smallBtn} onClick={() => delAp(i)}>
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
