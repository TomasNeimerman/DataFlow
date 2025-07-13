// app/Login/page.js
'use client'; // Indica que este componente utiliza funcionalidades del cliente como useState y useRouter

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
      console.log('Respuesta del login:', response);
      if (response.success) {
        localStorage.setItem('fechaInicio', new Date().toISOString());
        localStorage.setItem('jwtToken', response.token);
        router.push('/Index'); // ✅ Redirige a la ruta interna
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
   
    <div className={styles.container}>
      <h1 className={styles.title}>Actualizador</h1>
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