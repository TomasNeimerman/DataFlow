// app/Articulos/page.js
"use client";

import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Articulos() {
const [clases, setClases] = useState([]); // Estado para almacenar las clases
useEffect(() => {
  const fetchClases = async () => { // Aquí la función es async
    try {
      const response = await window.api.getClases(); // <-- AQUÍ ESPERAS A QUE LA PROMESA SE RESUELVA
                                                     // Ahora 'response' ES EL [[PromiseResult]]
      console.log("Objeto response completo de getClases (después de await):", response); // <-- ESTE ES EL LOG QUE DEBERÍAS HACER AHORA

      if (response.success) {
        setClases(response.clases); // <-- Aquí response.clases YA DEBE EXISTIR
        console.log("Clases obtenidas exitosamente:", response.clases);
      } else {
        // ...manejo de error...
      }
    } catch (err) {
      // ...manejo de error...
    } finally {
      // ...
    }
  };
  fetchClases();
}, []);
console.log("Clase CHO:", chocolate); // Verifica si la clase CHO existe
  return (
    <div className={styles.body}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm
        nombreModulo="Articulos"
        onImportar={false}
        estadoImportar={false} // Pasa el estado del hook
        mensajeImportacion={""} // Pasa el mensaje detallado del hook
      />
      
    </div>
  );
};