import DB from '../../../lib/db';
import { getSessionsTable } from '../../../lib/sessionsMeta';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const table = await getSessionsTable();
    const onlyActive = req.query.onlyActive === 'true';

    const sql = `
      SELECT
        Usuario AS user,
        DeviceId AS deviceId,
        LastSeen,
        Activa,
        (
          SELECT u.\`Id\`
          FROM \`Usuarios\` u
          WHERE u.\`Usuario\` COLLATE utf8mb4_unicode_ci
                = \`${table}\`.\`Usuario\` COLLATE utf8mb4_unicode_ci
          LIMIT 1
        ) AS userId,
        (
          SELECT u.\`FechaExpiracionClave\`
          FROM \`Usuarios\` u
          WHERE u.\`Usuario\` COLLATE utf8mb4_unicode_ci
                = \`${table}\`.\`Usuario\` COLLATE utf8mb4_unicode_ci
          LIMIT 1
        ) AS fechaExpiracionClave
      FROM \`${table}\`
      ORDER BY user ASC, LastSeen DESC
    `;

    const rows = await DB.query(sql);

    const byUser = new Map();
    for (const r of rows) {
      if (!byUser.has(r.user)) {
        byUser.set(r.user, {
          user: r.user,
          userId: r.userId ?? null,
          fechaExpiracionClave: r.fechaExpiracionClave || null,
          expireAt: r.fechaExpiracionClave || null,
          sessions: []
        });
      }
      if (!onlyActive || Number(r.Activa) === 1) {
        byUser.get(r.user).sessions.push({
          deviceId: r.deviceId,
          lastSeen: r.LastSeen,
          active: Number(r.Activa) === 1
        });
      }
    }

    res.json({ users: Array.from(byUser.values()) });
  } catch (e) {
    console.error('API /sessions error:', e);
    res.status(500).json({ error: e.message, code: e.code || null });
  }
}
