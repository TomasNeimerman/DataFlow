import Image from 'next/image';
import logo from '../../../public/logo_cone.png'
import styles from './styles.module.css'; // Asegúrate de que la ruta sea correcta

export default function Imagen() {
  return (
    <div>
    <Image
      alt='CONE ERP'
      className={styles.img}
      src={logo}/>
    </div>
  );}