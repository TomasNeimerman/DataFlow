// app/components/CuadroChequesEdoR.js
"use client"
import React, { useState, useEffect, use } from "react";
import styles from './styles.module.css';

const ChequesRechazados = ({
  chequesRechazados,
  situaciones,
  onChequeToggle,
  onSituacionChange,
  selectedChequesData,
  onImportarClick,
  isImportButtonDisabled,
  importStatus,
  importMessage
}) => {
  const [mostrarCuadro, setMostrarCuadro] = useState(true);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedCheques, setSortedCheques] = useState([]);
  const [updatedFechasById, setUpdatedFechasById] = useState({});
  // const [isLoadingUpdatedDates, setIsLoadingUpdatedDates] = useState(true); // Uncomment if you want to use a loading state

  useEffect(() => {
    const fetchUpdatedDates = async () => {
      // setIsLoadingUpdatedDates(true); // Uncomment if you want to use a loading state
      try {
        const data = await window.api.getUpdatedFecha()
        console.log("Fechas de actualización obtenidas:", data);

        // Assuming data.data is the object like { idCheque1: { UltimaFechaCambio: '...', c3s_FCmbio: '...' }, ...}
        setUpdatedFechasById(data.data);
      } catch (error) {
        console.error("Error al obtener las fechas de actualización:", error);
        setUpdatedFechasById({}); // Ensure it's an empty object on error
      } finally {
        // setIsLoadingUpdatedDates(false); // Uncomment if you want to use a loading state
      }
    };

    fetchUpdatedDates();
  }, []); // Dependencias vacías para que se ejecute solo una vez al montar

  useEffect(() => {
    if (!chequesRechazados || chequesRechazados.length === 0) {
      setSortedCheques([]);
      return;
    }

    const sortableCheques = [...chequesRechazados];

    if (sortColumn) {
      sortableCheques.sort((a, b) => {
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
          valA = parseInt(valA, 10);
          valB = parseInt(valB, 10);
          if (isNaN(valA)) valA = 0;
          if (isNaN(valB)) valB = 0;
        }

        if (valA < valB) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    setSortedCheques(sortableCheques);
  }, [chequesRechazados, sortColumn, sortDirection]);

  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  const renderSortArrow = (columnName) => {
    return (
      <span style={{ marginLeft: '5px' }}>
        <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'asc' ? 'bold' : 'normal' }}>▲</span>
        <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'desc' ? 'bold' : 'normal' }}>▼</span>
      </span>
    );
  };

  const toggleMostrarCuadro = () => {
    setMostrarCuadro(!mostrarCuadro);
  };

  // Uncomment this block if you want to use a loading state
  /*
  if (isLoadingUpdatedDates) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Cargando información de cheques...</h2>
      </div>
    );
  }
  */

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Cheques de Terceros</h2>
      </div>
      <>
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
                <th>Fecha modificacion</th>
                <th>Situación</th>
                <th>Actualizar</th>
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
                  const situacionId = selectedChequesData[cheque.idCheque]?.situacionId || '';

                  // MODIFICACIÓN: Using optional chaining to safely access properties
                  console.log(updatedFechasById);
                  const id = parseInt(cheque.idCheque)
                  // Find the specific update item for the current cheque
                  const fechaActualizacion = updatedFechasById?.find(item => item.c3sch3_ID === id)?.c3s_FCmbio;
                  console.log("Fecha de actualización:", fechaActualizacion, "id cheque", id);
                  // Usamos tu clase tractualizado para la fila completa
                  const isUpdated = !!fechaActualizacion;

                  return (
                    <tr key={cheque.idCheque} >
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.emp}</td>
                      {/* Aplicar la clase boldText para el texto en negrita */}
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.idCheque}</td>
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.nroDefinitivo}</td>
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.fvto}</td>
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.importe}</td>
                      <td className={isUpdated ? styles.boldText : ''}>{cheque.estado}</td>
                      <td className={isUpdated ? styles.boldText : ''}>
                        {fechaActualizacion ?
                          new Date(fechaActualizacion).toLocaleDateString('es-AR') + ' ' +
                          new Date(fechaActualizacion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit'})
                          : 'Sin actualizar'}
                      </td>
                      <td className={styles.situacionCell}>
                        {isSelected && (
                          <select
                            value={situacionId}
                            onChange={(e) => onSituacionChange(cheque.idCheque, e.target.value)}
                            className={styles.select}
                          >
                            <option value="">Seleccionar...</option>
                            {situaciones.map(situacion => (
                              <option key={situacion.sit_Cod} value={situacion.sit_Cod}>
                                {situacion.sit_Desc}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={styles.actionCell}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onChequeToggle(cheque.idCheque)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
      </>
    </div>
  );
};

export default ChequesRechazados;