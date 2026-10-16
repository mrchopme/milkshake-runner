// The HiFi city's blocks (Task 32, Caedon's board 23 pick, 2026-10-15: "as prototyped"): facades with depth (cornices, a fascia
// over a recessed storefront, awnings, ledges or piers), every -z end finished, the body in its tile's colour, per-theme heights.
//
// The block list, a contract (signs and furniture anchor on it): the part fills the `blocks` array city.js hands every part (the
// sixth argument, also the chunk group's userData.blocks), in build order: the -x side first, then +x, each from low z to high.
//   { side: -1 | 1,  which side of the road
//     z0, z1,        the facade's span along z (z1 = z0 + frontage - GAP); its end wall stands at z0 - 0.02, its cornice return
//                    reaches z0 - CORNICE.ret
//     h,             roof height, m, on the floor grid SHOP_H + 3.5n
//     setAt,         the street wall's top: the first setback, or h without one
//     shop,          storefront image index (style.shops)
//     tile,          facade tile index (style.facades)
//     lot,           index in build order
//     awning }       true when the shop image has an awning: it spans z0..z1, 0.4-1.5 m out, lip 3.1 m, top 3.8 m
// Fixed geometry a consumer can rely on: the fascia board 3.8 m to SHOP_H, 0.4 m out; cornices CORNICE.h under each roof and
// setback, CORNICE.out out.
// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wall, instanced } from './shapes.js';
import { material } from './materials.js';
import { facadeMaterial, shopMaterial, TILE, SHOP_H, tintFor, tinted } from './facade.js';
import { FACADE_X } from './street.js';
import { rng } from '../../../src/generator.js';
// ponytail: calibration knobs, metres (board 15; Task 32, board 23). Overhang bands: above 4.5 m up to 0.9 out (cornices), 3.0-4.5 m
// only the awnings (1.6) over the fascia (0.4), below 3.0 m nothing past 0.4, never past x 4.5 (the road).
export const DEPTH = [8, 14], GAP = 0.5, CORNICE = { h: 1.05, out: 0.85, ret: 0.25 }, ROOF = { maxH: 40, tower: 0.35 };
const DRESS = {
  fascia: { y: 3.8, out: 0.4 }, recess: 0.45, // the sign board from 3.8 m to SHOP_H, the storefront set back behind it
  ledge: { h: 0.16, out: 0.18 }, pier: { w: 0.4, out: 0.15, every: 2.5 }, // masonry: a ledge every floor; stone and glass: piers
  awning: { out: 1.5, slope: 25, valance: 0.19 }, // hinged under the fascia's front edge: front edge 3.29 m, lip 3.10
  body: [10, 16], over: 40, inset: [5, 8], shopW: 8.5, // body depth (to 40 m, above), the first setback, the tiers' insets, one shop image per ~8.5 m
};
const snap = (h) => SHOP_H + Math.max(2, Math.round((h - SHOP_H) / 3.5)) * 3.5; // roofs and setbacks on the floor grid: cornices never cut a window band
// Setback tiers, monotone in h (no 41 m block's street wall above a 40 m one's): none to 40 m, one at max(40, 0.6h) to 60 m, two above.
function tiers(h) {
  const out = h <= DRESS.over ? [] : h <= 60 ? [snap(Math.max(DRESS.over, 0.6 * h))] : [snap(Math.max(DRESS.over, 0.45 * h))];
  if (h > 60) out.push(snap(Math.max(out[0] + 7, 0.75 * h)));
  return out.filter((t, k) => t < h - 3.4 && (k === 0 || t > out[k - 1]));
}
// ponytail: the pre-Task-32 part's draws, replayed so the shared stream reaches signs, furniture and traffic where it always did
// (their layouts and the stills keep still); returns the first draw as this chunk's own seed. Drop it once every later part draws
// from its own sub-stream.
function burn(rr, { z0, length }, cross, { minH, maxH }) {
  let first = 0;
  const r = () => { const v = rr(); first ||= v; return v; };
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    if (cross && z >= cross.z && z < cross.z + 12) { z = cross.z + 12; continue; }
    const end = Math.min(cross && z < cross.z ? cross.z : z0 + length, z0 + length);
    const depth = Math.min(DEPTH[0] + r() * (DEPTH[1] - DEPTH[0]), end - z), h = minH + r() * (maxH - minH);
    r(); r(); r();
    if (depth < 3) { z = end; continue; }
    if (h < ROOF.maxH && depth > 4) r();
    for (let k = Math.floor(r() * 3); k > 0; k--) { r(); r(); }
    z += depth;
  }
  return Math.floor(first * 2 ** 32);
}
// Heights (style.heights): 'runs' of 2-4 blocks, short or tall, a jump between like runs; 'walk' a clamped random walk with outliers.
function heightModel(H, look) {
  const span = ([a, b]) => a + look() * (b - a), clamp = (v, [a, b]) => Math.max(a, Math.min(b, v)), st = {};
  return () => {
    if (H.kind === 'walk') {
      const step = H.steps[Math.floor(look() * H.steps.length)] * (look() < 0.5 ? -1 : 1);
      st.h = st.h == null ? snap(span(H.range)) : snap(clamp(st.h + step, H.range));
      return { h: look() < H.outlier.share ? snap(span(H.outlier.h)) : st.h, tall: false };
    }
    if (!st.left) {
      const tall = look() < H.tallShare, range = tall ? H.tall : H.short;
      let base = span(range);
      if (st.tall === tall && Math.abs(base - st.base) < 0.3 * (range[1] - range[0])) base = range[0] + range[1] - base;
      Object.assign(st, { left: 2 + Math.floor(look() * 3), tall, base, range });
    }
    st.left--;
    const h = st.tall ? st.base * (0.9 + 0.2 * look()) : st.base + [-3.5, 0, 3.5][Math.floor(look() * 3)];
    return { h: snap(clamp(h, st.range)), tall: st.tall };
  };
}
const ALL = [0, 1, 2, 3, 4], NO_AWNING = [[0.18, null, 0.18]];
const merge = (T, geos) => { const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)), false); geos.forEach((x) => x.dispose()); return g; };

// Shells along both sides, merged into one mesh per material, so a chunk is a handful of draw calls. Every piece in the body mesh
// carries a colour (mergeGeometries returns null on a mix, and city.js would skip the part).
// Theme fields: heights, tileClass (per tile: 'm' masonry ledges, 's'/'g' stone or glass piers), bodies (per tile: its wall colour),
// trim (cornices, fascia, ledges), facadeTint, shopBands (per shop image: [sign bottom, awning top or null, lip], fractions from its top).
export function buildings(gfx, args, style, r, cross, blocks = []) {
  const { z0, length } = args, seed = burn(r, args, cross, style.buildings);
  const T = gfx.three, groups = new Map(), roofs = { tower: [], ac: [] }, C = CORNICE;
  const put = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const body = material(`${style.id}/body`, () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const { minH, maxH, colors } = style.buildings;
  const H = style.heights ?? { kind: 'runs', short: [minH, maxH], tall: [minH, maxH], tallShare: 0, shortTiles: ALL, tallTiles: ALL };
  const lots = H.depth ?? DEPTH, trim = new T.Color(style.trim ?? '#c9bda3'), bands = style.shopBands ?? NO_AWNING;
  const shopIds = style.shops?.length ? style.shops.map((_, i) => i) : [0, 1, 2, 3];
  const bodyColor = (f) => { // the tile's own wall colour, tinted as its texels are (sRGB, as the texels)
    const hex = style.bodies?.[f]; if (!hex) return null;
    const n = parseInt(hex.slice(1), 16), c = tinted(tintFor(style, f), n >> 16, (n >> 8) & 255, n & 255);
    return new T.Color().setRGB(...c.map((v) => v / 255), T.SRGBColorSpace);
  };
  for (const side of [-1, 1]) {
    // ponytail: two sub-streams per chunk side from the chunk's own seed (layout, look), so nothing here reshuffles the shared stream
    const key = (seed ^ (side > 0 ? 0x9e3779b9 : 0x3243f6a8)) >>> 0, lay = rng(key), look = rng(key + 1), next = heightModel(H, look);
    const pick = (list, not) => { const l = list.length > 1 ? list.filter((x) => x !== not) : list; return l[Math.floor(look() * l.length)]; };
    let z = z0 + C.ret, prevTile = -1, prevShop = -1; // the first block leaves room for its cornice return: nothing crosses the seam
    while (z < z0 + length) {
      if (cross && z >= cross.z && z < cross.z + 12) { z = cross.z + 12; continue; }
      const end = cross && z < cross.z ? cross.z : z0 + length;
      let depth = lots[0] + lay() * (lots[1] - lots[0]);
      if (end - z - depth < lots[0]) depth = end - z; // the remainder joins this block: no slivers
      if (depth < 3) { z = end; continue; }
      const d = depth - GAP, zc = z + d / 2, face = -side, X = (inn) => side * (FACADE_X + inn); // inn: metres behind the facade line
      let { h, tall } = next();
      if (depth < 7.5) { h = Math.min(h, snap((H.short ?? H.range)[1])); tall = false; } // a squeezed block never stands as a full-height slab
      const f = pick(H.kind === 'walk' ? H.tiles ?? ALL : tall ? H.tallTiles : H.shortTiles, prevTile), s = pick(shopIds, prevShop);
      prevTile = f; prevShop = s;
      const fm = facadeMaterial(gfx, style, f), sm = shopMaterial(gfx, style, s), deep = DRESS.body[h > DRESS.over ? 1 : 0];
      const color = bodyColor(f) ?? new T.Color(colors[Math.floor(look() * colors.length)]), cls = style.tileClass?.[f] ?? 'm';
      const along = (mat, inn, y0, y1, tw, th, v0 = 0) => put(mat, wall(T, d, y1 - y0, face, tw, th, v0).translate(X(inn), (y0 + y1) / 2, zc));
      const across = (mat, in0, in1, y0, y1, tw, th, v0 = 0) => put(mat, wall(T, in1 - in0, y1 - y0, 0, tw, th, v0, 'z').translate(X((in0 + in1) / 2), (y0 + y1) / 2, z - 0.02)); // the -z end
      const box = (in0, in1, y0, y1, za, zb, c = color) => { const b = new T.BoxGeometry(in1 - in0, y1 - y0, zb - za, 1, 1, Math.max(1, Math.ceil((zb - za) / 4))).translate(X((in0 + in1) / 2), (y0 + y1) / 2, (za + zb) / 2); paint(T, b, c); put(body, b); };
      // the shop band: storefront glass recessed under a fascia showing the image's own sign, an awning from its own awning rows;
      // the image repeats every ~8.5 m (tw), the storefront wears only the rows under the painted awning so it never shows twice
      const [sign, awnTop, lip] = bands[s] ?? bands[0], tw = d / Math.max(1, Math.round(d / DRESS.shopW)), F = DRESS.fascia;
      along(sm, DRESS.recess, 0, F.y, tw, F.y / (1 - lip));
      const sv = [1 - 0.92 * sign, 1 - 0.1 * sign]; // the sign band, a little cropped so its letters keep their shape
      along(sm, -F.out - 0.01, F.y, SHOP_H, tw, (SHOP_H - F.y) / (sv[1] - sv[0]), sv[0]);
      box(-F.out, DRESS.recess, F.y, SHOP_H, z, z + d, trim); // the fascia's shelf, soffit and ends
      if (awnTop != null) {
        const A = DRESS.awning, run = A.out - F.out, rad = A.slope * Math.PI / 180, L = run / Math.cos(rad), drop = run * Math.tan(rad);
        const vT = 1 - awnTop, vL = 1 - lip, vM = vL + 0.25 * (vT - vL); // the slope wears the band's top three quarters, the valance the rest
        put(sm, wall(T, d, L, face, tw, L / (vT - vM), vM).translate(0, -L / 2, 0).rotateZ(face * (Math.PI / 2 - rad)).translate(X(-F.out), F.y, zc));
        along(sm, -A.out, F.y - drop - A.valance, F.y - drop, tw, A.valance / (vM - vL), vL);
      }
      across(sm, DRESS.recess, deep, 0, SHOP_H, (deep - DRESS.recess) / Math.max(1, Math.round((deep - DRESS.recess) / DRESS.shopW)), SHOP_H); // the end wears the whole image
      box(DRESS.recess + 0.02, deep, 0, SHOP_H, z, z + d);
      // the facade bands: SHOP_H to the first setback, then each tier set back; each with its end wall, body, cornice and relief
      const tops = [...tiers(h), h], insets = [0, ...DRESS.inset];
      tops.forEach((y1, k) => {
        const y0 = k ? tops[k - 1] : SHOP_H, inn = insets[k], v0 = (y0 - SHOP_H) / TILE.h;
        along(fm, inn, y0, y1, TILE.w, TILE.h, v0);
        across(fm, inn, deep, y0, y1, TILE.w, TILE.h, v0);
        box(inn + 0.02, deep, y0, y1, z, z + d);
        box(inn - C.out, inn + 0.3, y1 - C.h, y1, z - C.ret, z + d, trim); // the cornice's front
        box(inn - C.out, deep, y1 - C.h, y1, z - C.ret, z + 0.3, trim); // and its return round the end
        if (cls === 'm') for (let y = SHOP_H + 3.5 * Math.ceil((y0 - SHOP_H + 0.1) / 3.5); y < y1 - C.h - 0.3; y += 3.5) box(inn - DRESS.ledge.out, inn + 0.05, y - DRESS.ledge.h / 2, y + DRESS.ledge.h / 2, z, z + d, trim);
        else for (let u = DRESS.pier.every; u < d - 0.3; u += DRESS.pier.every) { const zp = face > 0 ? z + d - u : z + u; box(inn - DRESS.pier.out, inn + 0.05, y0, y1 - C.h, zp - DRESS.pier.w / 2, zp + DRESS.pier.w / 2); }
      });
      // a tower behind a walk-up (downtown's second row): its own tall tile on the road face and the end, its own body colour, a cornice
      if (H.back && !tall && look() < H.back.share) {
        const off = H.back.x[0] + look() * (H.back.x[1] - H.back.x[0]), w = H.back.w[0] + look() * (H.back.w[1] - H.back.w[0]), bh = snap(H.tall[0] + look() * (H.tall[1] - H.tall[0])), bt = pick(H.tallTiles, -1), bm = facadeMaterial(gfx, style, bt);
        along(bm, off, SHOP_H, bh, TILE.w, TILE.h);
        across(bm, off, off + w, SHOP_H, bh, TILE.w, TILE.h);
        box(off + 0.02, off + w, 0, bh, z, z + d, bodyColor(bt) ?? color);
        box(off - C.out, off + 0.3, bh - C.h, bh, z - C.ret, z + d, trim);
      }
      // roofs: a water tower on a low roof deep enough for it, AC units on the top tier
      const top = insets[tops.length - 1];
      if (h < ROOF.maxH && depth > 4 && look() < ROOF.tower) roofs.tower.push(new T.Matrix4().makeTranslation(side * (FACADE_X + 6), h, zc));
      for (let k = Math.floor(look() * 3); k > 0; k--) roofs.ac.push(new T.Matrix4().makeTranslation(side * (FACADE_X + top + 1.5 + look() * (deep - top - 3)), h, z + 1.5 + look() * (d - 3)));
      blocks.push({ side, z0: z, z1: z + d, h, setAt: tops[0], shop: s, tile: f, lot: blocks.length, awning: awnTop != null });
      z += depth;
    }
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
export function paint(T, geo, color) { const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) color.toArray(c, i * 3); geo.setAttribute('color', new T.BufferAttribute(c, 3)); }
