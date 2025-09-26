import { useEffect, useState } from 'react';
import UserAccordion from '../components/UserAccordion';

export default function Home() {
  const [data, setData] = useState([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
  setLoading(true);
  try {
    const r = await fetch(`/api/sessions?onlyActive=${onlyActive}`);
     if (!r.ok) {
       const err = await r.json().catch(() => ({}));
       const msg = [err.error, err.code].filter(Boolean).join(' ');
       throw new Error(msg || `HTTP ${r.status}`);
    }
    const j = await r.json();
    setData(j.users || []);
  } catch (e) {
    console.error(e);
    setData([]);
    alert('Error de base de datos: ' + e.message); // simple y directo
  } finally {
    setLoading(false);
  }
}


  useEffect(() => { fetchData(); }, [onlyActive]);

  async function activate(user, deviceId) {
    await fetch('/api/sessions/activate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user, deviceId })
    });
    fetchData();
  }

  async function deactivate(user, deviceId) {
    await fetch('/api/sessions/deactivate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user, deviceId })
    });
    fetchData();
  }

  return (
    <main className="body">
      {/* Si tenés un logo, descomentá:
      <img className="img" src="/logo.png" alt="logo" />
      */}
      <div className="container">
        <div className="titleContainer">
          <h1 className="title">Panel de <span className="titlespan">Sesiones</span></h1>
          <button className="btn btn-sm" onClick={fetchData}>Actualizar</button>
        </div>

        <p className="small">Ver usuarios y habilitar/deshabilitar sesiones por <code>deviceId</code>.</p>

        <div className="toggleContainer">
          <button
            className={`toggleButton ${!onlyActive ? 'active' : ''}`}
            onClick={() => setOnlyActive(false)}
          >Todas</button>
          <button
            className={`toggleButton ${onlyActive ? 'active' : ''}`}
            onClick={() => setOnlyActive(true)}
          >Activas</button>
        </div>

        {loading && <div className="info">Cargando...</div>}

        {!loading && data.length === 0 && (
          <div className="errorBox">No hay sesiones para mostrar.</div>
        )}

        {!loading && data.map(u => (
          <UserAccordion
            key={u.user}
            user={u.user}
            sessions={u.sessions}
            onActivate={activate}
            onDeactivate={deactivate}
          />
        ))}
      </div>
    </main>
  );
}
