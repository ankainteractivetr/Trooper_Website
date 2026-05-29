// textures.js
// Helpers for loading images and normalising them onto fixed-size canvases so
// every layer of a texture_2d_array shares identical dimensions.

// Fetch an image URL and decode it to an ImageBitmap with STRAIGHT (non-pre-
// multiplied) alpha so it matches our copyExternalImageToTexture settings.
export async function loadImageBitmap(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to load image: ${url} (${res.status})`);
  const blob = await res.blob();
  return createImageBitmap(blob, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
}

// Draw a bitmap onto a canvas of (w x h) using "cover" cropping (fill the box,
// centre-crop the overflow). Returns the canvas, ready for GPU upload.
export function coverDrawToCanvas(bitmap, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const ir = bitmap.width / bitmap.height;
  const tr = w / h;
  let dw, dh, dx, dy;
  if (ir > tr) {
    // source is wider -> crop sides
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    // source is taller -> crop top/bottom
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  return canvas;
}
