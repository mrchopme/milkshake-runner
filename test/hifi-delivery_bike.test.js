import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/delivery_bike.js')).default;
const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/delivery_bike.js', module: overlay }]);
const def = registry.obstacle.delivery_bike, { w, d } = def.box;

// A stand-in for public/hifi/delivery_bike.glb with its measured bounds (task-23-models.md): 0.98 x 0.89 x 0.47 units, long along x,
// its front (the cargo box, the rider's face) toward +x, marked; its material metallic, as Tripo leaves it (so the metal ruling can fail).
const tripo = () => new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() });
const body = new T.Mesh(new T.BoxGeometry(0.9793, 0.8855, 0.4689), tripo());
body.position.set(0.0001, 0, -0.0001);
const face = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.02), tripo());
face.name = 'face'; face.position.x = 0.48;
adopt('hifi/delivery_bike.glb', new T.Group().add(body, face));

const bounds = (o) => { o.updateMatrixWorld(true); return new T.Box3().setFromObject(o); };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };

test('the HiFi delivery bike fills its lane footprint, may stand taller, and keeps the shipped swerve', () => {
  assert.deepEqual(problems, []);
  assert.equal(def.moves, true);
  assert.equal(def.update, undefined, 'the overlay replaces createView only; the swerve is the engine\'s (src/rules.js updateObstacle moves the view\'s x)');
  const a = def.createView(gfx, {}).object, b = bounds(a), size = b.getSize(new T.Vector3());
  assert.ok(size.x <= w + 1e-6 && size.z <= d + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${d}`);
  assert.ok(Math.abs(size.x - w) < 1e-6 || Math.abs(size.z - d) < 1e-6, 'fills the footprint along one side');
  assert.ok(Math.abs(b.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(b.min.x + b.max.x) < 1e-6 && Math.abs(b.min.z + b.max.z) < 1e-6, 'centred in its lane');
  assert.ok(size.z > size.x, 'its long side runs along the street');
});

test('the HiFi delivery bike rides toward the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  let face; a.traverse((n) => { if (n.name === 'face') face = n; });
  assert.ok(face.getWorldPosition(new T.Vector3()).z < bounds(a).getCenter(new T.Vector3()).z - 0.1, 'the front (+x) looks toward the camera, at -z');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every bike shares one paint material');
});
