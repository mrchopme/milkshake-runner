import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/world.js';
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
