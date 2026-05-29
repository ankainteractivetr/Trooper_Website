import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// POST /api/auth/login  { username, password }  ->  { token }
// Credentials are checked against ADMIN_USERNAME / ADMIN_PASSWORD in .env.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const okUser = username === process.env.ADMIN_USERNAME;
  const okPass = password === process.env.ADMIN_PASSWORD;

  if (!okUser || !okPass) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }

  const token = jwt.sign({ sub: username, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.json({ token });
});

// GET /api/auth/me  -> confirms a token is still valid (used by the admin UI).
router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ ok: true, user });
  } catch {
    res.status(401).json({ ok: false });
  }
});

export default router;
