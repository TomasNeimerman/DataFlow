// pages/_app.js
import { useEffect, useRef } from 'react';
import '../public/styles/globals.css';
import Imagen from './components/Image';
import EmpresaSelected from './components/EmpresaSelected';
import HamburgerButton from './components/HamburgerMenu';
import logo_cone from '../public/logo_cone.png'
import logo from '../public/logo.png'

function MyApp({ Component, pageProps }) {
  const isDevRef = useRef(false);

  useEffect(() => {
    // preguntamos al main si es dev
    (async () => {
      try { isDevRef.current = !!(await window?.api?.isDev?.()); } catch {}
    })();

    const onKeyDown = (e) => {
      const el = document.activeElement;
      const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (editing) return;

      // F12 solo en dev
      if (e.key === 'F12' && isDevRef.current) {
        e.preventDefault();
        window?.api?.abrirDevTools?.();
        return;
      }

      // Recargar (habilitado siempre)
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        window?.api?.recargarVentana?.();
        return;
      }

      // Salir (si querés que sea siempre)
      if (e.key === 'Escape') {
        e.preventDefault();
        window?.api?.salirApp?.();
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="page-container">
      <Component {...pageProps} />

      <div className="overlay-bottom-right">
        <Imagen logo={logo_cone}/>
      </div>
      <div className="overlay-bottom-left">
        <Imagen logo={logo}/>
      </div>
      <div className="overlay-top-right">
        <EmpresaSelected />
      </div>

      <HamburgerButton />
    </div>
  );
}

export default MyApp;
