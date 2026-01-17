import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css"

export default function CajasSection({
  nfmt,
  optsCajas,
  cajaSel,
  setCajaSel,
  cajaMonto,
  setCajaMonto,
  addCaja,
  aplicCajas,
  delCaja,
}) {
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader}>
        <span className={styles.cardTitle}>Cajas</span>
      </button>
      <div className={styles.cardBody}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Caja</label>
            <select className={styles.select} value={cajaSel} onChange={(e) => setCajaSel(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsCajas.map((o) => (
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
              value={cajaMonto}
              onFocus={(e) => {
                if ((e.target.value || "") === "0") e.target.select();
              }}
              onChange={(e) => setCajaMonto(e.target.value)}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>&nbsp;</label>
            <button className={styles.btn} onClick={addCaja} disabled={!cajaSel || !cajaMonto}>
              Agregar
            </button>
          </div>
        </div>

        {aplicCajas.length > 0 && (
          <ul className={styles.listSimple}>
            {aplicCajas.map((t, i) => (
              <li key={i}>
                <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                <button className={styles.smallBtn} onClick={() => delCaja(i)}>
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
