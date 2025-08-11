"use client";
import React from "react";
import styles from './styles.module.css';

const PreciosActualizados = ({ precios }) => {
    if (!precios || precios.length === 0) {
        return null; 
    }

    // Función para formatear los precios de forma segura
    const formatPrice = (price) => {
        const number = parseFloat(price);
        if (isNaN(number)) {
            return '$ 0.00'; // O '-' si preferís
        }
        return `$ ${number.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerContainer}>
                <h2 className={styles.title}>Resultados de la Última Actualización</h2>
            </div>
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr className={styles.headerRow}>
                            <th>Fecha de Ejecución</th>
                            <th>Lista</th>
                            <th>Código de Artículo</th>
                            <th>Descripción</th>
                            <th>Precio Anterior</th>
                            <th>Precio Nuevo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {precios.map((precio, index) => (
                            <tr key={index} className={styles.row}>
                                <td>{new Date(precio.FechaEjecucion).toLocaleString('es-AR')}</td>
                                <td>{precio.ListaPrecioCod}</td>
                                <td>{precio.CodArticulo}</td>
                                <td>{precio.Descripcion}</td>
                                <td>{formatPrice(precio.PrecioAnterior)}</td>
                                <td>{formatPrice(precio.PrecioNuevo)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PreciosActualizados;