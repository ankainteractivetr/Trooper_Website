// api.js
// Thin client for the backend API. In dev, VITE_API_URL is blank and requests
// go through Vite's proxy (/api -> http://localhost:4000). In production set
// VITE_API_URL to the backend origin.

const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'trooper_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = opts.body instanceof FormData;
  if (!isForm && opts.body && typeof opts.body === 'object') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  // NOTE: never set Content-Type for FormData — the browser adds the boundary.

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401) {
    setToken('');
    throw new Error('Unauthorized');
  }

  // Read the body once as text, then parse JSON only if there's actually
  // content — this avoids "Unexpected end of JSON input" on empty responses.
  const raw = await res.text();
  let data = null;
  if (raw) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = JSON.parse(raw); } catch { data = raw; }
    } else {
      data = raw;
    }
  }

  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // ── Public ──
  content: () => req('/api/content'),

  // ── Auth ──
  login: (username, password) =>
    req('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => req('/api/auth/me'),

  // ── Site content (auth) ──
  saveSite: (payload) => req('/api/content/site', { method: 'PUT', body: payload }),

  // ── Social links (auth) ──
  social: {
    list: () => req('/api/social'),
    create: (form) => req('/api/social', { method: 'POST', body: form }),
    update: (id, payload) => req(`/api/social/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => req(`/api/social/${id}`, { method: 'DELETE' }),
    reorder: (order) => req('/api/social/reorder/all', { method: 'PUT', body: { order } }),
  },

  // ── Reel images (auth) ──
  reel: {
    list: () => req('/api/reel'),
    upload: (form) => req('/api/reel', { method: 'POST', body: form }),
    update: (id, payload) => req(`/api/reel/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => req(`/api/reel/${id}`, { method: 'DELETE' }),
    reorder: (order) => req('/api/reel/reorder/all', { method: 'PUT', body: { order } }),
  },
};