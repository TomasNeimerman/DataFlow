import Image from 'next/image';
import logo from '../../../public/logo_cone.png';
import styles from './styles.module.css';
import { useRouter } from 'next/router';

export default function Imagen() {
  const router = useRouter();

  const handleLogoClick = async () => {
    try {
      // Si estamos en Electron y existe la API:
      const hasElectron = typeof window !== 'undefined' && window.api?.getStoreValue;
      if (hasElectron) {
        const idCliente = await window.api.getStoreValue('idCliente');
        if (idCliente) router.push('/Index');
        return; // si no hay idCliente, no hacemos nada
      }

      // Fallback por si se ejecuta en navegador (dev): intenta con localStorage
      const idClienteLocal =
        typeof window !== 'undefined' ? window.localStorage?.getItem('idCliente') : null;
      if (idClienteLocal) router.push('/Index');
    } catch {
      // silencioso
    }
  };

  return (
    <div>
      <Image
        alt="CONE ERP"
        className={styles.img}
        src={logo}
        onClick={handleLogoClick}
        role="button"
        priority
      />
    </div>
  );
}
