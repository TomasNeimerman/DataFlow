import DB from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const onlyActive = req.query.onlyActive === 'true';
  const table = process.env.SESSIONS_TABLE || 'SesionesActivas';

  try {
    const rows = await DB.query(
      `SELECT Usuario AS user, DeviceId AS deviceId, LastSeen, Activa
       FROM \`${table}\`
       ${onlyActive ? 'WHERE Activa = 1' : ''}
       ORDER BY user ASC, LastSeen DESC`
    );

    // Agrupo por usuario
    const map = {};
    for (const r of rows) {
      if (!map[r.user]) map[r.user] = [];
      map[r.user].push({
        deviceId: r.deviceId,
        lastSeen: r.LastSeen,
        active: Number(r.Activa) === 1
      });
    }

    res.json({ users: Object.entries(map).map(([user, sessions]) => ({ user, sessions })) });
  } catch (e) {
    console.error('API /sessions error:', e);
   res.status(500).json({
     error: e.message,
     code: e.code || null,
     errno: e.errno || null,
     sqlState: e.sqlState || null,
     sqlMessage: e.sqlMessage || null,
     address: e.address || null,
     port: e.port || null
   });
  }
}
