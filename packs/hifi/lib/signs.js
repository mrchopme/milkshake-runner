import { instanced } from './shapes.js';
import { material } from './materials.js';
import { cityFiles } from './facade.js';
import { FACADE_X } from './street.js';
// LED and poster stacks on the facades and blade signs over the storefronts (board 01), instanced: one draw call per image a
// chunk draws from. A missing LED face leaves its panels flat colour, a missing poster's panel turns LED and a missing blade
// sign is left out; each image's material is keyed by its path, so it still shows on the next chunk once it lands.
const LED = { glow: 2.4, rate: 0.8 }; // ponytail: brightness past the bloom threshold, blinks per second
// ponytail: calibration knobs — posters and blade images a chunk draws from (one LED face; each image is a draw call), the share
// of stack panels that are posters, the posters' and blades' own glow (as the billboard's), and the blade signs (metres: width,
// centre height, at least this far apart and at most twice it, off the wall)
const PICK = 2, POSTER = 0.5, GLOW = 0.6;
export const BLADE = { w: 1.1, y: 3.4, every: 10, wall: 0.1 };
const ASPECT = { led: 1024 / 439, poster: 1024 / 573, blade: 688 / 1024 }; // the generated images'; a panel keeps its image's aspect inside its drawn size
export const SIGN_FILES = { leds: cityFiles('signs', 'led', 3), posters: cityFiles('signs', 'poster', 12), blades: cityFiles('signs', 'blade', 6) }; // the posters are the billboard's paths, so the cache loads each once
const loaded = (gfx, path) => { try { return path ? gfx.texture(path) : null; } catch { return null; } };

export function ledMaterial(gfx, path) {
  const T = gfx.three, map = loaded(gfx, path);
  return material(map ? `led/${path}` : 'led', () => {
    const m = new T.MeshBasicMaterial({ color: new T.Color(LED.glow, LED.glow, LED.glow), map }); // a face's own bright texels bloom, its dark ones stay dark
    m.onBeforeCompile = (s) => { // each panel blinks on its own beat; the glow is the panel's own face, never a plate over it
      s.uniforms.uTime = gfx.time;
      s.vertexShader = 'varying float vBeat;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBeat = fract( float( gl_InstanceID ) * 0.618 );');
      s.fragmentShader = 'uniform float uTime;\nvarying float vBeat;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n  diffuseColor.rgb *= 0.65 + 0.35 * step( 0.5, fract( uTime * ${LED.rate.toFixed(2)} + vBeat ) );`);
    };
    return m;
  });
}
// A poster or blade sign lit by its own texels (its emissive map), so it stays bright in shade; null while its image is missing.
function imageMaterial(gfx, path) {
  const map = loaded(gfx, path);
  return map && material(`sign/${path}`, () => new gfx.three.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: GLOW, roughness: 0.7 }));
}
export function signs(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group(), sets = new Map(), bezels = [], colors = []; // material -> instance matrices
  const put = (mat, m) => { if (!sets.has(mat)) sets.set(mat, []); sets.get(mat).push(m); };
  const one = (list = []) => list[Math.floor(r() * list.length)], turn = (a) => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a);
  const led = ledMaterial(gfx, one(style.leds)), posters = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.posters))), blades = Array.from({ length: PICK }, () => imageMaterial(gfx, one(style.blades)));
  // seam: a panel spans z .. z + w (w <= 6) and its bezel 4% more each side, so the stack starts no later than 6.24 m from the end
  for (const side of [-1, 1]) for (let z = z0 + 4; z + 6.24 <= z0 + length; z += 9 + r() * 14) {
    if (cross && z + 6.24 > cross.z && z < cross.z + 12) continue;
    const stack = 1 + Math.floor(r() * 3), x = side * (FACADE_X - 0.08), w = 3 + r() * 3; // just off the facade, the bezel behind
    for (let k = 0; k < stack; k++) {
      const y = 6 + k * 3.4 + r(), h = 2.2 + r() * 0.8, color = new T.Color(style.signs[Math.floor(r() * style.signs.length)]);
      const mat = (r() < POSTER && posters[Math.floor(r() * PICK)]) || led, a = mat === led ? ASPECT.led : ASPECT.poster, pw = Math.min(w, h * a);
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z + w / 2), turn(-side * Math.PI / 2), new T.Vector3(pw, pw / a, 1));
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
    if (mat === led && !led.map) colors.forEach((c, i) => mesh.setColorAt(i, c));
    g.add(mesh);
  }
  g.add(instanced(T, new T.PlaneGeometry(1, 1), material('bezel', () => new T.MeshStandardMaterial({ color: '#1b1d2a', roughness: 0.35 })), bezels));
  return g;
}
