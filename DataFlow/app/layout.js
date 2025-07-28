import styles from './layout.css'; // Importa los estilos globales CSS
import Imagen from './components/Image';
import EmpresaSelected from './components/EmpresaSelected';
export const metadata = {
  title: 'DataFlow',
  description: 'Tus datos, en movimiento',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      
      <body className={styles.body}>
        <Imagen/>
        <EmpresaSelected/>
        {children}
        </body>
    </html>
  );
}
