import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { material } from './materials.js';
import { freeWith } from './paint.js';
import { pickBy } from './rand.js';
import { paint } from './buildings.js';
import { CROSS, FACADE_X, WALK, SIDE, sideWalls } from './street.js';
// Street furniture, one InstancedMesh per part per kind; x from the road's centre line. Across the 6 m sidewalk (kerb 4.5, facade
// 10.5): lamps, hydrants, signals and the bus shelter at the kerb; trees on the back half; the subway mid-sidewalk; bins, benches,
// newsstands and planters against the buildings.
//
// The kerb's rhythm (Task 32; Caedon, 2026-10-15: "Regular rhythm like the frames", board 24 "Ship as prototyped"; it reverses
// board 18's random stretches of trees and lamps). One tree pitch P a chunk, both sides, drawn from pickBy(z0) in `pitch` and fitted
// to the chunk (length / n, n odd); the -x side's trees stand at half pitches, the +x side's at whole ones, so every +x tree stands
// halfway between two -x trees. A lamp halfway between every second pair of tree spots (2P), the two sides' lamps in opposite gaps.
// n is odd for the seams: +x's trees at 0 and length fall in the seam margins, and only an odd n puts a +x lamp at 0.5P and at
// length - 0.5P to fill that 2P hole (an even n left 1.5P, up to 15 m, empty). The cost: one short lamp gap (P) a seam on +x, and
// on -x, whose lamps at whole pitches cannot reach both ends of an odd n, one extra lamp at length - P (a short gap inside the chunk,
// 2P across the seam, not 3P). A flush pit under every tree. Planter pairs at shop doors from the block list (buildings.js's header).
// The benches, bins, newsstands, the rare shelter or subway and the hydrants keep board 18's stretches and rates in what is left.
// Everything the rhythm adds is hashed from its place (pickBy), so it draws nothing from the chunk's stream.
// ponytail: calibration knobs. Small trees (Caedon, Task 33 pick 3, board 28: "less big"; Task 32's were pitch [8, 10], x 6.0, scale
// [0.75, 0.9]): pitch [11, 14] (at 120 m only n = 9, P 13.33, so the lamps every 2P come 26.7 m apart, not Task 32's "about every
// 18 m"); trees: model -> x, each slot drawing one from its place (Task 32 C7: tree.glb, guard cut, and Caedon's T3, tree2.glb, about
// half each); 7.6, the sidewalk's back half: a canopy reaches 2.31k m (tree; tree2 2.26k), so at k 0.55-0.68 it spans x 6.03-9.17,
// clear of the lamps at 5.33 and the outer lane, under the blade signs (from 6.16 m up; a top is under 4.1 m). scale: of the kit's
// 6 m, 3.3-4.1 m (no trunk lift: the canopy starts 1.2-1.5 m up). Each model has its FOOT (the trunk, inside the pit's soil) and its
// stand-in in the kit test; tree2's leaves are lifted to tree.glb's green (kit.js), so TINT serves both. dusk: the lamps' glow in a
// `lit` theme (KIT.lamp's 1.2 by day).
export const RHYTHM = { pitch: [11, 14], trees: { tree: 7.6, tree2: 7.6 }, lamp: 5.33, scale: [0.55, 0.68], jitter: 0.06, dusk: 2 };
// the flush pit under every tree: `size` m square, a stone rim `rim` m wide round dark soil, their tops 1-1.5 cm over the sidewalk's
export const PITS = { size: 1.5, rim: 0.1, stone: '#9a968f', soil: '#3a2e25' };
// planter pairs, door z +/- dz, on `chance` of the shop lots. x 9.8, not the brief's 9.9: planter.glb is 0.83 m across, so at 9.9
// it reaches 10.32, past the 0.2 m kept off the wall
export const PLANTER = { x: 9.8, dz: 1.2, chance: 0.5 };
// the canopy's tint per theme (instanceColor, linear): our rendered lit green -> the style frames' (style gap §2; midtown and uptown
// lifted a step by the main session after board 24), then +/- `value` in value and up to `olive` toward olive, hashed from the place.
// The model's paint masks it to the leaf texels (kit.js's matteHook), so the bark stays as generated.
export const TINT = { downtown: ['#6ca126', '#4f8a3a'], midtown: ['#61901d', '#7a8a3a'], uptown: ['#5b831e', '#5f6a2a'], value: 0.08, olive: 0.08 };
// uptown's light pools: one additive radial quad under each lamp's head, `r` m out, centred `in` m toward the road from the pole
const POOL = { r: 2.2, in: 1.0, color: '#c9927d' };
// board 18's stretches for the rest, SEG m long, each drawing one kind by weight, and a hydrant on top by chance. The bare weight
// holds the old tree and lamp stretches' 0.34, so the extras' rates are board 18's; the stream is not (the old tree and lamp draws
// are gone), so the later parts (traffic) and the board 18 and stack stills reshuffle.
export const SEG = [16, 34];
export const STRETCH = [
  { weight: 0.76 }, // bare
  { weight: 0.1, kind: 'bench', x: 9.85, with: { kind: 'bin', x: 9.8 } },
  { weight: 0.07, kind: 'newsstand', x: 9.35 },
  { weight: 0.07, rare: [{ kind: 'bus_shelter', x: 5.8 }, { kind: 'subway', x: 7.5 }] }, // at most one a chunk: a second draw is bare
];
export const HYDRANT = { chance: 0.25, kind: 'hydrant', x: 4.95 };
export const CLEAR = 2, SEAM = 2; // m kept clear of the side street; m kept from the chunk's ends
// ponytail: calibration knobs — each piece's footprint, half its size across the sidewalk and along it (metres, measured on the
// generated models at KIT's heights; a tree's is its trunk, its guard or slab cut). Every piece keeps GAP m from the footprints already
// on its side, so nothing stands inside anything else: a corner's traffic light goes first, then the rhythm, then a piece tries up
// to TRIES spots in its stretch before it is left out. A tree spaces by its pit.
// append new kinds at the end: the put() salts depend on FOOT's key order
export const FOOT = { lamp: [0.54, 0.55], traffic_light: [0.72, 0.72], hydrant: [0.19, 0.2], bin: [0.2, 0.2], tree: [0.45, 0.45], tree2: [0.32, 0.32], bench: [0.3, 0.58], newsstand: [0.81, 1.09], bus_shelter: [0.87, 1.42], subway: [1.49, 1.25], planter: [0.35, 0.43] };
const GAP = 0.2, TRIES = 10, PIT = PITS.size / 2, KINDS = Object.keys(FOOT);
// ponytail: calibration knob (main session, Task 34 fix round 1; the P1 report's measure): a signal's pole 1.22 m past the cross
// street's paving, the 1.44 m base's half (FOOT) plus 0.5, so the base clears the 12 m paving (at board 19's 0.5 it reached 0.22 m onto it)
const SIGNAL_DZ = FOOT.traffic_light[1] + 0.5;
const hash = (z, side, salt) => pickBy(z * 7.31 + side * 1000 + salt * 104729, 1e4) / 1e4; // a stable [0, 1) from a place, no stream

export function furniture(gfx, { z0, length }, style, r, cross, blocks) {
  const T = gfx.three, g = gfx.group(), byKind = {}, feet = { [-1]: [], [1]: [] }, pits = [], pools = []; // feet: the footprints on each side so far, [x0, x1, z0, z1]
  const half = (kind) => (kind in RHYTHM.trees ? [PIT, PIT] : FOOT[kind]);
  const foot = (kind, x, z) => { const [hx, hz] = half(kind); return [Math.abs(x) - hx, Math.abs(x) + hx, z - hz, z + hz]; };
  const free = (f, side) => feet[side].every((o) => f[1] + GAP <= o[0] || o[1] + GAP <= f[0] || f[3] + GAP <= o[2] || o[3] + GAP <= f[2]);
  const clear = (z) => !cross || z <= cross.z - CLEAR || z >= cross.z + CROSS.width + CLEAR;
  const fits = (kind, x, z, side) => clear(z) && free(foot(kind, x, z), side);
  const at = (kind, x, z, side, k = 1, yaw = 0) => { feet[side].push(foot(kind, x, z)); (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(x, 0.18, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (side > 0 ? -Math.PI / 2 : Math.PI / 2) + yaw), new T.Vector3(k, k, k))); };
  // a spot whose footprint stays in [a, b], each try hashed from the stretch, the side, the kind and the try (main session, Task 34 fix
  // round 1, rules § Invariants): no draw from the stream, so how many tries a piece needs moves no later part (traffic) nor the stills
  const put = ({ kind, x }, a, b, s) => {
    const hz = half(kind)[1], salt = 20 + TRIES * KINDS.indexOf(kind);
    for (let t = 0; t < TRIES && b - a >= 2 * hz; t++) { const z = a + hz + hash(a, s, salt + t) * (b - a - 2 * hz); if (fits(kind, x, z, s)) return at(kind, s * x, z, s); }
  };
  const place = (kind, x, z, s, k, yaw) => { // the rhythm's spot, if its footprint stays off the seams and fits
    const hz = half(kind)[1], ok = z - hz >= z0 + SEAM && z + hz <= z0 + length - SEAM && fits(kind, x, z, s);
    if (ok) at(kind, s * x, z, s, k, yaw);
    return ok;
  };
  // the signals on the far corners, one each side, both heads at the oncoming runner (Caedon, board 29, 2026-10-20; it replaces
  // board 19's diagonal pair, whose lenses faced each other across the avenue): the model's lenses face its front (+x, the way its
  // head hangs), which the kit turns +z and at() toward the road; yaw -side * pi/2 turns it -z. Each base on its sidewalk, the pole
  // SIGNAL_DZ past the paving. A crossing sits 30 m or more from either end of its chunk (lib/city.js), so no pole leaves it.
  // The signals take no draw: from here on the furniture's stream is position-hashed but for the stretches' own draws.
  if (cross) for (const s of [-1, 1]) at('traffic_light', s * 5.28, cross.z + CROSS.width + SIGNAL_DZ, s, 1, -s * Math.PI / 2);
  const kinds = Object.keys(RHYTHM.trees), [lo, hi] = RHYTHM.pitch, odd = [];
  for (let k = Math.ceil(length / hi); k <= Math.floor(length / lo); k++) if (k % 2) odd.push(k);
  const n = odd[Math.floor(hash(z0, 0, 1) * odd.length)] ?? (Math.round(length / lo) | 1), P = length / n;
  for (const s of [-1, 1]) {
    const phase = s < 0 ? 0.5 : 0;
    for (let j = 0; j <= n; j++) {
      const z = z0 + (j + phase) * P, tree = kinds[Math.floor(hash(z, s, 8) * kinds.length)];
      const k = RHYTHM.scale[0] + (RHYTHM.scale[1] - RHYTHM.scale[0]) * hash(z, s, 2), yaw = Math.floor(4 * hash(z, s, 3)) * Math.PI / 2 + (2 * hash(z, s, 4) - 1) * RHYTHM.jitter;
      if (place(tree, RHYTHM.trees[tree], z, s, k, yaw)) pits.push(new T.Matrix4().makeTranslation(s * RHYTHM.trees[tree], 0.18, z));
      if ((j % 2 === 0 || (s < 0 && j === n - 2)) && place('lamp', RHYTHM.lamp, z + P / 2, s)) pools.push(new T.Matrix4().makeRotationY(s < 0 ? Math.PI : 0).setPosition(s * (RHYTHM.lamp - POOL.in), 0, z + P / 2));
    }
  }
  // the side street's walks (Task 33 pick 2, board 28; street.js SIDE): a tree in a pit every SIDE.tree.every m turned in quarter steps,
  // a lamp halfway between every second pair as far off its kerb as the avenue's (so its pool fits), the two walks half a pitch apart;
  // only kinds the avenue already draws (no new mesh), hashed from the place (no stream draw), off the avenue's footprints
  if (cross) {
    const [wa, wb] = sideWalls(cross.z), Tr = SIDE.tree, trees = kinds.filter((k) => byKind[k]), kerb = RHYTHM.lamp - (FACADE_X - WALK), up = new T.Vector3(0, 1, 0);
    for (const s of [-1, 1]) for (const [zw, dir] of [[wa, 1], [wb, -1]]) { // dir: from the wall toward the road
      const zt = zw + dir * Tr.in, zl = zw + dir * (SIDE.walk - kerb), key = (x, salt) => hash(3 * cross.z + x, 3 * s + dir, salt);
      for (let j = 0, x = Tr.from + (dir < 0 ? Tr.every / 2 : 0); x < SIDE.far - 2; j++, x += Tr.every) {
        const tree = trees[Math.floor(key(x, 9) * trees.length)], xl = x + Tr.every / 2;
        if (tree) { byKind[tree].push(new T.Matrix4().compose(new T.Vector3(s * x, 0.18, zt), new T.Quaternion().setFromAxisAngle(up, Math.floor(4 * key(x, 10)) * Math.PI / 2), new T.Vector3(Tr.k, Tr.k, Tr.k))); pits.push(new T.Matrix4().makeTranslation(s * x, 0.18, zt)); }
        if (j % 2 && byKind.lamp && xl < SIDE.far - 2) {
          byKind.lamp.push(new T.Matrix4().makeRotationY(dir > 0 ? 0 : Math.PI).setPosition(s * xl, 0.18, zl));
          pools.push(new T.Matrix4().makeRotationY(dir * Math.PI / 2).setPosition(s * xl, 0, zl + dir * POOL.in));
        }
      }
    }
  }
  for (const b of blocks ?? []) if (b.shop != null && hash(b.z0, b.side, 5) < PLANTER.chance) for (const d of [-PLANTER.dz, PLANTER.dz]) place('planter', PLANTER.x, (b.z0 + b.z1) / 2 + d, b.side);
  const total = STRETCH.reduce((t, x) => t + x.weight, 0);
  let rareLeft = true;
  for (const s of [-1, 1]) for (let a = z0 + SEAM, end = z0 + length - SEAM; a < end;) {
    const b = Math.min(a + SEG[0] + r() * (SEG[1] - SEG[0]), end);
    let w = r() * total;
    const st = STRETCH.find((x) => (w -= x.weight) < 0) ?? STRETCH[0];
    if (st.rare && rareLeft) { rareLeft = false; put(st.rare[Math.floor(r() * st.rare.length)], a, b, s); }
    else if (st.kind) { put(st, a, b, s); if (st.with) put(st.with, a, b, s); }
    if (r() < HYDRANT.chance) put(HYDRANT, a, b, s);
    a = b;
  }
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const m = instanced(T, p.geometry, kind === 'lamp' ? lampPaint(p.material, style) : p.material, mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.furniture = kind;
    if (kind in RHYTHM.trees) tint(T, m, mats, style);
    g.add(m);
  }
  if (pits.length) { const m = instanced(T, pitGeometry(T), material('kit/pit', () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), pits); m.userData.pit = true; g.add(m); noShadow(m); }
  if (style?.lit > 0 && pools.length) { const m = instanced(T, poolGeometry(T), poolMaterial(T), pools); m.userData.pool = true; g.add(m); }
  return g;
}

// A dusk theme's lamps: a copy of the kit's lamp paint at RHYTHM.dusk, kept by that paint and freed with it (the traffic.js pattern),
// so a day theme and a dusk theme built in one session each keep their own glow (one shared paint let the last chunk built set both).
// Only a lit model: the stand-in's glow is its own.
const dusk = new WeakMap();
function lampPaint(paint, style) {
  if (!(style?.lit > 0) || !paint.emissiveMap) return paint;
  if (!dusk.has(paint)) dusk.set(paint, freeWith(paint, Object.assign(paint.clone(), { emissiveIntensity: RHYTHM.dusk }))); // every texture is the paint's; clone() keeps the shared flag
  return dusk.get(paint);
}
// per-instance canopy colour: the theme's shift, then a hashed value and olive step (gfx.dispose frees instanceColor)
function tint(T, mesh, mats, style) {
  const [from, to] = TINT[style?.id] ?? ['#fff', '#fff'], f = new T.Color(from), base = new T.Color(to), p = new T.Vector3(), c = new T.Color(), olive = new T.Color();
  base.setRGB(base.r / f.r, base.g / f.g, base.b / f.b);
  mats.forEach((x, i) => {
    p.setFromMatrixPosition(x);
    const s = Math.sign(p.x), v = 1 + TINT.value * (2 * hash(p.z, s, 6) - 1), o = TINT.olive * hash(p.z, s, 7);
    mesh.setColorAt(i, c.copy(base).multiplyScalar(v).multiply(olive.setRGB(1 + o, 1, 1 - o)));
  });
}
// The shapes every chunk shares, built once and flagged shared (a few boxes and two quads: never freed).
const shared = (g) => { g.userData.shared = true; return g; };
// ponytail: the 1.5 cm pit casts no shadow (it drew into both cascades for nothing visible). gfx.bend marks every opaque mesh a
// caster after the parts are built, and this part's group sits inside the chunk's, so no 'added' of its own fires after the bend
// (the cable's re-set in bridge.js works only on the chunk's group): the flag is pinned instead.
const noShadow = (m) => Object.defineProperty(m, 'castShadow', { get: () => false, set() {} });
let pitShape = null, poolShape = null, poolMap = null;
// a rim of four stone strips round a dark soil square, vertex-coloured
function pitGeometry(T) {
  if (pitShape) return pitShape;
  const { size: w, rim } = PITS, c = (geo, hex) => { paint(T, geo, new T.Color(hex)); return geo; };
  return (pitShape = shared(mergeGeometries([
    c(new T.BoxGeometry(w - 2 * rim, 0.02, w - 2 * rim), PITS.soil),
    ...[[0, (w - rim) / 2, w, rim], [0, -(w - rim) / 2, w, rim], [(w - rim) / 2, 0, rim, w - 2 * rim], [-(w - rim) / 2, 0, rim, w - 2 * rim]].map(([x, z, sx, sz]) => c(new T.BoxGeometry(sx, 0.03, sz).translate(x, 0, z), PITS.stone)),
  ])));
}
// a pool's two levels, in its lamp's frame (+x away from the road): on the road just over the edge lines, on the sidewalk past the
// kerb just over its top and the pits, one radial map across both
function poolGeometry(T) {
  if (poolShape) return poolShape;
  const { r } = POOL, kerb = FACADE_X - WALK - (RHYTHM.lamp - POOL.in);
  const part = (x0, x1, y) => { const g = new T.PlaneGeometry(x1 - x0, 2 * r).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, 0), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + r) / (2 * r), (p.getZ(i) + r) / (2 * r)); return g; };
  return (poolShape = shared(mergeGeometries([part(-r, kerb, 0.03), part(kerb, r, 0.2)])));
}
// additive, its falloff in alpha, so the quad's corners add nothing even in the fog
function poolMaterial(T) {
  return material('kit/pool', () => {
    if (!poolMap) {
      const n = 64, px = new Uint8Array(n * n * 4);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2)) ** 2)], (y * n + x) * 4);
      poolMap = Object.assign(new T.DataTexture(px, n, n), { magFilter: T.LinearFilter, minFilter: T.LinearFilter, needsUpdate: true });
      poolMap.userData.shared = true;
    }
    return new T.MeshBasicMaterial({ map: poolMap, color: POOL.color, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  });
}
