// pages/index.js

import styles from './styles.module.css'; // Importa tus estilos globales


export default function Home() {
  return (
    <div className={styles.body}>

      <div className={styles.container}>
        <h1 className={styles.title}>Bejerman <span className={styles.titlespan}>ERP</span></h1>
        <p className={styles.p}>Bienvenido a la aplicación.</p>
        
      </div>
      </div>
  );
}