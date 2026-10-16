import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import { pickBy } from '../packs/hifi/lib/rand.js';
import hifiBillboard from '../packs/hifi/props/billboard.js';

// Task 32 (Caedon, board 23, 2026-10-15: "As prototyped", the style frames have no sidewalk billboard): in HiFi the prop draws
// nothing; the low-fi prop and the levels' prop rates are untouched.
const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });

test('the overlay re-skins the shipped billboard as nothing: an empty group, no files to load, the shipped length kept', () => {
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/billboard.js', module: hifiBillboard }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.billboard.createView, hifiBillboard.createView);
  assert.equal(registry.prop.billboard.length, shipped.prop.billboard.length, 'the shipped length stays');
  assert.equal(hifiBillboard.assets, undefined, 'it loads no poster');
  for (const z of [0, 40, 80, -40]) {
    const o = hifiBillboard.createView(gfx, { z, length: 4, lanes }).object;
    assert.ok(o.isGroup && o.children.length === 0, `z ${z}: an empty group`);
  }
});

test('pickBy is a stable draw in [0, n) from a number', () => {
  const draws = Array.from({ length: 200 }, (_, k) => pickBy(k * 40, 12));
  assert.deepEqual(draws, Array.from({ length: 200 }, (_, k) => pickBy(k * 40, 12)));
  assert.ok(draws.every((d) => Number.isInteger(d) && d >= 0 && d < 12));
  assert.ok(new Set(draws).size >= 10, 'spreads over the range');
});
