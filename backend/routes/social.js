import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploader } from '../middleware/upload.js';

const router = Router();
const upload = uploader('social');

// GET /api/social  (auth) — full list incl. disabled, for the CMS.
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await q('SELECT * FROM social_links ORDER BY sort_order, id'));
  } catch (e) { next(e); }
});

// POST /api/social  (auth) — create. icon = uploaded file OR provided URL.
router.post('/', requireAuth, upload.single('icon'), async (req, res, next) => {
  try {
    const { platform, url, iconUrl } = req.body || {};
    const icon = req.file ? req.file.filename : (iconUrl || '');
    const [{ n }] = await q('SELECT COALESCE(MAX(sort_order)+1, 0) AS n FROM social_links');
    const r = await q(
      'INSERT INTO social_links (platform, url, icon, sort_order, enabled) VALUES (?,?,?,?,1)',
      [platform || 'Link', url || '#', icon, n]
    );
    const [row] = await q('SELECT * FROM social_links WHERE id = ?', [r.insertId]);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// PUT /api/social/:id  (auth) — update fields and/or replace icon.
router.put('/:id', requireAuth, upload.single('icon'), async (req, res, next) => {
  try {
    const { platform, url, iconUrl, enabled } = req.body || {};
    const [cur] = await q('SELECT * FROM social_links WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });

    const icon = req.file ? req.file.filename : (iconUrl ?? cur.icon);
    await q(
      'UPDATE social_links SET platform=?, url=?, icon=?, enabled=? WHERE id=?',
      [
        platform ?? cur.platform,
        url ?? cur.url,
        icon,
        enabled === undefined ? cur.enabled : (Number(enabled) ? 1 : 0),
        req.params.id,
      ]
    );
    const [row] = await q('SELECT * FROM social_links WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

// DELETE /api/social/:id  (auth)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [cur] = await q('SELECT * FROM social_links WHERE id = ?', [req.params.id]);
    if (cur && cur.icon && !/^https?:\/\//i.test(cur.icon)) {
      const p = path.join(process.env.UPLOAD_DIR || 'uploads', 'social', cur.icon);
      fs.promises.unlink(p).catch(() => {});
    }
    await q('DELETE FROM social_links WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/social/reorder/all  (auth)  body: { order: [id, id, ...] }
router.put('/reorder/all', requireAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.order) ? req.body.order : [];
    let i = 0;
    for (const id of ids) {
      await q('UPDATE social_links SET sort_order = ? WHERE id = ?', [i++, id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
