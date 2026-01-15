import React from "react";
import local from "./styles.module.css";
import styles from "../../../pages/Modules/Recibos/styles.module.css"

export default function SubmitDock({  ready, canConfirm, onConfirmar }) {
  return (
    <div className={styles.submitDock}>
      <button className={styles.submitBtn} disabled={!ready || !canConfirm} onClick={onConfirmar}>
        Confirmar Recibos
      </button>
    </div>
  );
}
