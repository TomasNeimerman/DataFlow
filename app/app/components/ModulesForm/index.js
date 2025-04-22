"use client";
import { useEffect, useState } from 'react';
import styles from './styles.module.css';

const ModuleForm = ({ nombreModulo, onImportar, idCliente }) => { // Se eliminó valoresActuales como prop
  const [modulos, setModulos] = useState([]);
  
  const [fileName, setFileName] = useState('');
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [file, setFile] = useState(null);

  

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

  // Manejo de la carga del archivo
  const handleFileChange = (event) => {
    const f = event.target.files[0];
    if (f) {
      setFile(f);
      setFileName(f.name);
      setIsFileLoaded(true);
    } else {
      setFile(null);
      setFileName('');
      setIsFileLoaded(false);
    }
  };

  // Verificar el archivo
  const handleVerify = () => {
    if (fileName) {
      const expectedFileName = `${modulos[0].pathExcel}`; // O el formato que necesites
      if (fileName === expectedFileName) {
        console.log("El archivo es válido para verificar.");
        document.getElementById('fileStatus').innerText = `Archivo valido`;
      } else {
        console.error("El nombre del archivo no coincide con el módulo.");
        document.getElementById('fileStatus').innerText = `Archivo invalido`;
      }
    }
  };

  const handleCancel = () => {
    setFileName(''); // Restablecer el nombre del archivo
    setIsFileLoaded(false); // Restablecer el estado de carga
    document.getElementById('loadFile').value = ''; // Limpiar el campo de entrada de archivo
    document.getElementById('fileStatus').innerText = ''; // Restablecer el mensaje
  };

  const titulo = modulos.length > 0 ? modulos[0].texto : "Cargando...";

  return (
    <div>
      <h1 className={styles.title}>{titulo}</h1>
      <input 
        type='file' 
        className={styles.input} 
        id="loadFile" 
        accept=".xlsx, .xls" 
        onChange={handleFileChange} 
      />
      <button className={styles.btn2} id="cancel" onClick={handleCancel}>Cancelar</button>
      <button 
        className={styles.btn2} 
        id="verifyButton" 
        disabled={!isFileLoaded} 
        onClick={handleVerify}
      >
        Verificar
      </button>
      <button 
        className={styles.btn} 
        id="saveButton" 
        disabled={!isFileLoaded} 
        onClick={() => onImportar && onImportar(file)}
      >
        Importar
      </button>
      <p className={styles.error} id="fileStatus"></p>
    </div>
  );
};

export default ModuleForm;