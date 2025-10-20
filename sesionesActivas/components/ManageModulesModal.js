import { useEffect, useState } from 'react';

export default function ManageModulesModal({ open, onClose, userId, user, onSaved }) {
  const [mods, setMods] = useState([]);        // {id, nombre, icono, assigned}
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      try {
        const q = await fetch(`/api/users/modules?userId=${userId}`);
        if (!q.ok) throw new Error(await q.text());
        const j = await q.json();
        setMods(j.modules || []);
      } catch (e) {
        alert('No se pudieron cargar los módulos: ' + (e.message || 'error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, userId]);

  function toggle(id, val) {
    setMods(ms => ms.map(m => m.id === id ? { ...m, assigned: val } : m));
  }

  async function save() {
    setSaving(true);
    try {
      const selectedIds = mods.filter(m => m.assigned).map(m => m.id);
      const r = await fetch('/api/users/modules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, selectedIds })
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved?.();
      onClose();
    } catch (e) {
      alert('No se pudieron guardar los cambios: ' + (e.message || 'error'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={e => e.stopPropagation()}>
        <h3 style={{marginBottom:12}}>Módulos de <span style={{color:'#e82c02'}}>{user}</span></h3>

        {loading ? (
          <div className="info">Cargando módulos…</div>
        ) : (
          <div className="tableContainer">
            <table className="table">
              <thead>
                <tr className="headerRow">
                  <th style={{width:70}}>ID</th>
                  <th style={{width:70}}>Icono</th>
                  <th>Nombre</th>
                  <th style={{width:100, textAlign:'center'}}>Habilitado</th>
                </tr>
              </thead>
              <tbody>
                {mods.map(m => (
                  <tr key={m.id}>
                    <td className="num">{m.id}</td>
                    <td>
                      {m.icono ? <img src={m.icono} alt="" style={{height:20}} /> : '—'}
                    </td>
                    <td>{m.nombre}</td>
                    <td style={{textAlign:'center'}}>
                      <input
                        type="checkbox"
                        checked={!!m.assigned}
                        onChange={e => toggle(m.id, e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
                {mods.length === 0 && (
                  <tr><td colSpan={4} className="info">No hay módulos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="modalButtons">
          <button className="btn ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={save} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
