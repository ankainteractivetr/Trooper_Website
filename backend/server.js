import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import socialRoutes from './routes/social.js';
import reelRoutes from './routes/reel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

// CORS — allow the Vite dev server (and optionally any origin in dev).
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) || '*',
  })
);

// Serve uploaded images. cross-origin so the WebGPU canvas can use them as textures.
app.use(
  '/uploads',
  express.static(path.join(__dirname, UPLOAD_DIR), {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'trooper-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/reel', reelRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Central error handler (multer + thrown errors land here).
app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.status || (err.message?.includes('allowed') ? 400 : 500);
  res.status(code).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`\n  Trooper backend running → http://localhost:${PORT}`);
});
