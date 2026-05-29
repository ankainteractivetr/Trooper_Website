// shaders.js
// All WGSL shader source for the scene, kept as template-literal strings so we
// can build pipelines without any external loader.
//
// Shared "Globals" uniform (bind group 0, binding 0) — 176 bytes / Float32Array(44):
//   view    : mat4x4<f32>   // floats  0..15
//   proj    : mat4x4<f32>   // floats 16..31
//   camPos  : vec4<f32>     // floats 32..35  (xyz = camera world pos)
//   time    : vec4<f32>     // floats 36..39  (x=seconds, y=aspect, z=resW, w=resH)
//   accent  : vec4<f32>     // floats 40..43  (rgb = theme accent, linearised-ish)
//
// NOTE: the whole pipeline runs in GAMMA space using non-srgb texture/canvas
// formats, so shaders output colour values straight to the swap-chain.

const GLOBALS = /* wgsl */ `
struct Globals {
  view   : mat4x4<f32>,
  proj   : mat4x4<f32>,
  camPos : vec4<f32>,
  time   : vec4<f32>,
  accent : vec4<f32>,
};
@group(0) @binding(0) var<uniform> G : Globals;
`;

// ── Background: a single full-screen triangle with a procedural starfield + nebula.
export const BACKGROUND_WGSL = /* wgsl */ `
${GLOBALS}

struct VOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid : u32) -> VOut {
  // Oversized triangle covering the screen. z = 1.0 -> far plane.
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 3.0,  1.0),
  );
  var o : VOut;
  let xy = p[vid];
  o.pos = vec4<f32>(xy, 1.0, 1.0);
  o.uv = xy * 0.5 + vec2<f32>(0.5, 0.5);
  return o;
}

fn hash21(p : vec2<f32>) -> f32 {
  var h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn vnoise(p : vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = hash21(i);
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p0 : vec2<f32>) -> f32 {
  var p = p0;
  var v = 0.0;
  var amp = 0.5;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + amp * vnoise(p);
    p = p * 2.02 + vec2<f32>(11.3, 7.7);
    amp = amp * 0.5;
  }
  return v;
}

fn starLayer(uv : vec2<f32>, scale : f32, thresh : f32, tw : f32) -> f32 {
  let g = uv * scale;
  let cell = floor(g);
  let r = hash21(cell);
  if (r < thresh) {
    let fpos = fract(g) - 0.5;
    let d = length(fpos);
    let core = smoothstep(0.06, 0.0, d);
    let flicker = 0.6 + 0.4 * sin(G.time.x * (1.5 + r * 4.0) + r * 28.0);
    return core * mix(1.0, flicker, tw);
  }
  return 0.0;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  let res = max(G.time.zw, vec2<f32>(1.0, 1.0));
  let aspect = res.x / res.y;
  var uv = in.uv;
  uv.x = uv.x * aspect;

  // Deep space base gradient (slightly blue-black, darker toward edges).
  let bg = mix(vec3<f32>(0.012, 0.018, 0.035),
               vec3<f32>(0.004, 0.006, 0.014),
               clamp(in.uv.y, 0.0, 1.0));

  // Slow-drifting nebula tinted with the accent + a cyan counter-tone.
  let drift = vec2<f32>(G.time.x * 0.012, G.time.x * -0.008);
  let n = fbm(uv * 2.3 + drift);
  let n2 = fbm(uv * 4.7 - drift * 1.7);
  let neb = pow(clamp(n * 0.8 + n2 * 0.35, 0.0, 1.0), 2.2);
  let cyan = vec3<f32>(0.10, 0.55, 0.75);
  let nebColor = mix(G.accent.rgb * 0.7, cyan, n2) * neb * 0.5;

  // Three star layers at increasing density / decreasing size.
  var stars = 0.0;
  stars = stars + starLayer(in.uv, 90.0, 0.030, 1.0) * 1.0;
  stars = stars + starLayer(in.uv + 3.1, 150.0, 0.020, 1.0) * 0.7;
  stars = stars + starLayer(in.uv + 7.7, 250.0, 0.012, 0.7) * 0.5;

  let starCol = vec3<f32>(0.85, 0.92, 1.0) * stars;

  var col = bg + nebColor + starCol;

  // Vignette to keep focus toward the centre/content.
  let c = in.uv - vec2<f32>(0.5, 0.5);
  let vig = smoothstep(0.95, 0.35, length(c));
  col = col * mix(0.55, 1.0, vig);

  return vec4<f32>(col, 1.0);
}
`;

// ── Film reel: image quads laid out on a rotating cylinder, with a procedural
//    perforated film border and cinematic lighting.
export const REEL_WGSL = /* wgsl */ `
${GLOBALS}

struct ReelU {
  model  : mat4x4<f32>,
  params : vec4<f32>,   // x = frameCount, y = borderFrac, z = gloss, w = unused
};
@group(1) @binding(0) var<uniform> R : ReelU;
@group(1) @binding(1) var samp : sampler;
@group(1) @binding(2) var tex  : texture_2d_array<f32>;

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) uv     : vec2<f32>,
  @location(1) layer  : f32,
  @location(2) nrm    : vec3<f32>,
  @location(3) wpos   : vec3<f32>,
};

@vertex
fn vs(
  @location(0) pos   : vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv    : vec2<f32>,
  @location(3) layer : f32,
) -> VOut {
  var o : VOut;
  let world = R.model * vec4<f32>(pos, 1.0);
  o.clip = G.proj * G.view * world;
  o.uv = uv;
  o.layer = layer;
  // model has no non-uniform scale, so using its upper 3x3 on the normal is fine.
  o.nrm = normalize((R.model * vec4<f32>(normal, 0.0)).xyz);
  o.wpos = world.xyz;
  return o;
}

fn sprockets(uv : vec2<f32>, vBorder : f32) -> f32 {
  // Returns ~1 inside a sprocket hole, ~0 elsewhere. Holes sit in the top and
  // bottom film bands and repeat evenly along the strip direction (u).
  let rep = 0.09;
  let cu = (fract(uv.x / rep + 0.5) - 0.5) * rep;   // signed distance to hole centre (u)
  let topC = vBorder * 0.5;
  let botC = 1.0 - vBorder * 0.5;
  let dTop = uv.y - topC;
  let dBot = uv.y - botC;
  var cv = dBot;
  if (abs(dTop) < abs(dBot)) { cv = dTop; }
  let d = length(vec2<f32>(cu, cv * 1.15));
  let r = vBorder * 0.30;
  return smoothstep(r, r * 0.6, d);                  // 1 inside hole, 0 outside
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  let vBorder = R.params.y;          // top/bottom film-band thickness
  let uInset = vBorder * 0.35;       // thin separator between adjacent frames
  let u = in.uv.x;
  let v = in.uv.y;

  var base : vec3<f32>;

  let inImage = v > vBorder && v < (1.0 - vBorder) && u > uInset && u < (1.0 - uInset);

  if (inImage) {
    // Remap the inner region to 0..1 and sample the correct array layer.
    let iu = (u - uInset) / (1.0 - 2.0 * uInset);
    let iv = (v - vBorder) / (1.0 - 2.0 * vBorder);
    let li = i32(in.layer + 0.5);
    // textureSampleLevel (not textureSample) -> safe in non-uniform control flow.
    let img = textureSampleLevel(tex, samp, vec2<f32>(iu, iv), li, 0.0);
    base = img.rgb;

    // Glowing accent seam just inside the image edge.
    let edge = min(min(iu, 1.0 - iu), min(iv, 1.0 - iv));
    let seam = smoothstep(0.025, 0.0, edge);
    base = base + G.accent.rgb * seam * 0.7;
  } else {
    // Film stock: dark band with bright sprocket holes along top & bottom.
    let filmCol = vec3<f32>(0.045, 0.05, 0.065);
    let hole = sprockets(in.uv, vBorder);
    base = mix(filmCol, vec3<f32>(0.72, 0.80, 0.92), hole * 0.85);
  }

  // Lighting — a single key light + cyan fresnel rim for the sci-fi look.
  let L = normalize(vec3<f32>(0.4, 0.7, 0.6));
  let N = normalize(in.nrm);
  let diff = clamp(dot(N, L), 0.0, 1.0);
  let V = normalize(G.camPos.xyz - in.wpos);
  let fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);

  var col = base * (0.45 + 0.65 * diff);
  col = col + vec3<f32>(0.20, 0.65, 0.85) * fres * 0.7; // cyan rim

  // Gentle cinematic vignette per-frame based on distance from frame centre.
  let cc = in.uv - vec2<f32>(0.5, 0.5);
  let vig = smoothstep(0.85, 0.25, length(cc));
  col = col * mix(0.8, 1.0, vig);

  return vec4<f32>(col, 1.0);
}
`;

// ── Title: layered/extruded 3D text. Front layer is the lit, glowing face,
//    the stacked back layers form the extrusion side in the accent colour.
export const TITLE_WGSL = /* wgsl */ `
${GLOBALS}

struct TitleU {
  model      : mat4x4<f32>,
  colorFront : vec4<f32>,
  colorEdge  : vec4<f32>,
};
@group(1) @binding(0) var<uniform> T : TitleU;
@group(1) @binding(1) var samp : sampler;
@group(1) @binding(2) var tex  : texture_2d<f32>;

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) uv    : vec2<f32>,
  @location(1) shade : f32,
  @location(2) emis  : f32,
};

@vertex
fn vs(
  @location(0) pos  : vec3<f32>,
  @location(1) uv   : vec2<f32>,
  @location(2) shade: f32,
  @location(3) emis : f32,
) -> VOut {
  var o : VOut;
  o.clip = G.proj * G.view * T.model * vec4<f32>(pos, 1.0);
  o.uv = uv;
  o.shade = shade;
  o.emis = emis;
  return o;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  // Same texture sampled on every layer; alpha defines the glyph shape.
  let s = textureSampleLevel(tex, samp, in.uv, 0.0);
  let a = s.a;
  if (a < 0.01) { discard; }

  if (in.emis > 0.5) {
    // Front face: bright white core with an accent-tinted glow.
    let core = s.rgb;
    let glow = T.colorFront.rgb;
    let col = core + glow * 0.35;
    return vec4<f32>(col, a);
  }

  // Extrusion side layers: accent edge colour, darkened by per-layer shade.
  let col = T.colorEdge.rgb * in.shade;
  return vec4<f32>(col, a);
}
`;
