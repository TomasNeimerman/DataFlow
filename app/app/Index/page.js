// pages/index.js
import Image from 'next/image';
import styles from './styles.module.css'; // Importa tus estilos globales
import logo from '../../public/logo_cone.png'

export default function Home() {
  return (
    <div className={styles.body}>
      <Image
      alt='CONE ERP'
      className={styles.img}
      src={logo}/>
      <div className={styles.container}>
        <h1 className={styles.title}>Bejerman <span className={styles.titlespan}>ERP</span></h1>
        <p className={styles.p}>Bienvenido a la aplicación.</p>
        
      </div>
      </div>
  );
}