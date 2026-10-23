import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import { ROAD_HALF } from '../src/world.js';
import * as gfx from '../src/gfx.js';

const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
const lanes = { count: 3, width: 3, roadHalf: ROAD_HALF };
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });

test('the HiFi railings prop draws nothing: the HiFi bridge chunk draws its own on the walkway edges', async () => {
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const view = hifi.createView(gfx, { z: 0, length: 40, lanes }).object;
  let meshes = 0;
  view.traverse((n) => { if (n.isMesh) meshes++; });
  assert.equal(meshes, 0, 'was ten railings.glb sections a side at x ±5.0, now the walkway kerb: a second line inside the bridge\'s railings (Task 32 C6 review)');
});

test('the HiFi railings are a looks-only overlay that keeps the shipped length', async () => {
  const { default: hifi } = await import('../packs/hifi/props/railings.js');
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/railings.js', module: hifi }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.railings.createView, hifi.createView);
  assert.equal(registry.prop.railings.assets, undefined, 'no model of its own: the HiFi bridge theme loads railings.glb');
  assert.equal(registry.prop.railings.length, shipped.prop.railings.length);
});
