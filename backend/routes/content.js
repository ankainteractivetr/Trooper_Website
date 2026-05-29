import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const base = () => (process.env.PUBLIC_URL || 'http://localhost:4000').replace(/\/$/, '');

// Turn a stored icon/filename into an absolute URL.
function urlFor(folder, value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value; // already a full URL
  return `${base()}/uploads/${folder}/${value}`;
}

// GET /api/content  — everything the public site needs, in one call.
router.get('/', async (_req, res, next) => {
  try {
    const [content] = await q('SELECT * FROM site_content WHERE id = 1');
    const social = await q(
      'SELECT id, platform, url, icon FROM social_links WHERE enabled = 1 ORDER BY sort_order, id'
    );
    const reel = await q(
      'SELECT id, filename, caption FROM reel_images WHERE enabled = 1 ORDER BY sort_order, id'
    );

    res.json({
      title: content?.title ?? "Caner 'Trooper' Kurt",
      subtitle: content?.subtitle ?? '',
      about: content?.about ?? '',
      accent: content?.accent ?? '#ff2d2d',
      social: social.map((s) => ({ ...s, icon: urlFor('social', s.icon) })),
      reel: reel.map((r) => ({
        id: r.id,
        caption: r.caption,
        url: urlFor('reel', r.filename),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/content/site  (auth) — update title / subtitle / about / accent.
router.put('/site', requireAuth, async (req, res, next) => {
  try {
    const { title, subtitle, about, accent } = req.body || {};
    const vals = [
      title ?? "Caner 'Trooper' Kurt",
      subtitle ?? '',
      about ?? '',
      accent ?? '#ff2d2d',
    ];
    // Upsert: create the single content row (id=1) if it doesn't exist yet,
    // otherwise update it. This works even if the DB was never seeded.
    await q(
      `INSERT INTO site_content (id, title, subtitle, about, accent)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), subtitle=VALUES(subtitle),
         about=VALUES(about), accent=VALUES(accent)`,
      vals
    );
    const [row] = await q('SELECT * FROM site_content WHERE id = 1');
    // Always return valid JSON (never an empty body).
    res.json(
      row || { id: 1, title: vals[0], subtitle: vals[1], about: vals[2], accent: vals[3] }
    );
  } catch (e) {
    next(e);
  }
});

export default router;