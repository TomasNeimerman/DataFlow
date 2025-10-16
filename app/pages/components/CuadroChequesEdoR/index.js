// app/components/CuadroChequesEdoR.js
"use client";
import React, { useState, useEffect } from "react";
import styles from './styles.module.css';

const ChequesRechazados = ({
  chequesRechazados = [],
  situaciones = [],
  onChequeToggle = () => {},
  selectedChequesData = {},
  onImportarClick = () => {},
  isImportButtonDisabled = false,
  importStatus = null,
  importMessage = '',
  runLogs = [],
  runErrors = [],
  onSelectAllChange = () => {},
  refreshKey = 0,

  // 👇 nuevos props
  fieldMode = 'situacion',
  onFieldModeChange = () => {},
  onRowValueChange = () => {},
  onGlobalValueChange = () => {},
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedCheques, setSortedCheques] = useState([]);
  const [updatedFechasById, setUpdatedFechasById] = useState({});

  const getSitDesc = (code) => {
    if (code === undefined || code === null || code === '') return '';
    const sit = Array.isArray(situaciones)
      ? situaciones.find(s => String(s.sit_Cod) === String(code))
      : null;
    return sit ? sit.sit_Desc : String(code);
  };

  useEffect(() => {
    const fetchUpdatedDates = async () => {
      try {
        if (typeof window !== 'undefined' && window.api?.getUpdatedFecha) {
          const data = await window.api.getUpdatedFecha();
          setUpdatedFejasByIdSafe(data?.data || {});
        }
      } catch {
        setUpdatedFejasByIdSafe({});
      }
    };
    // Safe setter for SSR build
    const setUpdatedFejasByIdSafe = (v) => setUpdatedFechasById(v);
    fetchUpdatedDates();
  }, [refreshKey]);

  useEffect(() => {
    if (!Array.isArray(chequesRechazados) || chequesRechazados.length === 0) {
      setSortedCheques([]);
      return;
    }
    const arr = [...chequesRechazados];

    if (sortColumn) {
      arr.sort((a, b) => {
        let valA = a?.[sortColumn];
        let valB = b?.[sortColumn];

        if (sortColumn === 'fvto') {
          valA = a?.fvtoRaw instanceof Date && !isNaN(a.fvtoRaw) ? a.fvtoRaw.getTime() : 0;
          valB = b?.fvtoRaw instanceof Date && !isNaN(b.fvtoRaw) ? b.fvtoRaw.getTime() : 0;
        } else if (sortColumn === 'importe') {
          valA = parseFloat(String(valA ?? '').replace(/[^0-9,-]+/g, "").replace(",", "."));
          valB = parseFloat(String(valB ?? '').replace(/[^0-9,-]+/g, "").replace(",", "."));
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

  const selectedIds = Object.keys(selectedChequesData || {}).filter(id => selectedChequesData?.[id]?.isSelected);
  const selectedCount = selectedIds.length;
  const allSelected = Array.isArray(chequesRechazados) && chequesRechazados.length > 0 && selectedCount === chequesRechazados.length;

  const handleHeaderSelectAll = (checked) => {
    onSelectAllChange?.(!!checked);
  };

  // Render editor para el valor global
  const renderGlobalEditor = () => {
    if (selectedCount === 0) return null;
    if (fieldMode === 'situacion') {
      return (
        <select className={styles.select} defaultValue="" onChange={(e) => onGlobalValueChange(e.target.value)}>
          <option value="">Seleccionar...</option>
          {Array.isArray(situaciones) && situaciones.map(s => (
            <option key={s.sit_Cod} value={s.sit_Cod}>{s.sit_Desc}</option>
          ))}
        </select>
      );
    } else if (fieldMode === 'fvto') {
      return (
        <input type="date" className={styles.input} onChange={(e) => onGlobalValueChange(e.target.value)} />
      );
    } else if (fieldMode === 'numero') {
      return (
        <input type="text" className={styles.input} onChange={(e) => onGlobalValueChange(e.target.value)} />
      );
    }
    return null;
  };

  // Render editor por fila
  const renderRowEditor = (cheque) => {
    const isSelected = !!selectedChequesData?.[cheque.idCheque]?.isSelected;
    if (!isSelected) return <span className={styles.muted}>—</span>;

    const rowVal = selectedChequesData?.[cheque.idCheque]?.newValue || '';

    if (fieldMode === 'situacion') {
      return (
        <select
          className={styles.select}
          value={rowVal}
          onChange={(e) => onRowValueChange(cheque.idCheque, e.target.value)}
        >
          <option value="">Seleccionar...</option>
          {Array.isArray(situaciones) && situaciones.map(s => (
            <option key={s.sit_Cod} value={s.sit_Cod}>{s.sit_Desc}</option>
          ))}
        </select>
      );
    } else if (fieldMode === 'fvto') {
      return (
        <input
          type="date"
          className={styles.input}
          value={rowVal}
          onChange={(e) => onRowValueChange(cheque.idCheque, e.target.value)}
        />
      );
    } else if (fieldMode === 'numero') {
      return (
        <input
          type="text"
          className={styles.input}
          value={rowVal}
          onChange={(e) => onRowValueChange(cheque.idCheque, e.target.value)}
        />
      );
    }
    return null;
  };

  const newValueHeader =
    fieldMode === 'situacion' ? 'Nueva situación' :
    fieldMode === 'fvto'      ? 'Nueva fecha vto.' :
                                'Nuevo número';

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Cheques de Terceros</h2>
      </div>

      {/* Selector de campo + editor global si hay filas seleccionadas */}
      <div className={styles.massBar}>
        <div className={styles.massLeft}>
          <label className={styles.label}>Campo a actualizar:</label>
          <select
            className={styles.select}
            value={fieldMode}
            onChange={(e) => onFieldModeChange(e.target.value)}
          >
            <option value="situacion">Situación</option>
            <option value="fvto">Fecha de vencimiento</option>
            <option value="numero">Número de cheque</option>
          </select>
        </div>
        {selectedCount > 0 && (
          <div className={styles.massRight}>
            <label className={styles.label}>
              {newValueHeader} (para {allSelected ? 'todos' : 'seleccionados'}):
            </label>
            {renderGlobalEditor()}
          </div>
        )}
      </div>

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
              <th>{newValueHeader}</th>
              <th>
                Actualizar&nbsp;
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleHeaderSelectAll(e.target.checked)}
                  title="Seleccionar todos"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!sortedCheques?.length ? (
              <tr>
                <td colSpan="10" className={styles.noResults}>No hay cheques para actualizar.</td>
              </tr>
            ) : (
              sortedCheques.map(cheque => {
                const isSelected = !!selectedChequesData?.[cheque.idCheque]?.isSelected;
                const chosenSit = selectedChequesData?.[cheque.idCheque]?.situacionId;
                const currentSit = chosenSit || cheque.situacion || '';
                const id = parseInt(cheque.idCheque, 10);

                const fechaActualizacion = Array.isArray(updatedFechasById)
                  ? updatedFechasById.find(item => item.c3sch3_ID === id)?.c3s_FCmbio
                  : updatedFechasById?.[id]?.c3s_FCmbio;

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
                      {fechaActualizacion || 'Sin actualizar'}
                    </td>

                    {/* Situación actual (solo texto) */}
                    <td className={styles.situacionCell}>
                      <span className={styles.situacionText}>
                        {getSitDesc(currentSit) || (isSelected ? 'Seleccioná arriba…' : '—')}
                      </span>
                    </td>

                    {/* Editor por fila según campo */}
                    <td className={styles.editCell}>
                      {renderRowEditor(cheque)}
                    </td>

                    <td className={styles.actionCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onChequeToggle?.(cheque.idCheque)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {Array.isArray(runLogs) && runLogs.length > 0 && (
        <div className={styles.logBox}>
          <div className={styles.logTitle}>Resultado de la operación</div>
          <ul className={styles.logList}>
            {runLogs.map((line, idx) => (
              <li key={idx} className={styles.logItem}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(runErrors) && runErrors.length > 0 && (
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
          disabled={!!isImportButtonDisabled}
        >
          Actualizar Cheques Seleccionados
        </button>
      </div>
    </div>
  );
};

export default ChequesRechazados;
