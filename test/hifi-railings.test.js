import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import { ROAD_HALF } from '../src/world.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three, CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
const lanes = { count: 3, width: 3, roadHalf: ROAD_HALF };
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });

// A stand-in for the generated GLB: one rail section 0.13 x 0.39 x 0.98 along z, off-centre and below the origin as generators leave it.
function standIn() {
  const raw = new T.Group(), m = new T.Mesh(new T.BoxGeometry(0.13, 0.39, 0.98), new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() }));
  m.position.set(0.3, -0.2, 0.5);
  raw.add(m);
  adopt('hifi/railings.glb', raw);
}
const instances = (o) => { const out = []; o.traverse((n) => { if (n.isInstancedMesh) out.push(n); }); return out; };
// every instance's world bounds: the geometry's box through the instance matrix
const bounds = (mesh) => Array.from({ length: mesh.count }, (_, i) => { const m = new T.Matrix4(); mesh.getMatrixAt(i, m); return mesh.geometry.boundingBox.clone().applyMatrix4(m); });
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('the HiFi railings put one segment every 4 m along the shipped 40 m, both sides at the shipped x, as tall as the shipped posts', async () => {
  standIn();
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const len = shipped.prop.railings.length, args = { z: 0, length: len, lanes };
  const shipView = shipped.prop.railings.createView(gfx, args).object, ship = new T.Box3().setFromObject(shipView), railX = Math.abs(shipView.children[0].position.x); // the first child is a rail
  const view = hifi.createView(gfx, args).object, meshes = instances(view);
  assert.equal(meshes.length, 1, 'one InstancedMesh for the one model mesh');
  const all = bounds(meshes[0]);
  assert.equal(all.length, 2 * (len / 4), 'ten segments a side');
  for (const side of [-1, 1]) {
    const mine = all.filter((b) => Math.sign(b.min.x + b.max.x) === side).sort((a, b) => a.min.z - b.min.z);
    assert.equal(mine.length, len / 4);
    mine.forEach((b, i) => {
      assert.ok(near(b.min.z, 4 * i) && near(b.max.z, 4 * i + 4), `segment ${i} spans z ${b.min.z}..${b.max.z}`);
      assert.ok(near((b.min.x + b.max.x) / 2, side * railX), `at x ${(b.min.x + b.max.x) / 2}, the shipped ${side * railX}`);
      assert.ok(near(b.min.y, 0) && near(b.max.y, ship.max.y), `from the ground to ${b.max.y} m, the shipped posts' ${ship.max.y} m`);
    });
  }
});

test('every HiFi railings prop shares one paint, without Tripo\'s random metal', async () => {
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const paint = (o) => instances(o)[0].material, args = { z: 0, length: 40, lanes };
  const a = paint(hifi.createView(gfx, args).object), b = paint(hifi.createView(gfx, args).object);
  assert.equal(a, b, 'one material for every copy');
  assert.ok(a.isMeshPhysicalMaterial && a.metalness === 0 && a.metalnessMap === null, 'metalness 0, no metal map');
});

test('freeing a HiFi railings prop leaves the shared model alone', async () => {
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const view = hifi.createView(gfx, { z: 0, length: 40, lanes }).object, mesh = instances(view)[0], freed = [];
  const { geometry, material } = mesh, realDispose = mesh.dispose;
  geometry.dispose = () => freed.push('geometry'); material.dispose = () => freed.push('material'); // own properties over the shared parts' prototype methods
  mesh.dispose = function () { freed.push('instance buffers'); return realDispose.call(this); };
  try { gfx.dispose(view); } finally { delete geometry.dispose; delete material.dispose; } // the shared parts outlive this test
  assert.deepEqual(freed, ['instance buffers'], 'the prop frees its own instance buffers and leaves the shared geometry and paint alone');
});

test('the HiFi railings are a looks-only overlay that keeps the shipped length', async () => {
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/railings.js', module: hifi }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.railings.createView, hifi.createView);
  assert.deepEqual(registry.prop.railings.assets, ['hifi/railings.glb']);
  assert.equal(registry.prop.railings.length, shipped.prop.railings.length);
});
