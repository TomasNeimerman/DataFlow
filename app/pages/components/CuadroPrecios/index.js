"use client";
import React, { useState } from "react";
import styles from './styles.module.css';

const CuadroPrecios = ({ precios, onActualizar, isUpdating, progress, error, successMessage }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (columnName) => {
    if (sortColumn === columnName) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(columnName); setSortDirection('asc'); }
  };

  const renderSortArrow = (columnName) => (
    <span style={{ marginLeft: 5 }}>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'asc' ? 'bold' : 'normal' }}>▲</span>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'desc' ? 'bold' : 'normal' }}>▼</span>
    </span>
  );

  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Generador de Listas de Precios Avanzado</h2>
      </div>

      {/* Botón + barra de progreso */}
      <div className={styles.importButtonContainer}>
        <button className={styles.btn} onClick={onActualizar} disabled={isUpdating}>
          {isUpdating ? 'Actualizando...' : 'Actualizar Precios'}
        </button>
      </div>

      {/* Barra determinística cuando hay progreso */}
      {progress && (
        <div style={{ marginTop: 10 }}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
            <span>{progress.stage || 'Procesando'}</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div style={{height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden'}}>
            <div style={{
              width: `${pct}%`,
              height:'100%',
              background:'#3b82f6',
              transition:'width .25s ease'
            }}/>
          </div>
          {progress.message && (
            <div style={{fontSize:12, opacity:.8, marginTop:6}}>
              {progress.message}
            </div>
          )}
        </div>
      )}

      {/* Mensajes de estado */}
      <div className={styles.statusMessages}>
        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}
      </div>
    </div>
  );
};

export default CuadroPrecios;
