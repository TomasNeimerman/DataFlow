import { useState, useEffect } from 'react';

export default function RenewModal({ open, onClose, onSubmit, defaultDate }) {
  const [date, setDate] = useState(defaultDate || '');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => { setDate(defaultDate || ''); setPwd(''); }, [defaultDate, open]);
  if (!open) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <h3>Renovar clave</h3>

        <label className="label">Nueva fecha de expiración</label>
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />

        <label className="label" style={{ marginTop: 10 }}>Nueva contraseña</label>
        <div className="inputGroup">
          <input
            className="input"
            type={showPwd ? 'text' : 'password'}
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="togglePwd"
            aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPwd(s => !s)}
          >
            {showPwd ? '🔒' : '🔓'}
          </button>
        </div>

        <div className="modalButtons">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn danger" onClick={() => onSubmit({ date, pwd })} disabled={!date || !pwd}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
