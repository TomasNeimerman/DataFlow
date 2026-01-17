// app/Articulos/page.js
"use client";

import styles from './styles.module.css';
import ArticulosForm from '../../../components/ArticulosForm';
import { useState, useEffect } from 'react';


export default function Articulos() {
    // Estados para almacenar los datos de las diferentes tablas
    const [articulos, setArticulos] = useState([]);
    const [clases, setClases] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [tasasIVA, setTasasIVA] = useState([]);
    const [idCliente, setIdCliente] = useState(null);

    // Estado para manejar la carga de datos y errores
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
    // <-- MODIFICADO
    const fetchIdCliente = async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    };
    fetchIdCliente();
  }, []);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch Articulos
                const resArticulos = await window.api.getArticulos();
                if (resArticulos.success) {
                    setArticulos(resArticulos.articulos);
                    console.log("Artículos obtenidos:", resArticulos.articulos);
                } else {
                    console.error("Error al obtener artículos:", resArticulos.message);
                    setError(prev => ({ ...prev, articulos: resArticulos.message }));
                }

                // Fetch Clases
                const resClases = await window.api.getClases();
                if (resClases.success) {
                    setClases(resClases.clases);
                    console.log("Clases obtenidas:", resClases.clases);
                } else {
                    console.error("Error al obtener clases:", resClases.message);
                    setError(prev => ({ ...prev, clases: resClases.message }));
                }

                // Fetch Proveedores
                const resProveedores = await window.api.getProveedores();
                if (resProveedores.success) {
                    setProveedores(resProveedores.proveedores);
                    console.log("Proveedores obtenidos:", resProveedores.proveedores);
                } else {
                    console.error("Error al obtener proveedores:", resProveedores.message);
                    setError(prev => ({ ...prev, proveedores: resProveedores.message }));
                }

                // Fetch Rubros
                const resRubros = await window.api.getRubros();
                if (resRubros.success) {
                    setRubros(resRubros.rubros);
                    console.log("Rubros obtenidos:", resRubros.rubros);
                } else {
                    console.error("Error al obtener rubros:", resRubros.message);
                    setError(prev => ({ ...prev, rubros: resRubros.message }));
                }

                // Fetch Tasas IVA
                const resTasasIVA = await window.api.getTasasIVA();
                if (resTasasIVA.success) {
                    setTasasIVA(resTasasIVA.tasasIVA);
                    console.log("Tasas IVA obtenidas:", resTasasIVA.tasasIVA);
                } else {
                    console.error("Error al obtener tasas IVA:", resTasasIVA.message);
                    setError(prev => ({ ...prev, tasasIVA: resTasasIVA.message }));
                }

            } catch (err) {
                console.error("Error inesperado al cargar datos iniciales:", err);
                setError(prev => ({ ...prev, general: err.message }));
            } finally {
                setLoading(false); // Una vez que todas las llamadas han terminado (éxito o error)
            }
        };

        fetchAllData();
    }, []); // El array vacío asegura que se ejecute solo una vez al montar el componente

    if (loading) {
        return (
            <div className={styles.body}>
         
                <p>Cargando datos de artículos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.body}>
                <p>Error al cargar los datos: {error.general || JSON.stringify(error)}</p>
                {/* Puedes mostrar errores específicos si existen, por ejemplo: */}
                {error.clases && <p>Error en Clases: {error.clases}</p>}
                {error.proveedores && <p>Error en Proveedores: {error.proveedores}</p>}
                {/* ... y así sucesivamente */}
            </div>
        );
    }

    return (
        <div className={styles.body}>
            <ArticulosForm
                idCliente={idCliente}
                nombreModulo="Articulos"
                onImportar={false}
                estadoImportar={false} // Pasa el estado del hook
                mensajeImportacion={""} // Pasa el mensaje detallado del hook
                
            />
            
        </div>
    );
}