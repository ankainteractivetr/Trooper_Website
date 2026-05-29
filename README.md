# Caner 'Trooper' Kurt — 3D Personal Website

A modern, dark, sci-fi personal website rendered with **raw WebGPU** (no three.js,
no rendering libraries — hand-written WGSL shaders and matrix math). It ships with
a full **Node + Express + MySQL** backend and a **CMS** so every piece of content
(title, bio text, social links, and the photos on the film reel) is editable from
an admin panel.

---
### What is true 3D vs. styled

- **Film reel** (left): true 3D — a vertical cylinder of image quads, each photo a
  layer of a `texture_2d_array`, lit with a key light + cyan fresnel rim, spinning.
- **Space background**: true 3D — a full-screen procedural nebula + starfield shader.
- **Title** (top): a plain **HTML `<h1>`** styled with CSS (neon glow), centred over
  the scene — far easier to place and align pixel-perfectly than extruded 3D text.
- **Bio panel** (right): a holographic **HTML/CSS** console floating over the 3D
  scene. Long paragraphs of prose are far more readable as crisp DOM text than as
  raw 3D geometry, so this part is deliberately styled (glass blur, scanlines, HUD
  brackets, glow) rather than rendered as meshes.

---

## Tech stack

- **Frontend:** Vite + React 18 + React Router + Tailwind CSS + raw WebGPU/WGSL
- **Backend:** Node.js + Express + MySQL (mysql2) + JWT auth + Multer uploads

---

## Prerequisites

- **Node.js 18+**
- **MySQL 8+** (or MariaDB 10.4+) running locally
- A **WebGPU-capable browser** for the 3D experience: **Chrome / Edge 113+**
  (Safari 18+ and Firefox with the flag also work). Without WebGPU the site shows a
  graceful 2D fallback that lists the reel photos newest-first. The layout is
  responsive: on narrow screens it stacks vertically (title → reel → bio → social).

---

## 1) Backend setup

```bash
cd backend
npm install
```

Copy the example env and edit it:

```bash
cp .env.example .env
```

Open `backend/.env` and set at least:

| Variable          | What to set                                              |
|-------------------|----------------------------------------------------------|
| `DB_PASSWORD`     | your MySQL root (or user) password                       |
| `DB_USER`         | your MySQL user (default `root`)                          |
| `ADMIN_USERNAME`  | the CMS login username                                   |
| `ADMIN_PASSWORD`  | the CMS login password — **change this**                 |
| `JWT_SECRET`      | a long random string — **change this**                   |

Create the database schema, then seed it with the existing content + photos:

```bash
npm run db:setup   # creates the `trooper_site` database and tables
npm run db:seed    # inserts the bio text, 7 social links and the trooper_* images
```

Start the API:

```bash
npm start          # http://localhost:4000   (or: npm run dev  for auto-reload)
```

Health check: open <http://localhost:4000/api/health>.

> The `trooper_*` photos and social icons are already in `backend/uploads/`, so the
> reel and social bar are populated immediately after `db:seed`.

---

## 2) Frontend setup

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env   # leave VITE_API_URL blank for local dev (uses the proxy)
npm run dev            # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/uploads`
to the backend on port 4000, so no CORS setup is needed in development.

---

## 3) Admin / CMS

Go to <http://localhost:5173/admin> and log in with the `ADMIN_USERNAME` /
`ADMIN_PASSWORD` from `backend/.env` (defaults: `trooper` / `Trooper387!Vulkan` —
**change these before deploying**).

From the control deck you can:

- **Site** — edit the title, subtitle, accent colour, email, blog URL, and the bio
  text (blank line = new paragraph).
- **Social links** — add / edit / delete links, upload icons, toggle visibility,
  and reorder them.
- **Film reel** — upload one or many photos, caption them, toggle visibility,
  reorder, and delete. New uploads appear on the 3D reel on the next page load.

Changes are saved to MySQL and reflected on the public site immediately.

---

## Project structure

```
trooper-website/
├── backend/
│   ├── routes/        auth, content, social, reel
│   ├── middleware/    auth (JWT), upload (Multer)
│   ├── uploads/       reel/ and social/ image files (served statically)
│   ├── schema.sql     database + tables
│   ├── setup-db.js    runs schema.sql
│   ├── seed.js        seeds existing content
│   └── server.js      Express app
└── frontend/
    └── src/
        ├── gpu/        raw WebGPU layer (no three.js)
        │   ├── math.js       column-major mat4 (WebGPU [0,1] depth)
        │   ├── shaders.js    WGSL: background + film reel
        │   ├── textures.js   image loading / cover-crop
        │   ├── FilmReel.js   cylinder mesh + texture_2d_array
        │   └── Renderer.js   device, pipelines, camera, draw loop
        ├── components/  Home, HologramPanel, SocialBar, Unsupported, Admin
        ├── api.js       backend client
        └── main.jsx     routes: "/" and "/admin"
```

---

## Tuning the 3D scene

The visual constants are grouped at the top of each GPU module for easy tweaking:

- **Camera / composition** — `frontend/src/gpu/Renderer.js` (`FOV`, `REEL_POS_X`,
  `REEL_POS_Y`, `REEL_SPIN`, `CAM_TARGET`, `CAM_EYE`).
- **Reel geometry** — `frontend/src/gpu/FilmReel.js` (`RADIUS`, `HALF_H`,
  `SEGMENTS_PER_FRAME`, `V_BORDER`).

If anything looks off on first run (positioning, size, spin speed), these are the
knobs to turn — the renderer is fully modular so individual pieces are easy to
adjust without touching the rest.

---

## Production build

```bash
# frontend
cd frontend
# set VITE_API_URL in .env to your backend's public origin first
npm run build      # outputs static files to frontend/dist
```

Serve `frontend/dist` from any static host (or behind the same origin as the API),
and run the backend with a process manager (e.g. `pm2`). When the frontend is served
from a different origin than the API, set `CORS_ORIGIN` in `backend/.env` accordingly.

---

## Security checklist before deploying

- [ ] Change `ADMIN_PASSWORD` and `JWT_SECRET` in `backend/.env`.
- [ ] Use a dedicated MySQL user (not `root`) with a strong password.
- [ ] Serve everything over HTTPS.
- [ ] Set `CORS_ORIGIN` to your real frontend origin.
