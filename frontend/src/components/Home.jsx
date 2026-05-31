import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Renderer } from '../gpu/Renderer.js';
import HologramPanel from './HologramPanel.jsx';
import SocialBar from './SocialBar.jsx';
import Unsupported from './Unsupported.jsx';

// Matches the CSS breakpoint in index.css (stacked, scrollable layout).
const STACK_QUERY = '(max-width: 880px)';
const isStacked = () =>
  typeof window !== 'undefined' && window.matchMedia(STACK_QUERY).matches;

export default function Home() {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | unsupported | error
  const [errorMsg, setErrorMsg] = useState('');
  const [revealUI, setRevealUI] = useState(false); // HUD shows only after the reel is painted

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

        // Frame the reel for the current layout, then start the render loop.
        renderer.setLayout(isStacked() ? 'stacked' : 'desktop');
        renderer.start();
        setStatus('ready');

        // Renderer is fully initialized now (canvas + textures + reel built and
        // the loop running → the reel paints on the very next frame). Reveal the
        // HUD immediately so the bio panel and the reel come up together.
        setRevealUI(true);
      } catch (e) {
        console.warn('[Home] WebGPU init failed:', e);
        rendererRef.current = null;
        try { renderer?.destroy(); } catch { /* ignore */ }
        renderer = null;
        if (!cancelled) {
          // 2D fallback reel + HUD appear together.
          setStatus('unsupported');
          setRevealUI(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { rendererRef.current?.destroy(); } catch { /* ignore */ }
      rendererRef.current = null;
    };
  }, []);

  // Keep the renderer's reel framing in sync with the CSS layout breakpoint
  // (desktop ⇄ stacked) on resize / orientation change.
  useEffect(() => {
    const mq = window.matchMedia(STACK_QUERY);
    const apply = () => rendererRef.current?.setLayout(mq.matches ? 'stacked' : 'desktop');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="page">
      {/* Title — a real <h1>, perfectly centred and aligned via CSS */}
      <h1 className="site-title">{content?.title || "Caner 'Trooper' Kurt"}</h1>

      {/* The reel "stage": live WebGPU canvas, or a 2D fallback */}
      {status === 'unsupported'
        ? <FallbackReel content={content} />
        : <canvas ref={canvasRef} className="scene-canvas" />}

      {content && revealUI && <HologramPanel content={content} />}
      {content && revealUI && <SocialBar social={content.social} />}

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
// Photos are listed last → first (reverse of the stored order).
function FallbackReel({ content }) {
  const reel = content?.reel || [];
  return (
    <div className="scene-canvas fallback-stage">
      <div className="film-fallback">
        {reel.slice().reverse().map((r) => (
          <div className="film-cell" key={r.id}>
            <img src={r.url} alt={r.caption || ''} />
          </div>
        ))}
      </div>
    </div>
  );
}