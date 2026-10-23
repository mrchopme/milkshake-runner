import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover, sameColor } from './helpers.js';
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

test('every HiFi overpass wears the city\'s stone (Task 34 L-I, board 29 pick 5): the bridge piers\' ashlar, no metal, a lighter parapet course on top', async () => {
  const { default: hifi } = await import('../packs/hifi/props/overpass.js');
  const { stone } = await import('../packs/hifi/lib/bridge.js'), { PARAPET } = await import('../packs/hifi/props/overpass.js');
  const paint = (o) => { const p = new Set(); o.traverse((n) => { if (n.isMesh) p.add(n.material); }); return [...p]; };
  const view = hifi.createView(gfx, { z: 0, length: 8, lanes }).object, a = paint(view), b = paint(hifi.createView(gfx, { z: 0, length: 8, lanes }).object);
  assert.equal(a.length, 1);
  // assert.ok(a === b), never assert.equal(a, b), on THREE objects: a failing strict diff inspects their typed arrays one element a line and Myers-diffs the lines (a 256 x 128 texture is 131k of them: tens of GB, the Mac freezes; 2026-10-21)
  assert.ok(a[0] === b[0], 'one material for every copy');
  assert.ok(a[0] === stone(gfx, ['#888888'], 1, 0, 1).material, 'the piers\' and the quay\'s own stone material: its ashlar map, one draw call\'s worth of state');
  assert.ok(a[0].map && a[0].metalness === 0 && a[0].metalnessMap === null && a[0].vertexColors, 'the stone map, metalness 0, no metal map, tinted by vertex colour');
  const top = world(view).max.y, deck = view.children[0].children[0], c = deck.geometry.attributes.color, p = deck.geometry.attributes.position;
  deck.updateMatrixWorld(true);
  const tone = (i) => c.getX(i) + c.getY(i) + c.getZ(i), y = (i) => new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(deck.matrixWorld).y;
  const hi = [...Array(p.count).keys()].filter((i) => y(i) > top - 1e-6), lo = [...Array(p.count).keys()].filter((i) => y(i) < top - PARAPET.h - 1e-6);
  assert.ok(hi.length && lo.length && hi.every((i) => Math.abs(tone(i) - tone(lo[0]) * PARAPET.tone) < 1e-6), 'the top course PARAPET.tone times the wall\'s');
  assert.ok(deck.geometry.attributes.uv.array instanceof Float32Array, 'metre UVs, not the model\'s quantised atlas ones');
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

test('the stone\'s ashlar is projected per face, so a curved generated surface never stretches it (Task 34 L-I fix round)', async () => {
  const { dress } = await import('../packs/hifi/props/overpass.js');
  // a smooth half cylinder along z, scaled as a fitted model is: its vertex normals sweep through every angle, so a per-vertex
  // projection gives one triangle's corners different axes and smears the texture across it
  const m = new T.Mesh(new T.CylinderGeometry(3, 3, 1, 24, 1, true, 0, Math.PI).rotateX(Math.PI / 2), new T.MeshStandardMaterial());
  m.scale.set(1.5, 2, 20); m.updateMatrixWorld(true);
  dress(gfx, m, Infinity);
  const g = m.geometry, p = g.attributes.position, uv = g.attributes.uv, idx = g.index, n = idx ? idx.count : p.count, at = (i) => new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
  let worst = 0;
  for (let t = 0; t < n; t += 3) {
    const k = [0, 1, 2].map((j) => (idx ? idx.getX(t + j) : t + j));
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) worst = Math.max(worst, Math.hypot(uv.getX(k[a]) - uv.getX(k[b]), uv.getY(k[a]) - uv.getY(k[b])) / at(k[a]).distanceTo(at(k[b])));
  }
  assert.ok(worst <= 1 + 1e-6, `a planar projection never lengthens an edge: worst ${worst.toFixed(2)}x`);
});


test('the overpass takes its section theme\'s stone (look.stone, Task 34 L-K), the piers\' darkest stone when the theme has none', async () => {
  const { default: hifi } = await import('../packs/hifi/props/overpass.js');
  const { PIER_COLORS } = await import('../packs/hifi/lib/bridge.js');
  const deck = (theme) => hifi.createView(gfx, { z: 0, length: 8, lanes, theme }).object.children[0].children[0].geometry;
  const wall = (theme) => { // the deck's lowest corner: under the parapet course, so its colour is the tint itself
    const g = deck(theme), c = g.attributes.color, p = g.attributes.position;
    let lo = 0; for (let i = 1; i < p.count; i++) if (p.getY(i) < p.getY(lo)) lo = i;
    return [c.getX(lo), c.getY(lo), c.getZ(lo)];
  };
  sameColor(wall({ id: 'midtown', look: { stone: '#a9896d' } }), new T.Color('#a9896d'), 'the theme\'s stone');
  sameColor(wall({ id: 'bridge', look: {} }), new T.Color(PIER_COLORS[2]), 'no stone in the look: the piers\'');
  sameColor(wall(undefined), new T.Color(PIER_COLORS[2]), 'no theme passed: the piers\'');
  const a = deck({ look: { stone: '#a9896d' } }), b = deck(undefined);
  assert.ok(a !== b && a.attributes.position === b.attributes.position && a.attributes.uv === b.attributes.uv, 'a tint is its own colours over the one dressed position and uv buffers');
  assert.ok(deck({ look: { stone: '#a9896d' } }) === a, 'one geometry a tint, shared by its copies');
});

test('the warm themes tint their stone props warm; downtown and the bridge keep the piers\' stone (Task 34 L-K)', async () => {
  const look = async (id) => (await import(`../packs/hifi/themes/${id}.js`)).default.look;
  assert.equal((await look('midtown')).stone, '#a9896d', 'the Garden\'s low orange sun: a sandstone');
  assert.equal((await look('uptown')).stone, '#8c5d47', 'the dusk: uptown\'s own quay stone');
  for (const id of ['downtown', 'bridge']) assert.equal((await look(id)).stone, undefined, `${id}: the piers' stone, downtown's own darkest`);
});

// Re-pinned (Task 34 L-K fix round, the main session's ruling): the overpass has no lamp globes, so it takes no paint split: its 16
// bright deck-top centre-line faces would cost a second material, +1 draw and Tripo's three 1024^2 maps uploaded for paint no camera sees.
test('the overpass dresses all stone whatever its paint (no lamp): one material, its own never kept, so its maps are never uploaded', async () => {
  const { dress } = await import('../packs/hifi/props/overpass.js'), { stone } = await import('../packs/hifi/lib/bridge.js');
  const map = new T.DataTexture(new Uint8Array([250, 245, 210, 255]), 1, 1); // all cream: every face over a bright texel
  map.flipY = false; map.needsUpdate = true;
  const m = new T.Mesh(new T.PlaneGeometry(4, 1, 4, 1), new T.MeshStandardMaterial({ map }));
  m.updateMatrixWorld(true);
  dress(gfx, m, 0.5, { h: 0.5, tone: 1.3 });
  assert.ok(m.material === stone(gfx, ['#888888'], 1, 0, 1).material, 'the stone alone, not [stone, paint]');
  assert.equal(m.geometry.groups.length, 0, 'one group, one draw');
  const view = (await import('../packs/hifi/props/overpass.js')).default.createView(gfx, { z: 0, length: 8, lanes }).object;
  view.traverse((n) => { if (n.isMesh) assert.ok(!Array.isArray(n.material) && n.geometry.groups.length === 0, 'every overpass mesh one stone group'); });
});

test('a tint\'s geometry lives as long as the generated source (the shared-buffer ruling): gfx.dispose of one copy frees nothing shared, the source\'s dispose frees every tint', async () => {
  const { dress } = await import('../packs/hifi/props/overpass.js');
  const src = new T.PlaneGeometry(4, 1, 4, 1), mesh = () => { const m = new T.Mesh(src, new T.MeshStandardMaterial()); m.updateMatrixWorld(true); return m; };
  const a = mesh(), b = mesh();
  dress(gfx, a, Infinity, undefined, { tint: '#a9896d' }); dress(gfx, b, Infinity, undefined, { tint: '#8c5d47' });
  const ga = a.geometry, gb = b.geometry, gone = new Set();
  for (const g of [ga, gb]) g.addEventListener('dispose', () => gone.add(g));
  assert.ok(ga !== gb && ga.attributes.position === gb.attributes.position, 'two tints over one position buffer');
  gfx.dispose(gfx.group(a));
  assert.equal(gone.size, 0, 'gfx.dispose of one copy leaves its tint (shared) and so the buffers and the other tint');
  assert.ok(b.geometry === gb && gb.attributes.position === ga.attributes.position);
  src.dispose();
  assert.ok(gone.has(ga) && gone.has(gb), 'the source\'s dispose frees every tint with it');
});
