import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt, release } from '../src/assets.js';

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
  release([]); // a level without the barrier frees its file
  adopt('hifi/barrier_low.glb', standIn()); // a later level loads it again: new materials
  const [p] = paints(def.createView(gfx, {}).object);
  assert.ok(glossy(p), `the reload is painted too, not shown raw (${p.type}, metalness ${p.metalness})`);
  assert.notEqual(p, paints(a)[0], 'its own paint, not the released one\'s (whose maps were freed)');
});
