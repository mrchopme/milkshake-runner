import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt, release } from '../src/assets.js';
import { freeWith } from '../packs/hifi/lib/paint.js';
import { facadeMaterial } from '../packs/hifi/lib/facade.js';
import billboard from '../packs/hifi/props/billboard.js';

// src/main.js releases the old level's files before the next one loads, so a model can come back as new material objects. Every
// overlay paints through lib/paint.js's painter; the barrier stands in for them all.
const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/barrier_low.js')).default;
const def = applyPack(shipped, [{ path: 'packs/hifi/obstacles/barrier_low.js', module: overlay }]).registry.obstacle.barrier_low;

// Tripo's material: metal everywhere (task-23-models.md)
const standIn = () => new T.Group().add(new T.Mesh(new T.BoxGeometry(0.42, 0.53, 0.98), new T.MeshStandardMaterial({ metalness: 1, metalnessMap: new T.Texture() })));
const paints = (o) => { const s = new Set(); o.traverse((n) => { if (n.isMesh) s.add(n.material); }); return [...s]; };
const glossy = (m) => m.isMeshPhysicalMaterial && m.clearcoat === 0.6 && m.metalness === 0 && m.metalnessMap === null;

test('a model reloaded after assets.release gets fresh paint, not its raw generated material', () => {
  adopt('hifi/barrier_low.glb', standIn());
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  assert.equal(paints(a).length, 1, 'both segments wear one paint');
  assert.ok(glossy(paints(a)[0]), 'the first load is painted');
  assert.equal(paints(b)[0], paints(a)[0], 'two copies share one paint');
  let freed = 0;
  paints(a)[0].addEventListener('dispose', () => freed++);
  release([]); // a level without the barrier frees its file
  assert.equal(freed, 1, 'and its paint with it: the look\'s CSM holds every lit material until it is disposed');
  adopt('hifi/barrier_low.glb', standIn()); // a later level loads it again: new materials
  const [p] = paints(def.createView(gfx, {}).object);
  assert.ok(glossy(p), `the reload is painted too, not shown raw (${p.type}, metalness ${p.metalness})`);
  assert.notEqual(p, paints(a)[0], 'its own paint, not the released one\'s (whose maps were freed)');
});

// Task 27 (final review I1): the city's image materials are keyed by the loaded texture, as paints are by the loaded material,
// so a level replayed after release wears its new files and the released ones are freed, not pinned for the session.
test('freeWith on a texture its own material wears frees the material once, without recursing', () => {
  const map = new T.Texture(), m = new T.MeshStandardMaterial({ map, emissiveMap: map }), freed = [];
  m.addEventListener('dispose', () => freed.push('material'));
  map.addEventListener('dispose', () => freed.push('map'));
  freeWith(map, m);
  map.dispose();
  assert.deepEqual(freed.sort(), ['map', 'material']);
});

test('a facade tile reloaded after assets.release wears a new material, and the released one goes with its own masks', () => {
  const path = 'hifi/test/t27-tile.webp', style = { id: 't27', glow: { share: 0.7, color: '#ffb46a', intensity: 1.2 }, facades: [path], buildings: { colors: ['#888888'] } }; // Task 32: the window cells' glow (was `lit`)
  const saved = globalThis.OffscreenCanvas; // a canvas to draw the masks on (Node has none)
  globalThis.OffscreenCanvas = class { getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }; } };
  try {
    const first = new T.Texture({});
    adopt(path, first);
    const old = facadeMaterial(gfx, style, 0), freed = [];
    assert.ok(old.map === first && old.emissiveMap && old.roughnessMap, 'the tile with its glow and gloss masks');
    for (const [k, x] of Object.entries({ material: old, glow: old.emissiveMap, gloss: old.roughnessMap, tile: first })) x.addEventListener('dispose', () => freed.push(k));
    release([]);
    assert.deepEqual(freed.sort(), ['gloss', 'glow', 'material', 'tile'], 'the released tile takes its material and masks with it, once each');
    const next = new T.Texture({});
    adopt(path, next);
    const fresh = facadeMaterial(gfx, style, 0);
    assert.ok(fresh !== old && fresh.map === next, 'the reload wears its own material, not the released one');
    assert.equal(facadeMaterial(gfx, style, 0), fresh, 'which every chunk shares');
  } finally { globalThis.OffscreenCanvas = saved; }
});

test('a billboard poster reloaded after assets.release wears a new material, and the released one goes with it', () => {
  const load = () => billboard.assets.map((p) => { const t = new T.Texture(); adopt(p, t); return t; });
  const poster = () => billboard.createView(gfx, { z: 0, lanes: { roadHalf: 4.5 } }).object.children[2].material;
  const first = load(), old = poster();
  assert.ok(first.includes(old.map) && old.emissiveMap === old.map, 'a poster lit by its own texels');
  let freed = 0;
  old.addEventListener('dispose', () => freed++);
  release([]);
  assert.equal(freed, 1, 'the released poster takes its material with it');
  const next = load(), fresh = poster();
  assert.ok(fresh !== old && fresh.map === next[first.indexOf(old.map)], 'the reload wears its own material');
});
