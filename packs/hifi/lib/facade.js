import { material } from './materials.js';
import { glowMap, roughMap } from './paint.js';
export const TILE = { w: 5, h: 7 }, SHOP_H = 4.3; // ponytail: metres per facade tile (2 bays x 2 floors) and the storefront band
// ponytail: calibration knobs, measured on the real tiles — a lit pane is a tile's own warm bright texel (0 on brick and stone),
// the only thing that glows, at the theme's `lit`; glass is any blue texel or a lit pane, glossy against the matte wall; and
// the mask maps' size.
const isLit = (r, g, b) => r > 200 && g > 140 && r - b > 100, isGlass = (r, g, b) => b > r + 18 || isLit(r, g, b);
const MASK = { size: 512, glass: 0.12, wall: 0.6 };
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
const tile = (gfx, path) => { try { const t = gfx.texture(path); t.wrapS = t.wrapT = gfx.three.RepeatWrapping; return t; } catch { return null; } };
// A tile not loaded yet falls back to the placeholder under its own key, so the real tile still gets built once it lands.
// A loaded tile gets its window masks from its own texels: glossy glass, matte wall, and its lit panes glowing at `style.lit`
// (Caedon's glow rule; no glow mask at all on a daytime theme). Without a canvas to read it (Node) the tile is plain: matte,
// nothing glows.
export function facadeMaterial(gfx, style, i) {
  const T = gfx.three, map = style.facades?.[i] && tile(gfx, style.facades[i]), colors = style.buildings.colors;
  return material(`${style.id}/facade/${map ? style.facades[i] : `placeholder/${i}`}`, () => {
    if (!map) return new T.MeshStandardMaterial({ map: placeholderTile(T, colors[i % colors.length], '#2c3a63'), roughness: 0.5, metalness: 0.05 });
    const glow = style.lit ? glowMap(T, map, isLit, MASK.size) : null, rough = roughMap(T, map, isGlass, MASK.glass, MASK.wall, MASK.size);
    return new T.MeshStandardMaterial({
      map, metalness: 0.05, roughness: rough ? 1 : MASK.wall, roughnessMap: rough,
      emissive: glow ? '#ffffff' : '#000000', emissiveMap: glow, emissiveIntensity: style.lit ?? 0,
    });
  });
}
export function shopMaterial(gfx, style, i) {
  const T = gfx.three, map = style.shops?.[i] && tile(gfx, style.shops[i]);
  return material(`${style.id}/shop/${map ? style.shops[i] : `placeholder/${i}`}`, () => new T.MeshStandardMaterial({
    map: map || placeholderTile(T, '#3b3f55', '#9ad0ff', 32), roughness: 0.4, metalness: 0.1,
  }));
}
