"use client";

import ui from "../../Modules/ActualizadordePrecios/styles.module.css";
import styles from "./styles.module.css";

export default function Descargar({
  codigosLista = [],
  loadingCodigos = false,
  errorCodigos = "",
  selectedOption = "",
  onSelectChange = () => {},
  isOptionConfirmed = false,
  onConfirmarSeleccion = () => {},
  onVerVistaPrevia = () => {},
  onDescargarClick = () => {},
}) {
  return (
    <>
      <div className={styles.titleWrap}><h2 className={ui.title}>Seleccionar Lista</h2></div>

      <select
        className={ui.select}
        value={selectedOption}
        onChange={(e) => onSelectChange(e.target.value)}
        disabled={loadingCodigos}
      >
        <option value="">
          {loadingCodigos ? "Cargando Listas..." : "Seleccione una Opción..."}
        </option>
        {codigosLista.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {!!errorCodigos && (
        <small className={ui.errorText} style={{ display: "block", marginTop: 6 }}>
          {errorCodigos}
        </small>
      )}

      <div className={styles.actions}>
        <button className={ui.btn} disabled={!selectedOption} onClick={onConfirmarSeleccion}>
          Confirmar Selección
        </button>

        {isOptionConfirmed && (
          <>
            <button className={ui.btn} onClick={onVerVistaPrevia}>Ver Vista Previa</button>
            <button className={ui.btn} onClick={onDescargarClick}>Descargar Lista</button>
            <p className={ui.info} style={{ margin: 0, alignSelf: "center" }}>
              Opción Seleccionada: <strong>{selectedOption}</strong>
            </p>
          </>
        )}
      </div>
    </>
  );
}
