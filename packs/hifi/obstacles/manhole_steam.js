// HiFi manhole_steam: the generated cover in public/hifi/manhole_steam.glb, fitted to the shipped box (content/obstacles/manhole_steam.js),
// and the steam column, made in code: one Points cloud every manhole shares. The shipped cycle and hit timing stay as they are;
// the view shows the steam while `active` (the cycle's on window) and the vertex shader moves the puffs on the run clock.
import { fitBox } from '../lib/fit.js';
import { gloss, painter, SATIN } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — turns the model's front (+x) toward the player (-z); a flat cover is nearly symmetric, so this is a guess
const paint = painter((T, m) => gloss(T, m, SATIN)); // bare cast iron (the model's own metal map stays, Task 23 ruling) under a light wet sheen
// ponytail: calibration knobs. rate: a puff's full rises per second (its life is 1 / rate s); small and large: its diameter in metres at
// the grate and at the top (large must fit the box: w and d); cone: the share of the box's free width a puff may drift to, at the
// grate and at the top; opacity per puff; colour below the look's bloom threshold (0.85, linear): steam is not a light.
export const STEAM = { count: 28, rate: 2.2, small: 0.2, large: 0.8, cone: [0.2, 0.65], opacity: 0.3, color: '#d9e1e6' };

let parts; // { scale, offset, steam }, measured from the first copy

export default {
  kind: 'obstacle', id: 'manhole_steam', assets: ['hifi/manhole_steam.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/manhole_steam.glb');
    model.rotation.y = YAW;
    parts ??= build(T, gfx, model, this);
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    const steam = new T.Points(parts.steam.geometry, parts.steam.material);
    steam.userData.shared = true; // every manhole draws these; gfx.dispose leaves them alone
    steam.visible = false;
    return { object: gfx.group(model, steam), update(o, run, dt, active) { steam.visible = active; } };
  },
};

function build(T, gfx, model, { box, cycle }) {
  const { scale, offset } = fitBox(T, model, box, true);
  const top = new T.Box3().setFromObject(model).getSize(new T.Vector3()).y * scale; // the cover's height: the column starts there
  return { scale, offset, steam: steam(T, gfx, box, cycle.period, top) };
}

// The puffs' seeds, one vec4 each: two for where it drifts, one for its age offset (evenly spread, so the column is steady),
// one for its size. A Kronecker sequence, no rng: the same column every build.
const fract = (x) => x - Math.floor(x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const seed = (i) => [fract(i * 0.7548776662466927), fract(i * 0.5698402909980532), i / STEAM.count, fract(i * 0.618034)];

// One puff at `ph` seconds into the cycle (cycle number k, so every eruption scatters differently): the vertex shader's formula
// in JavaScript, what the tests exercise (as gfx.bendOffset does for the bend); the GLSL below is checked by eye.
// ponytail: the formula lives twice (puff and MOTION), so a retune must change both; a test cannot run GLSL in Node.
// A puff is born at the grate, rises through the box's whole height while it swells, and fades in and out; its drift widens
// as it climbs, within the box's free width, so its sprite never leaves the box (the timing rule).
export function puff([s0, s1, s2, s3], ph, k, { w, h, d }, top) {
  const a = fract(ph * STEAM.rate + s2), D = STEAM.small + (STEAM.large - STEAM.small) * a * (0.7 + 0.3 * s3);
  const cone = STEAM.cone[0] + (STEAM.cone[1] - STEAM.cone[0]) * a;
  const u = fract(s0 + 0.618 * k) * 2 - 1, v = fract(s1 + 0.382 * k) * 2 - 1;
  return { x: u * (w / 2 - D / 2) * cone, y: top + D / 2 + a * (h - top - STEAM.large), z: v * (d / 2 - D / 2) * cone, d: D, fade: smooth(0, 0.12, a) * (1 - smooth(0.7, 1, a)) };
}
const f = (x) => x.toFixed(4);
const MOTION = `
  float k = floor( uTime / uPeriod ), ph = uTime - k * uPeriod;
  float a = fract( ph * ${f(STEAM.rate)} + aSeed.z ), pD = ${f(STEAM.small)} + ${f(STEAM.large - STEAM.small)} * a * ( 0.7 + 0.3 * aSeed.w );
  float cone = ${f(STEAM.cone[0])} + ${f(STEAM.cone[1] - STEAM.cone[0])} * a;
  vec2 drift = fract( aSeed.xy + vec2( 0.618, 0.382 ) * k ) * 2.0 - 1.0;
  transformed = vec3( drift.x * ( uBox.x - 0.5 * pD ) * cone, uBox.w + 0.5 * pD + a * ( uBox.y - uBox.w - ${f(STEAM.large)} ), drift.y * ( uBox.z - 0.5 * pD ) * cone );
  vFade = smoothstep( 0.0, 0.12, a ) * ( 1.0 - smoothstep( 0.7, 1.0, a ) );`;

function steam(T, gfx, { w, h, d }, period, top) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(STEAM.count * 3), 3)); // never read: the shader places every puff
  geometry.setAttribute('aSeed', new T.BufferAttribute(new Float32Array(Array.from({ length: STEAM.count }, (_, i) => seed(i)).flat()), 4));
  geometry.boundingBox = new T.Box3(new T.Vector3(-w / 2, top, -d / 2), new T.Vector3(w / 2, h, d / 2)); // the shader moves the puffs, so cull by the column
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new T.Sphere());
  const material = new T.PointsMaterial({ color: STEAM.color, size: 1, transparent: true, opacity: STEAM.opacity, depthWrite: false });
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTime: gfx.time, uPeriod: { value: period }, uBox: { value: new T.Vector4(w / 2, h, d / 2, top) } });
    s.vertexShader = 'uniform float uTime, uPeriod;\nuniform vec4 uBox;\nattribute vec4 aSeed;\nvarying float vFade;\n' + s.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>${MOTION}`)
      .replace('gl_PointSize = size;', 'gl_PointSize = size * pD * projectionMatrix[ 1 ][ 1 ];');
    s.fragmentShader = 'varying float vFade;\n' + s.fragmentShader
      .replace('#include <map_particle_fragment>', `#include <map_particle_fragment>\n  diffuseColor.a *= vFade * ( 1.0 - smoothstep( 0.2, 1.0, length( gl_PointCoord - 0.5 ) * 2.0 ) );`);
  };
  geometry.userData.shared = material.userData.shared = true;
  return { geometry, material };
}
