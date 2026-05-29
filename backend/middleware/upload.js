import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const ROOT = process.env.UPLOAD_DIR || 'uploads';
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 12);

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

// Build a multer instance that stores into uploads/<sub> with a safe unique name.
export function uploader(sub) {
  const dir = path.join(ROOT, sub);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const base = path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .slice(0, 40) || 'img';
      const hash = crypto.randomBytes(4).toString('hex');
      cb(null, `${base}-${Date.now()}-${hash}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED.has(file.mimetype)) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
}
