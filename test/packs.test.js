import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { buildRegistry, applyPack, checkModule } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });
const at = (path, module) => [{ path, module }];
const view = () => ({ object: null });
const taxi = (extra = {}) => at('packs/hifi/obstacles/taxi.js', { kind: 'obstacle', id: 'taxi', createView: view, ...extra });

test('a pack re-skins a module and keeps how it plays', () => {
  const { registry, problems } = applyPack(shipped, taxi({ assets: ['hifi/taxi.glb'] }));
  assert.deepEqual(problems, []);
  assert.equal(registry.obstacle.taxi.createView, view);
  assert.deepEqual(registry.obstacle.taxi.assets, ['hifi/taxi.glb']);
  assert.equal(registry.obstacle.taxi.box, shipped.obstacle.taxi.box);
  assert.equal(registry.obstacle.taxi.avoid, shipped.obstacle.taxi.avoid);
  assert.notEqual(shipped.obstacle.taxi.createView, view, 'the registry it was given is not changed');
  assert.equal(registry.obstacle.barrier_low, shipped.obstacle.barrier_low, 'modules the pack does not name are untouched');
});

test('a pack cannot change how a module plays; the module underneath carries on', () => {
  const { registry, problems } = applyPack(shipped, taxi({ box: { w: 0.1, h: 0.1, d: 0.1 } }));
  assert.match(problems.join(), /"box" is not a looks-only field of obstacle modules: packs change how things look, not how they play/);
  assert.equal(registry.obstacle.taxi, shipped.obstacle.taxi);
});

test('only the looks fields of the module kind are allowed', () => {
  assert.match(applyPack(shipped, taxi({ look: {} })).problems.join(), /"look" is not a looks-only field of obstacle modules/);
  assert.match(applyPack(shipped, at('packs/hifi/endings/finish.js', { kind: 'ending', id: 'finish', run() {} })).problems.join(), /"run" is not a looks-only field of ending modules/);
});

test('an overlay must name a registered module and sit at its path', () => {
  assert.match(applyPack(shipped, at('packs/hifi/obstacles/rocket.js', { kind: 'obstacle', id: 'rocket', createView: view })).problems.join(), /no registered obstacle "rocket" to re-skin/);
  assert.match(applyPack(shipped, at('packs/hifi/obstacles/cab.js', { kind: 'obstacle', id: 'taxi', createView: view })).problems.join(), /must be saved as packs\/<pack>\/obstacles\/taxi\.js/);
  assert.match(applyPack(shipped, at('packs/hifi/props/taxi.js', { kind: 'obstacle', id: 'taxi', createView: view })).problems.join(), /must be saved as/);
  assert.match(applyPack(shipped, [...taxi(), ...taxi()]).problems.join(), /duplicate overlay/);
});

test('a community module is re-skinned at its namespaced path', () => {
  const rock = { kind: 'obstacle', id: 'ari/rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView() {} };
  const reg = buildRegistry([{ path: 'content/obstacles/ari/rock.js', module: rock }]);
  const { registry, problems } = applyPack(reg, at('packs/hifi/obstacles/ari/rock.js', { kind: 'obstacle', id: 'ari/rock', createView: view }));
  assert.deepEqual(problems, []);
  assert.equal(registry.obstacle['ari/rock'].createView, view);
});

test('the merged module passes the same checks as any module', () => {
  assert.match(applyPack(shipped, taxi({ createView: 'nope' })).problems.join(), /createView/);
  assert.match(applyPack(shipped, taxi({ assets: ['/etc/passwd'] })).problems.join(), /assets must be a list of \.glb files/);
  assert.match(applyPack(shipped, taxi({ assets: 'hifi/taxi.glb' })).problems.join(), /assets must be a list/);
  assert.match(checkModule({ ...shipped.obstacle.taxi, assets: ['../secrets.glb'] }).join(), /assets/);
  assert.equal(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/taxi.glb'] }).length, 0);
});

test('no pack, no change', () => {
  const { registry, problems } = applyPack(shipped, []);
  assert.deepEqual(problems, []);
  for (const kind of Object.keys(shipped)) assert.deepEqual(Object.keys(registry[kind]), Object.keys(shipped[kind]));
  assert.equal(registry.obstacle.taxi, shipped.obstacle.taxi);
});

const PACK = fileURLToPath(new URL('../packs/hifi/', import.meta.url));

test('the HiFi pack applies cleanly over the shipped content', async () => {
  assert.deepEqual(applyPack(shipped, await discover(PACK, 'packs/hifi')).problems, []);
});

test('every shipped theme has a HiFi look, so a mid-level theme switch never drops to the low-fi renderer', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const id of Object.keys(shipped.theme)) assert.ok(registry.theme[id].look, `theme "${id}" has no look in packs/hifi/themes/`);
});

test('every file the HiFi pack lists is in public/', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const byId of Object.values(registry)) for (const m of Object.values(byId)) for (const a of m.assets ?? []) {
    assert.ok(existsSync(new URL(`../public/${a}`, import.meta.url)), `${m.kind} "${m.id}" lists ${a}, which is not in public/`);
  }
});

test('the HiFi taxi fits the shipped taxi footprint, sits on the road, and every taxi shares one glossy paint', async () => {
  const T = gfx.three;
  // A stand-in for the generated GLB: 1.1 x 0.9 x 2.6 units, off-centre and below the origin, as generators leave them.
  const raw = new T.Group(), body = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 2.6), new T.MeshStandardMaterial());
  body.position.set(0.3, -0.2, 0.5);
  raw.add(body);
  adopt('hifi/taxi.glb', raw);
  const { default: hifiTaxi } = await import('../packs/hifi/obstacles/taxi.js');
  const a = hifiTaxi.createView(gfx).object, b = hifiTaxi.createView(gfx).object;
  a.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(a.children[0]), size = box.getSize(new T.Vector3()); // the model, without the light plates
  const { w, d } = shipped.obstacle.taxi.box;
  assert.ok(size.x <= w + 1e-6 && size.z <= d + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m`);
  assert.ok(Math.abs(size.x - w) < 1e-6 || Math.abs(size.z - d) < 1e-6, 'fills the footprint along one side');
  assert.ok(Math.abs(box.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, 'centred on its lane');
  const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
  assert.ok(paint(a)?.clearcoat > 0, 'glossy clearcoat paint');
  assert.equal(paint(a), paint(b), 'every taxi shares one paint material');
});

test('the HiFi taxi lights its own red tail lamps instead of laying boxes over them', async () => {
  const { default: hifiTaxi, lampMask } = await import('../packs/hifi/obstacles/taxi.js');
  // a red lamp, yellow paint, a white bumper and an orange shadow in the paint: only the lamp may glow
  const px = new Uint8ClampedArray([220, 40, 40, 255, 245, 200, 30, 255, 250, 250, 250, 255, 180, 120, 40, 255]);
  assert.deepEqual([...lampMask(px)], [220, 40, 40, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const red = (n) => n.isMesh && n.material.emissive && n.material.emissive.r > 0.9 && n.material.emissive.g < 0.5;
  assert.ok(!hifiTaxi.createView(gfx).object.children.some(red), 'no red plates over the lamps');
});
