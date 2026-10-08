import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, resolveRules, laneX, jumpHeight, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  inReach, collect, updateObstacle, multiplier, MAX_DT, RULE_RANGES,
} from '../src/rules.js';
import { classifySwipe, KEYS } from '../src/input.js';

const R = resolveRules();
const COW = { height: 1.9, width: 1.0 };
const BARRIER = { avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 } };
const BEAM = { avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 } };
const STEAM = { avoid: 'timing', box: { w: 2, h: 2.5, d: 1 }, cycle: { period: 1.5, on: 0.5 } };
const BIKE = { avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true };
const MAGNET = { id: 'magnet', duration: 8, effect: { reach: 15 } };
const SHIELD = { id: 'shield', duration: 'untilHit', effect: { shield: true } };
const X2 = { id: 'x2', duration: 10, effect: { multiplier: 2 } };
const JUG = { id: 'jug', value: 1 };

function runInto(def, action, rules = R) {
  const run = createRun(rules, COW);
  const o = { lane: 1, z: 3.6 };
  if (action) act(run, action);
  let touched = false;
  while (run.z < o.z + 2) {
    step(run, 1 / 60, 12);
    const box = obstacleBox(o, def, run.time, rules);
    if (box && overlaps(playerBox(run), box)) touched = true;
  }
  return touched;
}

test('rules resolve over the defaults, nested too', () => {
  const r = resolveRules({ gravity: -24, speed: { start: 10 } });
  assert.equal(r.gravity, -24);
  assert.equal(r.speed.start, 10);
  assert.equal(r.speed.end, DEFAULT_RULES.speed.end);
  assert.ok(laneX(0, r) > laneX(2, r), 'lane 0 is screen-left (+x)');
  assert.ok(Math.abs(jumpHeight(R) - 1.35) < 0.01);
});

test('lanes clamp; no double jump; sliding in the air fast-falls', () => {
  const run = createRun(R, COW);
  act(run, 'left'); act(run, 'left'); act(run, 'left');
  assert.equal(run.lane, 0);
  for (let i = 0; i < 4; i++) act(run, 'right');
  assert.equal(run.lane, 2);
  act(run, 'jump'); step(run, 0.05, 12);
  const vy = run.vy;
  act(run, 'jump');
  assert.equal(run.vy, vy);
  act(run, 'slide');
  assert.ok(run.vy <= R.fastFall);
});

test('jumping clears a barrier; running into it hits; a weak jump no longer clears it', () => {
  assert.equal(runInto(BARRIER, 'jump'), false);
  assert.equal(runInto(BARRIER, null), true);
  assert.equal(runInto(BARRIER, 'jump', resolveRules({ jumpSpeed: 5 })), true);
});

test('sliding ducks a beam; standing hits it', () => {
  assert.equal(runInto(BEAM, 'slide'), false);
  assert.equal(runInto(BEAM, null), true);
});

test('steam only hurts while it is on', () => {
  assert.ok(obstacleBox({ lane: 1, z: 0 }, STEAM, 0.2, R));
  assert.equal(obstacleBox({ lane: 1, z: 0 }, STEAM, 1.0, R), null);
});

test('a shield absorbs one hit, grace follows, then the next hit ends the run', () => {
  const run = createRun(R, COW);
  collect(run, SHIELD);
  assert.equal(run.effects.shield.t, Infinity);
  assert.equal(hit(run), 'shield');
  assert.equal(run.effects.shield, undefined);
  assert.equal(hit(run), 'grace');
  assert.equal(run.over, false);
  for (let t = 0; t <= R.grace; t += MAX_DT) step(run, MAX_DT, 12);
  assert.equal(hit(run), 'dead');
  assert.equal(run.over, true);
});

test('a huge frame time is clamped (no teleport after a background tab)', () => {
  const run = createRun(R, COW);
  assert.equal(step(run, 5, 12), MAX_DT);
  assert.ok(Math.abs(run.z - 12 * MAX_DT) < 1e-9);
});

test('speed rises across a level, carries on from a previous level and caps', () => {
  assert.equal(speedAt({ length_m: 1000 }, 0, R), 12);
  assert.equal(speedAt({ length_m: 1000 }, 1000, R), 24);
  assert.equal(speedAt({ length_m: null }, 1e6, R), 30);
  assert.equal(speedAt({ length_m: 1000 }, 500, resolveRules({ speed: { start: 10, end: 30 } })), 20);
  assert.equal(speedAt({ length_m: 1000 }, 0, R, 24), 24, 'a carried speed is the new start');
  assert.equal(speedAt({ length_m: 1000 }, 1000, R, 24), 30, 'the ramp continues by the same amount, capped');
});

test('a run remembers its speed and where it started', () => {
  const run = createRun(R, COW, 0, 24);
  assert.equal(run.speedFrom, 24);
  assert.equal(run.speed, 24, 'before the first step the speed is the start speed');
  step(run, 1 / 60, 25);
  assert.equal(run.speed, 25);
  assert.equal(createRun(R, COW).speedFrom, 12);
});

test('reaction is a rule with a range', () => {
  assert.equal(R.reaction, 0.6);
  assert.deepEqual(RULE_RANGES.reaction, [0.2, 1.5]);
});

test('effects: reach, multiplier, timers and expiry', () => {
  const run = createRun(R, COW, 3);
  assert.equal(inReach(run, { z: 10, lane: 0 }), false);
  collect(run, MAGNET);
  assert.equal(inReach(run, { z: 10, lane: 0 }), true);
  assert.equal(inReach(run, { z: -5, lane: 1 }), false);
  collect(run, JUG); assert.equal(run.jugs, 4);
  collect(run, X2); collect(run, JUG); assert.equal(run.jugs, 6);
  assert.equal(multiplier(run), 2);
  for (let t = 0; t < 10.1; t += MAX_DT) step(run, MAX_DT, 12);
  assert.equal(run.effects.x2, undefined);
  assert.equal(run.effects.magnet, undefined);
  assert.equal(multiplier(run), 1);
});

test('a jug in your lane is picked up without a magnet; one lane over is not', () => {
  const run = createRun(R, COW);
  assert.equal(inReach(run, { z: 0.5, lane: 1 }), true);
  assert.equal(inReach(run, { z: 0.5, lane: 0 }), false);
});

test('the player box follows the character and the slide height', () => {
  const run = createRun(R, { height: 2.4, width: 1.4 });
  assert.equal(playerBox(run).y1, 2.4);
  assert.equal(playerBox(run).x1 - playerBox(run).x0, 1.4);
  act(run, 'slide');
  assert.equal(playerBox(run).y1, R.slideHeight);
});

test('bikes only start moving when the player is close', () => {
  const run = createRun(R, COW);
  const far = { lane: 1, z: 100, moveTo: 0 };
  updateObstacle(far, BIKE, run, 0.05);
  assert.equal(far.x, undefined);
  const near = { lane: 1, z: 20, moveTo: 0 };
  updateObstacle(near, BIKE, run, 0.05);
  assert.ok(near.x > laneX(1, R) && near.x < laneX(0, R));
  const parked = { lane: 1, z: 20, moveTo: null };
  updateObstacle(parked, BIKE, run, 0.05);
  assert.equal(parked.x, undefined);
});

test('swipes and keys map to actions', () => {
  assert.equal(classifySwipe(50, 0), 'right');
  assert.equal(classifySwipe(-50, 5), 'left');
  assert.equal(classifySwipe(0, -60), 'jump');
  assert.equal(classifySwipe(3, 60), 'slide');
  assert.equal(classifySwipe(10, 10), null);
  assert.equal(KEYS.Space, 'jump');
  assert.equal(KEYS.Escape, 'pause');
});

import { before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generate, normalizeLevel, densityAt, rng, passable, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from './helpers.js';

let registry;
before(async () => { registry = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url)))); });

const lvl = (patch = {}) => ({
  id: 't', length_m: 1500, theme: { id: 'downtown' },
  density: { start: 0.5, end: 0.9 },
  obstacles: { taxi: 3, barrier_low: 2, scaffold_beam: 2, delivery_bike: 1, manhole_steam: 1 },
  jugs: { per_100m: 12, powerups: ['magnet', 'shield', 'x2'] },
  ...patch,
});
const all = (level, seed, rules = R) => generate(normalizeLevel(level), rng(seed), 0, level.length_m ?? 3000, registry, rules);
const rowsOf = (obstacles) => Map.groupBy(obstacles, (o) => o.z);
const isPassable = (o, rules = R) => passable(registry.obstacle[o.id], rules);
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

test('same seed builds the same street', () => assert.deepEqual(all(lvl(), 7), all(lvl(), 7)));

test('the road is clear at the start and before the end', () => {
  for (const s of seeds.slice(0, 20)) for (const o of all(lvl(), s).obstacles) assert.ok(o.z >= START_CLEAR && o.z < 1500 - END_CLEAR, `obstacle at ${o.z}`);
});

test('a full row always has a jump or slide option under the default rules', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl(), s).obstacles).values()) if (row.length === 3) assert.ok(row.some((o) => isPassable(o)), `seed ${s}`);
});

test('with nothing to jump or slide, a row never fills all three lanes', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 1 } }), s).obstacles).values()) assert.ok(row.length <= 2);
});

test('fairness follows the level rules: a weak jump makes the barrier a wall', () => {
  const weak = resolveRules({ jumpSpeed: 5 });
  assert.equal(passable(registry.obstacle.barrier_low, R), true);
  assert.equal(passable(registry.obstacle.barrier_low, weak), false);
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 2, barrier_low: 2 } }), s, weak).obstacles).values()) assert.ok(row.length <= 2, `seed ${s}`);
});

test('pickups keep clear of obstacles in their lane', () => {
  for (const s of seeds.slice(0, 50)) {
    const { obstacles, pickups } = all(lvl(), s);
    for (const p of pickups) assert.ok(!obstacles.some((o) => o.lane === p.lane && Math.abs(o.z - p.z) < JUG_CLEARANCE));
  }
});

test('specials only come from the level list, everything else is a jug', () => {
  const ids = new Set(seeds.slice(0, 10).flatMap((s) => all(lvl({ jugs: { per_100m: 30, powerups: ['x2'] } }), s).pickups.map((p) => p.id)));
  assert.deepEqual([...ids].sort(), ['jug', 'x2']);
  assert.ok(all(lvl({ jugs: { per_100m: 30, powerups: [] } }), 1).pickups.every((p) => p.id === 'jug'));
});

test('moving obstacles only move into a free neighbouring lane', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { delivery_bike: 1, taxi: 1 } }), s).obstacles).values()) {
    for (const o of row.filter((o) => o.id === 'delivery_bike')) {
      if (o.moveTo === null) continue;
      assert.equal(Math.abs(o.moveTo - o.lane), 1);
      assert.ok(!row.some((other) => other.lane === o.moveTo));
    }
  }
});

test('density controls how busy the street is', () => {
  const count = (d) => all(lvl({ density: { start: d, end: d } }), 3).obstacles.length;
  assert.ok(count(1) > count(0.1) * 3);
});

test('chunked generation keeps rows on one grid', () => {
  const r = rng(5), norm = normalizeLevel(lvl({ length_m: null }));
  const zs = [...generate(norm, r, 0, 120, registry, R).obstacles, ...generate(norm, r, 120, 240, registry, R).obstacles].map((o) => o.z);
  assert.ok(zs.every((z) => z % ROW_GAP === 0));
});

test('a quiet section has no obstacles and a density override interpolates inside it', () => {
  const level = lvl({ sections: [{ from_m: 0, to_m: 600, density: { start: 0, end: 0 } }, { from_m: 600, to_m: 900, density: { start: 0, end: 1 } }] });
  for (const s of seeds.slice(0, 20)) assert.ok(all(level, s).obstacles.every((o) => o.z >= 600));
  const norm = normalizeLevel(level);
  assert.equal(densityAt(norm.sections[1], 600), 0);
  assert.equal(densityAt(norm.sections[1], 750), 0.5);
  assert.equal(norm.sections.length, 3, 'the rest of the level is a base section');
  assert.equal(norm.sections[2].densitySpan[1], 1500, 'base sections interpolate across the whole level');
});

test('placements land exactly where asked and a non-generating section has nothing else', () => {
  const level = lvl({ sections: [{ from_m: 100, to_m: 400, generation: false, placements: [
    { at_m: 150, lane: 1, kind: 'obstacle', id: 'barrier_low' },
    { at_m: 150, lane: 0, kind: 'obstacle', id: 'delivery_bike' },
    { at_m: 220, lane: 2, kind: 'pickup', id: 'shield' },
  ] }] });
  for (const s of seeds.slice(0, 10)) {
    const { obstacles, pickups } = all(level, s);
    const inSection = obstacles.filter((o) => o.z >= 100 && o.z < 400);
    assert.deepEqual(inSection.map((o) => [o.id, o.lane, o.z, o.moveTo]).sort(), [['barrier_low', 1, 150, undefined], ['delivery_bike', 0, 150, null]].sort());
    assert.ok(pickups.some((p) => p.id === 'shield' && p.lane === 2 && p.z === 220 && p.placed));
  }
});

test('a section theme merges over the level theme', () => {
  const norm = normalizeLevel(lvl({ theme: { id: 'downtown', sky: '#111111', fog: 0.2 }, sections: [{ from_m: 0, to_m: 100, theme: { sky: '#222222' } }] }));
  assert.deepEqual(norm.sections[0].theme, { id: 'downtown', sky: '#222222', fog: 0.2 });
  assert.deepEqual(norm.sections[1].theme, { id: 'downtown', sky: '#111111', fog: 0.2 });
});

import { loadSave, writeSave, recordRun } from '../src/save.js';
import { isLocked, completeLevel, orderLevels } from '../src/campaign.js';

const campaign = { start: 'a', locked: { b: 'a', endless: 'b' } };

test('blocked storage never breaks the game', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(blocked), { best: {}, completed: [] });
  assert.doesNotThrow(() => writeSave({ best: {}, completed: [] }, blocked));
  assert.deepEqual(loadSave(undefined), { best: {}, completed: [] });
  assert.deepEqual(loadSave({ getItem: () => 'not json' }), { best: {}, completed: [] });
});

test('save round-trips and best only goes up', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = loadSave(storage);
  recordRun(s, 'a', 10); recordRun(s, 'a', 4); completeLevel(s, 'a'); completeLevel(s, 'a');
  writeSave(s, storage);
  assert.deepEqual(loadSave(storage), { best: { a: 10 }, completed: ['a'] });
});

test('campaign locks come from the data, and community levels are open', () => {
  const s = { best: {}, completed: [] };
  assert.equal(isLocked(campaign, s, 'b'), true);
  assert.equal(isLocked(campaign, s, 'canal-street-dash'), false);
  completeLevel(s, 'a');
  assert.equal(isLocked(campaign, s, 'b'), false);
  assert.equal(isLocked(campaign, s, 'endless'), true);
});

test('shipped order first, community levels by title, invalid files listed but not playable', () => {
  const levels = { a: { title: 'A' }, b: { title: 'B' }, zed: { title: 'Alpha' }, bad: { title: 'Broken' } };
  const { order, valid } = orderLevels(levels, ['b', 'a', 'ghost'], { 'bad.json': ['nope'] });
  assert.deepEqual(order, ['b', 'a', 'zed', 'bad']);
  assert.equal(valid('a'), true);
  assert.equal(valid('bad'), false);
});

test('a storage getter that throws (blocked cookies) never breaks the game', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.deepEqual(loadSave(), { best: {}, completed: [] });
    assert.doesNotThrow(() => writeSave({ best: {}, completed: [] }));
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});

test('generated rows keep clear of placed obstacles in a generating section', () => {
  const level = lvl({ density: { start: 0.9, end: 0.9 }, sections: [{ from_m: 100, to_m: 400, placements: [
    { at_m: 180, lane: 0, kind: 'obstacle', id: 'taxi' }, { at_m: 180, lane: 1, kind: 'obstacle', id: 'taxi' }, { at_m: 255, lane: 2, kind: 'obstacle', id: 'taxi' },
  ] }] });
  for (const s of seeds) {
    const { obstacles } = all(level, s);
    const placed = obstacles.filter((o) => o.placed);
    assert.equal(placed.length, 3, `seed ${s}`);
    for (const o of obstacles.filter((o) => !o.placed)) for (const p of placed) assert.ok(Math.abs(o.z - p.z) >= ROW_GAP, `seed ${s}: generated ${o.id} at ${o.z} m next to a placement at ${p.z} m`);
  }
});
