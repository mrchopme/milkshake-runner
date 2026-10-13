import { KIT, kitParts, placeholder } from './kit.js';
import { instanced } from './shapes.js';
import { material } from './materials.js';
// Distant traffic on the cross street only: each car sits at a side-street lane centre at the avenue's edge and slides
// outward in the vertex stage on the run clock, wrapping, so it never enters the avenue.
// ponytail: calibration knobs: m/s, metres of side street a car drives before it wraps, |x| where it starts, lanes from cross.z.
export const DRIVE = { speed: 6, span: 31, from: 9, lanes: [3, 9] };
const KINDS = ['sedan', 'van', 'taxi'];
// A clone of the kit's material (one per source material, cached and shared; gfx.bend patches the clone in its own right)
// whose vertices slide along the part's own z before the instance matrix. ponytail: assumes the part's matrix is unscaled
// with +z ahead, as the placeholders are; a fitted model (Task 23) may need the drive in the fitted frame.
function driving(gfx, source, phase) {
  return material(`traffic/${source.uuid}`, () => {
    const m = source.clone();
    m.onBeforeCompile = (s) => { // the phase is a uniform: every clone shares one program (three keys it by this hook's source)
      s.uniforms.uTime = gfx.time; s.uniforms.uPhase = { value: phase };
      s.vertexShader = 'uniform float uTime;\nuniform float uPhase;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed.z += mod( uTime * ${DRIVE.speed.toFixed(1)} + fract( float( gl_InstanceID ) * 0.618 + uPhase ) * ${DRIVE.span.toFixed(1)}, ${DRIVE.span.toFixed(1)} );`);
    };
    return m;
  });
}
export function traffic(gfx, args, style, r, cross) {
  const T = gfx.three, g = gfx.group(), byKind = {};
  if (!cross) return g;
  for (let n = 2 + Math.floor(r() * 3); n > 0; n--) { // two to four cars; heading +x in the far lane, -x in the near one
    const side = r() < 0.5 ? -1 : 1, kind = KINDS[Math.floor(r() * KINDS.length)];
    (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(side * DRIVE.from, 0, cross.z + DRIVE.lanes[side > 0 ? 1 : 0]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side * Math.PI / 2), new T.Vector3(1, 1, 1)));
  }
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
    const m = instanced(T, p.geometry, driving(gfx, p.material, KINDS.indexOf(kind) / KINDS.length), mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.traffic = true;
    g.add(m);
  }
  return g;
}
