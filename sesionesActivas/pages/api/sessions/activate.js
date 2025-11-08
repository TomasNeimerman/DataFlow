// pages/api/sessions/activate.js
import DB from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user, deviceId } = req.body || {};
  const table = process.env.SESSIONS_TABLE || 'SesionesActivas';

  if (!user || !deviceId) return res.status(400).json({ error: 'Faltan user o deviceId' });

  try {
    // 1) ¿Es admin?
    const rows = await DB.query(
      "SELECT `admin` FROM `Usuarios` WHERE `Usuario` COLLATE utf8mb4_unicode_ci = ? LIMIT 1",
      [user]
    );
    const isAdmin = !!(rows && rows[0] && Number(rows[0].admin) === 1);

    // 2) Activar según sea admin o no
    if (isAdmin) {
      // Admin: NO desactiva las otras
      const sql = `
        UPDATE \`${table}\`
           SET \`Activa\` = 1
         WHERE \`Usuario\` COLLATE utf8mb4_unicode_ci = ?
           AND \`DeviceId\` = ?
      `;
      await DB.query(sql, [user, deviceId]);
      return res.json({ ok: true, isAdmin: true });
    } else {
      // No-admin: deja 1 solo device activo para ese user (como antes)
      const sql = `
        UPDATE \`${table}\`
           SET \`Activa\` = CASE WHEN \`DeviceId\` = ? THEN 1 ELSE 0 END
         WHERE \`Usuario\` COLLATE utf8mb4_unicode_ci = ?
      `;
      await DB.query(sql, [deviceId, user]);
      return res.json({ ok: true, isAdmin: false });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
}
