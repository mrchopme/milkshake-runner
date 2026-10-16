import { chunkRng } from './rand.js';
import { street, CROSS } from './street.js';
import { stone, WATER } from './bridge.js';
// ponytail: calibration knob, metres (Task 31a): the land's top just under the road's and the side street's 0.1 m slabs; its sides
// run out as far as the bridge water, so from the bridge the city sits on a wide shore (the main session's fix round 1, after looking in the game)
const LAND_TOP = -0.12;
// The HiFi city (round 2 spec): one chunk of street, buildings, signs and furniture, all inside [z0, z0 + length].
// Each later task adds its part here; a part that throws is skipped, so the street is always there. Every part is called as
// part(gfx, args, style, r, cross, blocks): `blocks` is the list the buildings part fills (its shape: buildings.js's header), also on
// the group's userData for tests.
export function cityChunk(gfx, args, style) {
  const r = chunkRng(args.rng), g = gfx.group();
  const cross = args.length >= 100 ? { z: args.z0 + 30 + Math.floor(r() * (args.length - 60 - CROSS.width)) } : null; // one cross street in a full chunk
  g.userData.cross = cross; // for tests and later parts
  g.add(street(gfx, args, style, cross));
  // the land under the whole chunk (Task 31a): unseen inside the city, under the street and behind the blocks; a stone quay
  // rising from the water and running off both sides where a bridge meets it
  const land = stone(gfx, style.buildings.colors, WATER.half * 2, LAND_TOP, args.length);
  land.position.z = args.z0 + args.length / 2;
  land.userData.land = true;
  g.add(land);
  const blocks = g.userData.blocks = [];
  for (const part of style.parts ?? []) {
    try { g.add(part(gfx, args, style, r, cross, blocks)); } catch (err) { console.warn(`city ${style.id}: ${part.name} failed:`, err); }
  }
  return g;
}
