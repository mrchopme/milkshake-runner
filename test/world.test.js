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

test('the world hands the shader the bending stretches in view, 20 m ahead of Milkshake, and straightens on dispose', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, sections: [{ from_m: 150, to_m: 400, curve: { turn: 1 } }] }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0); // the view is [run.z, run.z + 200): a stretch starting at 150 is in it
  assert.equal(gfx.bendStart.value, gfx.DEAD, 'the bend starts 20 m ahead of Milkshake');
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [150, 400, -gfx.TURN_K, 0], 'the turn ahead is in the uniforms with its start and end lines');
  assert.equal(gfx.bendOffset(100).x, 0, 'straight up to its start line');
  assert.ok(gfx.bendOffset(300).x < 0, 'bent beyond it');
  run.z = 300;
  world.update(run, 0);
  assert.equal(gfx.bendStart.value, 320, 'the start rides with Milkshake');
  assert.ok(world.live.obstacles.every((o) => o.view.object.material.userData.bent), 'everything the world adds is bendable');
  run.z = 450;
  world.update(run, 0);
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [0, 0, 0, 0], 'a stretch behind Milkshake is dropped');
  world.dispose();
  assert.deepEqual(gfx.bendSegments.value.map((v) => v.length()), [0, 0, 0, 0]);
});

test('a stretch that starts past 200 m but inside the built street is in the uniforms too, so nothing pops when it enters view', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, sections: [{ from_m: 230, to_m: 400, curve: { turn: 1 } }] }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0); // the street is built in 120 m chunks to 240 m: the start line at 230 is drawn, so it must already be bent
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [230, 400, -gfx.TURN_K, 0], 'every drawn vertex is bent by every stretch it lies in');
  world.dispose();
});

test('a stretch whose lead-in lies inside the built street is in the uniforms before its own chunk builds, so the lead-in never pops', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, sections: [{ from_m: 250, to_m: 400, curve: { turn: 1 } }] }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0); // the street is built to 240 m: the start line at 250 is not drawn yet, but its bend begins BEND_LEAD before it, at 210, which is drawn
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [250, 400, -gfx.TURN_K, 0], 'a stretch is in the uniforms as soon as its lead-in is drawn');
  assert.ok(gfx.bendOffset(230).x < 0, 'the lead-in on the drawn street, 230 m out, is already bent');
  world.dispose();
});

test('props are built, streamed, dropped and bent like obstacles', () => {
  let disposed = 0;
  const arch = { kind: 'prop', id: 'arch', length: 2, createView(gfx, { lanes }) { return { object: gfx.box(lanes.roadHalf * 2, 1, 1, '#ffffff'), dispose() { disposed++; } }; } };
  const registry = { obstacle: {}, pickup: {}, prop: { arch }, theme: { t: theme }, character: {}, ending: {} };
  const lvl = { ...level, obstacles: {}, density: { start: 0, end: 0 }, props: { per_100m: 5, ids: { arch: 1 } } };
  const world = createWorld(new THREE.Scene(), lvl, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0);
  assert.ok(world.live.props.length > 0);
  assert.ok(world.live.props.every((p) => p.view.object.position.z === p.z && p.view.object.material.userData.bent));
  run.z = 300;
  world.update(run, 0);
  assert.ok(world.live.props.every((p) => p.z + p.length >= 300 - 15), 'props are dropped once their far end is behind');
  assert.ok(disposed > 0);
});

test('a level-wide curve is fully straight at the finish line, not just aiming there', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, curve: { turn: 1 } }, { registry, rules, seed: 1, end: 800 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.z = 300;
  world.update(run, 0);
  assert.ok(gfx.bendOffset(400).x < 0, 'bent in the middle of the level');
  run.z = 500; // 100 m out: the last 120 m are straight by geometry
  world.update(run, 0);
  assert.deepEqual(gfx.bendOffset(600), { x: 0, y: 0 });
  run.z = 600;
  world.update(run, 0);
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [0, 0, 0, 0], 'no stretch reaches the finish line');
  assert.deepEqual(gfx.bendOffset(650), { x: 0, y: 0 }, 'the ending\'s street is straight');
  world.dispose();
});
