import { material } from './materials.js';
import { roughMap, redraw } from './paint.js';
import { pickBy } from './rand.js';
export const TILE = { w: 5, h: 7 }, SHOP_H = 4.3; // ponytail: metres per facade tile (2 bays x 2 floors) and the storefront band
// ponytail: calibration knobs, measured on the real tiles — a lit pane is a tile's own warm bright texel; glass is any blue texel
// or a lit pane, glossy against the matte wall; a window pane (what a lit window cell glows in) is blue glass (not a purple trim),
// a lit pane, or a dark neutral pane (uptown-03's brown panes); the mask maps' size.
const isLit = (r, g, b) => r > 200 && g > 140 && r - b > 100, isGlass = (r, g, b) => b > r + 18 || isLit(r, g, b);
const luma = (p, i) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
const isPane = (r, g, b) => (b > r + 18 && g >= r - 8) || isLit(r, g, b) || (0.2126 * r + 0.7152 * g + 0.0722 * b < 64 && Math.max(r, g, b) - Math.min(r, g, b) < 48);
const MASK = { size: 512, glass: 0.12, wall: 0.6 };
// ponytail: the window glow's canvas (512^2, not 1024^2: Task 32's perf trim) holding the tile 4 x 4 times, and a cell's pane rect
// (fractions of a 2.5 x 3.5 m window cell)
const GLOW = { reps: 4, size: 512, u: [0.12, 0.88], v: [0.05, 0.88] };
// The generated city's images (round 2): public/hifi/city/<dir>/<name>-01.webp … <name>-<n>.webp
export const cityFiles = (dir, name, n) => Array.from({ length: n }, (_, i) => `hifi/city/${dir}/${name}-${String(i + 1).padStart(2, '0')}.webp`);
const rgb = (T, hex) => new T.Color(hex).toArray().map((v) => Math.round(v * 255));
// A Node-safe stand-in for a generated tile: two bays by two floors of glass in a wall colour.
export function placeholderTile(T, wallHex, glassHex, n = 64) {
  const px = new Uint8Array(n * n * 4), w = rgb(T, wallHex), gl = rgb(T, glassHex);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const bx = (x % (n / 2)) / (n / 2), fy = (y % (n / 2)) / (n / 2), glass = bx > 0.18 && bx < 0.82 && fy > 0.25 && fy < 0.85;
    px.set([...(glass ? gl : w), 255], (y * n + x) * 4);
  }
  const t = new T.DataTexture(px, n, n);
  Object.assign(t, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, colorSpace: T.SRGBColorSpace, needsUpdate: true });
  t.userData.shared = true;
  return t;
}
const tile = (gfx, path) => { try { const t = gfx.texture(path); t.wrapS = t.wrapT = gfx.three.RepeatWrapping; t.anisotropy = 16; return t; } catch { return null; } };
// A theme's `facadeTint` multiplies a tile's wall texels (never its glass) by `mul`; `warm` weights it by how warm a texel is (the
// brick, not its cream trims); `only` lists the tiles it applies to. Exported: a block's body colour wears the same tint.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const tintFor = (style, i) => { const t = style.facadeTint; return t && (!t.only || t.only.includes(i)) ? t : null; };
export function tinted(tint, r, g, b) {
  if (!tint) return [r, g, b];
  const w = tint.warm ? clamp01((r - b - 60) / 60) : 1;
  return [r, g, b].map((c, k) => Math.min(255, Math.round(c * (1 + (tint.mul[k] - 1) * w))));
}
// Lit windows: the tile drawn 4 x 4 times on one canvas (worn at repeat 1/4, so the pattern repeats every 20 x 28 m, not every
// tile), each 2.5 x 3.5 m window cell lit by a seeded hash at `share`, only its own pane texels white, all else black (Caedon's glow rule).
function cellGlow(T, map, share, salt) {
  if (!map?.image || typeof OffscreenCanvas === 'undefined') return null;
  const { reps, size } = GLOW, t = size / reps, cell = t / 2, cells = size / cell, canvas = new OffscreenCanvas(size, size), ctx = canvas.getContext('2d');
  for (let a = 0; a < reps; a++) for (let b = 0; b < reps; b++) ctx.drawImage(map.image, a * t, b * t, t, t);
  const img = ctx.getImageData(0, 0, size, size), px = img.data, lit = [];
  for (let k = 0; k < cells * cells; k++) lit.push(pickBy(salt * 4096 + k, 1000) < share * 1000);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, cu = (x % cell) / cell, cv = (y % cell) / cell;
    const on = lit[Math.floor(y / cell) * cells + Math.floor(x / cell)] && cu > GLOW.u[0] && cu < GLOW.u[1] && cv > GLOW.v[0] && cv < GLOW.v[1] && isPane(px[i], px[i + 1], px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  Object.assign(tex, { flipY: map.flipY, colorSpace: T.SRGBColorSpace, wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
  tex.repeat.set(1 / reps, 1 / reps);
  return tex;
}
// A tile not loaded yet falls back to the placeholder under its own key, so the real tile still gets built once it lands.
// A loaded tile gets its masks from its own texels: glossy glass, matte wall; its wall tint (`style.facadeTint`) in a copy of the
// tile; and, with `style.glow` {share, color, intensity, skip}, its window cells lit (`skip`: tiles whose dark lattice would read as
// panes, uptown-02's fire escape). Without a canvas to read it (Node) the tile is plain: matte, untinted, nothing glows.
export function facadeMaterial(gfx, style, i) {
  const T = gfx.three, map = style.facades?.[i] && tile(gfx, style.facades[i]), colors = style.buildings.colors, tint = tintFor(style, i), G = style.glow;
  return material(`${style.id}/facade/${map ? style.facades[i] : `placeholder/${i}`}${tint ? '/tint' : ''}${G ? '/glow' : ''}`, () => {
    if (!map) return new T.MeshStandardMaterial({ map: placeholderTile(T, colors[i % colors.length], '#2c3a63'), roughness: 0.5, metalness: 0.05 });
    const color = tint && redraw(T, map, 1024, (px, k) => { if (!isGlass(px[k], px[k + 1], px[k + 2])) px.set(tinted(tint, px[k], px[k + 1], px[k + 2]), k); });
    if (color) color.anisotropy = 16;
    const glow = G && !G.skip?.includes(i) ? cellGlow(T, map, G.share, i + 1) : null, rough = roughMap(T, map, isGlass, MASK.glass, MASK.wall, MASK.size);
    return new T.MeshStandardMaterial({
      map: color || map, metalness: 0.05, roughness: rough ? 1 : MASK.wall, roughnessMap: rough,
      emissive: glow ? G.color : '#000000', emissiveMap: glow, emissiveIntensity: glow ? G.intensity : 0,
    });
  }, map);
}
// A shop's interior glows from its own glass texels (their luma) in `style.shopGlow` {color, intensity}. Awnings and the fascia are
// planes, so the material casts its shadow from both sides (three's default draws only back faces into the shadow map).
export function shopMaterial(gfx, style, i) {
  const T = gfx.three, map = style.shops?.[i] && tile(gfx, style.shops[i]), G = style.shopGlow;
  return material(`${style.id}/shop/${map ? style.shops[i] : `placeholder/${i}`}${G ? '/glow' : ''}`, () => {
    const glow = G && map ? redraw(T, map, 512, (px, k) => { const on = isGlass(px[k], px[k + 1], px[k + 2]); px[k] = px[k + 1] = px[k + 2] = on ? Math.round(luma(px, k)) : 0; }) : null;
    return new T.MeshStandardMaterial({
      map: map || placeholderTile(T, '#3b3f55', '#9ad0ff', 32), roughness: 0.4, metalness: 0.1, shadowSide: T.DoubleSide,
      emissive: glow ? G.color : '#000000', emissiveMap: glow, emissiveIntensity: glow ? G.intensity : 0,
    });
  }, map);
}
