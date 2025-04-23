import React from "react";
import styles from './styles.module.css';

const formatFecha = (fecha) => {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const año = d.getUTCFullYear();
  return `${dia}/${mes}/${año}`;
};

const formatImporte = (valor) => {
  if (!valor) return '-';
  const num = parseFloat(valor);
  return isNaN(num) ? '-' : num.toLocaleString('es-AR', { minimumFractionDigits: 2 });
};

const renderCampo = (label, actual, nuevo) => {
  const diferente = actual !== nuevo;
  return (
    <tr key={label}>
      <td className={styles.fieldName}>{label}</td>
      <td>{actual ?? '-'}</td>
      <td className={diferente ? styles.differentValue : styles.sameValue}>
        {nuevo ?? '-'}
      </td>
    </tr>
  );
};

const esChequeIgual = (actual, nuevo) => {
  return (
    actual.chpemp_Codigo === nuevo.codEmp &&
    actual.chpsuc_Cod === nuevo.emp &&
    formatFecha(actual.chp_FEnt) === nuevo.fechaEmision &&
    actual.chpbco_Suc === nuevo.movimiento &&
    actual.chptch_Cod === nuevo.tipoCheque &&
    actual.chp_edo === nuevo.estado &&
    formatFecha(actual.chp_FVto) === nuevo.fechaVenc &&
    actual.chp_NroCheq === nuevo.chequeCodigo &&
    actual.chp_NroDtvo === nuevo.nroDefinitivo &&
    parseFloat(actual.chp_Importe).toFixed(2) === parseFloat(nuevo.importe).toFixed(2)
  );
};

const ChequesActualizados = ({ cheques, valoresActuales, validar }) => {
  const getNuevoCheque = (id) => cheques.find((c) => c.idCheque === id);

  const chequesModificados = valoresActuales.filter(actual => {
    const nuevo = getNuevoCheque(actual.chp_ID);
    return nuevo && !esChequeIgual(actual, nuevo);
  });

  if (!validar || chequesModificados.length === 0) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Actualización de Cheques Detectada</h2>
      <div className={styles.cardsContainer}>
        {chequesModificados.map((actual) => {
          const nuevo = getNuevoCheque(actual.chp_ID);
          return (
            <div key={actual.chp_ID} className={styles.card}>
              <h4 className={styles.cardTitle}>Cheque ID: {actual.chp_ID}</h4>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    <th>Campo</th>
                    <th>Actual</th>
                    <th>Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {renderCampo("Empresa", actual.chpemp_Codigo, nuevo.codEmp)}
                  {renderCampo("Sucursal", actual.chpsuc_Cod, nuevo.emp)}
                  {renderCampo("Fecha Emisión", formatFecha(actual.chp_FEnt), nuevo.fechaEmision)}
                  {renderCampo("Movimiento", actual.chpbco_Suc, nuevo.movimiento)}
                  {renderCampo("Tipo Cheque", actual.chptch_Cod, nuevo.tipoCheque)}
                  {renderCampo("Estado", actual.chp_edo, nuevo.estado)}
                  {renderCampo("Fecha Vencimiento", formatFecha(actual.chp_FVto), nuevo.fechaVenc)}
                  {renderCampo("Código Cheque", actual.chp_NroCheq, nuevo.chequeCodigo)}
                  {renderCampo("Nro Definitivo", actual.chp_NroDtvo, nuevo.nroDefinitivo)}
                  {renderCampo("Importe", formatImporte(actual.chp_Importe), formatImporte(nuevo.importe))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChequesActualizados;
