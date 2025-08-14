// EmpresaSelect
"use client"
import styles from './styles.module.css';
import { useState, useEffect } from 'react';

const EmpresaSelected = () => {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("Cargando...");
  const [idCliente, setIdCliente] = useState(null);

  useEffect(() => {
    const fetchDatos = async () => {
      if (window.api) {
        // <-- MODIFICADO: Obtener ambos valores con la API de store
        const id = await window.api.getStoreValue('idCliente');
        const nombreEmpresa = await window.api.getStoreValue('selectedEmpresaId');
        
        setIdCliente(id);

        if (nombreEmpresa) {
          setEmpresaSeleccionada(nombreEmpresa);
        } else {
          setEmpresaSeleccionada("No hay empresa seleccionada");
        }
      }
    };
    
    fetchDatos();
  }, []);

  return (
    <div className={styles.container}>
      {idCliente != null ?
        <h4>Empresa Seleccionada: <span className={styles.empresa}>{empresaSeleccionada}</span></h4> :
        <></>
      }
    </div>
  );
}

export default EmpresaSelected;