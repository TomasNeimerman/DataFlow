// app/components/CuadroChequesEdoR.js
// Renamed from ChequesEdoR to be more descriptive of its role in this new flow
import React, { useState, useEffect } from "react"; // Import useEffect
import styles from './styles.module.css'; // Asegúrate de que esta ruta sea correcta

// Componente ChequesRechazados ahora es puramente visual y recibe props para los datos y acciones.
const ChequesRechazados = ({
  chequesRechazados,
  situaciones, // This will now be the raw array of { sit_Cod, sit_Desc } objects
  onChequeToggle, // Callback cuando se activa/desactiva un checklist
  onSituacionChange, // Callback cuando cambia la situación de un cheque
  selectedChequesData, // Objeto con el estado de selección y situación de cada cheque
  onImportarClick, // Callback para el botón importar
  isImportButtonDisabled, // Prop para deshabilitar el botón importar
  importStatus, // Estado de la importación (success, error, loading, info)
  importMessage // Mensaje de la importación
}) => {
  const [mostrarCuadro, setMostrarCuadro] = useState(true); // Default a true
  const [sortColumn, setSortColumn] = useState(null); // Estado para la columna de ordenamiento
  const [sortDirection, setSortDirection] = useState('asc'); // Estado para la dirección de ordenamiento ('asc' o 'desc')
  const [sortedCheques, setSortedCheques] = useState([]); // Estado para los cheques ordenados

  // useEffect para aplicar el ordenamiento cada vez que cambian los cheques o los parámetros de ordenamiento
  useEffect(() => {
    if (!chequesRechazados || chequesRechazados.length === 0) {
      setSortedCheques([]);
      return;
    }

    const sortableCheques = [...chequesRechazados]; // Crear una copia para no mutar el prop

    if (sortColumn) {
      sortableCheques.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Manejo específico para cada tipo de columna
        if (sortColumn === 'fvto') {
          // Para fechas, usar fvtoRaw que es un objeto Date
      // Convertir a timestamp para comparar, si es inválido, usar 0 (o Number.MIN_VALUE/MAX_VALUE si prefieres)
          valA = a.fvtoRaw instanceof Date && !isNaN(a.fvtoRaw) ? a.fvtoRaw.getTime() : 0;
          valB = b.fvtoRaw instanceof Date && !isNaN(b.fvtoRaw) ? b.fvtoRaw.getTime() : 0;
          
          // --- DEBUGGING: Log para fechas ---
          console.log(`[Sort fvto] Cheque A fvtoRaw:`, a.fvtoRaw, `Timestamp A:`, valA);
          console.log(`[Sort fvto] Cheque B fvtoRaw:`, b.fvtoRaw, `Timestamp B:`, valB);
          // --- FIN DEBUGGING ---
        } else if (sortColumn === 'importe') {
          // Para importes, parsear a número flotante.
          // Eliminar caracteres no numéricos excepto coma/punto y luego reemplazar coma por punto para parseFloat.
          valA = parseFloat(String(valA).replace(/[^0-9,-]+/g, "").replace(",", "."));
          valB = parseFloat(String(valB).replace(/[^0-9,-]+/g, "").replace(",", "."));
          if (isNaN(valA)) valA = 0; // Manejar NaN (valores no numéricos)
          if (isNaN(valB)) valB = 0;
        } else if (sortColumn === 'idCheque' || sortColumn === 'nroDefinitivo') {
          // Para ID y Nro Definitivo, asegurar que sean números para comparar
          valA = parseInt(valA, 10);
          valB = parseInt(valB, 10);
          if (isNaN(valA)) valA = 0;
          if (isNaN(valB)) valB = 0;
        }

        // Lógica de comparación
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

  // Función para manejar el clic en el encabezado de la columna
  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      // Si se hace clic en la misma columna, invertir la dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si se hace clic en una nueva columna, establecer esa columna y dirección ascendente
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  // Función para renderizar el indicador de ordenamiento
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
              {/* Encabezados de columna ordenables */}
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
              <th>Situación</th>
              <th>Actualizar</th>
            </tr>
          </thead>
          <tbody>
            {sortedCheques.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.noResults}>No hay cheques para actualizar.</td> {/* Colspan ajustado */}
              </tr>
            ) : (
              sortedCheques.map(cheque => { // Usar sortedCheques aquí
                const isSelected = selectedChequesData[cheque.idCheque]?.isSelected || false;
                const situacionId = selectedChequesData[cheque.idCheque]?.situacionId || '';

                return (
                  <tr key={cheque.idCheque}>
                    <td>{cheque.emp}</td>
                    <td>{cheque.idCheque}</td>
                    <td>{cheque.nroDefinitivo}</td>
                    <td>{cheque.fvto}</td>
                    <td>{cheque.importe}</td>
                    <td>{cheque.estado}</td>
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
        {/* Import Button moved here, but its logic remains in the parent */}
        <div className={styles.importButtonContainer}>
          {/* Mostrar el mensaje de importación aquí */}
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
