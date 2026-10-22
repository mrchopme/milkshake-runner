import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import { ROAD_HALF } from '../src/world.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';
import { DEFAULT_RULES, laneX, jumpHeight } from '../src/rules.js';
import { cameraFor } from '../src/engine.js';

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

test('the HiFi tunnel stretches over the shipped 60 m, its roof no lower than the shipped one, its walls clear of the road, its own road under the street', async () => {
  standIn();
  const { default: hifi, BODY, ROOF } = await import('../packs/hifi/props/tunnel.js');
  const len = shipped.prop.tunnel.length, args = { z: 0, length: len, lanes };
  const ship = shipped.prop.tunnel.createView(gfx, args).object, roof = world(ship.children[0]).max.y;
  const view = hifi.createView(gfx, args).object, box = world(view), h = box.max.y - box.min.y;
  assert.ok(near(box.min.z, 0) && near(box.max.z, len), `runs ${box.min.z}..${box.max.z} m, the shipped ${len} m`);
  assert.ok(near(box.min.x + box.max.x, 0), 'centred on the street');
  assert.ok(near(box.min.y + BODY.roof * h, ROOF), `the body's roof top at ${box.min.y + BODY.roof * h} m, the knob's ${ROOF} m`);
  assert.ok(ROOF >= roof, `the roof top ${ROOF} m is at least the shipped tube's ${roof} m`);
  const clear = BODY.clear * (box.max.x - box.min.x), floor = box.min.y + BODY.floor * h;
  assert.ok(clear > ROAD_HALF * 2 && clear < ROAD_HALF * 2 + 2, `${clear} m between the walls, the road ${ROAD_HALF * 2} m`);
  assert.ok(floor < 0 && floor > -0.2, `the model's own floor at y ${floor}: under the street, which keeps its own road and dashes`);
});

test('the HiFi tunnel\'s vault and lamp globes clear the default chase camera at the apex of a jump by more than the near plane', async () => {
  const { default: hifi, BODY } = await import('../packs/hifi/props/tunnel.js');
  const NEAR = 0.1; // the camera's near plane (src/engine.js)
  const R = DEFAULT_RULES, side = cameraFor({ x: laneX(0, R), y: jumpHeight(R), z: 0 }), apex = side.y; // lane 0 is the farthest lane: the camera trails the player at 0.6 of its x
  assert.ok(Math.abs(side.x) <= 1.5 + 1e-9, `the camera reaches x ${side.x}: BODY.ceiling was measured over |x| <= 1.5`);
  const box = world(hifi.createView(gfx, { z: 0, length: 60, lanes }).object), ceiling = box.min.y + BODY.ceiling * (box.max.y - box.min.y);
  assert.ok(ceiling - apex > NEAR, `the lowest thing over the camera is ${ceiling.toFixed(2)} m, its apex ${apex.toFixed(3)} m`);
});

test('the HiFi tunnel keeps its flared mouth toward the player', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const view = hifi.createView(gfx, { z: 0, length: 60, lanes }).object;
  const nub = world(view.children[0].children[1]);
  assert.ok(nub.max.z < 5, `the +x end sits at z ${nub.max.z.toFixed(2)}, the near end (the player is at -z)`);
});

test('the HiFi tunnel is one mesh in the city\'s stone (Task 34 L-I, board 29 pick 5), no metal, shared by every copy', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const { stone } = await import('../packs/hifi/lib/bridge.js');
  const paint = (o) => { const p = new Set(); o.traverse((n) => { if (n.isMesh) p.add(n.material); }); return [...p]; };
  const view = hifi.createView(gfx, { z: 0, length: 60, lanes }).object, a = paint(view), b = paint(hifi.createView(gfx, { z: 0, length: 60, lanes }).object);
  assert.equal(a.length, 1);
  // assert.ok(a === b), never assert.equal(a, b), on THREE objects: a failing strict diff inspects their typed arrays one element a line and Myers-diffs the lines (a 256 x 128 texture is 131k of them: tens of GB, the Mac freezes; 2026-10-21)
  assert.ok(a[0] === b[0], 'one material for every copy');
  assert.ok(a[0] === stone(gfx, ['#888888'], 1, 0, 1).material, 'the bridge piers\' stone material, its ashlar map');
  assert.ok(a[0].map && a[0].metalness === 0 && a[0].metalnessMap === null && a[0].vertexColors, 'the stone map, metalness 0, no metal map, tinted by vertex colour');
  const g = view.children[0].children[0].geometry;
  assert.ok(g.attributes.color && g.attributes.uv.array instanceof Float32Array, 'tinted by vertex colour, on metre UVs');
});

test('the HiFi tunnel is a looks-only overlay that keeps the shipped length', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/tunnel.js', module: hifi }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.tunnel.createView, hifi.createView);
  assert.deepEqual(registry.prop.tunnel.assets, ['hifi/tunnel.glb']);
  assert.equal(registry.prop.tunnel.length, shipped.prop.tunnel.length);
});
