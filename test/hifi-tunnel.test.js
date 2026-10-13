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

// A stand-in for the generated GLB: the tube's bounds (0.98 long along x, 0.32 tall, 0.41 wide), off-centre and below the origin as
// generators leave it, with a nub inside the +x end, the flared mouth the player should face.
function standIn() {
  const raw = new T.Group(), off = new T.Vector3(0.3, -0.2, 0.5), stone = new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() });
  for (const [w, h, d, x, y, z] of [[0.98, 0.32, 0.41, 0, 0, 0], [0.02, 0.02, 0.02, 0.46, 0, 0]]) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), stone);
    m.position.set(x, y, z).add(off);
    raw.add(m);
  }
  adopt('hifi/tunnel.glb', raw);
}
const world = (o) => { let root = o; while (root.parent) root = root.parent; root.updateMatrixWorld(true); return new T.Box3().setFromObject(o); }; // from the root down: a child's box needs its parents' fresh matrices
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('the HiFi tunnel stretches over the shipped 60 m, its roof at the shipped height, its walls clear of the road, its own road under the street', async () => {
  standIn();
  const { default: hifi, BODY } = await import('../packs/hifi/props/tunnel.js');
  const len = shipped.prop.tunnel.length, args = { z: 0, length: len, lanes };
  const ship = shipped.prop.tunnel.createView(gfx, args).object, roof = world(ship.children[0]).max.y;
  const view = hifi.createView(gfx, args).object, box = world(view), h = box.max.y - box.min.y;
  assert.ok(near(box.min.z, 0) && near(box.max.z, len), `runs ${box.min.z}..${box.max.z} m, the shipped ${len} m`);
  assert.ok(near(box.min.x + box.max.x, 0), 'centred on the street');
  assert.ok(near(box.min.y + BODY.roof * h, roof), `the body's roof top at ${box.min.y + BODY.roof * h} m, the shipped tube's ${roof} m`);
  const clear = BODY.clear * (box.max.x - box.min.x), floor = box.min.y + BODY.floor * h;
  assert.ok(clear > ROAD_HALF * 2 && clear < ROAD_HALF * 2 + 2, `${clear} m between the walls, the road ${ROAD_HALF * 2} m`);
  assert.ok(floor < 0 && floor > -0.2, `the model's own floor at y ${floor}: under the street, which keeps its own road and dashes`);
});

test('the HiFi tunnel keeps its flared mouth toward the player', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const view = hifi.createView(gfx, { z: 0, length: 60, lanes }).object;
  const nub = world(view.children[0].children[1]);
  assert.ok(nub.max.z < 5, `the +x end sits at z ${nub.max.z.toFixed(2)}, the near end (the player is at -z)`);
});

test('the HiFi tunnel is one mesh with one paint, without Tripo\'s random metal, shared by every copy', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const paint = (o) => { const p = new Set(); o.traverse((n) => { if (n.isMesh) p.add(n.material); }); return [...p]; };
  const a = paint(hifi.createView(gfx, { z: 0, length: 60, lanes }).object), b = paint(hifi.createView(gfx, { z: 0, length: 60, lanes }).object);
  assert.equal(a.length, 1);
  assert.equal(a[0], b[0], 'one material for every copy');
  assert.ok(a[0].isMeshPhysicalMaterial && a[0].metalness === 0 && a[0].metalnessMap === null, 'metalness 0, no metal map');
});

test('the HiFi tunnel is a looks-only overlay that keeps the shipped length', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/tunnel.js', module: hifi }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.tunnel.createView, hifi.createView);
  assert.deepEqual(registry.prop.tunnel.assets, ['hifi/tunnel.glb']);
  assert.equal(registry.prop.tunnel.length, shipped.prop.tunnel.length);
});
