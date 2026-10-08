import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { createWorld, defaultChunk } from '../src/world.js';
import { rng } from '../src/generator.js';
import { createRun, resolveRules } from '../src/rules.js';

// world.js needs three but not the DOM, so Node can drive its streaming with a view that counts its own disposal.
const rules = resolveRules();
const theme = { kind: 'theme', id: 't', sky: '#000000', fog: 0.3, buildings: { colors: ['#000000'], minH: 1, maxH: 2 } };
const level = { id: 'w', length_m: 600, theme: { id: 't' }, obstacles: { rock: 1 }, density: { start: 1, end: 1 }, jugs: { per_100m: 0, powerups: [] } };

test('a view\'s dispose() runs when its obstacle is dropped behind and when the world is disposed', () => {
  let disposed = 0;
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff'), dispose() { disposed++; } }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), level, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0);
  const built = world.live.obstacles.length;
  assert.ok(built > 0, 'the first chunks hold obstacles');
  run.z = 300;
  world.update(run, 0);
  assert.ok(world.live.obstacles.every((o) => o.z >= 300 - 15), 'everything behind the player is dropped');
  assert.ok(disposed > 0, 'dropped views were disposed');
  const before = disposed, live = world.live.obstacles.length;
  world.dispose();
  assert.equal(disposed, before + live, 'disposing the world disposes every live view');
});

test('no building in a default chunk crosses the chunk seam', () => {
  const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
  const buildings = { colors: ['#a3714f', '#8a8f9c'], minH: 18, maxH: 70 };
  for (let seed = 1; seed <= 50; seed++) {
    const r = rng(seed);
    for (const z0 of [0, 120, 240]) {
      const g = defaultChunk(gfx, { z0, length: 120, lanes, rng: r, theme: { buildings } });
      for (const m of g.children) {
        const { height, depth } = m.geometry.parameters;
        if (height < 1) continue; // road, sidewalks and lane dashes
        assert.ok(m.position.z - depth / 2 >= z0 - 1e-9 && m.position.z + depth / 2 <= z0 + 120 + 1e-9, `seed ${seed}: building at ${m.position.z} ± ${depth / 2} leaves chunk ${z0}`);
      }
    }
  }
});

test('a pulled pickup moves its view toward Milkshake', () => {
  const jug = { kind: 'pickup', id: 'jug', color: '#ffffff', value: 1 };
  const registry = { obstacle: {}, pickup: { jug }, theme: { t: theme }, character: {}, ending: {} };
  const lvl = { ...level, obstacles: {}, density: { start: 0, end: 0 }, jugs: { per_100m: 20, powerups: [] } };
  const world = createWorld(new THREE.Scene(), lvl, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.effects.magnet = { t: 8, reach: 15 };
  run.z = 16; // pickups start at START_CLEAR / 2 = 20 m; from here the first ones are inside the magnet's reach
  world.update(run, 0);
  const p = world.live.pickups.find((p) => p.lane !== 1 && p.z - run.z > 2 && p.z - run.z < 15);
  const before = Math.abs(p.view.object.position.x), zBefore = p.z;
  for (let i = 0; i < 5; i++) world.update(run, 1 / 60);
  assert.ok(Math.abs(p.view.object.position.x) < before, 'slides toward the centre lane');
  assert.ok(p.z < zBefore, 'the logical pickup comes back along the street');
  assert.equal(p.view.object.position.x, p.x, 'the view follows the logical x');
  assert.equal(p.view.object.position.z, p.z, 'the view sits at the logical position');
});
