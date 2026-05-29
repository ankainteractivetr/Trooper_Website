import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken, setToken } from '../api.js';

const BASE = import.meta.env.VITE_API_URL || '';
function asset(folder, value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE}/uploads/${folder}/${value}`;
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!getToken());
  const [booting, setBooting] = useState(!!getToken());
  const [toast, setToast] = useState('');

  const flash = useCallback((m) => {
    setToast(m);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(''), 2600);
  }, []);

  // Validate an existing token on load.
  useEffect(() => {
    if (!getToken()) return;
    (async () => {
      try { await api.me(); setAuthed(true); }
      catch { setToken(''); setAuthed(false); }
      finally { setBooting(false); }
    })();
  }, []);

  if (!authed) return <Login onIn={() => setAuthed(true)} />;
  if (booting) return <Centered>// authenticating …</Centered>;

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div className="font-[Orbitron] tracking-[0.18em] text-white">
          TROOPER <span style={{ color: 'var(--accent)' }}>//</span> CONTROL DECK
        </div>
        <div className="flex items-center gap-2">
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">View site</a>
          <button className="btn danger" onClick={() => { setToken(''); setAuthed(false); }}>
            Log out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <SiteSection flash={flash} />
        <SocialSection flash={flash} />
        <ReelSection flash={flash} />
      </main>

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}

/* ───────────────────────── Login ───────────────────────── */
function Login({ onIn }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const { token } = await api.login(u, p);
      setToken(token);
      onIn();
    } catch (e) {
      setErr(e.message === 'Unauthorized' ? 'Invalid credentials' : (e.message || 'Login failed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-login">
      <div className="holo p-7 w-[min(92vw,380px)] relative">
        <span className="bracket tl" /><span className="bracket tr" />
        <span className="bracket bl" /><span className="bracket br" />
        <div className="tag mb-1">// secure access</div>
        <h1 className="font-[Orbitron] text-xl text-white mb-5">Control Deck</h1>
        <label className="tag">username</label>
        <input className="fld mt-1 mb-3" value={u} autoFocus
          onChange={(e) => setU(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <label className="tag">password</label>
        <input className="fld mt-1 mb-4" type="password" value={p}
          onChange={(e) => setP(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <p className="text-[#ff6a5d] text-sm mb-3">{err}</p>}
        <button className="btn w-full" onClick={submit} disabled={busy}>
          {busy ? 'Authenticating…' : 'Enter'}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Site ───────────────────────── */
function SiteSection({ flash }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.content().then(setS).catch(() => {}); }, []);

  if (!s) return <Card title="Site"><Skeleton /></Card>;

  const set = (k, v) => setS((cur) => ({ ...cur, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.saveSite({
        title: s.title, subtitle: s.subtitle, about: s.about, accent: s.accent,
      });
      flash('Site content saved');
    } catch (e) { flash(e.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Site">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="title"><input className="fld" value={s.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="subtitle"><input className="fld" value={s.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></Field>
        <Field label="accent color">
          <div className="flex items-center gap-2">
            <input type="color" value={s.accent || '#ff2d2d'} onChange={(e) => set('accent', e.target.value)}
              className="w-10 h-10 rounded border border-[rgba(61,240,255,0.3)] bg-transparent" />
            <input className="fld" value={s.accent || ''} onChange={(e) => set('accent', e.target.value)} />
          </div>
        </Field>
      </div>
      <Field label="about (rich text — supports links; justified on the site)" className="mt-3">
        <RichText value={s.about || ''} onChange={(html) => set('about', html)} />
      </Field>
      <div className="mt-3"><button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save site'}</button></div>
    </Card>
  );
}

/* ───────────────────────── Social ───────────────────────── */
function SocialSection({ flash }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.social.list().then(setRows).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const setRow = (id, k, v) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  const saveRow = async (r) => {
    try { await api.social.update(r.id, { platform: r.platform, url: r.url, enabled: r.enabled }); flash('Link saved'); }
    catch (e) { flash(e.message || 'Save failed'); }
  };
  const toggle = async (r) => {
    const enabled = r.enabled ? 0 : 1;
    setRow(r.id, 'enabled', enabled);
    try { await api.social.update(r.id, { platform: r.platform, url: r.url, enabled }); }
    catch (e) { flash(e.message || 'Update failed'); }
  };
  const uploadIcon = async (r, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('platform', r.platform || '');
    fd.append('url', r.url || '');
    fd.append('icon', file);
    try { await api.social.update(r.id, fd); flash('Icon updated'); load(); }
    catch (e) { flash(e.message || 'Upload failed'); }
  };
  const del = async (id) => {
    if (!confirm('Delete this link?')) return;
    try { await api.social.remove(id); flash('Link deleted'); load(); }
    catch (e) { flash(e.message || 'Delete failed'); }
  };
  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    try { await api.social.reorder(next.map((r) => r.id)); }
    catch (e) { flash(e.message || 'Reorder failed'); }
  };
  const add = async () => {
    const fd = new FormData();
    fd.append('platform', 'New Link');
    fd.append('url', 'https://');
    try { await api.social.create(fd); flash('Link added'); load(); }
    catch (e) { flash(e.message || 'Add failed'); }
  };

  if (!rows) return <Card title="Social links"><Skeleton /></Card>;

  return (
    <Card title="Social links" action={<button className="btn ghost" onClick={add}>+ Add link</button>}>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.id} className="admin-row">
            <div className="w-11 h-11 grid place-items-center rounded border border-[rgba(61,240,255,0.25)] bg-black/40 overflow-hidden shrink-0">
              {r.icon ? <img src={asset('social', r.icon)} alt="" className="w-7 h-7 object-contain" />
                : <span className="text-[10px] opacity-60">none</span>}
            </div>
            <input className="fld w-32" value={r.platform || ''} onChange={(e) => setRow(r.id, 'platform', e.target.value)} placeholder="Platform" />
            <input className="fld flex-1 min-w-[160px]" value={r.url || ''} onChange={(e) => setRow(r.id, 'url', e.target.value)} placeholder="https://" />
            <label className="btn ghost cursor-pointer">
              Icon
              <input type="file" accept="image/*" hidden onChange={(e) => uploadIcon(r, e.target.files?.[0])} />
            </label>
            <button className={`btn ${r.enabled ? '' : 'ghost'}`} onClick={() => toggle(r)}>{r.enabled ? 'On' : 'Off'}</button>
            <div className="flex flex-col">
              <button className="mini-btn" onClick={() => move(i, -1)} title="Up">▲</button>
              <button className="mini-btn" onClick={() => move(i, 1)} title="Down">▼</button>
            </div>
            <button className="btn ghost" onClick={() => saveRow(r)}>Save</button>
            <button className="btn danger" onClick={() => del(r.id)}>✕</button>
          </div>
        ))}
        {rows.length === 0 && <Empty>No links yet.</Empty>}
      </div>
    </Card>
  );
}

/* ───────────────────────── Reel ───────────────────────── */
function ReelSection({ flash }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.reel.list().then(setRows).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const setRow = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  const saveRow = async (r) => {
    try { await api.reel.update(r.id, { caption: r.caption, enabled: r.enabled }); flash('Frame saved'); }
    catch (e) { flash(e.message || 'Save failed'); }
  };
  const toggle = async (r) => {
    const enabled = r.enabled ? 0 : 1;
    setRow(r.id, 'enabled', enabled);
    try { await api.reel.update(r.id, { caption: r.caption, enabled }); }
    catch (e) { flash(e.message || 'Update failed'); }
  };
  const del = async (id) => {
    if (!confirm('Delete this frame?')) return;
    try { await api.reel.remove(id); flash('Frame deleted'); load(); }
    catch (e) { flash(e.message || 'Delete failed'); }
  };
  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    try { await api.reel.reorder(next.map((r) => r.id)); }
    catch (e) { flash(e.message || 'Reorder failed'); }
  };
  const upload = async (files) => {
    if (!files || !files.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    setBusy(true);
    try { await api.reel.upload(fd); flash(`Uploaded ${files.length} image(s)`); load(); }
    catch (e) { flash(e.message || 'Upload failed'); }
    finally { setBusy(false); }
  };

  if (!rows) return <Card title="Film reel"><Skeleton /></Card>;

  return (
    <Card
      title="Film reel"
      action={
        <label className="btn cursor-pointer">
          {busy ? 'Uploading…' : '+ Upload images'}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </label>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {rows.map((r, i) => (
          <div key={r.id} className={`reel-card ${r.enabled ? '' : 'opacity-50'}`}>
            <div className="reel-thumb">
              <img src={asset('reel', r.filename)} alt={r.caption || ''} />
            </div>
            <input className="fld mt-2 text-sm" value={r.caption || ''} placeholder="Caption"
              onChange={(e) => setRow(r.id, 'caption', e.target.value)} />
            <div className="flex items-center gap-1 mt-2">
              <button className="mini-btn" onClick={() => move(i, -1)} title="Earlier">◀</button>
              <button className="mini-btn" onClick={() => move(i, 1)} title="Later">▶</button>
              <button className={`btn ${r.enabled ? '' : 'ghost'} flex-1`} onClick={() => toggle(r)}>{r.enabled ? 'On' : 'Off'}</button>
              <button className="btn ghost" onClick={() => saveRow(r)}>Save</button>
              <button className="btn danger" onClick={() => del(r.id)}>✕</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <Empty>No images yet — upload some frames.</Empty>}
      </div>
    </Card>
  );
}

/* ───────────────────────── UI bits ───────────────────────── */
function Card({ title, action, children }) {
  return (
    <section className="holo admin-card relative">
      <span className="bracket tl" /><span className="bracket tr" />
      <span className="bracket bl" /><span className="bracket br" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-[Orbitron] tracking-wide text-white text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <div className="tag mb-1">{label}</div>
      {children}
    </div>
  );
}
function Centered({ children }) {
  return <div className="admin-login"><div className="tag animate-pulse">{children}</div></div>;
}
function Skeleton() { return <div className="h-24 rounded bg-white/5 animate-pulse" />; }
function Empty({ children }) { return <div className="text-sm opacity-50 py-4">{children}</div>; }

/* A minimal rich-text editor (contentEditable) that emits HTML. Kept
   uncontrolled so the caret stays put; the parent reads HTML on each input. */
function RichText({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && value != null) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, arg) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? '');
  };
  const addLink = () => {
    const url = prompt('Link URL:', 'https://');
    if (url) exec('createLink', url);
  };

  return (
    <div>
      <div className="rt-toolbar">
        <button type="button" className="mini-btn" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><b>B</b></button>
        <button type="button" className="mini-btn" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><i>I</i></button>
        <button type="button" className="mini-btn" title="Add link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>Link</button>
        <button type="button" className="mini-btn" title="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('unlink')}>Unlink</button>
        <button type="button" className="mini-btn" title="Paragraph" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', 'p')}>¶</button>
      </div>
      <div
        ref={ref}
        className="rt-editor fld"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
      />
    </div>
  );
}
