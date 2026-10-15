import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { CROSS, FACADE_X } from './street.js';
import { BLADE } from './signs.js';
// Street furniture in random stretches (Caedon, 2026-10-14, board 18: "WAY too many trees and streetlamps ... trees are too
// repetitive ... generated randomly in segments"), one InstancedMesh per part per kind. Each side of a chunk is cut into stretches
// SEG m long; each stretch draws one kind by weight, and a hydrant on top by chance; x from the road's centre line. Across the
// 6 m sidewalk (kerb 4.5, facade 10.5): lamps, hydrants, signals and the bus shelter at the kerb; trees and the subway
// mid-sidewalk; bins, benches and newsstands against the buildings.
// ponytail: calibration knobs (board 18's prototype, as Caedon approved it).
export const SEG = [16, 34];
export const STRETCH = [
  { weight: 0.42 }, // bare
  { weight: 0.2, kind: 'tree', x: 7.2, n: [1, 3], step: 6.5, scale: [0.7, 1.05] }, // each its own size, turned any way
  { weight: 0.14, kind: 'lamp', x: 5.33 },
  { weight: 0.1, kind: 'bench', x: 9.85, with: { kind: 'bin', x: 9.8 } },
  { weight: 0.07, kind: 'newsstand', x: 9.35 },
  { weight: 0.07, rare: [{ kind: 'bus_shelter', x: 5.8 }, { kind: 'subway', x: 7.5 }] }, // at most one a chunk: a second draw is bare
];
export const HYDRANT = { chance: 0.25, kind: 'hydrant', x: 4.95 };
export const CLEAR = 2, SEAM = 2; // m kept clear of the side street; m kept from the chunk's ends
// ponytail: calibration knob — a tree's canopy reaches 2.31 m from its trunk in its widest direction at KIT's 6 m (measured on the
// generated model). Turned any way, a tree scaled past 0.9 steps toward the kerb, so its canopy stays clear of the blade signs.
const CANOPY = 2.31, BLADES = FACADE_X - BLADE.wall - BLADE.w;
// ponytail: calibration knobs — each piece's footprint, half its size across the sidewalk and along it (metres, measured on the
// generated models at KIT's heights). Every piece keeps GAP m from the footprints already on its side, so nothing stands inside
// anything else: a corner's traffic light goes first, a piece tries up to TRIES spots in its stretch before it is left out, and a
// tree in a row skips its spot. A tree turns any way, so it keeps the square its footprint sweeps (the half diagonal each way).
export const FOOT = { lamp: [0.54, 0.55], traffic_light: [0.72, 0.72], hydrant: [0.19, 0.2], bin: [0.2, 0.2], tree: [1.23, 1.24], bench: [0.3, 0.58], newsstand: [0.81, 1.09], bus_shelter: [0.87, 1.42], subway: [1.49, 1.25] };
const GAP = 0.2, TRIES = 10, PIT = Math.hypot(...FOOT.tree);

export function furniture(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group(), byKind = {}, feet = { [-1]: [], [1]: [] }; // feet: the footprints on each side so far, [x0, x1, z0, z1]
  const foot = (kind, x, z, k = 1) => { const [hx, hz] = kind === 'tree' ? [PIT, PIT] : FOOT[kind]; return [Math.abs(x) - hx * k, Math.abs(x) + hx * k, z - hz * k, z + hz * k]; };
  const free = (f, side) => feet[side].every((o) => f[1] + GAP <= o[0] || o[1] + GAP <= f[0] || f[3] + GAP <= o[2] || o[3] + GAP <= f[2]);
  const clear = (z) => !cross || z <= cross.z - CLEAR || z >= cross.z + CROSS.width + CLEAR;
  const fits = (kind, x, z, side, k) => clear(z) && free(foot(kind, x, z, k), side);
  const at = (kind, x, z, side, k = 1, yaw = 0) => { feet[side].push(foot(kind, x, z, k)); (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(x, 0.18, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (side > 0 ? -Math.PI / 2 : Math.PI / 2) + yaw), new T.Vector3(k, k, k))); };
  const put = ({ kind, x }, a, b, s) => { // a random spot whose footprint stays in [a, b]
    const hz = FOOT[kind][1];
    for (let t = 0; t < TRIES && b - a >= 2 * hz; t++) { const z = a + hz + r() * (b - a - 2 * hz); if (fits(kind, x, z, s)) return at(kind, s * x, z, s); }
  };
  const total = STRETCH.reduce((t, x) => t + x.weight, 0);
  let rareLeft = true;
  // the signals on diagonal corners (Caedon, board 19, 2026-10-15: a mirrored pair read as weird): one before the side street on a
  // side drawn at random, the other across the avenue past it, each base on the sidewalk 0.5 m from the paving. A crossing sits
  // 30 m or more from either end of its chunk (lib/city.js), so the far one never leaves it.
  if (cross) { const s = r() < 0.5 ? -1 : 1; at('traffic_light', s * 5.28, cross.z - 0.5, s); at('traffic_light', -s * 5.28, cross.z + CROSS.width + 0.5, -s); }
  for (const s of [-1, 1]) for (let a = z0 + SEAM, end = z0 + length - SEAM; a < end;) {
    const b = Math.min(a + SEG[0] + r() * (SEG[1] - SEG[0]), end);
    let w = r() * total;
    const st = STRETCH.find((x) => (w -= x.weight) < 0) ?? STRETCH[0];
    if (st.rare && rareLeft) { rareLeft = false; put(st.rare[Math.floor(r() * st.rare.length)], a, b, s); }
    else if (st.kind === 'tree') { // a row, step m apart, its first footprint in the stretch; a tree that would leave it is left out
      const n = st.n[0] + Math.floor(r() * (st.n[1] - st.n[0] + 1)), edge = PIT * st.scale[1], z1 = a + edge + r() * Math.max(0, b - a - 2 * edge - (n - 1) * st.step);
      for (let i = 0; i < n; i++) {
        const k = st.scale[0] + r() * (st.scale[1] - st.scale[0]), x = Math.min(st.x, BLADES - CANOPY * k), z = z1 + i * st.step;
        if (z + PIT * k <= b && fits('tree', x, z, s, k)) at('tree', s * x, z, s, k, r() * 2 * Math.PI);
      }
    } else if (st.kind) { put(st, a, b, s); if (st.with) put(st.with, a, b, s); }
    if (r() < HYDRANT.chance) put(HYDRANT, a, b, s);
    a = b;
  }
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const m = instanced(T, p.geometry, p.material, mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.furniture = kind;
    g.add(m);
  }
  return g;
}
