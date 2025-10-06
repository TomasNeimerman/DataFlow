// app/components/CuadroChequesEdoR.js
"use client";
import React, { useState, useEffect } from "react";
import styles from './styles.module.css';

const ChequesRechazados = ({
  chequesRechazados,
  situaciones,
  onChequeToggle,
  onSituacionChange, // compatibilidad
  selectedChequesData,
  onImportarClick,
  isImportButtonDisabled,
  importStatus,
  importMessage,
  // NUEVO
  onSelectAllChange,
  onGlobalSituacionChange,
  refreshKey,
  runLogs = [],
  runErrors = [],
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedCheques, setSortedCheques] = useState([]);
  const [updatedFechasById, setUpdatedFechasById] = useState({});

  useEffect(() => {
    const fetchUpdatedDates = async () => {
      try {
        const data = await window.api.getUpdatedFecha();
        setUpdatedFechasById(data.data || {});
      } catch (error) {
        console.error("Error al obtener las fechas de actualización:", error);
        setUpdatedFechasById({});
      }
    };
    fetchUpdatedDates();
  }, [refreshKey]);

  useEffect(() => {
    if (!chequesRechazados?.length) { setSortedCheques([]); return; }
    const arr = [...chequesRechazados];
    if (sortColumn) {
      arr.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (sortColumn === 'fvto') {
          valA = a.fvtoRaw instanceof Date && !isNaN(a.fvtoRaw) ? a.fvtoRaw.getTime() : 0;
          valB = b.fvtoRaw instanceof Date && !isNaN(b.fvtoRaw) ? b.fvtoRaw.getTime() : 0;
        } else if (sortColumn === 'importe') {
          valA = parseFloat(String(valA).replace(/[^0-9,-]+/g, "").replace(",", "."));
          valB = parseFloat(String(valB).replace(/[^0-9,-]+/g, "").replace(",", "."));
          if (isNaN(valA)) valA = 0;
          if (isNaN(valB)) valB = 0;
        } else if (sortColumn === 'idCheque' || sortColumn === 'nroDefinitivo') {
          valA = parseInt(valA, 10) || 0;
          valB = parseInt(valB, 10) || 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ?  1 : -1;
        return 0;
      });
    }
    setSortedCheques(arr);
  }, [chequesRechazados, sortColumn, sortDirection]);

  const handleSort = (columnName) => {
    if (sortColumn === columnName) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(columnName); setSortDirection('asc'); }
  };

  const renderSortArrow = (columnName) => (
    <span style={{ marginLeft: '5px' }}>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'asc' ? 'bold' : 'normal' }}>▲</span>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'desc' ? 'bold' : 'normal' }}>▼</span>
    </span>
  );

  const selectedIds = Object.keys(selectedChequesData).filter(id => selectedChequesData[id]?.isSelected);
  const selectedCount = selectedIds.length;
  const allSelected = chequesRechazados.length > 0 && selectedCount === chequesRechazados.length;

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Cheques de Terceros</h2>
      </div>

      {/* Select global: aparece si hay seleccionados */}
      {selectedCount > 0 && (
        <div className={styles.massActions}>
          <span>Situación para {allSelected ? 'todos' : 'seleccionados'}:</span>
          <select
            onChange={(e) => onGlobalSituacionChange(e.target.value)}
            className={styles.select}
            defaultValue=""
          >
            <option value="">Seleccionar...</option>
            {situaciones.map(situacion => (
              <option key={situacion.sit_Cod} value={situacion.sit_Cod}>
                {situacion.sit_Desc}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th>Empresa</th>
              <th onClick={() => handleSort('idCheque')} className={styles.sortableHeader}>
                ID Cheque {renderSortArrow('idCheque')}
              </th>
              <th onClick={() => handleSort('nroDefinitivo')} className={styles.sortableHeader}>
                Número {renderSortArrow('nroDefinitivo')}
              </th>
              <th onClick={() => handleSort('fvto')} className={styles.sortableHeader}>
                Fecha Vencimiento {renderSortArrow('fvto')}
              </th>
              <th onClick={() => handleSort('importe')} className={styles.sortableHeader}>
                Importe {renderSortArrow('importe')}
              </th>
              <th>Estado</th>
              <th>Fecha modificación</th>
              <th>Situación</th>
              <th>
                Actualizar&nbsp;
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAllChange(e.target.checked)}
                  title="Seleccionar todos"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCheques.length === 0 ? (
              <tr>
                <td colSpan="9" className={styles.noResults}>No hay cheques para actualizar.</td>
              </tr>
            ) : (
              sortedCheques.map(cheque => {
                const isSelected = selectedChequesData[cheque.idCheque]?.isSelected || false;
                const id = parseInt(cheque.idCheque, 10);

                const fechaActualizacion = Array.isArray(updatedFechasById)
                  ? updatedFechasById.find(item => item.c3sch3_ID === id)?.c3s_FCmbio
                  : updatedFechasById[id]?.c3s_FCmbio;

                const isUpdated = !!fechaActualizacion;

                return (
                  <tr key={cheque.idCheque}>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.emp}</td>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.idCheque}</td>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.nroDefinitivo}</td>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.fvto}</td>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.importe}</td>
                    <td className={isUpdated ? styles.boldText : ''}>{cheque.estado}</td>
                    <td className={isUpdated ? styles.boldText : ''}>
                      {fechaActualizacion
                        ? new Date(fechaActualizacion).toLocaleDateString('es-AR') + ' ' +
                          new Date(fechaActualizacion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        : 'Sin actualizar'}
                    </td>
                    <td className={styles.situacionCell}>&nbsp;</td>
                    <td className={styles.actionCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onChequeToggle(cheque.idCheque)} // toggle individual
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🟦 LOGS DEL BACK (incluye “Verificando…” y “No se requiere…”) */}
      {runLogs.length > 0 && (
        <div className={styles.logBox}>
          <div className={styles.logTitle}>Resultado de la operación</div>
          <ul className={styles.logList}>
            {runLogs.map((line, idx) => (
              <li key={idx} className={styles.logItem}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 🟥 ERRORES (si los hubo) */}
      {runErrors.length > 0 && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Errores detectados</div>
          <ul className={styles.errorList}>
            {runErrors.map((e, idx) => (
              <li key={idx} className={styles.errorItem}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.importButtonContainer}>
        {importStatus && (
          <p className={`${styles.statusMessage} ${styles[importStatus]}`}>
            {importMessage}
          </p>
        )}
        <button
          className={styles.btn}
          onClick={onImportarClick}
          disabled={isImportButtonDisabled}
        >
          Actualizar Cheques Seleccionados
        </button>
      </div>
    </div>
  );
};

export default ChequesRechazados;
