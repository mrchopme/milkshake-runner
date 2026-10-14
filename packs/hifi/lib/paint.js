// A glossy copy of a generated material: every standard field (maps, colour, normal scale, AO, side, alpha, vertex colours),
// then the extras. Sub-project 1's taxi copied a subset; this is the rule for every generated model (final review, minor).
// setValues, not Object.assign: it turns '#ffffff' into the material's Color instead of replacing the Color with a string.
// The source must be a MeshStandardMaterial. userData (the shared flag) is copied on purpose: build a gloss once and share it,
// as the taxi does, since clearing the flag would let the first despawn dispose the shared paint.
export function gloss(T, source, extra = {}) {
  const p = new T.MeshPhysicalMaterial();
  T.MeshStandardMaterial.prototype.copy.call(p, source);
  p.defines.PHYSICAL = ''; // the standard copy resets defines to { STANDARD }; without PHYSICAL, ior and specular do nothing
  p.setValues(extra);
  return p;
}
// The colour map redrawn texel by texel (`each(px, i)` rewrites the RGB at px[i]), or null without a map or a canvas (Node).
// Read the way the source map is (flipY, colour space, channel, wrap); offset and repeat are not copied, so a map that uses
// them needs its UVs in [0,1].
function redraw(T, map, size, each) {
  if (!map?.image || typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(size, size), ctx = canvas.getContext('2d');
  ctx.drawImage(map.image, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size), px = img.data;
  for (let i = 0; i < px.length; i += 4) each(px, i);
  ctx.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(canvas);
  Object.assign(t, { flipY: map.flipY, colorSpace: map.colorSpace, channel: map.channel, wrapS: map.wrapS, wrapT: map.wrapT });
  return t;
}
// The colour map with only the texels `test` accepts, as an emissive map: a lamp glows in its own shape (Caedon, 2026-10-09).
export const glowMap = (T, map, test, size = 1024) => redraw(T, map, size, (px, i) => { if (!test(px[i], px[i + 1], px[i + 2])) px[i] = px[i + 1] = px[i + 2] = 0; });
// The same mask as a roughness map: `on` where `test` accepts a texel, `off` elsewhere; data, so no colour space.
export function roughMap(T, map, test, on, off, size = 1024) {
  const t = redraw(T, map, size, (px, i) => { px[i] = px[i + 1] = px[i + 2] = Math.round(255 * (test(px[i], px[i + 1], px[i + 2]) ? on : off)); });
  if (t) t.colorSpace = T.NoColorSpace;
  return t;
}
