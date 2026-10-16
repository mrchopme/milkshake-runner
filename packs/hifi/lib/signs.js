import { instanced } from './shapes.js';
import { material } from './materials.js';
import { cityFiles } from './facade.js';
import { FACADE_X } from './street.js';
import { CORNICE, LOWEST } from './buildings.js';
// Colour-block and poster stacks on the facades and blade signs over the storefronts (board 01), instanced: one draw call per
// image a chunk draws from. A missing poster's panel turns a colour block and a missing blade sign is left out; each image's
// material is keyed by its loaded texture, so it still shows on the next chunk once it lands.
// ponytail: calibration knobs — the colour blocks' brightness: lit-looking, under every look's bloom threshold, steady (the
// teaser's big flat colour panels; Caedon, 2026-10-14, board 18: was an LED face at 2.4, blinking); posters and blade images a
// chunk draws from (each image is a draw call), the share of stack panels that are posters, the posters' and blades' own glow
// (as the billboard's), and the blade signs (metres: width, centre height, at least this far apart and at most twice it, off the wall)
const LED = 1.05, PICK = 2, POSTER = 0.2, GLOW = 0.6;
export const BLADE = { w: 1.1, y: 3.65, every: 10, wall: 0.1 }; // y: its bottom 2.83 m up clears a newsstand's top (2.78), its top 4.47 the lowest stack's bezel (at least 6.86 − 1.1 × 4.2 / 2 = 4.55)
export const ASPECT = { poster: 1024 / 573, blade: 688 / 1024 }; // the generated images'; a poster keeps its image's aspect inside its drawn size
export const SIGN_FILES = { posters: cityFiles('signs', 'poster', 12), blades: cityFiles('signs', 'blade', 6) }; // the posters are the billboard's paths, so the cache loads each once
const loaded = (gfx, path) => { try { return path ? gfx.texture(path) : null; } catch { return null; } };
// A poster or blade sign lit by its own texels (its emissive map), so it stays bright in shade; null while its image is missing.
function imageMaterial(gfx, path) {
  const map = loaded(gfx, path);
  return map && material(`sign/${path}`, () => new gfx.three.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: GLOW, roughness: 0.7 }), map);
}
export function signs(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group(), sets = new Map(), bezels = [], colors = []; // material -> instance matrices
  const put = (mat, m) => { if (!sets.has(mat)) sets.set(mat, []); sets.get(mat).push(m); };
  const one = (list = []) => list[Math.floor(r() * list.length)], turn = (a) => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a);
  const led = material('led', () => new T.MeshBasicMaterial({ color: new T.Color(LED, LED, LED) })); // its palette colour per panel
  const posters = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.posters))), blades = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.blades)));
  // a stack's top bezel stays under the cornice of the shortest facade the theme builds (buildings.js's LOWEST since Task 32's
  // walk-ups; the block list will carry each block's own); the cornice juts out past the panels
  const roof = Math.min(style.buildings.minH, LOWEST) - CORNICE.h;
  // board 18: bigger panels (4–6 by 3–4.2 m) 4.2 m apart up the wall, more stacks, fewer posters. The first panel's centre at
  // 6.86 m keeps its bezel (1.1 × the panel) at 4.55 m or more, over the blade signs; one lift a stack keeps its panels apart.
  // seam: a panel spans z .. z + w (w <= 6) and its bezel 4% more each side, so the stack starts no later than 6.24 m from the end
  for (const side of [-1, 1]) for (let z = z0 + 4; z + 6.24 <= z0 + length; z += 7 + r() * 9) {
    if (cross && z + 6.24 > cross.z && z < cross.z + 12) continue;
    const stack = 1 + Math.floor(r() * 3), x = side * (FACADE_X - 0.08), w = 4 + r() * 2, lift = r(); // just off the facade, the bezel behind
    for (let k = 0; k < stack; k++) {
      const y = 6.86 + k * 4.2 + lift, h = 3 + r() * 1.2, color = new T.Color(style.signs[Math.floor(r() * style.signs.length)]);
      const mat = (r() < POSTER && posters[Math.floor(r() * PICK)]) || led, pw = Math.min(w, h * ASPECT.poster);
      const [sw, sh] = mat === led ? [w, h] : [pw, pw / ASPECT.poster]; // a block its drawn size, a poster its image's aspect
      if (y + 1.1 * sh / 2 > roof) break;
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z + w / 2), turn(-side * Math.PI / 2), new T.Vector3(sw, sh, 1));
      put(mat, m); bezels.push(m.clone().multiply(new T.Matrix4().makeScale(1.08, 1.1, 1)).setPosition(x + side * 0.03, y, z + w / 2));
      if (mat === led) colors.push(color);
    }
  }
  // blade signs: out from the wall over the sidewalk, under the lowest stack, facing the oncoming camera; never across the side street
  for (const side of [-1, 1]) for (let z = z0 + 1 + r() * BLADE.every; z <= z0 + length - 1; z += BLADE.every * (1 + r())) {
    const mat = blades[Math.floor(r() * PICK)];
    if (mat && !(cross && z > cross.z - 1 && z < cross.z + 13)) put(mat, new T.Matrix4().compose(new T.Vector3(side * (FACADE_X - BLADE.wall - BLADE.w / 2), BLADE.y, z), turn(Math.PI), new T.Vector3(BLADE.w, BLADE.w / ASPECT.blade, 1)));
  }
  for (const [mat, list] of sets) {
    const mesh = instanced(T, new T.PlaneGeometry(1, 1), mat, list);
    if (mat === led) colors.forEach((c, i) => mesh.setColorAt(i, c));
    g.add(mesh);
  }
  g.add(instanced(T, new T.PlaneGeometry(1, 1), material('bezel', () => new T.MeshStandardMaterial({ color: '#1b1d2a', roughness: 0.35 })), bezels));
  return g;
}
