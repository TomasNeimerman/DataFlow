import React, { useState } from "react";
import styles from "./styles.module.css";

const PreciosActualizados = ({ precios, validar }) => {
  const [mostrarCuadro, setMostrarCuadro] = useState(false);

  const toggleMostrarCuadro = () => setMostrarCuadro(!mostrarCuadro);

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Precios Actualizados</h2>
        <button
          onClick={toggleMostrarCuadro}
          className={styles.toggleButton}
          placeholder="Mostrar/Ocultar precios actualizados"
          title="Mostrar/ocultar precios actualizados"
        >
          {mostrarCuadro ? "–" : "▭"}
        </button>
      </div>

      {!validar || !precios || precios.length === 0 ? (
        <p className={styles.noResults}>No hay precios para actualizar.</p>
      ) : (
        mostrarCuadro && (
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th>Lista de Precios - Cód.</th>
                <th>Art. - Cód. Genérico</th>
                <th>Art. - Cód. Elem. 1</th>
                <th>Art. - Cód. Elem. 2</th>
                <th>Art. - Cód. Elem. 3</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {precios.map(({ precio, actualizado, motivo }, idx) => (
                <tr
                  key={idx}
                  className={actualizado ? styles.tractualizado : ""}
                >
                  <td>{precio.lprdlp_Cod}</td>
                  <td>{precio.lprart_CodGen}</td>
                  <td>{precio.lprart_CodEle1}</td>
                  <td>{precio.lprart_CodEle2}</td>
                  <td>{precio.lprart_CodEle3}</td>
                  <td className={actualizado ? styles.ok : ""}>
                    {precio.precio}
                  </td>
                  <td>
                    {actualizado
                      ? "Se actualizó correctamente ✅"
                      : motivo
                      ? `No se actualizó (${motivo})`
                      : "No se actualizó"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
};

export default PreciosActualizados;
