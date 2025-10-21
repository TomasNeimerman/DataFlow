// pages/index.js
import styles from './styles.module.css'; // Importa tus estilos globales
import BDSelect from '../components/BDSelect';
import ModulosGrid from "../components/ModulosGrid";
import Imagen from '../components/Image';
import logo from '../../public/logo.png'
import EmpresaSelected from "../components/EmpresaSelected";

export default function Home() {
  return (
    <div className={styles.body}>
      <div className="overlay-top-right">
              
            </div>
      
      <div className={styles.container}>
        <div className={styles.space}>
        <h1 className={styles.title}><Imagen logo={logo}/></h1>
        <EmpresaSelected />
        </div>
        <p className={styles.p}>Bienvenido a la aplicación.</p>
        <BDSelect />
         <ModulosGrid />
      </div>
      </div>
  );
}