import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { buildRegistry } from '../src/registry.js';
import { validateAll } from '../src/validate.js';
import { generate, normalizeLevel, rng, passable } from '../src/generator.js';
import { resolveRules, jumpHeight, createRun } from '../src/rules.js';
import { discover } from './helpers.js';
import mob, { SETTLE_M, TIRE_M, HEEL_M } from '../content/props/newark/mob.js';
import theme from '../content/themes/newark/brick_city.js';
import dog from '../content/obstacles/newark/stray_dog.js';
import cart from '../content/obstacles/newark/shopping_cart.js';
import tape from '../content/obstacles/newark/police_tape.js';
import hydrant from '../content/obstacles/newark/busted_hydrant.js';

// The satirical Newark level and its pack (content/*/newark/) install like any community pack: nothing under src/ knows them.
const here = (p) => new URL(p, import.meta.url);
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const registry = buildRegistry(await discover(fileURLToPath(here('../content/'))));
const level = read(here('../levels/last-train-newark.json'));
const rules = resolveRules(level.rules);
const lanes = { count: 3, width: rules.laneWidth, roadHalf: 4.5 };

test('the Newark pack registers and its level validates next to the shipped ones', () => {
  assert.ok(registry.theme['newark/brick_city'] && registry.prop['newark/mob'] && registry.ending['newark/last_train'] && registry.pickup['newark/disco_fries']);
  const dir = here('../levels/');
  const levels = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'campaign.json'].includes(f)).map((f) => [f.slice(0, -5), read(new URL(f, dir))]));
  assert.deepEqual(validateAll(levels, read(new URL('index.json', dir)), registry), {});
});

test('the welcome sign stands at the city line and a fresh mob picks up the chase every 40 m, except where the tunnel is', () => {
  const { props, obstacles } = generate(normalizeLevel(level), rng(7), 0, 1600, registry, rules);
  assert.ok(props.some((p) => p.id === 'newark/welcome_sign' && p.placed && p.z === 20));
  const mobs = props.filter((p) => p.id === 'newark/mob').map((p) => p.z);
  assert.deepEqual(mobs.slice(0, 5), [40, 80, 120, 160, 200], 'one mob every 40 m from the first row');
  assert.ok(mobs.every((z) => z % 40 === 0 && (z + 40 <= 960 || z >= 1020)), 'none overlaps the tunnel');
  assert.ok(mobs.at(-1) >= 1520, 'the chase runs to the end');
  assert.ok(obstacles.some((o) => o.id === 'newark/stray_dog' && o.moveTo !== undefined), 'the strays lunge');
});

test('a mob waits in its alley, falls in at Milkshake\'s heels, then gives up and drops out of the frame', () => {
  const view = mob.createView(gfx, { z: 400, length: 40, lanes });
  const p = { id: 'newark/mob', z: 400, length: 40, view };
  const run = createRun(rules, { height: 1.9, width: 1 });
  const world = (m) => ({ x: m.object.position.x, behind: run.z - (p.z + m.object.position.z) });
  run.z = 370; view.update(p, run, 1 / 60);
  assert.ok(view.members.every((m) => Math.abs(world(m).x) > lanes.roadHalf), 'off the road, at the alley mouth');
  run.z = 400 + SETTLE_M + 4; run.x = 2.5;
  for (let i = 0; i < 10; i++) view.update(p, run, 0.1); // the lane lag settles
  let closest = Infinity;
  for (let i = 0; i < 40; i++) {
    run.time += 0.1; view.update(p, run, 0.1);
    for (const m of view.members) {
      const w = world(m);
      closest = Math.min(closest, w.behind);
      assert.ok(Math.abs(w.x - run.x) < 2.6 && w.behind >= HEEL_M - 1e-9 && w.behind < 3, `${m.kind} runs beside and behind her, never past her: x ${w.x.toFixed(2)}, ${w.behind.toFixed(2)} m back`);
      assert.equal(m.object.rotation.y, 0, 'facing up the street');
    }
  }
  assert.ok(closest < 0.6, `a lunging dog gets within a stride of her heels (closest ${closest.toFixed(2)} m)`);
  run.z = 400 + 39.5;
  for (let i = 0; i < 10; i++) view.update(p, run, 0.1);
  assert.ok(view.members.every((m) => world(m).behind > 15), 'left far behind before the prop is dropped');
  assert.ok(TIRE_M > SETTLE_M && TIRE_M < 40);
});

test('the Newark obstacles read as their moves', () => {
  const R = resolveRules();
  assert.ok(dog.avoid === 'jump' && dog.moves && dog.box.h <= jumpHeight(R) && passable(dog, R), 'the stray is hopped over and lunges');
  assert.ok(cart.avoid === 'lane' && cart.box.h >= jumpHeight(R) + 0.6, 'the cart stands well above a jump\'s apex');
  assert.ok(tape.avoid === 'slide' && tape.box.y >= R.slideHeight && tape.box.y < 1.9, 'the tape leaves room to slide under and catches a standing cow');
  const view = hydrant.createView(gfx);
  view.update({ z: 100 }, { time: 0.1 }, 1 / 60, false);
  const jet = view.object.children.find((c) => c.isGroup);
  assert.equal(jet.visible, false, 'the jet hides when the hydrant is off');
  view.update({ z: 100 }, { time: 1.9 }, 1 / 60, true);
  assert.equal(jet.visible, true);
});

test('a Brick City chunk builds without a DOM and keeps every block inside its chunk', () => {
  for (const seed of [1, 2, 3]) for (const z0 of [0, 120, 240]) {
    const g = theme.createChunk(gfx, { z0, length: 120, lanes, rng: rng(seed), theme });
    let boxes = 0;
    g.traverse((m) => {
      if (!m.geometry?.parameters?.depth) return;
      boxes++;
      const { depth } = m.geometry.parameters;
      assert.ok(m.position.z - depth / 2 >= z0 - 1e-9 && m.position.z + depth / 2 <= z0 + 120 + 1e-9, `seed ${seed}: a box at ${m.position.z} ± ${depth / 2} leaves chunk ${z0}`);
    });
    assert.ok(boxes > 60, 'a street, blocks, bands and curb life');
  }
});
