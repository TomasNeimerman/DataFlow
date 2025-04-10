// app/Login/page.js
'use client'; // Indica que este componente utiliza funcionalidades del cliente como useState y useRouter
import logo from '../../public/logo_cone.png'
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Importa useRouter desde 'next/navigation' en el directorio app
import styles from './styles.module.css'

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const response = await window.api.login(usuario, contraseña);

      if (response.success) {
        localStorage.setItem('jwtToken', response.token);
        router.push('http://localhost:3000/Index'); // Redirige a la página principal (probablemente app/page.js)
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Error al iniciar sesión.');
      console.error(err);
    }
  };

  return (
    <div className={styles.body}>
    <Image
    alt='CONE ERP'
    className={styles.img}
    src={logo}
    />
    <div className={styles.container}>
      <h1 className={styles.title}>Bejerman <span className={styles.titlespan}>ERP</span></h1>
      <div className={styles.inputgroup}>
        <label htmlFor="usuario" className={styles.label}>Usuario</label>
        <input
          type="text"
          id="usuario"
          className={styles.input}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />
      </div>
      <div className={styles.inputgroup}>
        <label htmlFor="contraseña" className={styles.label}>Contraseña</label>
        <input
          className={styles.input}
          type="password"
          id="contraseña"
          value={contraseña}
          onChange={(e) => setContraseña(e.target.value)}
          required
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btn} onClick={handleLogin}>Ingresar</button>
    </div>
    </div>
  );
}