import { instanced } from './shapes.js';
import { material } from './materials.js';
import { cityFiles } from './facade.js';
import { FACADE_X } from './street.js';
import { CORNICE } from './buildings.js';
import { rng } from '../../../src/generator.js';
// The signs over the shop band (Task 32, Caedon's board 23 pick, 2026-10-15: "As prototyped, signs: none"; board 18's colour
// blocks withdrawn, "weird blocks of colour"): a framed poster about every 75 m a side and a blade sign now and then, each on one
// block of the block list (buildings.js's header) and under its cornice, instanced (a draw call per image a chunk draws from).
// Every image glows from its own texels; one not loaded yet is left out, and its material is keyed by its texture, so it shows on
// the next chunk once it lands. No block list (a theme without buildings), no signs.
// ponytail: calibration knobs, metres (board 23's stack, tuned by eye). GLOW: an image's own emissive, by day (style.lit 0) and at
// dusk (Caedon's board 23: 0.6 by day read as stuck on); PICK: images a chunk draws from. Posters: width (narrower on a short
// block, never under 2.5), centre height range (the cornice can lower it, never under a 6 m bottom), frame margin and depth, and
// spacing on a side; OFF: the frame's back off the wall, clear of the facade relief (ledges 0.18 m out). Blades: width (the
// pictograms keep their aspect), centre height (floors 2-3, over the awnings and the fascia), off the wall, the chance of one a
// side a chunk at style.bladeRate 1 (0.83: 100 m / 120 m, at most one a side per ~100 m).
const GLOW = { day: 0.2, dusk: 0.6 }, PICK = 2;
export const POSTER = { w: 4, min: 2.5, y: [8, 9], bottom: 6, frame: 0.15, off: 0.19, every: [60, 80] };
export const BLADE = { w: 1.4, y: 7.2, wall: 0.1, chance: 0.83 };
export const ASPECT = { poster: 1024 / 573, blade: 688 / 1024 }; // the generated images'; a poster or blade keeps its image's aspect
export const SIGN_FILES = { posters: cityFiles('signs', 'poster', 12), blades: cityFiles('signs', 'blade', 6) };
const loaded = (gfx, path) => { try { return path ? gfx.texture(path) : null; } catch { return null; } };
function imageMaterial(gfx, path, glow) {
  const map = loaded(gfx, path);
  return map && material(`sign/${path}/${glow}`, () => new gfx.three.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: glow, roughness: 0.7 }), map);
}
export function signs(gfx, { z0, length }, style, r, cross, blocks = []) {
  const T = gfx.three, g = gfx.group(), sets = new Map(), frames = [];
  g.userData.signs = true; // for tests
  // ponytail: one draw from the chunk stream seeds the signs' own: furniture and traffic land where board 23's frames had them,
  // and nothing here moves them again
  const q = rng(Math.floor(r() * 2 ** 32));
  const put = (mat, m) => { if (!sets.has(mat)) sets.set(mat, []); sets.get(mat).push(m); };
  const one = (list = []) => list[Math.floor(q() * list.length)], turn = (a) => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a);
  const glow = (style.lit ?? 0) > 0 ? GLOW.dusk : GLOW.day;
  const posters = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.posters), glow)), blades = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.blades), glow));
  const mine = blocks.filter((b) => b.z0 >= z0 && b.z1 <= z0 + length); // buildings never cross the seam; this keeps it so
  const ceil = (b) => Math.min(b.setAt ?? b.h, b.h) - CORNICE.h; // under the block's own cornice
  const used = new Set(), P = POSTER, m = P.frame;
  // posters: at most one per 60-80 m a side, centred on a block wide enough to hold it and its frame, never across a gap
  for (const side of [-1, 1]) {
    let next = z0 + q() * P.every[0];
    for (const b of mine.filter((x) => x.side === side)) { // low z to high (the list's order)
      const zc = (b.z0 + b.z1) / 2, w = Math.min(P.w, b.z1 - b.z0 - 1.5), h = w / ASPECT.poster;
      const y = Math.min(P.y[0] + q() * (P.y[1] - P.y[0]), ceil(b) - h / 2 - m);
      const mat = posters[Math.floor(q() * PICK)];
      if (zc < next || w < P.min || y - h / 2 < P.bottom || !mat) continue;
      const back = FACADE_X - P.off;
      put(mat, new T.Matrix4().compose(new T.Vector3(side * (back - m - 0.01), y, zc), turn(-side * Math.PI / 2), new T.Vector3(w, h, 1)));
      frames.push(new T.Matrix4().compose(new T.Vector3(side * (back - m / 2), y, zc), new T.Quaternion(), new T.Vector3(m, h + 2 * m, w + 2 * m)));
      used.add(b); next = zc + P.every[0] + q() * (P.every[1] - P.every[0]);
    }
  }
  // blades: at most one a side a chunk, at the theme's rate (midtown none), out from the wall at a block's near end, on a block
  // with no poster, facing the oncoming camera
  for (const side of [-1, 1]) {
    const pick = q(), list = mine.filter((b) => b.side === side && b.z1 - b.z0 > 4 && !used.has(b)), b = list[Math.floor(q() * list.length)], mat = blades[Math.floor(q() * PICK)];
    const bh = BLADE.w / ASPECT.blade;
    if (!b || !mat || pick >= BLADE.chance * (style.bladeRate ?? 0) || BLADE.y + bh / 2 > ceil(b)) continue;
    put(mat, new T.Matrix4().compose(new T.Vector3(side * (FACADE_X - BLADE.wall - BLADE.w / 2), BLADE.y, b.z0 + 1), turn(Math.PI), new T.Vector3(BLADE.w, bh, 1)));
  }
  for (const [mat, list] of sets) g.add(instanced(T, new T.PlaneGeometry(1, 1), mat, list));
  if (frames.length) g.add(instanced(T, new T.BoxGeometry(1, 1, 1), material('sign/frame', () => new T.MeshStandardMaterial({ color: '#23242c', roughness: 0.55 })), frames));
  return g;
}
