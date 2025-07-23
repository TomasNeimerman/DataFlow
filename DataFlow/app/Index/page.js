// pages/index.js

import styles from './styles.module.css'; // Importa tus estilos globales
import BDSelect from '../components/BDSelect';

export default function Home() {
  return (
    <div className={styles.body}>

      <div className={styles.container}>
        <h1 className={styles.title}><span className={styles.titlespan}>Data</span>Flow</h1>
        <p className={styles.p}>Bienvenido a la aplicación.</p>
        <BDSelect />
      </div>
      </div>
  );
}