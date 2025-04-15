"use client"
import Image from 'next/image';
import styles from './styles.module.css'; // Importa tus estilos globales
import logo from '../../../public/logo_cone.png'
import ModuleForm from '@/app/components/ModulesForm';


export default function Modules() {
   
    
  return (
    <div className={styles.body}>
      <Image
      alt='CONE ERP'
      className={styles.img}
      src={logo}/>
      <ModuleForm/>
    </div>
  );
}