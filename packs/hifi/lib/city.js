import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chunkRng } from './rand.js';
import { street, CROSS, PAVE, pavingTexture, tintedMaterial } from './street.js';
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
  g.add(land(gfx, args, style));
  const blocks = g.userData.blocks = [];
  for (const part of style.parts ?? []) {
    try { g.add(part(gfx, args, style, r, cross, blocks)); } catch (err) { console.warn(`city ${style.id}: ${part.name} failed:`, err); }
  }
  return g;
}

// The land under the whole chunk (Task 31a): unseen inside the city, under the street and behind the blocks; a stone quay rising
// from the water and running off both sides where a bridge meets it. Its top is paved (Task 34 L-C, Task 33 item 3b: the bare slab
// read as a floating street): the box's own top face swapped for strips in the sidewalk's own material (group 1), each `cell` m
// across showing whole flags only (u from the kerb band's edge, so no kerb band or facade foot repeats), v on the sidewalk's 12 m
// period; one mesh, two draws.
function land(gfx, { z0, length }, style) {
  const T = gfx.three, G = style.ground, m = stone(gfx, style.buildings.colors, WATER.half * 2, LAND_TOP, length), box = m.geometry;
  const flag = G.flag ?? 1.5, cell = flag * Math.floor((6 - PAVE.kerb - PAVE.foot) / flag), zp = PAVE.len * Math.floor(z0 / PAVE.len), zc = z0 + length / 2, l = length / 2;
  const idx = Array.from(box.index.array), up = box.groups[2]; // BoxGeometry's groups: +x, -x, +y, -y, +z, -z
  idx.splice(up.start, up.count);
  box.setIndex(idx);
  box.clearGroups();
  const pos = [], uv = [];
  for (let x = -WATER.half; x < WATER.half - 1e-6; x += cell) {
    const x1 = Math.min(x + cell, WATER.half), u1 = PAVE.kerb + x1 - x, v = (z) => z + zc - zp;
    pos.push(x, LAND_TOP, l, x1, LAND_TOP, l, x1, LAND_TOP, -l, x, LAND_TOP, l, x1, LAND_TOP, -l, x, LAND_TOP, -l); // two triangles facing up
    uv.push(PAVE.kerb, v(l), u1, v(l), u1, v(-l), PAVE.kerb, v(l), u1, v(-l), PAVE.kerb, v(-l));
  }
  const top = new T.BufferGeometry(), n = pos.length / 3;
  top.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  top.setAttribute('normal', new T.Float32BufferAttribute(Array.from({ length: n }, () => [0, 1, 0]).flat(), 3));
  top.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  top.setAttribute('color', new T.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); // merged with the stone, so it carries one
  top.setIndex([...Array(n).keys()]);
  m.geometry = mergeGeometries([box, top], true);
  box.dispose(); top.dispose();
  m.material = [m.material, tintedMaterial(T, style, 'walk', G.walk, G.walkRough, pavingTexture(T, style))]; // street.js's sidewalk material, the same instance
  m.position.z = zc;
  m.userData.land = true;
  return m;
}
