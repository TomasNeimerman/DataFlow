import DB from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let { userId, user, newDate, newPassword } = req.body || {};
    if (!newDate || !newPassword || (!userId && !user)) {
      return res.status(400).json({ error: 'Falta userId o user, newDate o newPassword' });
    }

    // Si no llega userId, lo buscamos por user
    if (!userId && user) {
      const rows = await DB.query(
        "SELECT `Id` FROM `Usuarios` WHERE `Usuario` COLLATE utf8mb4_unicode_ci = ? LIMIT 1",
        [user]
      );
      if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
      userId = rows[0].Id;
    }

    // Detectar columna de expiración disponible
    const hasClave = (await DB.query("SHOW COLUMNS FROM `Usuarios` LIKE 'FechaExpiracionClave'")).length > 0;
    const hasFecha = (await DB.query("SHOW COLUMNS FROM `Usuarios` LIKE 'FechaExpiracion'")).length > 0;

    const sets = [];
    const params = [];
    if (hasClave) { sets.push("`FechaExpiracionClave` = ?"); params.push(newDate); }
    else if (hasFecha) { sets.push("`FechaExpiracion` = ?"); params.push(newDate); }
    else return res.status(500).json({ error: 'No existe columna de expiración en Usuarios' });

    sets.push("`Contraseña` = ?");
    params.push(newPassword);

    params.push(userId);
    const sql = `UPDATE \`Usuarios\` SET ${sets.join(', ')} WHERE \`Id\` = ?`;
    await DB.query(sql, params);

    res.json({ ok: true });
  } catch (e) {
    console.error('API /users/renew error:', e);
    res.status(500).json({ error: e.message, code: e.code || null });
  }
}
