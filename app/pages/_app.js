// pages/_app.js
import { useEffect, useRef } from 'react';
import '../public/styles/globals.css';
import Imagen from './components/Image';
import EmpresaSelected from './components/EmpresaSelected';
import HamburgerButton from './components/HamburgerMenu';
import { useRouter } from 'next/router';   // ⬅️ usamos el hook
import logo_cone from '../public/logo_cone.png'
import logo from '../public/logo.png'

function normalize(p = "/") {
  const noHashQuery = p.split("?")[0].split("#")[0];
  const trimmed = noHashQuery.replace(/\/+$/, "");
  const path = trimmed === "" ? "/" : trimmed;
  return path.toLowerCase(); // tolera /Index vs /index
}

function MyApp({ Component, pageProps }) {
  const isDevRef = useRef(false);
  const router = useRouter();

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

  // ✅ ocultar overlay-bottom-left en Index ("/" o "/Index")
  const here = normalize(router.asPath || "/");
  const isIndex = here === "/" || here === "/index";

  return (
    <div className="page-container">
      <Component {...pageProps} />

      <div className="overlay-bottom-right">
        <Imagen logo={logo_cone}/>
      </div>

      {!isIndex && (
        <div className="overlay-bottom-left" onClick={() => router.push("/Login")}>
          <Imagen logo={logo}/>
        </div>
      )}

      <HamburgerButton />
    </div>
  );
}

export default MyApp;
