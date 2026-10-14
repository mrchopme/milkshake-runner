import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { material } from './materials.js';
import { freeWith } from './paint.js';
// Distant traffic on the cross street only: each car sits at a side-street lane centre at the avenue's edge and slides
// outward in the vertex stage on the run clock, wrapping, so it never enters the avenue.
// ponytail: calibration knobs: m/s; |x| where a car starts (1.5 m behind the corner building line) and where it wraps (the paving ends at
// CROSS.reach 20.5 m, the back of the blocks, less half the longest car, 2.5 m, so a whole car stays on it); lanes from cross.z.
export const DRIVE = { speed: 6, from: 12, to: 18, lanes: [3, 9] };
const SPAN = (DRIVE.to - DRIVE.from).toFixed(1), KINDS = ['sedan', 'van', 'taxi'];
// The drive: vertices slide along +z (ahead) before the instance matrix, the phase a uniform so every material with this
// hook shares one program (three keys it by the hook's source).
const drive = (gfx, phase) => (s) => {
  s.uniforms.uTime = gfx.time; s.uniforms.uPhase = { value: phase };
  s.vertexShader = 'uniform float uTime;\nuniform float uPhase;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed.z += mod( uTime * ${DRIVE.speed.toFixed(1)} + fract( float( gl_InstanceID ) * 0.618 + uPhase ) * ${SPAN}, ${SPAN} );`);
};
// A clone of the kit's material, one per kit paint, shared by every chunk (gfx.bend patches the clone in its own right). Kept in a
// WeakMap by that paint and disposed with it, not in materials.js's session Map: the clone holds every texture of the paint (a
// vehicle's 1024 colour and ORM images, the sedan's canvases), so after assets.release frees the file it must go with the paint.
const drivers = new WeakMap();
const driving = (gfx, source, phase) => {
  if (!drivers.has(source)) {
    const m = Object.assign(source.clone(), { onBeforeCompile: drive(gfx, phase) });
    m.userData.shared = true; // every chunk draws it; gfx.dispose leaves it
    drivers.set(source, freeWith(source, m)); // every texture is the paint's: this frees the clone alone
  }
  return drivers.get(source);
};
// The shadow pass draws with this instead of three's own depth material, so the shadow drives with the car.
const shadow = (gfx, phase) => material(`traffic/depth/${phase}`, () => Object.assign(new gfx.three.MeshDepthMaterial({ depthPacking: gfx.three.RGBADepthPacking }), { onBeforeCompile: drive(gfx, phase) }));
// A model part's geometry with its fit (node transforms, scale, yaw) baked in, cached and shared, so the instance matrix
// is the placement alone and +z is the car's own ahead in metres. Placeholders are already in that frame. Freed with the loaded geometry.
const baked = new WeakMap();
export function fitted(T, p) {
  if (p.matrix.equals(new T.Matrix4())) return p.geometry;
  if (!baked.has(p)) {
    const g = p.geometry.clone().applyMatrix4(p.matrix);
    g.userData = { shared: true };
    p.geometry.addEventListener('dispose', () => g.dispose());
    baked.set(p, g);
  }
  return baked.get(p);
}
export function traffic(gfx, args, style, r, cross) {
  const T = gfx.three, g = gfx.group(), byKind = {};
  if (!cross) return g;
  for (let n = 2 + Math.floor(r() * 3); n > 0; n--) { // two to four cars; heading +x in the far lane, -x in the near one
    const side = r() < 0.5 ? -1 : 1, kind = KINDS[Math.floor(r() * KINDS.length)];
    (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(side * DRIVE.from, 0, cross.z + DRIVE.lanes[side > 0 ? 1 : 0]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side * Math.PI / 2), new T.Vector3(1, 1, 1)));
  }
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const phase = KINDS.indexOf(kind) / KINDS.length, m = instanced(T, fitted(T, p), driving(gfx, p.material, phase), mats);
    m.customDepthMaterial = shadow(gfx, phase);
    m.userData.traffic = kind;
    g.add(m);
  }
  return g;
}
