import DB from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user, deviceId } = req.body || {};
  const table = process.env.SESSIONS_TABLE || 'sessions_tokens';

  if (!user || !deviceId) return res.status(400).json({ error: 'Faltan user o deviceId' });

  try {
    // Deja activa la sesión elegida (1) y pone 0 al resto del mismo usuario.
    const sql = `
      UPDATE \`${table}\`
      SET Activa = CASE WHEN DeviceId = ? THEN 1 ELSE 0 END
      WHERE Usuario = ?
    `;
    await DB.query(sql, [deviceId, user]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
}
