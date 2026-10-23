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
  // assert.ok(a === b) on THREE objects, never assert.equal: see hifi-overpass.test.js (a failing diff froze the Mac, 2026-10-21)
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

test('the lamp globes keep Tripo\'s paint (Task 34 L-K): faces over a bright texel are a second group in the model\'s own material, the rest stone', async () => {
  const { dress, LAMP } = await import('../packs/hifi/props/overpass.js');
  const { stone } = await import('../packs/hifi/lib/bridge.js');
  // four quads in a row along x, uv u running with x across a 4 x 1 map: stone grey, cream (a globe), grey, cream; flipY false as glTF's
  const quads = new T.PlaneGeometry(4, 1, 4, 1), map = new T.DataTexture(new Uint8Array([120, 118, 112, 255, 246, 240, 204, 255, 150, 150, 150, 255, 250, 245, 210, 255]), 4, 1);
  map.flipY = false; map.needsUpdate = true;
  const own = new T.MeshStandardMaterial({ map }), m = new T.Mesh(quads, own);
  m.updateMatrixWorld(true);
  dress(gfx, m, Infinity);
  const g = m.geometry, p = g.attributes.position, uv = g.attributes.uv;
  assert.ok(Array.isArray(m.material) && m.material.length === 2, 'two materials');
  assert.ok(m.material[0] === stone(gfx, ['#888888'], 1, 0, 1).material && m.material[1] === own, 'the stone, then the model\'s own paint');
  assert.deepEqual(g.groups.map(({ start, count, materialIndex }) => [start, count, materialIndex]), [[0, 12, 0], [12, 12, 1]], 'two faces a quad: four stone, four paint');
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cell = Math.floor(cx + 2), bright = cell % 2 === 1;
    assert.equal(t >= 12, bright, `the face centred at x ${cx.toFixed(2)} (cell ${cell}) is in group ${bright ? 1 : 0}`);
    if (bright) for (let k = 0; k < 3; k++) assert.ok(Math.abs(uv.getX(t + k) - (p.getX(t + k) + 2) / 4) < 1e-6, 'a painted face keeps the model\'s own uv');
  }
  const { PIER_COLORS } = await import('../packs/hifi/lib/bridge.js'), s = new T.Color(PIER_COLORS[2]);
  const crowned = new T.Mesh(new T.PlaneGeometry(4, 1, 4, 1), own);
  crowned.updateMatrixWorld(true);
  dress(gfx, crowned, 0.5, { h: 0.5, tone: 2 });
  const c = crowned.geometry.attributes.color, q = crowned.geometry.attributes.position;
  assert.equal(crowned.geometry.groups.length, 2);
  for (let i = 0; i < q.count; i++) assert.ok(Math.abs(c.getX(i) - s.r * (q.getY(i) > 0 ? 2 : 1)) < 1e-6, `the tint and the parapet course over both groups (corner ${i})`);
  const plain = new T.Mesh(new T.PlaneGeometry(4, 1, 4, 1), new T.MeshStandardMaterial());
  plain.updateMatrixWorld(true);
  dress(gfx, plain, Infinity);
  assert.ok(plain.material === m.material[0] && plain.geometry.groups.length === 0, 'no map: one stone group, one draw');
  const flat = new T.Mesh(new T.PlaneGeometry(4, 1, 4, 1), new T.MeshStandardMaterial({ map: new T.Texture() }));
  flat.updateMatrixWorld(true);
  dress(gfx, flat, Infinity);
  assert.ok(flat.material === m.material[0], 'a map with no readable pixels: all stone');
  assert.ok(LAMP > 0.8 && LAMP < 0.9, `the luma threshold ${LAMP}`);
});

test('the tunnel takes its section theme\'s stone (look.stone, Task 34 L-K), the piers\' darkest stone when the theme has none', async () => {
  const { default: hifi } = await import('../packs/hifi/props/tunnel.js');
  const { PIER_COLORS } = await import('../packs/hifi/lib/bridge.js');
  const tint = (theme) => { const c = hifi.createView(gfx, { z: 0, length: 60, lanes, theme }).object.children[0].children[0].geometry.attributes.color; return [c.getX(0), c.getY(0), c.getZ(0)]; };
  const close = (a, hex, msg) => { const b = new T.Color(hex); assert.ok(Math.abs(a[0] - b.r) + Math.abs(a[1] - b.g) + Math.abs(a[2] - b.b) < 1e-6, `${msg}: ${a}`); };
  close(tint({ look: { stone: '#8c5d47' } }), '#8c5d47', 'the theme\'s stone');
  close(tint({ look: {} }), PIER_COLORS[2], 'the piers\' when the look has none');
});
