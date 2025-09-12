// EmpresaSelect
"use client";
import styles from './styles.module.css';
import { useState, useEffect } from 'react';

const EmpresaSelected = () => {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("Cargando...");
  const [idCliente, setIdCliente] = useState(null);

  useEffect(() => {
    const fetchDatos = async () => {
      if (window.api) {
        const id = await window.api.getStoreValue('idCliente');
        const nombreEmpresa = await window.api.getStoreValue('selectedEmpresaNombre');

        setIdCliente(id);
        setEmpresaSeleccionada(nombreEmpresa || "No hay empresa seleccionada");
      }
    };

    fetchDatos();

    const handler = (e) => {
      const { id, nombre } = e.detail || {};
      setEmpresaSeleccionada(nombre || "No hay empresa seleccionada");
    };

    window.addEventListener('empresa:selected', handler);
    return () => window.removeEventListener('empresa:selected', handler);
  }, []);

  return (
    <div className={styles.container}>
      {idCliente != null ? (
        <h4>
          Empresa Seleccionada: <span className={styles.empresa}>{empresaSeleccionada}</span>
        </h4>
      ) : null}
    </div>
  );
};

export default EmpresaSelected;
