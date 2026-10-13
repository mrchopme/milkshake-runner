import { material } from './materials.js';
export const TILE = { w: 5, h: 7 }, SHOP_H = 4.3; // ponytail: metres per facade tile (2 bays x 2 floors) and the storefront band
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
export function facadeMaterial(gfx, style, i) {
  const T = gfx.three, path = style.facades?.[i], colors = style.buildings.colors;
  return material(`${style.id}/facade/${path ?? i}`, () => new T.MeshStandardMaterial({
    map: (path && tile(gfx, path)) || placeholderTile(T, colors[i % colors.length], '#2c3a63'), roughness: 0.5, metalness: 0.05,
  }));
}
export function shopMaterial(gfx, style, i) {
  const T = gfx.three, path = style.shops?.[i];
  return material(`${style.id}/shop/${path ?? i}`, () => new T.MeshStandardMaterial({
    map: (path && tile(gfx, path)) || placeholderTile(T, '#3b3f55', '#9ad0ff', 32), roughness: 0.4, metalness: 0.1,
  }));
}
