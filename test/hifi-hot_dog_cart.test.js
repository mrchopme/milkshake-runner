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

// A stand-in for public/hifi/hot_dog_cart.glb with its measured bounds (task-23-models.md): 0.67 x 0.98 x 0.79 units, the umbrella
// the highest point, longer along z than x. The marker sits on the +x face.
const body = new T.Mesh(new T.BoxGeometry(0.6652, 0.9791, 0.7885), new T.MeshStandardMaterial());
body.position.set(0.0004, -0.0005, -0.0001);
const face = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.02), new T.MeshStandardMaterial());
face.name = 'face'; face.position.x = 0.32;
adopt('hifi/hot_dog_cart.glb', new T.Group().add(body, face));

const bounds = (o) => { o.updateMatrixWorld(true); return new T.Box3().setFromObject(o); };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };

test('the HiFi hot dog cart, umbrella and all, sits inside its box on the road, broadside to the player', () => {
  assert.deepEqual(problems, []);
  const a = def.createView(gfx, {}).object, b = bounds(a), size = b.getSize(new T.Vector3());
  assert.ok(b.min.x >= -w / 2 - 1e-6 && b.max.x <= w / 2 + 1e-6 && b.min.z >= -d / 2 - 1e-6 && b.max.z <= d / 2 + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${d}`);
  assert.ok(Math.abs(b.max.y - h) < 1e-6, 'the umbrella top is the box top: as big as the jump box allows');
  assert.ok(Math.abs(b.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(b.min.x + b.max.x) < 1e-6 && Math.abs(b.min.z + b.max.z) < 1e-6, 'centred in its lane');
  assert.ok(size.x > size.z, 'its long side runs across the lane');
});

test('the HiFi hot dog cart shows its +x side to the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  let face; a.traverse((n) => { if (n.name === 'face') face = n; });
  assert.ok(face.getWorldPosition(new T.Vector3()).z < bounds(a).getCenter(new T.Vector3()).z - 0.1, 'the +x face looks toward the camera, at -z');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every cart shares one paint material');
});
