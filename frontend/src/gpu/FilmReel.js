// FilmReel.js
// Builds the rotating "film roll": a vertical cylinder whose outward faces are
// the uploaded images, wrapped like a strip of film. Each image becomes one
// layer of a texture_2d_array; each frame on the cylinder samples its own layer.
//
// The mesh is rebuilt whenever the image set changes (build()). Geometry is
// centred on the origin with its axis along +Y; the Renderer positions/rotates
// it via the per-object model matrix.

import { loadImageBitmap, coverDrawToCanvas } from './textures.js';

// ── Tunable geometry constants (safe to tweak) ───────────────────────────
const RADIUS = 2.30;            // cylinder radius
const HALF_H = 1.35;            // half the strip height (full height = 2 * HALF_H)
const SEGMENTS_PER_FRAME = 16;  // arc subdivisions per frame (higher = smoother curve)
const V_BORDER = 0.10;          // top/bottom film-band fraction — MUST match shader params.y
const U_INSET = V_BORDER * 0.35;
const TEX_BASE = 512;           // base texture resolution per layer

export class FilmReel {
  constructor(device) {
    this.device = device;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.indexCount = 0;
    this.frameCount = 0;
    this.texture = null;
    this.textureView = null;
    this.sampler = null;

    // ReelU uniform: model(16) + params(4) = 80 bytes / Float32Array(20)
    this.uData = new Float32Array(20);
    this.uBuffer = device.createBuffer({
      size: this.uData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.radius = RADIUS;
  }

  get ready() {
    return this.frameCount > 0 && this.vertexBuffer && this.textureView;
  }

  // (Re)build mesh + texture array from a list of image URLs.
  async build(urls) {
    const device = this.device;
    const N = urls.length;
    if (N === 0) {
      this.frameCount = 0;
      return;
    }

    // ── Geometry ──────────────────────────────────────────────
    const S = SEGMENTS_PER_FRAME;
    const delta = (Math.PI * 2) / N;
    const floatsPerVert = 9; // pos3 + normal3 + uv2 + layer1
    const vertsPerFrame = (S + 1) * 2;
    const verts = new Float32Array(N * vertsPerFrame * floatsPerVert);
    const indices = new Uint32Array(N * S * 6);

    let vp = 0;
    let ip = 0;
    for (let f = 0; f < N; f++) {
      const theta0 = f * delta;
      const base = f * vertsPerFrame;

      for (let row = 0; row < 2; row++) {
        const y = row === 0 ? -HALF_H : HALF_H;
        // Flip V: WebGPU texel (0,0) is top-left, so the TOP row must map to v=0
        // (otherwise the photos render upside-down).
        const v = 1 - row;
        for (let col = 0; col <= S; col++) {
          const t = col / S;
          const theta = theta0 + t * delta;
          const sx = Math.sin(theta);
          const cz = Math.cos(theta);
          verts[vp++] = RADIUS * sx; // x
          verts[vp++] = y;           // y
          verts[vp++] = RADIUS * cz; // z
          verts[vp++] = sx;          // nx
          verts[vp++] = 0;           // ny
          verts[vp++] = cz;          // nz
          verts[vp++] = t;           // u
          verts[vp++] = v;           // v
          verts[vp++] = f;           // layer
        }
      }

      for (let col = 0; col < S; col++) {
        const bl = base + 0 * (S + 1) + col;
        const br = base + 0 * (S + 1) + col + 1;
        const tl = base + 1 * (S + 1) + col;
        const tr = base + 1 * (S + 1) + col + 1;
        indices[ip++] = bl; indices[ip++] = br; indices[ip++] = tr;
        indices[ip++] = bl; indices[ip++] = tr; indices[ip++] = tl;
      }
    }

    // Replace old buffers.
    this.vertexBuffer?.destroy?.();
    this.indexBuffer?.destroy?.();

    this.vertexBuffer = device.createBuffer({
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, verts);

    this.indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.indexBuffer, 0, indices);

    this.indexCount = indices.length;
    this.frameCount = N;

    // ── Texture array ─────────────────────────────────────────
    // Pick a per-layer size matching the visible inner-image aspect so photos
    // are not stretched. All layers must share one size.
    const innerW = RADIUS * delta * (1 - 2 * U_INSET);
    const innerH = 2 * HALF_H * (1 - 2 * V_BORDER);
    const aspect = innerW / innerH;
    let texW, texH;
    if (aspect >= 1) {
      texW = TEX_BASE;
      texH = Math.max(128, Math.round(TEX_BASE / aspect));
    } else {
      texH = TEX_BASE;
      texW = Math.max(128, Math.round(TEX_BASE * aspect));
    }

    this.texture?.destroy?.();
    this.texture = device.createTexture({
      size: [texW, texH, N],
      format: 'rgba8unorm', // non-srgb: keep the whole pipeline in gamma space
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Upload each image into its layer. Failures fall back to a neutral fill so
    // one broken URL doesn't blank the whole reel.
    for (let i = 0; i < N; i++) {
      let canvas;
      try {
        const bmp = await loadImageBitmap(urls[i]);
        canvas = coverDrawToCanvas(bmp, texW, texH);
        bmp.close?.();
      } catch (err) {
        console.warn('[FilmReel] image failed, using placeholder:', urls[i], err);
        canvas = document.createElement('canvas');
        canvas.width = texW; canvas.height = texH;
        const c = canvas.getContext('2d');
        c.fillStyle = '#11161f';
        c.fillRect(0, 0, texW, texH);
        c.fillStyle = '#3df0ff';
        c.font = `${Math.round(texH * 0.1)}px monospace`;
        c.textAlign = 'center';
        c.fillText('NO SIGNAL', texW / 2, texH / 2);
      }
      device.queue.copyExternalImageToTexture(
        { source: canvas, flipY: false },
        { texture: this.texture, origin: [0, 0, i], premultipliedAlpha: false },
        [texW, texH, 1]
      );
    }

    this.textureView = this.texture.createView({ dimension: '2d-array' });

    // Static uniform params (model is written per-frame by the Renderer).
    this.uData[16] = N;        // frameCount
    this.uData[17] = V_BORDER; // borderFrac
    this.uData[18] = 0.5;      // gloss (reserved)
    this.uData[19] = 0.0;
  }

  // Write the model matrix into the uniform and flush params to the GPU.
  setModel(model) {
    this.uData.set(model, 0);
    this.device.queue.writeBuffer(this.uBuffer, 0, this.uData);
  }
}