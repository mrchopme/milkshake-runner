import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { CROSS } from './street.js';
// Street furniture on board 15's rhythm (approved by Caedon as drawn), one InstancedMesh per part per kind.
// ponytail: calibration knobs from board 15. RHYTHM: metres between copies along each side, x from the road's centre line.
export const RHYTHM = [
  { kind: 'lamp', every: 24, x: 4.95, alternate: true },
  { kind: 'tree', every: 18, x: 6.6, offset: 9 },
  { kind: 'hydrant', every: 40, x: 4.95, offset: 13 },
  { kind: 'bin', every: 30, x: 5.1, offset: 5 },
];
export const SCATTER = [ // about this many a chunk on average, each on a random side and spot
  { kind: 'bench', perChunk: 1, x: 6.9 },
  { kind: 'newsstand', perChunk: 1, x: 6.5 },
];
export const RARE = { chance: 0.5, kinds: [{ kind: 'bus_shelter', x: 6.3 }, { kind: 'subway', x: 6.4 }] }; // at most one a chunk, on one side
export const CLEAR = 2, JITTER = 0.3, SEAM = 2; // m kept clear of the side street; ± m along the street from the chunk's seed; m kept from the chunk's ends
const WIDE = 1.5; // half the footprint along z of the widest piece (a bus shelter is about 3 m)

export function furniture(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group(), byKind = {};
  const at = (kind, x, z, side) => { (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(x, 0.18, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side > 0 ? -Math.PI / 2 : Math.PI / 2), new T.Vector3(1, 1, 1))); };
  const clamp = (z) => Math.min(z0 + length - SEAM, Math.max(z0 + SEAM, z)); // seam: the widest footprint stays inside the chunk
  const clear = (z) => !cross || z <= cross.z - CLEAR || z >= cross.z + CROSS.width + CLEAR;
  const spot = () => { // a random z on the chunk, the side street's clear zone left out
    const a = cross ? cross.z - CLEAR - WIDE : 0, gap = cross ? CROSS.width + 2 * (CLEAR + WIDE) : 0;
    const z = z0 + SEAM + r() * (length - 2 * SEAM - gap);
    return z > a ? z + gap : z;
  };
  const side = () => (r() < 0.5 ? -1 : 1);
  for (const rule of RHYTHM) for (const s of [-1, 1]) {
    const start = z0 + ((rule.offset ?? 0) + (rule.alternate && s > 0 ? rule.every / 2 : 0)) % rule.every;
    for (let z = start; z < z0 + length - 1; z += rule.every) {
      const zj = clamp(z + (r() - 0.5) * 2 * JITTER);
      if (clear(zj)) at(rule.kind, s * rule.x, zj, s);
    }
  }
  for (const rule of SCATTER) for (let n = Math.floor(rule.perChunk * length / 120 + r()); n > 0; n--) { const s = side(); at(rule.kind, s * rule.x, spot(), s); }
  if (r() < RARE.chance) { const rule = RARE.kinds[Math.floor(r() * RARE.kinds.length)], s = side(); at(rule.kind, s * rule.x, spot(), s); }
  if (cross) for (const s of [-1, 1]) at('traffic_light', s * 4.95, cross.z - 0.5, s); // both corners before the crosswalk
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const m = instanced(T, p.geometry, p.material, mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.furniture = kind;
    g.add(m);
  }
  return g;
}
