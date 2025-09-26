import { useState } from 'react';

export default function UserAccordion({ user, sessions, onActivate, onDeactivate }) {
  const [open, setOpen] = useState(false);
  const activeCount = sessions.filter(s => s.active).length;

  return (
    <div className="userCard">
      <div className="accordionHeader" onClick={() => setOpen(o => !o)}>
        <div className="accordionTitle">
          <strong>{user}</strong>
          <span className="count">— {activeCount} activa(s)</span>
        </div>
        <span className={`chevron ${open ? 'open' : ''}`}>▼</span>
      </div>

      {open && (
        <div className="accordionBody">
          {sessions.map(s => (
            <div key={s.deviceId} className="sessionRow">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong>{s.deviceId}</strong>
                  <span className="chip id">deviceId</span>
                  {s.active && <span className="chip active">ACTIVA</span>}
                </div>
                <div className="meta">LastSeen: {s.lastSeen ? new Date(s.lastSeen).toLocaleString() : '—'}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!s.active ? (
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onActivate(user, s.deviceId); }}>
                    Habilitar
                  </button>
                ) : (
                  <button className="btn btn-sm ghost" onClick={(e) => { e.stopPropagation(); onDeactivate(user, s.deviceId); }}>
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
