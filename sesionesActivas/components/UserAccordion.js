import { useState, useMemo } from 'react';

function fmt(d) {
  if (!d) return '—';
  try {
    const [y,m,dd] = d.slice(0,10).split('-'); // YYYY-MM-DD
    return `${dd}/${m}/${y}`;
  } catch {
    return d;
  }
}

// ✅ vence el día inclusive, sin efectos de TZ/DST
function isExpired(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const expUTC = Date.UTC(y, (m || 1) - 1, d || 1);
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return expUTC <= todayUTC; // inclusivo
}

export default function UserAccordion({
  user, userId, expireAt, sessions,
  onActivate, onDeactivate, onOpenRenew,
  onOpenModules,
  showModules = true           // 👈 NUEVO
}) {
  const [open, setOpen] = useState(false);
  const expired = useMemo(() => isExpired(expireAt), [expireAt]);
  const headerClass = `accordionHeader ${expired ? 'expired' : ''}`;

  return (
    <div className={`userCard ${expired ? 'expired' : ''}`}>
      <div className={headerClass} onClick={() => { if (!expired) setOpen(o => !o); }}>
        <div className="accordionTitle">
          <strong>{user}</strong>
          <span className={`chip ${expired ? 'danger' : ''}`}>
            {expired ? `Clave expirada el ${fmt(expireAt)}` : `Expira: ${fmt(expireAt)}`}
          </span>
        </div>

        {expired ? (
          <button
            className="btn btn-sm danger"
            onClick={(e) => { e.stopPropagation(); onOpenRenew?.({ user, userId, expireAt }); }}
          >
            Renovar Clave
          </button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {showModules && (
              <button
                className="btn btn-sm ghost"
                onClick={(e) => { e.stopPropagation(); onOpenModules?.({ user, userId }); }}
                title="Gestionar módulos"
              >
                Módulos
              </button>
            )}
            <span className={`chevron ${open ? 'open' : ''}`}>▼</span>
          </div>
        )}
      </div>

      {!expired && open && (
        <div className="accordionBody">
          {sessions.map(s => (
            <div key={s.deviceId} className="sessionRow">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong>{s.deviceId}</strong>
                  <span className="chip id">deviceId</span>
                  {s.active && <span className="chip active">ACTIVA</span>}
                </div>
                <div className="meta">
                  LastSeen: {s.lastSeen ? new Date(s.lastSeen).toLocaleString() : '—'}
                </div>
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
