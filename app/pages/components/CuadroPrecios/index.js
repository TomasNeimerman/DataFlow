"use client"
import React, { useState, useEffect } from "react";
import styles from './styles.module.css';

const CuadroPrecios = ({ precios }) => {
  // Estados para el ordenamiento
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedPrecios, setSortedPrecios] = useState([]);

  // useEffect para aplicar el ordenamiento cada vez que cambian los precios, la columna o la dirección
  useEffect(() => {
    if (!precios || precios.length === 0) {
      setSortedPrecios([]);
      return;
    }

    const sortablePrecios = [...precios]; // Crear una copia para no mutar el prop original

    if (sortColumn) {
      sortablePrecios.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Lógica de comparación específica para cada columna
        if (sortColumn === 'lpr_Precio') {
          // Convertir a número para comparar precios
          valA = parseFloat(String(valA).replace(/[^0-9,-]+/g, "").replace(",", "."));
          valB = parseFloat(String(valB).replace(/[^0-9,-]+/g, "").replace(",", "."));
          if (isNaN(valA)) valA = 0; // Manejar valores no numéricos
          if (isNaN(valB)) valB = 0;
        } else if (sortColumn === 'lpr_FecMod') {
          // Convertir a objetos Date para comparar fechas
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
          // Si la fecha es inválida, se convierte a NaN, que se maneja como 0 para el ordenamiento
          if (isNaN(valA)) valA = 0;
          if (isNaN(valB)) valB = 0;
        } else {
          // Para cadenas de texto y otros tipos, asegurar que sean strings para la comparación
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
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
    setSortedPrecios(sortablePrecios);
  }, [precios, sortColumn, sortDirection]); // Dependencias del useEffect

  // Función para manejar el clic en el encabezado de la columna para ordenar
  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      // Si se hace clic en la misma columna, cambiar la dirección de ordenamiento
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si se hace clic en una nueva columna, establecerla y ordenar ascendentemente
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  // Función para renderizar las flechas de ordenamiento en el encabezado
  const renderSortArrow = (columnName) => {
    return (
      <span style={{ marginLeft: '5px' }}>
        <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'asc' ? 'bold' : 'normal' }}>▲</span>
        <span style={{ fontWeight: sortColumn === columnName && sortDirection === 'desc' ? 'bold' : 'normal' }}>▼</span>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Precios</h2>
      </div>
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead> {/* Se cambió className={styles.headerRow} de <thead> a <tr> */}
              <tr className={styles.headerRow}>
                {/* Encabezados de columna con onClick para ordenar y renderSortArrow */}
                <th onClick={() => handleSort('lprdlp_Cod')} className={styles.sortableHeader}>
                  Codigo {renderSortArrow('lprdlp_Cod')}
                </th>
                <th onClick={() => handleSort('lprart_CodGen')} className={styles.sortableHeader}>
                  Codigo Generico {renderSortArrow('lprart_CodGen')}
                </th>
                <th onClick={() => handleSort('lpr_Precio')} className={styles.sortableHeader}>
                  Precio {renderSortArrow('lpr_Precio')}
                </th>
                <th onClick={() => handleSort('lpr_FecMod')} className={styles.sortableHeader}>
                  Fecha Modificación {renderSortArrow('lpr_FecMod')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Se corrigió 'precios.lenght' a 'precios.length' */}
              {sortedPrecios.length === 0 ? (
                <tr>
                  <td colSpan="4" className={styles.noResults}>No hay precios para actualizar.</td>
                </tr>
              ) : (
                sortedPrecios.map((precio, index) => (
                  <tr key={index} className={styles.row}> {/* Usar un key único y estable */}
                    <td>{precio.lprdlp_Cod}</td>
                    <td>{precio.lprart_CodGen}</td>
                    <td>{precio.lpr_Precio}</td>
                    <td>{new Date(precio.lpr_FecMod).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.importButtonContainer}>
          <button
            className={styles.btn}
            // Aquí puedes agregar la funcionalidad para el botón "Actualizar Precios"
          >
            Actualizar Precios
          </button>
        </div>
      </>
    </div>
  );
};

export default CuadroPrecios;
