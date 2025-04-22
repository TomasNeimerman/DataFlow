import React from "react";
import styles from './styles.module.css';

// ✅ Formatear fecha a DD/MM/YYYY
const formatFecha = (fecha) => {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR'); // DD/MM/YYYY
};

// ✅ Formatear importe con separador de miles y coma decimal
const formatImporte = (valor) => {
  if (!valor) return '-';
  const num = parseFloat(valor);
  if (isNaN(num)) return '-';
  return num.toLocaleString('es-AR', { minimumFractionDigits: 2 });
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

const ChequesActualizados = ({ cheques, valoresActuales }) => {
  const getNuevoCheque = (id) => cheques.find((c) => c.idCheque === id);

  return (
    <div >
      <h2 className={styles.title}>Actualización de Cheques Detectada</h2>

      {valoresActuales.length === 0 && (
        <p className={styles.noResults}>No hay cheques para actualizar.</p>
      )}

      <div className={styles.cardsContainer}> {/* Nuevo div contenedor */}
        {valoresActuales.map((actual) => {
          const nuevo = getNuevoCheque(actual.chp_ID);
          if (!nuevo) return null;

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