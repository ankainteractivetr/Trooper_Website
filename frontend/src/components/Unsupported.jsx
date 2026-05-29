import { useState } from 'react';

export default function Unsupported() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="unsupported-banner pointer-events-auto">
      <div className="holo px-4 py-3 flex items-center gap-3">
        <span className="tag">// 2d mode</span>
        <p className="text-[12.5px] opacity-85 m-0">
          This browser doesn’t support WebGPU, so the full 3D scene is disabled.
          For the real experience, open in <strong>Chrome</strong> or{' '}
          <strong>Edge 113+</strong>.
        </p>
        <button className="btn ghost ml-1" onClick={() => setOpen(false)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
