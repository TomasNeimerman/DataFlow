"use client";

import CuadroPrecios from '../../components/CuadroPrecios';
import PreciosActualizados from '../../components/PreciosActualizados';
import { useState, useEffect } from 'react';
import pageStyles from './styles.module.css';

export default function Precios() {
    const [precios, setPrecios] = useState([]);
    const [preciosActualizados, setPreciosActualizados] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // 1. La función de carga inicial ahora buscará AMBOS datos.
    const initializePage = async () => {
        setError(null);
        try {
            // Hacemos las dos llamadas a la API
            const preciosPromise = window.api.getPrecios();
            const actualizadosPromise = window.api.getPreciosActualizados();

            // Esperamos a que ambas terminen
            const [preciosResponse, actualizadosResponse] = await Promise.all([
                preciosPromise,
                actualizadosPromise
            ]);

            // Procesamos la respuesta de la lista de precios principal
            if (preciosResponse.success) {
                setPrecios(preciosResponse.precios);
            } else {
                console.error('Error al obtener precios:', preciosResponse.message);
            }

            // Procesamos la respuesta de los precios actualizados
            if (actualizadosResponse.success && actualizadosResponse.preciosActualizados.length > 0) {
                setPreciosActualizados(actualizadosResponse.preciosActualizados);
            } else {
                // Si no hay resultados, nos aseguramos de que el estado esté vacío
                setPreciosActualizados([]);
            }

        } catch (err) {
            setError('Error de conexión al inicializar la página.');
            console.error(err);
        }
    };

    // 2. El useEffect ahora llama a la nueva función de inicialización
    useEffect(() => {
        initializePage();
    }, []);

    // La función de actualización se mantiene igual
    const handleUpdatePrices = async () => {
        setIsUpdating(true);
        setError(null);
        setSuccessMessage('');
        
        try {
            const updateResponse = await window.api.actualizarPrecios();
            if (updateResponse.success) {
                setSuccessMessage(updateResponse.message);
                // Después de actualizar, volvemos a cargar todo para reflejar el nuevo estado
                await initializePage();
            } else {
                setError(updateResponse.message || 'Ocurrió un error durante la actualización.');
            }
        } catch (err) {
            setError('Error de conexión al actualizar los precios.');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className={pageStyles.body}>


            <div className={pageStyles.contentContainer}>
                {/* La lógica de renderizado ahora funciona desde la carga inicial */}
                {preciosActualizados.length > 0 ? (
                    <PreciosActualizados precios={preciosActualizados} />
                ) : (
                    <CuadroPrecios 
                        precios={precios}
                        onActualizar={handleUpdatePrices}
                        isUpdating={isUpdating}
                        error={error}
                        successMessage={successMessage}
                    />
                )}
            </div>
        </div>
    );
}