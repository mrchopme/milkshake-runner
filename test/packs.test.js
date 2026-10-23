import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { buildRegistry, applyPack, checkModule, loadPack } from '../src/registry.js';
import { discover, same } from './helpers.js';
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
  assert.match(applyPack(shipped, taxi({ assets: ['/etc/passwd'] })).problems.join(), /assets must be a list of \.glb, \.webp or \.png files/);
  assert.match(applyPack(shipped, taxi({ assets: 'hifi/taxi.glb' })).problems.join(), /assets must be a list/);
  assert.match(checkModule({ ...shipped.obstacle.taxi, assets: ['../secrets.glb'] }).join(), /assets/);
  assert.equal(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/taxi.glb'] }).length, 0);
});

test('a module may list .webp and .png images as well as .glb models', () => {
  assert.equal(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/taxi.glb', 'hifi/city/sky/downtown-01.webp', 'hifi/x.png'] }).length, 0);
  assert.match(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/x.jpg'] }).join(), /assets must be a list of \.glb, \.webp or \.png files/);
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
  const raw = new T.Group(), body = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 2.6), new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() })); // metallic, as Tripo leaves it
  body.position.set(0.3, -0.2, 0.5);
  raw.add(body);
  adopt('hifi/taxi.glb', raw);
  const { default: hifiTaxi } = await import('../packs/hifi/obstacles/taxi.js');
  const a = hifiTaxi.createView(gfx).object, b = hifiTaxi.createView(gfx).object;
  a.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(a.children[0]), size = box.getSize(new T.Vector3()); // the model
  const { w, d } = shipped.obstacle.taxi.box;
  assert.ok(size.x <= w + 1e-6 && size.z <= d + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m`);
  assert.ok(Math.abs(size.x - w) < 1e-6 || Math.abs(size.z - d) < 1e-6, 'fills the footprint along one side');
  assert.ok(Math.abs(box.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, 'centred on its lane');
  const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
  assert.ok(paint(a)?.clearcoat > 0, 'glossy clearcoat paint');
  same(paint(a), paint(b), 'every taxi shares one paint material');
  assert.ok(paint(a).metalness === 0 && paint(a).metalnessMap === null, 'Tripo\'s random metal dropped, as the pickups and the cow do');
});

test('the HiFi taxi lights its own red tail lamps instead of laying boxes over them', async () => {
  const { default: hifiTaxi, isLamp } = await import('../packs/hifi/obstacles/taxi.js');
  // a red lamp, yellow paint, a white bumper and an orange shadow in the paint: only the lamp may glow
  assert.deepEqual([[220, 40, 40], [245, 200, 30], [250, 250, 250], [180, 120, 40]].map((c) => isLamp(...c)), [true, false, false, false]);
  const red = (n) => n.isMesh && n.material.emissive && n.material.emissive.r > 0.9 && n.material.emissive.g < 0.5;
  assert.ok(!hifiTaxi.createView(gfx).object.children.some(red), 'no red plates over the lamps');
});

test('the HiFi taxi\'s roof does not flare in the sun: a soft clearcoat and no lit plate in its sign (Caedon, board 18)', async () => {
  const { default: hifiTaxi } = await import('../packs/hifi/obstacles/taxi.js');
  const o = hifiTaxi.createView(gfx).object;
  assert.equal(o.children.length, 1, 'the model alone: the teaser\'s roof sign is unlit, and a plate is a box laid over a light');
  let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; });
  // re-pinned from 0.5 / 0.45 (Caedon, board 29 pick 4): still haloed the roof and sign with any sun ahead
  assert.ok(p.clearcoat === 0.2 && p.clearcoatRoughness === 0.6, `clearcoat ${p.clearcoat}, roughness ${p.clearcoatRoughness}: a full, sharp clearcoat on the white sign caught the sun as a halo`);
  assert.equal(p.userData.reflect, 0.3, 'reflections below the look\'s shared knob');
});

test('gloss copies every standard field of a generated material, then adds the gloss', async () => {
  const { gloss } = await import('../packs/hifi/lib/paint.js');
  const T = gfx.three, src = new T.MeshStandardMaterial({ color: '#ff0000', aoMapIntensity: 0.5, side: T.DoubleSide, vertexColors: true });
  src.normalScale.set(0.3, 0.3);
  const p = gloss(T, src, { clearcoat: 1 });
  assert.ok(p.isMeshPhysicalMaterial && p.clearcoat === 1);
  assert.ok('PHYSICAL' in p.defines, 'still compiles as a physical material (ior, specular), which the standard copy resets');
  assert.equal(p.color.getHexString(), 'ff0000'); assert.equal(p.aoMapIntensity, 0.5); assert.equal(p.side, T.DoubleSide); assert.equal(p.vertexColors, true); assert.equal(p.normalScale.x, 0.3);
  const glow = gloss(T, src, { emissive: '#ffffff', emissiveMap: null }); // the taxi's call: a colour given as a string must stay a Color
  assert.ok(glow.emissive.isColor && glow.emissive.getHexString() === 'ffffff');
});

test('glowMap hands back nothing without a map or a canvas to read it', async () => {
  const { glowMap } = await import('../packs/hifi/lib/paint.js');
  assert.equal(glowMap(gfx.three, null, () => true), null, 'a map-less model');
  assert.equal(glowMap(gfx.three, { image: {} }, () => true), null, 'Node has no OffscreenCanvas');
});

test('glowMap keeps the texels the test accepts, blacks out the rest, and reads the map the way the source does', async () => {
  const { glowMap } = await import('../packs/hifi/lib/paint.js');
  const bytes = new Uint8ClampedArray([220, 40, 40, 255, 245, 200, 30, 255, 250, 250, 250, 255, 180, 120, 40, 255]); // lamp, paint, bumper, shadow
  let stored;
  const saved = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class { getContext() { return { drawImage() {}, getImageData: () => ({ data: bytes }), putImageData: (img) => { stored = [...img.data]; } }; } };
  try {
    const t = glowMap(gfx.three, { image: {}, flipY: false, colorSpace: 'srgb', channel: 1 }, (r, g, b) => r > 150 && g < 90 && b < 90, 2);
    assert.deepEqual(stored, [220, 40, 40, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255], 'the lamp stays, the rest goes black, alpha stays');
    assert.ok(t.isCanvasTexture && t.flipY === false && t.colorSpace === 'srgb' && t.channel === 1, 'read the way the source map is');
  } finally { globalThis.OffscreenCanvas = saved; }
});

test('fitBox keeps a jumpable model inside its box and lets a lane blocker stand taller', async () => {
  const { fitBox } = await import('../packs/hifi/lib/fit.js');
  const T = gfx.three, tall = () => new T.Mesh(new T.BoxGeometry(1, 3, 2), new T.MeshStandardMaterial());
  assert.ok(Math.abs(fitBox(T, tall(), { w: 2, h: 1, d: 4 }, true).scale - 1 / 3) < 1e-9, 'inside: the height decides');
  assert.ok(Math.abs(fitBox(T, tall(), { w: 2, h: 1, d: 4 }, false).scale - 2) < 1e-9, 'lane: the footprint decides');
});

test('a pack file that fails to load disables only itself, like a broken one', async () => {
  const files = { // what import.meta.glob hands loadPack in the browser; one file 404s
    '../packs/hifi/themes/downtown.js': async () => ({ kind: 'theme', id: 'downtown', look: { exposure: 1.1 } }),
    '../packs/hifi/themes/bridge.js': async () => { throw new Error('404'); },
    '../packs/other/themes/uptown.js': async () => { throw new Error('another pack: never loaded'); },
  };
  const warn = console.warn;
  console.warn = () => {};
  let entries;
  try { entries = await loadPack('hifi', files); } finally { console.warn = warn; }
  const { registry, problems } = applyPack(shipped, entries);
  assert.deepEqual(registry.theme.downtown.look, { exposure: 1.1 });
  assert.equal(registry.theme.bridge, shipped.theme.bridge);
  assert.match(problems.join(), /packs\/hifi\/themes\/bridge\.js/);
  assert.ok(!problems.join().includes('uptown'), 'files of other packs are never loaded');
});

test('files under packs/<pack>/lib/ are helpers, never loaded as overlays', async () => {
  const files = {
    '../packs/hifi/lib/city.js': async () => { throw new Error('a helper must not be loaded as an overlay'); },
    '../packs/hifi/themes/downtown.js': async () => ({ kind: 'theme', id: 'downtown', look: {} }),
  };
  assert.deepEqual((await loadPack('hifi', files)).map((e) => e.path), ['packs/hifi/themes/downtown.js']);
});

test('every skyline a HiFi look names is in that theme\'s assets', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const t of Object.values(registry.theme)) for (const p of [].concat(t.look?.skyline ?? []).flat()) assert.ok(t.assets?.includes(p), `theme "${t.id}" names ${p} but does not list it`); // flat: the near ring may wear a list
});
