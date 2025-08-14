// RUTA: pages/_app.js

import '../public/styles/globals.css';
import Imagen from './components/Image';
import EmpresaSelected from './components/EmpresaSelected';

function MyApp({ Component, pageProps }) {
    return (
        // Contenedor relativo para posicionar los elementos superpuestos
        <div className="page-container">
            {/* La página actual (Login, Index, etc.) se renderiza como la capa de fondo */}
            <Component {...pageProps} />

            {/* --- Elementos Superpuestos --- */}
            <div className="overlay-top-left">
                <Imagen />
            </div>
            <div className="overlay-top-right">
                <EmpresaSelected />
            </div>
        </div>
    );
}

export default MyApp;