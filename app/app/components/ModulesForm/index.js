"use client";
import { useEffect, useState } from 'react';
import styles from './styles.module.css';

const ModuleForm = ({ module }) => {
  const [clientes, setClientes] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    const { ipcRenderer } = window.require?.('electron') ?? {};
    if (ipcRenderer) {
      ipcRenderer.invoke('get-clientes-modules', module)
        .then(data => setClientes(data))
        .catch(console.error);
    }
  }, [module]);
  const handleChange = (e) => {
    setSelected(e.target.value);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Actualizador de Cheques</h1>

      {clientes.length > 1 && (
        <select
          className={styles.select}
          id="empresas"
          value={selected}
          onChange={handleChange}
        >
          <option value="">Seleccione una empresa</option>
          {clientes.map(cliente => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </select>
      )}

      <input type='file' className={styles.input} id="loadFile" accept=".xlsx, .xls" />
      <button className={styles.btn2} id="cancel" disabled>Cancelar</button>
      <button className={styles.btn2} id="verifyButton" disabled>Verificar</button>
      <button className={styles.btn} id="saveButton" disabled>Guardar</button>
      <p className={styles.error} id="fileStatus">
        No se ha cargado ningún archivo de cheques
      </p>
    </div>
  );
};

export default ModuleForm;
