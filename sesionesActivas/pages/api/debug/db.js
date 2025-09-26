import DB from '../../../lib/db';
import { getDbConfigMeta } from '../../../dbconfig';

export default async function handler(req, res) {
  try {
    const ok = await DB.ping();
    const meta = getDbConfigMeta();
    res.json({ ok, source: meta.source, configPath: meta.path || '(env)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
