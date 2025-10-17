// pages/index.js
import styles from './styles.module.css'; // Importa tus estilos globales
import BDSelect from '../components/BDSelect';
import ModulosGrid from "../components/ModulosGrid";
import Imagen from '../components/Image';
import logotitle from '../../public/logotitle.png'

export default function Home() {
  return (
    <div className={styles.body}>

      <div className={styles.container}>
        <h1 className={styles.title}><Imagen logo={logotitle}/></h1>
        <p className={styles.slogan}>Tus, datos en movimiento</p>
        <p className={styles.p}>Bienvenido a la aplicación.</p>
        <BDSelect />
         <ModulosGrid />
      </div>
      </div>
  );
}