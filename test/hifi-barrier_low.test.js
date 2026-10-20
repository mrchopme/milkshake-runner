import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/barrier_low.js')).default;
const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/barrier_low.js', module: overlay }]);
const def = registry.obstacle.barrier_low, { w, h, d } = def.box;

// A stand-in for public/hifi/barrier_low.glb with its measured bounds (task-23-models.md): 0.42 x 0.53 x 0.98 units, long along
// z, its face toward +x (the marker). Tripo leaves it a hair off-centre, and its material metallic (so the metal ruling can fail).
const tripo = () => new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() });
const body = new T.Mesh(new T.BoxGeometry(0.4193, 0.5338, 0.9811), tripo());
body.position.set(-0.0003, 0, 0.0004);
const face = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.02), tripo());
face.name = 'face'; face.position.x = 0.2;
adopt('hifi/barrier_low.glb', new T.Group().add(body, face));

const bounds = (o) => { o.updateMatrixWorld(true); return new T.Box3().setFromObject(o); };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };

test('the HiFi barrier is one jersey barrier filling its whole box, standing on the road (Caedon, board 19: two knee-high copies were too tiny)', () => {
  assert.deepEqual(problems, []);
  const a = def.createView(gfx, {}).object, b = bounds(a), size = b.getSize(new T.Vector3());
  let copies = 0; a.traverse((n) => { if (n.name === 'face') copies++; });
  assert.equal(copies, 1);
  assert.ok(b.min.x >= -w / 2 - 1e-6 && b.max.x <= w / 2 + 1e-6 && b.min.z >= -d / 2 - 1e-6 && b.max.z <= d / 2 + 1e-6 && b.min.y >= -1e-6 && b.max.y <= h + 1e-6, `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${h} x ${d}`);
  const box = new T.Box3(new T.Vector3(-w / 2, 0, -d / 2), new T.Vector3(w / 2, h, d / 2));
  for (const end of ['min', 'max']) for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(b[end][k] - box[end][k]) < 1e-3, `${end}.${k}: ${b[end][k].toFixed(4)}, the box's ${box[end][k]}: on the road, centred, the box filled`);
});

test('the HiFi barrier shows its face to the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  const faces = []; a.traverse((n) => { if (n.name === 'face') faces.push(n); });
  assert.equal(faces.length, 1);
  for (const f of faces) assert.ok(f.getWorldPosition(new T.Vector3()).z < bounds(f.parent).getCenter(new T.Vector3()).z - 0.1, 'the +x face looks toward the camera, at -z');
  // re-pinned from clearcoat 0.6 / 0.2 (Caedon, board 29 pick 4): the gloss cut across every glossy model
  assert.ok(paint(a).clearcoat === 0.3 && paint(a).clearcoatRoughness === 0.4, 'satin');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every barrier shares one paint material');
});
