import { chunkRng } from './rand.js';
import { street, CROSS } from './street.js';
import { stone } from './bridge.js';
// ponytail: calibration knobs, metres (Task 31a): the land's top just under the road's and the side street's 0.1 m slabs, its
// sides out to the back of the blocks (their bodies end 2 cm past the side street's paving)
const LAND = { top: -0.12, half: CROSS.reach + 0.02 };
// The HiFi city (round 2 spec): one chunk of street, buildings, signs and furniture, all inside [z0, z0 + length].
// Each later task adds its part here; a part that throws is skipped, so the street is always there.
export function cityChunk(gfx, args, style) {
  const r = chunkRng(args.rng), g = gfx.group();
  const cross = args.length >= 100 ? { z: args.z0 + 30 + Math.floor(r() * (args.length - 60 - CROSS.width)) } : null; // one cross street in a full chunk
  g.userData.cross = cross; // for tests and later parts
  g.add(street(gfx, args, style, cross));
  // the land under the whole chunk (Task 31a): unseen inside the city, a stone quay rising from the water where a bridge meets it
  const land = stone(gfx, style.buildings.colors, LAND.half * 2, LAND.top, args.length);
  land.position.z = args.z0 + args.length / 2;
  land.userData.land = true;
  g.add(land);
  for (const part of style.parts ?? []) {
    try { g.add(part(gfx, args, style, r, cross)); } catch (err) { console.warn(`city ${style.id}: ${part.name} failed:`, err); }
  }
  return g;
}
