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

// A stand-in for the generated GLB, on the real mesh's proportions (0.48 x 0.50 x 0.98, the road it carries along z): a deck over
// the top 28% on two pillars at z = +-0.39, off-centre and below the origin as generators leave it; a nub on the deck's +x end
// marks the front. The deck is the first mesh, so its underside is the clearance.
function standIn() {
  const raw = new T.Group(), off = new T.Vector3(0.3, -0.2, 0.5), steel = new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() });
  const part = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), steel); m.position.set(x, y, z).add(off); raw.add(m); return m; };
  part(0.48, 0.14, 0.98, 0, 0.182, 0);                                      // the deck: y 0.112 .. 0.252
  for (const z of [-0.39, 0.39]) part(0.1, 0.364, 0.12, 0, -0.07, z);       // the pillars: y -0.252 .. 0.112
  part(0.02, 0.02, 0.02, 0.23, 0.182, 0);                                   // the nub, inside the deck's +x face
  adopt('hifi/overpass.glb', raw);
  return raw;
}
const world = (o) => { let root = o; while (root.parent) root = root.parent; root.updateMatrixWorld(true); return new T.Box3().setFromObject(o); }; // from the root down: a child's box needs its parents' fresh matrices
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('the HiFi overpass fits the shipped one: 15 m across the street, its length, 5 m clear under the deck, pillars on the street', async () => {
  standIn();
  const { default: hifi } = await import('../packs/hifi/props/overpass.js');
  const len = shipped.prop.overpass.length, args = { z: 0, length: len, lanes };
  const ship = world(shipped.prop.overpass.createView(gfx, args).object), shipDeck = world(shipped.prop.overpass.createView(gfx, args).object.children[0]);
  const view = hifi.createView(gfx, args).object, box = world(view), deck = world(view.children[0].children[0]);
  assert.ok(near(box.max.x - box.min.x, ship.max.x - ship.min.x), `spans ${box.max.x - box.min.x} m across the street`);
  assert.ok(near(box.min.z, 0) && near(box.max.z, len), `runs ${box.min.z}..${box.max.z} m along it`);
  assert.ok(near(box.min.x + box.max.x, 0), 'centred on the street');
  assert.ok(near(box.min.y, 0), 'pillars stand on the street');
  assert.ok(near(deck.min.y, shipDeck.min.y, 0.01), `deck underside at ${deck.min.y} m, the shipped ${shipDeck.min.y} m (the knob is measured to three digits)`);
});

test('the HiFi overpass lays the span across the street and turns its front toward the player', async () => {
  const { default: hifi } = await import('../packs/hifi/props/overpass.js');
  const view = hifi.createView(gfx, { z: 0, length: 8, lanes }).object;
  const nub = world(view.children[0].children[3]), centre = world(view).getCenter(new T.Vector3());
  assert.ok(nub.min.z < centre.z - 1, `the front (+x) end sits at z ${nub.min.z.toFixed(2)}, near the player at -z, the deck centre at ${centre.z}`);
  assert.ok(near((nub.min.x + nub.max.x) / 2, 0), 'on the street axis');
});

test('every HiFi overpass shares one paint, without Tripo\'s random metal', async () => {
  const { default: hifi } = await import('../packs/hifi/props/overpass.js');
  const paint = (o) => { const p = new Set(); o.traverse((n) => { if (n.isMesh) p.add(n.material); }); return [...p]; };
  const a = paint(hifi.createView(gfx, { z: 0, length: 8, lanes }).object), b = paint(hifi.createView(gfx, { z: 0, length: 8, lanes }).object);
  assert.equal(a.length, 1);
  assert.equal(a[0], b[0], 'one material for every copy');
  assert.ok(a[0].isMeshPhysicalMaterial && a[0].metalness === 0 && a[0].metalnessMap === null, 'metalness 0, no metal map');
});

test('the HiFi overpass is a looks-only overlay that keeps the shipped length', () => {
  return import('../packs/hifi/props/overpass.js').then(({ default: hifi }) => {
    const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/overpass.js', module: hifi }]);
    assert.deepEqual(problems, []);
    assert.equal(registry.prop.overpass.createView, hifi.createView);
    assert.deepEqual(registry.prop.overpass.assets, ['hifi/overpass.glb']);
    assert.equal(registry.prop.overpass.length, shipped.prop.overpass.length);
  });
});
