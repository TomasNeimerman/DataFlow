"use client"
import React, { useState, useEffect } from "react";
import styles from './styles.module.css';

const CuadroPrecios = ({ precios, onActualizar, isUpdating, error, successMessage }) => {
// Estados para el ordenamiento
const [sortColumn, setSortColumn] = useState(null);
const [sortDirection, setSortDirection] = useState('asc');
const [sortedPrecios, setSortedPrecios] = useState([]);

// useEffect para aplicar el ordenamiento
useEffect(() => {
    if (!precios || precios.length === 0) {
        setSortedPrecios([]);
        return;
    }

    const sortablePrecios = [...precios];

    if (sortColumn) {
        sortablePrecios.sort((a, b) => {
            let valA = a?.[sortColumn];
            let valB = b?.[sortColumn];

            if (sortColumn === 'lpr_Precio') {
                valA = parseFloat(String(valA).replace(/[^0-9,-]+/g, "").replace(",", "."));
                valB = parseFloat(String(valB).replace(/[^0-9,-]+/g, "").replace(",", "."));
                if (isNaN(valA)) valA = 0;
                if (isNaN(valB)) valB = 0;
            } else if (sortColumn === 'lpr_FecMod') {
                valA = new Date(valA)?.getTime() || 0;
                valB = new Date(valB)?.getTime() || 0;
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
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
}, [precios, sortColumn, sortDirection]);

// Función para manejar el clic en el encabezado
const handleSort = (columnName) => {
    if (sortColumn === columnName) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
        setSortColumn(columnName);
        setSortDirection('asc');
    }
};

// Función para renderizar las flechas de ordenamiento
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
            {/* Botón de actualizar dentro del headerContainer */}
            
        </div>

        {/* Mensajes de estado justo debajo del botón */}
        <div className={styles.statusMessages}>
            {error && <div className={styles.error}>{error}</div>}
            {successMessage && <div className={styles.success}>{successMessage}</div>}
        </div>
        <>
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr className={styles.headerRow}>
                        <th onClick={() => handleSort('lprdlp_Cod')} className={styles.sortableHeader}>
                            Código {renderSortArrow('lprdlp_Cod')}
                        </th>
                        <th onClick={() => handleSort('lprart_CodGen')} className={styles.sortableHeader}>
                            Código Genérico {renderSortArrow('lprart_CodGen')}
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
                    {sortedPrecios.length === 0 ? (
                        <tr>
                            <td colSpan="4" className={styles.noResults}>No hay precios para mostrar.</td>
                        </tr>
                    ) : (
                        sortedPrecios.map((precio, index) => (
                            <tr key={`${precio.lprart_CodGen}-${index}`} className={styles.row}>
                                <td>{precio.lprdlp_Cod}</td>
                                <td>{precio.lprart_CodGen}</td>
                                <td>{precio.lpr_Precio}</td>
                                <td>{new Date(precio.lpr_FecMod).toLocaleDateString('es-AR')}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>   
        </div>
        <div className={styles.importButtonContainer}>
            <button
                className={styles.btn}
                onClick={onActualizar}
                disabled={isUpdating}
            >
                {isUpdating ? 'Actualizando...' : 'Actualizar Precios'}
            </button>
            </div>
        </>
    </div>
);
};

export default CuadroPrecios;
