// TitleText.js
// Builds the true-3D site title ("Caner 'Trooper' Kurt"). The glyphs are drawn
// once to a 2D canvas (crisp white core + neon accent glow), uploaded as a
// texture, then mapped onto a stack of quads offset along -Z to fake extrusion.
// The front quad is the lit, glowing face; the layers behind form the side wall
// in the accent colour, darkening with depth.

const CANVAS_W = 2048;
const CANVAS_H = 512;

// ── Tunable constants (safe to tweak) ────────────────────────────────────
const QUAD_H = 0.92;                 // world height of the title
const QUAD_W = QUAD_H * (CANVAS_W / CANVAS_H); // keep the 4:1 canvas aspect
const LAYERS_BACK = 16;              // extrusion depth in layers
const LAYER_STEP = 0.035;            // z spacing between layers

export class TitleText {
  constructor(device) {
    this.device = device;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.indexCount = 0;
    this.texture = null;
    this.textureView = null;

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // TitleU uniform: model(16) + colorFront(4) + colorEdge(4) = 96 bytes / F32(24)
    this.uData = new Float32Array(24);
    this.uBuffer = device.createBuffer({
      size: this.uData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.halfW = QUAD_W / 2;
    this.halfH = QUAD_H / 2;
  }

  get ready() {
    return !!this.vertexBuffer && !!this.textureView;
  }

  async build(text, accentCss = '#ff2d2d') {
    const device = this.device;
    const label = text && text.trim() ? text : "Caner 'Trooper' Kurt";

    // ── Draw the glyphs to a canvas ───────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    // Make sure Orbitron is actually loaded before measuring/drawing.
    try {
      await document.fonts.load(`900 120px "Orbitron"`);
      await document.fonts.ready;
    } catch { /* fall back to default font silently */ }

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '6px'; } catch { /* not supported everywhere */ }

    const maxW = CANVAS_W * 0.92;
    let size = 260;
    const setFont = (s) => { ctx.font = `900 ${s}px "Orbitron", system-ui, sans-serif`; };
    setFont(size);
    while (ctx.measureText(label).width > maxW && size > 24) {
      size -= 4;
      setFont(size);
    }

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    // Soft accent glow (multiple passes build up intensity).
    ctx.fillStyle = accentCss;
    ctx.shadowColor = accentCss;
    ctx.shadowBlur = 42;
    ctx.fillText(label, cx, cy);
    ctx.shadowBlur = 26;
    ctx.fillText(label, cx, cy);

    // Crisp white core on top.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, cy);

    // Thin accent underline for a HUD feel.
    ctx.strokeStyle = accentCss;
    ctx.lineWidth = 4;
    ctx.shadowColor = accentCss;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    const ulW = Math.min(maxW, ctx.measureText(label).width + 40);
    ctx.moveTo(cx - ulW / 2, cy + size * 0.62);
    ctx.lineTo(cx + ulW / 2, cy + size * 0.62);
    ctx.stroke();

    // ── Upload texture (non-srgb, straight alpha) ─────────────
    this.texture?.destroy?.();
    this.texture = device.createTexture({
      size: [CANVAS_W, CANVAS_H, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: canvas, flipY: false },
      { texture: this.texture, premultipliedAlpha: false },
      [CANVAS_W, CANVAS_H, 1]
    );
    this.textureView = this.texture.createView();

    // ── Build the layered quad stack (back -> front) ──────────
    const hw = this.halfW;
    const hh = this.halfH;
    const floatsPerVert = 7; // pos3 + uv2 + shade1 + emis1
    const layers = LAYERS_BACK + 1;
    const verts = new Float32Array(layers * 4 * floatsPerVert);
    const indices = new Uint32Array(layers * 6);

    let vp = 0;
    let ip = 0;
    let quad = 0;

    const pushQuad = (z, shade, emis) => {
      const baseV = quad * 4;
      // top-left, top-right, bottom-right, bottom-left
      // v=0 at the top (canvas row 0), v=1 at the bottom.
      const corners = [
        [-hw,  hh, z, 0, 0],
        [ hw,  hh, z, 1, 0],
        [ hw, -hh, z, 1, 1],
        [-hw, -hh, z, 0, 1],
      ];
      for (const [x, y, zz, u, v] of corners) {
        verts[vp++] = x; verts[vp++] = y; verts[vp++] = zz;
        verts[vp++] = u; verts[vp++] = v;
        verts[vp++] = shade; verts[vp++] = emis;
      }
      indices[ip++] = baseV + 0; indices[ip++] = baseV + 1; indices[ip++] = baseV + 2;
      indices[ip++] = baseV + 0; indices[ip++] = baseV + 2; indices[ip++] = baseV + 3;
      quad++;
    };

    // Deepest layer first so painter-ordered alpha blending composites correctly.
    for (let k = LAYERS_BACK; k >= 1; k--) {
      const z = -k * LAYER_STEP;
      const tline = (LAYERS_BACK - k) / Math.max(1, LAYERS_BACK - 1); // 0 deep .. 1 near
      const shade = 0.22 + 0.55 * tline; // darker at the back
      pushQuad(z, shade, 0.0);
    }
    // Front face last.
    pushQuad(0.0, 1.0, 1.0);

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
  }

  setModelAndColors(model, frontRGB, edgeRGB) {
    this.uData.set(model, 0);
    this.uData[16] = frontRGB[0]; this.uData[17] = frontRGB[1];
    this.uData[18] = frontRGB[2]; this.uData[19] = 1.0;
    this.uData[20] = edgeRGB[0]; this.uData[21] = edgeRGB[1];
    this.uData[22] = edgeRGB[2]; this.uData[23] = 1.0;
    this.device.queue.writeBuffer(this.uBuffer, 0, this.uData);
  }
}
