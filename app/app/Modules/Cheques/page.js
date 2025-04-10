"use client"
import Image from 'next/image';
import styles from './styles.module.css'; // Importa tus estilos globales
import logo from '../../../public/logo_cone.png'


export default function Modules() {
   
    
  return (
    <div className={styles.body}>
      <Image
      alt='CONE ERP'
      className={styles.img}
      src={logo}/>
      <div className={styles.container}>
        <h1 className={styles.title}>Actualizador de Cheques</h1>
        
        <select className={styles.select} id="empresas">
            <option value="">Seleccione una empresa</option>
        </select>
        
        
        <p className={styles.p} id="empresaStatus">Seleccione una empresa para verificar su existencia en la base de datos</p>
        
        <button className={styles.btn} id="loadButton" accept=".xlsx, .xls">Seleccionar Planilla Excel</button>
        <button className={styles.btn} id="saveButton" disabled>Importar Archivo</button>
        
        <p className={styles.error} id="fileStatus">No se ha cargado ningún archivo de cheques</p>
    </div>
  </div>
  );
}