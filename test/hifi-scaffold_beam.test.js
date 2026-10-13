import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/scaffold_beam.js')).default;
const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/scaffold_beam.js', module: overlay }]);
const def = registry.obstacle.scaffold_beam, { w, h, d, y } = def.box;

// A stand-in for public/hifi/scaffold_beam.glb with its measured bounds (task-23-models.md): 0.34 x 0.98 x 0.95 units, four posts on
// the ground and the plank (the yellow texels) from y 0.249 to 0.400 of the centred model, its face toward +x (the marker).
const mat = () => new T.MeshStandardMaterial(), raw = new T.Group();
for (const x of [-0.14, 0.14]) for (const z of [-0.444, 0.444]) { const post = new T.Mesh(new T.BoxGeometry(0.06, 0.98, 0.06), mat()); post.position.set(x, 0, z); raw.add(post); }
const plank = new T.Mesh(new T.BoxGeometry(0.28, 0.151, 0.88), mat());
plank.name = 'plank'; plank.position.y = 0.3245;
const face = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.02), mat());
face.name = 'face'; face.position.set(0.12, 0.3245, 0);
raw.add(plank, face);
adopt('hifi/scaffold_beam.glb', raw);

const bounds = (o) => { o.updateMatrixWorld(true); return new T.Box3().setFromObject(o); };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
const find = (o, name) => { let f; o.traverse((n) => { if (n.name === name) f = n; }); return f; };

test('the HiFi scaffold stands on the road inside its box column, its plank in the box and daylight under it', () => {
  assert.deepEqual(problems, []);
  const a = def.createView(gfx, {}).object, b = bounds(a), size = b.getSize(new T.Vector3()), p = bounds(find(a, 'plank'));
  assert.ok(b.min.x >= -w / 2 - 1e-6 && b.max.x <= w / 2 + 1e-6 && b.min.z >= -d / 2 - 1e-6 && b.max.z <= d / 2 + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${d}`);
  assert.ok(Math.abs(b.min.y) < 1e-6, 'posts on the road');
  assert.ok(Math.abs(b.max.y - (y + h)) < 1e-6, 'the post caps reach the box top, no higher');
  assert.ok(p.min.y > y - 0.02 && p.min.y < y + 0.05, `the plank's underside (${p.min.y.toFixed(2)} m) is the box's bottom (${y} m): Milkshake slides under it, standing hits it`);
  assert.ok(p.max.y <= y + h + 1e-6, 'the plank stays inside the box');
  assert.ok(Math.abs(b.min.x + b.max.x) < 1e-6 && Math.abs(b.min.z + b.max.z) < 1e-6, 'centred in its lane');
  assert.ok(size.x > size.z, 'its long side runs across the lane');
});

test('the HiFi scaffold shows its +x face to the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  assert.ok(find(a, 'face').getWorldPosition(new T.Vector3()).z < bounds(a).getCenter(new T.Vector3()).z - 0.05, 'the +x face looks toward the camera, at -z');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every scaffold shares one paint material');
});
