// HiFi pigeons: the generated bird in public/hifi/pigeon.glb, one InstancedMesh over the shipped flock (content/obstacles/pigeons.js),
// every bird inside the slide box wherever its wings are in their beat. The wings flap in the vertex stage on the run clock
// (gfx.time), so a pause freezes them and a still pins them. Built once from the first copy; every flock shares it.
import { gloss } from '../lib/paint.js';
import { instanced } from '../lib/shapes.js';

const YAW = Math.PI; // ponytail: calibration knob — the bird's head is +z in the model (task-23-models); π turns it to the player (-z), its wings along ±x
const FLOCK = [-0.95, -0.45, 0.05, 0.5, 0.95].map((x, i) => [x, i % 2 ? 1.48 : 1.25]); // the shipped flock's body centres (x, y), metres
// ponytail: calibration knobs, in the model's own units after the yaw (the bird about 1 tall, centred). Measured in Node on the
// decoded mesh: the head |x| < 0.18 above y 0.2, the body's sides out to |x| 0.32 between y -0.24 and 0.18, the legs at |x| 0.2-0.22
// below y -0.3; no separate wing geometry, so a wing is a side of the body: its weight ramps in with |x| over `x` and with height
// over `y` (the belly and the legs stay), and it swings up and out about a hinge line along z at (±x[0], hinge), by up to `amp`
// radians, at `rate` radians of beat a second, each bird a radian of beat off the one before (the shipped flock's sin(time * 12 + i)).
// ponytail: the normals and the shadow pass keep the folded pose; rotate objectNormal too, or add a customDepthMaterial, if either reads wrong.
const FLAP = { amp: 1.0, rate: 12, x: [0.18, 0.28], y: [-0.2, 0], hinge: 0.15 };
const f = (n) => n.toFixed(3);
const FLAP_VERTEX = `
  float wing = smoothstep( ${f(FLAP.x[0])}, ${f(FLAP.x[1])}, abs( transformed.x ) ) * smoothstep( ${f(FLAP.y[0])}, ${f(FLAP.y[1])}, transformed.y );
  float lift = wing * ${f(FLAP.amp)} * ( 0.5 - 0.5 * cos( uTime * ${f(FLAP.rate)} + float( gl_InstanceID ) ) );
  vec2 arm = vec2( abs( transformed.x ) - ${f(FLAP.x[0])}, transformed.y - ${f(FLAP.hinge)} );
  transformed.xy = vec2( sign( transformed.x ) * ( ${f(FLAP.x[0])} + arm.x * cos( lift ) - arm.y * sin( lift ) ), ${f(FLAP.hinge)} + arm.x * sin( lift ) + arm.y * cos( lift ) );`;
// The same flap in JavaScript, for the fit and the tests: vertex (x, y) with the wings `k` (0 folded .. 1 fully up) through the beat.
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function flap(x, y, k) {
  const lift = smooth(...FLAP.x, Math.abs(x)) * smooth(...FLAP.y, y) * FLAP.amp * k, ax = Math.abs(x) - FLAP.x[0], ay = y - FLAP.hinge;
  return [Math.sign(x) * (FLAP.x[0] + ax * Math.cos(lift) - ay * Math.sin(lift)), FLAP.hinge + ax * Math.sin(lift) + ay * Math.cos(lift)];
}

let parts; // { geometry, paint, matrices }, built from the first copy

export default {
  kind: 'obstacle', id: 'pigeons', assets: ['hifi/pigeon.glb'],
  createView(gfx) {
    parts ??= build(gfx, gfx.asset('hifi/pigeon.glb'), this.box);
    return { object: gfx.group(instanced(gfx.three, parts.geometry, parts.paint, parts.matrices)) };
  },
};

function build(gfx, model, box) {
  const T = gfx.three;
  model.rotation.y = YAW;
  model.updateMatrixWorld(true);
  let mesh;
  model.traverse((n) => { if (n.isMesh) mesh ??= n; }); // one mesh, one material (task-23-models)
  // The yaw and the node's transform (the optimiser's dequantising scale) baked in, centred: the frame the flap and the fit work in.
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).center();
  geometry.userData.shared = true; // every flock draws it; gfx.dispose leaves it alone
  // The bird's reach with its wings anywhere in the beat, then the largest scale that keeps every bird of the flock in the box.
  const p = geometry.attributes.position, reach = new T.Box3(), v = new T.Vector3();
  for (let i = 0; i < p.count; i++) for (let k = 0; k <= 8; k++) reach.expandByPoint(v.set(...flap(p.getX(i), p.getY(i), k / 8), p.getZ(i)));
  const { min, max } = reach;
  const scale = Math.min(...FLOCK.flatMap(([x, y]) => [(box.w / 2 - x) / max.x, (box.w / 2 + x) / -min.x, (y - box.y) / -min.y, (box.y + box.h - y) / max.y, box.d / 2 / max.z, box.d / 2 / -min.z]));
  const paint = gloss(T, mesh.material, { clearcoat: 0.6, clearcoatRoughness: 0.2, metalness: 0, metalnessMap: null });
  paint.onBeforeCompile = (s) => { // the bird's own vertices, before three's instance and model matrices and the bend place it
    s.uniforms.uTime = gfx.time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${FLAP_VERTEX}`);
  };
  return { geometry, paint, matrices: FLOCK.map(([x, y]) => new T.Matrix4().makeScale(scale, scale, scale).setPosition(x, y, 0)) };
}
