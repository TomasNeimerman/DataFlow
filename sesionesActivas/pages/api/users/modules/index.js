// GET /api/users/modules?userId=123  (o ?user=test)
import DB from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let { userId, user } = req.query || {};
    if (!userId && !user) return res.status(400).json({ error: 'Falta userId o user' });

    // Si no viene userId, lo buscamos por nombre de usuario
    if (!userId && user) {
      const rows = await DB.query(
        "SELECT `Id` FROM `Usuarios` WHERE `Usuario` COLLATE utf8mb4_unicode_ci = ? LIMIT 1",
        [user]
      );
      if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
      userId = rows[0].Id;
    }

    const modules = await DB.query(
      `SELECT m.\`Id\` AS id, m.\`Nombre\` AS nombre, m.\`Icono\` AS icono,
              EXISTS(SELECT 1 FROM \`ModulosXCliente\` mx
                      WHERE mx.\`IdCliente\` = ? AND mx.\`IdModulo\` = m.\`Id\`) AS assigned
       FROM \`Modulos\` m
       ORDER BY m.Id ASC`,
      [userId]
    );

    res.json({ userId: Number(userId), modules: modules.map(m => ({
      id: m.id, nombre: m.nombre, icono: m.icono, assigned: !!Number(m.assigned)
    })) });
  } catch (e) {
    console.error('API /users/modules (GET) error:', e);
    res.status(500).json({ error: e.message, code: e.code || null });
  }
}
