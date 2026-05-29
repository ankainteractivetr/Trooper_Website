import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Renderer } from '../gpu/Renderer.js';
import HologramPanel from './HologramPanel.jsx';
import SocialBar from './SocialBar.jsx';
import Unsupported from './Unsupported.jsx';

export default function Home() {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | unsupported | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    let renderer = null;

    (async () => {
      let data;
      try {
        data = await api.content();
      } catch (e) {
        if (!cancelled) { setStatus('error'); setErrorMsg(e.message || 'Failed to load content'); }
        return;
      }
      if (cancelled) return;
      setContent(data);
      if (data?.accent) document.documentElement.style.setProperty('--accent', data.accent);

      try {
        renderer = new Renderer();
        rendererRef.current = renderer;
        await renderer.init(canvasRef.current);
        await renderer.setContent(data);
        if (cancelled) { renderer.destroy(); return; }
        renderer.start();
        setStatus('ready');
      } catch (e) {
        console.warn('[Home] WebGPU init failed:', e);
        rendererRef.current = null;
        try { renderer?.destroy(); } catch { /* ignore */ }
        renderer = null;
        if (!cancelled) setStatus('unsupported');
      }
    })();

    return () => {
      cancelled = true;
      try { rendererRef.current?.destroy(); } catch { /* ignore */ }
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className="page">
      {/* Title — a real <h1>, perfectly centred and aligned via CSS */}
      <h1 className="site-title">{content?.title || "Caner 'Trooper' Kurt"}</h1>

      {/* The reel "stage": live WebGPU canvas, or a 2D fallback */}
      {status === 'unsupported'
        ? <FallbackReel content={content} />
        : <canvas ref={canvasRef} className="scene-canvas" />}

      {content && <HologramPanel content={content} />}
      {content && <SocialBar social={content.social} />}

      {status === 'unsupported' && <Unsupported />}

      {status === 'error' && (
        <div className="state-overlay">
          <div className="holo p-6 max-w-md pointer-events-auto">
            <div className="tag mb-2">// connection error</div>
            <p className="text-sm opacity-80">
              Couldn’t reach the backend. Make sure the API server is running, then refresh.
            </p>
            {errorMsg && <p className="mt-2 text-xs opacity-50 font-mono">{errorMsg}</p>}
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="state-overlay">
          <div className="tag animate-pulse">// initializing renderer …</div>
        </div>
      )}
    </div>
  );
}

// 2D reel for browsers without WebGPU. Occupies the same stage slot as the canvas.
function FallbackReel({ content }) {
  const reel = content?.reel || [];
  return (
    <div className="scene-canvas fallback-stage">
      <div className="film-fallback">
        {reel.map((r) => (
          <div className="film-cell" key={r.id}>
            <img src={r.url} alt={r.caption || ''} />
          </div>
        ))}
      </div>
    </div>
  );
}
