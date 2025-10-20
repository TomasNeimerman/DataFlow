import { useEffect, useState, useMemo } from 'react';
import UserAccordion from '../components/UserAccordion';
import RenewModal from '../components/RenewModal'; // ← NUEVO
import logo from '../assets/icon/app-icon.png';
import Image from 'next/image';
import ManageModulesModal from '../components/ManageModulesModal';

export default function Home() {
  const [data, setData] = useState([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modsOpen, setModsOpen] = useState(false);
const [modsTarget, setModsTarget] = useState(null); // { user, userId }
  // ─── Estado del modal Renovar ──────────────────────────────
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState(null); // { user, userId?, expireAt? }

  async function fetchData() {
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions?onlyActive=${onlyActive}`);
      if (!r.ok) {
        const txt = await r.text();
        let msg = `HTTP ${r.status}`;
        try {
          const j = JSON.parse(txt);
          msg = [j.error, j.code, j.sqlMessage, j.address && `host=${j.address}`, j.port && `port=${j.port}`]
            .filter(Boolean).join(' | ');
        } catch { msg = txt; }
        throw new Error(msg);
      }
      const j = await r.json();
      setData(j.users || []);
    } catch (e) {
      console.error(e);
      setData([]);
      alert('Error de base de datos: ' + (e.message || 'desconocido'));
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

  // ─── Abrir modal Renovar desde el acordeón ─────────────────
  function openRenew({ user, userId, expireAt }) {
    setRenewTarget({ user, userId: userId ?? null, expireAt: expireAt ?? '' });
    setRenewOpen(true);
  }

  // ─── Guardar renovación ────────────────────────────────────
  async function submitRenew({ date, pwd }) {
    try {
      const body = {
        newDate: date,
        newPassword: pwd,
        // el backend acepta userId o user (para máxima compatibilidad)
        userId: renewTarget?.userId || null,
        user: renewTarget?.user
      };
      const r = await fetch('/api/users/renew', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t);
      }
      setRenewOpen(false);
      setRenewTarget(null);
      await fetchData();
    } catch (e) {
      alert('No se pudo renovar: ' + (e.message || 'error'));
    }
  }
  function openModules({ user, userId }) {
  setModsTarget({ user, userId });
  setModsOpen(true);
}
const viewData = useMemo(() => {
  if (!onlyActive) return data;
  return (data || [])
    .map(u => ({ ...u, sessions: (u.sessions || []).filter(s => s.active) }))
    .filter(u => u.sessions.length > 0);
}, [data, onlyActive]);
  return (
    <main className="body">
      <Image className="brandLogo" src={logo} alt="Panel de Sesiones" width={120} height={120} priority />

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

       {!loading && viewData.length === 0 && (
  <div className="errorBox">No hay sesiones activas.</div>
)}

        {!loading && viewData.map(u => (
  <UserAccordion
    key={u.user}
    user={u.user}
    userId={u.userId}
    expireAt={u.expireAt || u.fechaExpiracionClave || null}
    sessions={u.sessions}
    onActivate={activate}
    onDeactivate={deactivate}
    onOpenRenew={() =>
      openRenew({ user: u.user, userId: u.userId, expireAt: u.expireAt || u.fechaExpiracionClave })
    }
    onOpenModules={() => openModules({ user: u.user, userId: u.userId })}
    showModules={!onlyActive}          // 👈 oculto en “Activas”
  />
))}
      </div>

      <RenewModal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        onSubmit={submitRenew}
        defaultDate={renewTarget?.expireAt || ''}
      />
      <ManageModulesModal
  open={modsOpen}
  onClose={() => setModsOpen(false)}
  user={modsTarget?.user}
  userId={modsTarget?.userId}
  onSaved={() => fetchData()}
/>
    </main>
  );
}
