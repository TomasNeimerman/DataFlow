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

    // 👇 Suscripción a cambios en caliente
    const handler = (e) => {
      const { id, nombre } = e.detail || {};
      // (opcional) si querés, podrías obtener de store de nuevo:
      // pero con el nombre del evento alcanza para UX instantánea
      setEmpresaSeleccionada(nombre || "No hay empresa seleccionada");
      // idCliente no cambia acá; si querés refrescarlo:
      // window.api.getStoreValue('idCliente').then(setIdCliente).catch(()=>{});
    };

    window.addEventListener('empresa:selected', handler);
    return () => window.removeEventListener('empresa:selected', handler);
  }, []);

  return (
    <div className={styles.container}>
      {idCliente != null ?
        <h4>Empresa Seleccionada: <span className={styles.empresa}>{empresaSeleccionada}</span></h4> :
        <></>
      }
    </div>
  );
};

export default EmpresaSelected;
