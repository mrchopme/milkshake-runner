// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wall, instanced } from './shapes.js';
import { material } from './materials.js';
import { facadeMaterial, shopMaterial, TILE, SHOP_H } from './facade.js';
import { FACADE_X } from './street.js';
// ponytail: calibration knobs, metres (board 15)
export const DEPTH = [8, 14], GAP = 0.5, CORNICE = { h: 0.6, out: 0.35 }, SETBACK = { above: 0.6, inset: 2 }, ROOF = { maxH: 40, tower: 0.35 };
const merge = (T, geos) => { const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)), false); geos.forEach((x) => x.dispose()); return g; };

// Shells along both sides, merged into one mesh per material, so a chunk is a handful of draw calls.
export function buildings(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, groups = new Map(); // material -> geometries
  const put = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const body = material(`${style.id}/body`, () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const { minH, maxH, colors } = style.buildings, roofs = { tower: [], ac: [] };
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    if (cross && z >= cross.z && z < cross.z + 12) { z = cross.z + 12; continue; }
    const end = Math.min(cross && z < cross.z ? cross.z : z0 + length, z0 + length);
    const depth = Math.min(DEPTH[0] + r() * (DEPTH[1] - DEPTH[0]), end - z);
    const h = minH + r() * (maxH - minH), f = Math.floor(r() * 5), s = Math.floor(r() * 4), color = new T.Color(colors[Math.floor(r() * colors.length)]);
    if (depth < 3) { z = end; continue; }
    const d = depth - GAP, zc = z + depth / 2, x = side * FACADE_X, face = -side; // the facade looks at the road
    const setAt = h > 40 ? h * SETBACK.above : h;
    const facade = (geo, x0) => geo.translate(x0, 0, zc);
    // storefront band, then the facade tile up to the setback, then the upper facade set back
    put(shopMaterial(gfx, style, s), facade(wall(T, d, SHOP_H, face, d, SHOP_H).translate(0, SHOP_H / 2, 0), x));
    put(facadeMaterial(gfx, style, f), facade(wall(T, d, setAt - SHOP_H, face, TILE.w, TILE.h).translate(0, SHOP_H + (setAt - SHOP_H) / 2, 0), x));
    if (setAt < h) put(facadeMaterial(gfx, style, f), facade(wall(T, d, h - setAt, face, TILE.w, TILE.h).translate(0, setAt + (h - setAt) / 2, 0), x + side * SETBACK.inset));
    // the body behind (roof, sides, back) and a cornice at the top of the facade, vertex-coloured
    const box = (w, hh, dd, cx, cy) => { const b = new T.BoxGeometry(w, hh, dd, 1, 1, Math.max(1, Math.ceil(dd / 4))).translate(cx, cy, zc); paint(T, b, color); return b; };
    put(body, box(10, setAt, d, side * (FACADE_X + 5.02), setAt / 2));
    if (setAt < h) put(body, box(10 - SETBACK.inset, h - setAt, d, side * (FACADE_X + SETBACK.inset + (10 - SETBACK.inset) / 2 + 0.02), setAt + (h - setAt) / 2));
    put(body, box(CORNICE.out + 0.2, CORNICE.h, d, x - side * CORNICE.out / 2 + side * 0.1, setAt - CORNICE.h / 2));
    // a water tower on a low roof, only on a block deep enough to hold its 1.8 m radius (the seam rule)
    if (h < ROOF.maxH && depth > 4 && r() < ROOF.tower) roofs.tower.push(new T.Matrix4().makeTranslation(side * (FACADE_X + 6), h, zc));
    for (let k = Math.floor(r() * 3); k > 0; k--) roofs.ac.push(new T.Matrix4().makeTranslation(side * (FACADE_X + 3 + r() * 5), h, z + 1.5 + r() * (d - 3)));
    z += depth;
  }
  const g = gfx.group();
  for (const [mat, geos] of groups) {
    const m = new T.Mesh(merge(T, geos), mat);
    m.userData.building = true;
    g.add(m);
  }
  // Rooftop props in code (spec: water towers and AC units), two instanced meshes a chunk; a tank on legs, a box with a fan top
  const roofMat = material(`${style.id}/roof`, () => new T.MeshStandardMaterial({ color: '#7a5a43', roughness: 0.7 }));
  const steel = material('roof/steel', () => new T.MeshStandardMaterial({ color: '#b9bec8', roughness: 0.35, metalness: 0.6 }));
  if (roofs.tower.length) g.add(instanced(T, mergeGeometries([new T.CylinderGeometry(1.6, 1.6, 3.2, 16).translate(0, 4.6, 0), new T.ConeGeometry(1.8, 1.2, 16).translate(0, 6.8, 0), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => new T.CylinderGeometry(0.08, 0.08, 3, 6).translate(a * 1.1, 1.5, b * 1.1))].map((x) => x.toNonIndexed())), roofMat, roofs.tower));
  if (roofs.ac.length) g.add(instanced(T, new T.BoxGeometry(1.4, 0.9, 1.1).translate(0, 0.45, 0), steel, roofs.ac));
  return g;
}
function paint(T, geo, color) { const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) color.toArray(c, i * 3); geo.setAttribute('color', new T.BufferAttribute(c, 3)); }
