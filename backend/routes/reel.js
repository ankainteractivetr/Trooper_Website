import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploader } from '../middleware/upload.js';

const router = Router();
const upload = uploader('reel');

// GET /api/reel  (auth) — full list incl. disabled, for the CMS.
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await q('SELECT * FROM reel_images ORDER BY sort_order, id'));
  } catch (e) { next(e); }
});

// POST /api/reel  (auth) — upload one or more frames (field name: images).
router.post('/', requireAuth, upload.array('images', 30), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

    let [{ n }] = await q('SELECT COALESCE(MAX(sort_order)+1, 0) AS n FROM reel_images');
    const created = [];
    for (const f of files) {
      const r = await q(
        'INSERT INTO reel_images (filename, caption, sort_order, enabled) VALUES (?,?,?,1)',
        [f.filename, '', n++]
      );
      const [row] = await q('SELECT * FROM reel_images WHERE id = ?', [r.insertId]);
      created.push(row);
    }
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// PUT /api/reel/:id  (auth) — caption / enabled.
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { caption, enabled } = req.body || {};
    const [cur] = await q('SELECT * FROM reel_images WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    await q(
      'UPDATE reel_images SET caption = ?, enabled = ? WHERE id = ?',
      [
        caption ?? cur.caption,
        enabled === undefined ? cur.enabled : (Number(enabled) ? 1 : 0),
        req.params.id,
      ]
    );
    const [row] = await q('SELECT * FROM reel_images WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

// DELETE /api/reel/:id  (auth)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [cur] = await q('SELECT * FROM reel_images WHERE id = ?', [req.params.id]);
    if (cur && cur.filename) {
      const p = path.join(process.env.UPLOAD_DIR || 'uploads', 'reel', cur.filename);
      fs.promises.unlink(p).catch(() => {});
    }
    await q('DELETE FROM reel_images WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/reel/reorder/all  (auth)  body: { order: [id, id, ...] }
router.put('/reorder/all', requireAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.order) ? req.body.order : [];
    let i = 0;
    for (const id of ids) {
      await q('UPDATE reel_images SET sort_order = ? WHERE id = ?', [i++, id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
