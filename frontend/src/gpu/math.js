// math.js
// A tiny, dependency-free linear-algebra kit for WebGPU.
// Matrices are COLUMN-MAJOR (matches WGSL `mat4x4<f32>` memory layout) and
// stored as flat Float32Array(16). Vectors are plain [x, y, z] arrays.
//
// IMPORTANT for WebGPU: clip-space Z is [0, 1] (not [-1, 1] like WebGL/OpenGL).
// `perspective()` below therefore uses the zero-to-one depth convention.

export const mat4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    return m;
  },

  identity(out) {
    out.fill(0);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  },

  clone(a) {
    return new Float32Array(a);
  },

  // out = a * b   (column-major, so this applies b first then a)
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4 + 0];
      const b1 = b[i * 4 + 1];
      const b2 = b[i * 4 + 2];
      const b3 = b[i * 4 + 3];
      out[i * 4 + 0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  },

  // Right-handed perspective with depth range [0, 1] (WebGPU / D3D / Metal style).
  // Mirrors gl-matrix `perspectiveZO`.
  perspective(out, fovYRadians, aspect, near, far) {
    const f = 1.0 / Math.tan(fovYRadians / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[11] = -1;
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      out[10] = far * nf;
      out[14] = far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -near;
    }
    return out;
  },

  // Right-handed look-at.
  lookAt(out, eye, center, up) {
    const ex = eye[0], ey = eye[1], ez = eye[2];
    const ux = up[0], uy = up[1], uz = up[2];

    let z0 = ex - center[0], z1 = ey - center[1], z2 = ez - center[2];
    let len = Math.hypot(z0, z1, z2) || 1;
    z0 /= len; z1 /= len; z2 /= len;

    let x0 = uy * z2 - uz * z1;
    let x1 = uz * z0 - ux * z2;
    let x2 = ux * z1 - uy * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) { x0 = 0; x1 = 0; x2 = 0; } else { x0 /= len; x1 /= len; x2 /= len; }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * ex + x1 * ey + x2 * ez);
    out[13] = -(y0 * ex + y1 * ey + y2 * ez);
    out[14] = -(z0 * ex + z1 * ey + z2 * ez);
    out[15] = 1;
    return out;
  },

  translation(out, x, y, z) {
    mat4.identity(out);
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  },

  scaling(out, x, y, z) {
    out.fill(0);
    out[0] = x; out[5] = y; out[10] = z; out[15] = 1;
    return out;
  },

  rotationX(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    mat4.identity(out);
    out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
    return out;
  },

  rotationY(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    mat4.identity(out);
    out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
    return out;
  },

  rotationZ(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    mat4.identity(out);
    out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
    return out;
  },
};

export const vec3 = {
  normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  },
};
