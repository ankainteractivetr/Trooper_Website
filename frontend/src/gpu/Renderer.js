// Renderer.js
// WebGPU orchestrator — now renders ONLY the procedural space background and the
// rotating film reel. The title is a normal HTML <h1> (handled in React/CSS),
// which makes its placement and alignment trivial. No three.js — raw WebGPU.

import { mat4 } from './math.js';
import { BACKGROUND_WGSL, REEL_WGSL } from './shaders.js';
import { FilmReel } from './FilmReel.js';

// ── Scene composition constants (safe to tweak) ──────────────────────────
const FOV = (42 * Math.PI) / 180;
const NEAR = 0.1;
const FAR = 100;

// Desktop: reel sits in the LEFT half (right half is the HTML bio panel).
// Its right edge roughly lines up with the title's first apostrophe.
const REEL_POS_X = -3.4;
const REEL_POS_Y = 0.3;
const REEL_SPIN = -0.28;            // radians / second (negative = reversed)

const CAM_TARGET = [0.0, 0.35, 0.0];
const CAM_EYE = [0.0, 0.7, 11.0];

// Reel half-height — MUST stay in sync with HALF_H in FilmReel.js.
const REEL_HALF_H = 1.35;

// Stacked (mobile/tablet) framing: how much of the in-flow stage the centred
// reel should fill. The camera is dollied to satisfy these regardless of the
// canvas aspect ratio, so the reel is as wide as the bio panel below it.
const STACK_FILL_W = 0.94;   // fraction of stage WIDTH the reel may span
const STACK_FILL_H = 0.86;   // fraction of stage HEIGHT the reel may span
const STACK_MIN_DIST = 6.2;  // never dolly closer than this (avoids fish-eye)

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return [1.0, 0.176, 0.176];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

export class Renderer {
  constructor() {
    this.canvas = null;
    this.device = null;
    this.context = null;
    this.format = null;
    this.depthTexture = null;

    this.globals = new Float32Array(44); // view16 proj16 camPos4 time4 accent4
    this.proj = mat4.create();
    this.view = mat4.create();
    this.accent = hexToRgb('#ff2d2d');

    this.reel = null;

    this._raf = 0;
    this._start = 0;
    this._ro = null;
    this._running = false;
    this._tmpA = mat4.create();
    this._tmpB = mat4.create();
    this._model = mat4.create();

    this.layout = 'desktop';      // 'desktop' = reel left | 'stacked' = reel centred + framed
    this.onFirstFrame = null;     // fired once, right after the first frame is painted
    this._firstFrameDone = false;
  }

  async init(canvas) {
    if (!navigator.gpu) throw new Error('webgpu-unsupported');
    this.canvas = canvas;

    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('webgpu-unsupported');
    this.device = await adapter.requestDevice();
    this.device.lost.then((info) => console.error('[Renderer] device lost:', info.message));

    this.context = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

    this._resize();
    this._buildPipelines();

    this.reel = new FilmReel(this.device);

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.depthTexture) return;

    this.canvas.width = w;
    this.canvas.height = h;

    this.depthTexture?.destroy?.();
    this.depthTexture = this.device.createTexture({
      size: [w, h],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    mat4.perspective(this.proj, FOV, w / h, NEAR, FAR);
  }

  _module(code) {
    return this.device.createShaderModule({ code });
  }

  _buildPipelines() {
    const dev = this.device;
    const fmt = this.format;

    const depthOnTop = { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' };
    const depthTest = { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' };

    // Background — fullscreen, no vertex buffers.
    const bgMod = this._module(BACKGROUND_WGSL);
    this.bgPipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: { module: bgMod, entryPoint: 'vs' },
      fragment: { module: bgMod, entryPoint: 'fs', targets: [{ format: fmt }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: depthOnTop,
    });

    // Reel — depth-tested, opaque.
    const reelMod = this._module(REEL_WGSL);
    this.reelPipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: reelMod,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: 36,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x2' },
            { shaderLocation: 3, offset: 32, format: 'float32' },
          ],
        }],
      },
      fragment: { module: reelMod, entryPoint: 'fs', targets: [{ format: fmt }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: depthTest,
    });

    this.globalsBuffer = dev.createBuffer({
      size: this.globals.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const g = (pipeline) => dev.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.globalsBuffer } }],
    });
    this.bgGlobals = g(this.bgPipeline);
    this.reelGlobals = g(this.reelPipeline);
  }

  async setContent(content) {
    this.accent = hexToRgb(content?.accent);
    const urls = (content?.reel || []).map((r) => r.url).filter(Boolean);

    await this.reel.build(urls);

    if (this.reel.ready) {
      this.reelBind = this.device.createBindGroup({
        layout: this.reelPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: this.reel.uBuffer } },
          { binding: 1, resource: this.reel.sampler },
          { binding: 2, resource: this.reel.textureView },
        ],
      });
    }
  }

  // Layout mode is driven by the React layer (media query): 'desktop' keeps the
  // reel in the left half (HTML panel on the right); 'stacked' centres it.
  setLayout(mode) {
    this.layout = mode === 'stacked' ? 'stacked' : 'desktop';
  }

  // Camera distance that frames the centred reel to fill the stacked stage at
  // ANY aspect: fill by width, but back off if that would clip it vertically.
  _stackedDistance(aspect) {
    const tanHalf = Math.tan(FOV / 2);
    const a = Math.max(aspect, 0.0001);
    const radius = this.reel?.radius || 2.3;
    const dWidth = radius / (STACK_FILL_W * tanHalf * a);
    const dHeight = REEL_HALF_H / (STACK_FILL_H * tanHalf);
    return Math.max(dWidth, dHeight, STACK_MIN_DIST);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._start = performance.now();
    const loop = () => {
      if (!this._running) return;
      this._frame((performance.now() - this._start) / 1000);
      if (!this._firstFrameDone) {
        this._firstFrameDone = true;
        try { this.onFirstFrame?.(); } catch { /* ignore */ }
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _frame(t) {
    const dev = this.device;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const aspect = w / h;
    const stacked = this.layout === 'stacked';

    // Reel framing & camera dolly:
    //  • desktop → reel in the LEFT half, fixed dolly (right half = HTML panel)
    //  • stacked → reel CENTRED and dollied to fill the stage at any aspect,
    //              so it spans the same width as the bio panel beneath it.
    let eyeZ;
    let reelX;
    if (stacked) {
      eyeZ = this._stackedDistance(aspect) + Math.cos(t * 0.13) * 0.12;
      reelX = 0;
    } else {
      // Only nudges back on unusually narrow desktop windows; 0 at normal widths.
      const distBoost = aspect < 1.4 ? Math.max(0, (1.4 - aspect) * 2.4) : 0;
      eyeZ = CAM_EYE[2] + distBoost + Math.cos(t * 0.13) * 0.2;
      reelX = REEL_POS_X;
    }

    const eye = [0, CAM_EYE[1] + Math.sin(t * 0.2) * 0.12, eyeZ];
    mat4.lookAt(this.view, eye, CAM_TARGET, [0, 1, 0]);

    this.globals.set(this.view, 0);
    this.globals.set(this.proj, 16);
    this.globals[32] = eye[0]; this.globals[33] = eye[1]; this.globals[34] = eye[2]; this.globals[35] = 0;
    this.globals[36] = t; this.globals[37] = aspect; this.globals[38] = w; this.globals[39] = h;
    this.globals[40] = this.accent[0]; this.globals[41] = this.accent[1];
    this.globals[42] = this.accent[2]; this.globals[43] = 1;
    dev.queue.writeBuffer(this.globalsBuffer, 0, this.globals);

    if (this.reel.ready) {
      mat4.rotationY(this._tmpA, t * REEL_SPIN);
      mat4.translation(this._tmpB, reelX, REEL_POS_Y, 0);
      mat4.multiply(this._model, this._tmpB, this._tmpA);
      this.reel.setModel(this._model);
    }

    const encoder = dev.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.01, g: 0.012, b: 0.025, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setPipeline(this.bgPipeline);
    pass.setBindGroup(0, this.bgGlobals);
    pass.draw(3);

    if (this.reel.ready && this.reelBind) {
      pass.setPipeline(this.reelPipeline);
      pass.setBindGroup(0, this.reelGlobals);
      pass.setBindGroup(1, this.reelBind);
      pass.setVertexBuffer(0, this.reel.vertexBuffer);
      pass.setIndexBuffer(this.reel.indexBuffer, 'uint32');
      pass.drawIndexed(this.reel.indexCount);
    }

    pass.end();
    dev.queue.submit([encoder.finish()]);
  }

  destroy() {
    this.stop();
    this._ro?.disconnect?.();
    this._ro = null;
    this.depthTexture?.destroy?.();
    this.reel?.texture?.destroy?.();
    this.reel?.vertexBuffer?.destroy?.();
    this.reel?.indexBuffer?.destroy?.();
    this.device?.destroy?.();
    this.device = null;
  }
}