'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from './styles.module.css';

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      setError('');
      setLoading(true);

      // 1) Verificar BD local "manager"
      const chk = await window.api?.hasManager?.();
      if (!chk?.ok) {
        setError('No se encuentra sistema Bejerman ERP instalado');
        setLoading(false);
        return;
      }

      // 2) Login a la nube
      const response = await window.api.login(usuario, contraseña);
      if (response?.success) {
        localStorage.setItem('fechaInicio', new Date().toISOString());
        localStorage.setItem('jwtToken', response.token);
        router.push('/Index');
      } else {
        setError(response?.message || 'Error al iniciar sesión.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al iniciar sesión.');
    } finally {
      setLoading(false);
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

        <button className={styles.btn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}
