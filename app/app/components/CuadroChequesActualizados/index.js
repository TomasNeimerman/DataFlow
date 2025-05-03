import React from "react";
import styles from './styles.module.css';



const ChequesActualizados = ({ cheques, validar }) => {
  if (!validar || cheques.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.noResults}>No hay cheques para actualizar.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Actualización de Cheques</h2>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th>Empresa</th>
            <th>Nro Cheque</th>
            <th>Cheque</th>
            <th>Importe</th>
            <th>Fecha Movimiento</th>
            <th>Movimiento</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {cheques.map(({ cheque, actualizado }) => (
            <tr key={cheque.idCheque}>
              <td>{cheque.codEmp}</td>
              <td>{cheque.chequeCodigo}</td>
              <td>{cheque.nroDefinitivo}</td>
              <td className={actualizado ? styles.ok : ''}>{cheque.importe}</td>
              <td>{cheque.fechaEmision}</td>
              <td>{cheque.movimiento}</td>
              <td>{actualizado ? 'Se actualizo correctamente✅' : 'No se actualizo'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ChequesActualizados;
