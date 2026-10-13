import { chunkRng } from './rand.js';
import { street, CROSS } from './street.js';
// The HiFi city (round 2 spec): one chunk of street, buildings, signs and furniture, all inside [z0, z0 + length].
// Each later task adds its part here; a part that throws is skipped, so the street is always there.
export function cityChunk(gfx, args, style) {
  const r = chunkRng(args.rng), g = gfx.group();
  const cross = args.length >= 100 ? { z: args.z0 + 30 + Math.floor(r() * (args.length - 60 - CROSS.width)) } : null; // one cross street in a full chunk
  g.userData.cross = cross; // for tests and later parts
  g.add(street(gfx, args, style, cross));
  for (const part of style.parts ?? []) {
    try { g.add(part(gfx, args, style, r, cross)); } catch (err) { console.warn(`city ${style.id}: ${part.name} failed:`, err); }
  }
  return g;
}
