import DB from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user, deviceId } = req.body || {};
  const table = process.env.SESSIONS_TABLE || 'SesionesActivas';

  if (!user || !deviceId) return res.status(400).json({ error: 'Faltan user o deviceId' });

  try {
    const sql = `UPDATE \`${table}\` SET Activa = 0 WHERE Usuario = ? AND DeviceId = ?`;
    await DB.query(sql, [user, deviceId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
}
