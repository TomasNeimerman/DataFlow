import Image from 'next/image';
import styles from './styles.module.css';

export default function Imagen({logo}) {

  return (
    <div>
      <Image
        alt="CONE ERP"
        className={styles.img}
        src={logo}
      />
    </div>
  );
}
