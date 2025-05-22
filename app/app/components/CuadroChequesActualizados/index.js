import React, { useState } from "react";
import styles from './styles.module.css';


const ChequesActualizados = ({ cheques, validar }) => {
  const [mostrarCuadro, setMostrarCuadro] = useState(false);

  const toggleMostrarCuadro = () => {
    setMostrarCuadro(!mostrarCuadro);
  };
  console.log(cheques, 'cheques desde el cuadro cheques actualizados')
  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualización de Cheques</h2>
        <button onClick={toggleMostrarCuadro} className={styles.toggleButton}>
          {mostrarCuadro ? "–" : '▭'}
        </button>
      </div>
      {!validar || cheques.length === 0 ? (
        <p className={styles.noResults}>No hay cheques para actualizar.</p>
      ) : (
        mostrarCuadro && (
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th>Empresa</th>
                <th>Fecha Movimiento</th>
                <th>Nro Definitivo</th>
                <th>importe</th>
                <th>Tipo</th>
                <th>Movimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map(({ cheque, actualizado }) => (
                <tr className={actualizado ? styles.tractualizado: ''} key={cheque.idCheque}>
                  <td>{cheque.codEmp}</td>
                  <td>{cheque.fechaEmision}</td>
                  <td className={actualizado ? styles.ok : ''}>{cheque.nroDefinitivo}</td>
                  <td>{cheque.importe}</td>
                  <td>{cheque.tipoCheque}</td>
                  <td>{cheque.movimiento}</td>
                  <td>{actualizado ? 'Se actualizo correctamente✅' : 'No se actualizo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
};

export default ChequesActualizados;