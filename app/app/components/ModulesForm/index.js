"use client";
import { useEffect, useState } from 'react';
import styles from './styles.module.css';

const ModuleForm = ({  nombreModulo }) => {
  const [modulos, setModulos] = useState([]);
  const [idCliente, setIdCliente] = useState(null);

  useEffect(() => {
    // Recuperar idCliente del localStorage
    const storedIdCliente = localStorage.getItem("idCliente");
    setIdCliente(storedIdCliente);
  }, []);

  useEffect(() => {
    const fetchModulos = async () => {
      if (!idCliente) {
        console.error("idCliente no está definido o es inválido");
        return; // Salir de la función si idCliente no es válido
      }

      try {
        const response = await window.api.getModules(idCliente);
        console.log(response);
        
        if (response.success) {
          const modulosFiltrados = response.modulos.filter(modulo => modulo.nombre === nombreModulo);
          setModulos(modulosFiltrados);
        } else {
          console.error("Error en getModules:", response.message);
        }
      } catch (err) {
        console.error("Fallo al obtener módulos:", err);
      }
    };

    fetchModulos();
  }, [idCliente, nombreModulo]);
  console.log(modulos[0])
  const titulo = modulos[0].texto
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{titulo}</h1>
      <input type='file' className={styles.input} id="loadFile" accept=".xlsx, .xls" />
      <button className={styles.btn2} id="cancel" disabled>Cancelar</button>
      <button className={styles.btn2} id="verifyButton" disabled>Verificar</button>
      <button className={styles.btn} id="saveButton" disabled>Guardar</button>
      <p className={styles.error} id="fileStatus">No se ha cargado ningún archivo de cheques</p>
    </div>
  );
};

export default ModuleForm;
