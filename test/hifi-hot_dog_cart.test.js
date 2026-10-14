import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/hot_dog_cart.js')).default;
const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/hot_dog_cart.js', module: overlay }]);
const def = registry.obstacle.hot_dog_cart, { w, h, d } = def.box;

// A stand-in for public/hifi/hot_dog_cart.glb with its measured parts (model units, centred; measured on the optimised file):
// the body (wheels, cabinet, handles, lid) y -0.490 to 0.040, 0.47 x 0.53 x 0.79, longer along z; the umbrella's pole from 0.040 to
// 0.184 and its canopy and finial from 0.190 to 0.489, 0.67 x 0.65 across. The marker sits on the body's +x face.
const generated = new T.MeshStandardMaterial(); // the real model is one mesh with one material; the stand-in's parts share one
const mesh = (name, size, at) => { const m = new T.Mesh(new T.BoxGeometry(...size), generated); m.name = name; m.position.set(...at); return m; };
adopt('hifi/hot_dog_cart.glb', new T.Group().add(
  mesh('body', [0.4737, 0.5303, 0.7885], [0.0033, -0.2249, -0.0002]), mesh('pole', [0.08, 0.1438, 0.08], [0, 0.1121, 0]),
  mesh('canopy', [0.6652, 0.2989, 0.6472], [0.0004, 0.3397, -0.0005]), mesh('face', [0.02, 0.02, 0.02], [0.225, -0.2, 0])));

const bounds = (o) => { o.updateWorldMatrix(true, true); return new T.Box3().setFromObject(o); };
const part = (o, name) => { let f; o.traverse((n) => { if (n.name === name) f = n; }); return f; };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };

test('the HiFi hot dog cart\'s body fills the jump box on the road, broadside to the player, and the umbrella stands above it', () => {
  assert.deepEqual(problems, []);
  const a = def.createView(gfx, {}).object, body = bounds(part(a, 'body')), size = body.getSize(new T.Vector3());
  assert.ok(body.min.x >= -w / 2 - 1e-6 && body.max.x <= w / 2 + 1e-6 && body.min.z >= -d / 2 - 1e-6 && body.max.z <= d / 2 + 1e-6, `body footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${d}`);
  assert.ok(Math.abs(body.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(body.max.y - h) < 1e-3, `the body is as tall as the box (${body.max.y.toFixed(3)} of ${h} m): the largest it can be`);
  assert.ok(Math.abs(body.min.x + body.max.x) < 0.02 && Math.abs(body.min.z + body.max.z) < 0.02, 'centred in its lane');
  assert.ok(size.x > size.z, 'its long side runs across the lane');
  const canopy = bounds(part(a, 'canopy')), pole = bounds(part(a, 'pole'));
  assert.ok(canopy.min.y > h && canopy.max.y > 1.5 * h,`the canopy (${canopy.min.y.toFixed(2)} to ${canopy.max.y.toFixed(2)} m) stands above the ${h} m box (Caedon's exception: umbrella above the box)`);
  assert.ok(pole.max.y > h, 'and so does the pole');
  assert.ok(canopy.min.x >= -w / 2 && canopy.max.x <= w / 2 && canopy.min.z >= -d / 2 && canopy.max.z <= d / 2, 'the umbrella stays over the footprint');
});

test('the HiFi hot dog cart shows its +x side to the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  assert.ok(part(a, 'face').getWorldPosition(new T.Vector3()).z < bounds(part(a, 'body')).getCenter(new T.Vector3()).z - 0.1, 'the +x face looks toward the camera, at -z');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every cart shares one paint material, umbrella and body');
  let parts = 0; a.traverse((n) => { if (n.isMesh) { parts++; assert.equal(n.material, paint(a), `${n.name} wears the shared paint`); } });
  assert.equal(parts, 4);
});
