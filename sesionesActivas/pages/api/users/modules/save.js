// POST /api/users/modules/save  { userId: 123, selectedIds: [1,3,5] }
import DB from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, selectedIds } = req.body || {};
  if (!userId || !Array.isArray(selectedIds)) {
    return res.status(400).json({ error: 'Falta userId o selectedIds' });
  }

  const conn = await DB.pool.getConnection();
  try {
    await conn.beginTransaction();

    const current = await conn.query(
      "SELECT `IdModulo` FROM `ModulosXCliente` WHERE `IdCliente` = ?",
      [userId]
    );
    const currentIds = current[0].map(r => Number(r.IdModulo));

    const selected = [...new Set(selectedIds.map(Number))];
    const toAdd    = selected.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !selected.includes(id));

    if (toAdd.length) {
      const values = toAdd.map(id => [userId, id]);
      await conn.query(
        "INSERT INTO `ModulosXCliente` (`IdCliente`, `IdModulo`) VALUES ?",
        [values]
      );
    }

    if (toRemove.length) {
      await conn.query(
        "DELETE FROM `ModulosXCliente` WHERE `IdCliente` = ? AND `IdModulo` IN (?)",
        [userId, toRemove]
      );
    }

    await conn.commit();
    res.json({ ok: true, added: toAdd, removed: toRemove });
  } catch (e) {
    await conn.rollback();
    console.error('API /users/modules/save error:', e);
    res.status(500).json({ error: e.message, code: e.code || null });
  } finally {
    conn.release();
  }
}
