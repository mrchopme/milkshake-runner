import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { CROSS } from './street.js';
// Street furniture on board 15's rhythm (approved by Caedon as drawn), one InstancedMesh per part per kind.
// ponytail: calibration knobs from board 15. RHYTHM: metres between copies along each side, x from the road's centre line.
// Across the 6 m sidewalk (kerb 4.5, facade 10.5): lamps, hydrants, signals and the bus shelter at the kerb; trees and the
// subway mid-sidewalk, a tree's canopy clear of the blade signs; bins, benches and newsstands against the buildings.
export const RHYTHM = [
  { kind: 'lamp', every: 24, x: 5.33, alternate: true },
  { kind: 'tree', every: 18, x: 7.2, offset: 9 },
  { kind: 'hydrant', every: 40, x: 4.95, offset: 14 }, // at least 2 m from a lamp's 1.6 m base on either side
  { kind: 'bin', every: 30, x: 9.8, offset: 5 },
];
export const SCATTER = [ // about this many a chunk on average, each on a random side and spot
  { kind: 'bench', perChunk: 1, x: 9.85 },
  { kind: 'newsstand', perChunk: 1, x: 9.35 },
];
export const RARE = { chance: 0.5, kinds: [{ kind: 'bus_shelter', x: 5.8 }, { kind: 'subway', x: 7.5 }] }; // at most one a chunk, on one side
export const CLEAR = 2, JITTER = 0.3, SEAM = 2; // m kept clear of the side street; ± m along the street from the chunk's seed; m kept from the chunk's ends
const WIDE = 1.5; // half the footprint along z of the widest piece (a bus shelter is about 3 m)
// ponytail: calibration knobs — each piece's footprint, half its size across the sidewalk and along it (metres, measured on the
// generated models at KIT's heights). Every piece keeps GAP m from the footprints already on its side, so nothing stands inside
// anything else: a rhythm piece skips its spot (only a corner's traffic light, placed first, can hold it), a scattered or rare
// piece tries up to TRIES spots before it is left out.
const FOOT = { lamp: [0.77, 0.8], traffic_light: [0.72, 0.72], hydrant: [0.19, 0.2], bin: [0.2, 0.2], tree: [1.23, 1.24], bench: [0.3, 0.58], newsstand: [0.81, 1.09], bus_shelter: [0.87, 1.42], subway: [1.49, 1.25] };
const GAP = 0.2, TRIES = 10;

export function furniture(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group(), byKind = {}, feet = { [-1]: [], [1]: [] }; // feet: the footprints on each side so far, [x0, x1, z0, z1]
  const foot = (kind, x, z) => { const [hx, hz] = FOOT[kind]; return [Math.abs(x) - hx, Math.abs(x) + hx, z - hz, z + hz]; };
  const free = (f, side) => feet[side].every((o) => f[1] + GAP <= o[0] || o[1] + GAP <= f[0] || f[3] + GAP <= o[2] || o[3] + GAP <= f[2]);
  const at = (kind, x, z, side) => { feet[side].push(foot(kind, x, z)); (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(x, 0.18, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side > 0 ? -Math.PI / 2 : Math.PI / 2), new T.Vector3(1, 1, 1))); };
  const clamp = (z) => Math.min(z0 + length - SEAM, Math.max(z0 + SEAM, z)); // seam: the widest footprint stays inside the chunk
  const clear = (z) => !cross || z <= cross.z - CLEAR || z >= cross.z + CROSS.width + CLEAR;
  const spot = () => { // a random z on the chunk, the side street's clear zone left out
    const a = cross ? cross.z - CLEAR - WIDE : 0, gap = cross ? CROSS.width + 2 * (CLEAR + WIDE) : 0;
    const z = z0 + SEAM + r() * (length - 2 * SEAM - gap);
    return z > a ? z + gap : z;
  };
  const side = () => (r() < 0.5 ? -1 : 1);
  const drop = (rule, s) => { for (let k = 0; k < TRIES; k++) { const z = spot(); if (free(foot(rule.kind, rule.x, z), s)) return at(rule.kind, s * rule.x, z, s); } };
  if (cross) for (const s of [-1, 1]) at('traffic_light', s * 5.28, cross.z - 0.5, s); // both corners before the crosswalk, the base on the sidewalk
  for (const rule of RHYTHM) for (const s of [-1, 1]) {
    const start = z0 + ((rule.offset ?? 0) + (rule.alternate && s > 0 ? rule.every / 2 : 0)) % rule.every;
    for (let z = start; z < z0 + length - 1; z += rule.every) {
      const zj = clamp(z + (r() - 0.5) * 2 * JITTER);
      if (clear(zj) && free(foot(rule.kind, rule.x, zj), s)) at(rule.kind, s * rule.x, zj, s); // a corner's light keeps its spot
    }
  }
  for (const rule of SCATTER) for (let n = Math.floor(rule.perChunk * length / 120 + r()); n > 0; n--) drop(rule, side());
  if (r() < RARE.chance) drop(RARE.kinds[Math.floor(r() * RARE.kinds.length)], side());
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const m = instanced(T, p.geometry, p.material, mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.furniture = kind;
    g.add(m);
  }
  return g;
}
