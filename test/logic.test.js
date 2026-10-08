import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, resolveRules, laneX, jumpHeight, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  inReach, collect, updateObstacle, multiplier, MAX_DT, RULE_RANGES, pulled, pull,
} from '../src/rules.js';
import { classifySwipe, KEYS } from '../src/input.js';
import { cameraFor } from '../src/engine.js';

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
  assert.equal(pulled(run, { z: 10, lane: 0 }), true);
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
import { generate, normalizeLevel, densityAt, rng, passable, curveAt, cameraAt, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
import * as gfx from '../src/gfx.js';
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
  assert.deepEqual(loadSave(blocked), { best: {}, completed: [], helpSeen: false });
  assert.doesNotThrow(() => writeSave({ best: {}, completed: [], helpSeen: false }, blocked));
  assert.deepEqual(loadSave(undefined), { best: {}, completed: [], helpSeen: false });
  assert.deepEqual(loadSave({ getItem: () => 'not json' }), { best: {}, completed: [], helpSeen: false });
});

test('save round-trips and best only goes up', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = loadSave(storage);
  recordRun(s, 'a', 10); recordRun(s, 'a', 4); completeLevel(s, 'a'); completeLevel(s, 'a');
  s.helpSeen = true;
  writeSave(s, storage);
  assert.deepEqual(loadSave(storage), { best: { a: 10 }, completed: ['a'], helpSeen: true });
});

test('campaign locks come from the data, and community levels are open', () => {
  const s = { best: {}, completed: [], helpSeen: false };
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
    assert.deepEqual(loadSave(), { best: {}, completed: [], helpSeen: false });
    assert.doesNotThrow(() => writeSave({ best: {}, completed: [], helpSeen: false }));
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

test('at speed, generated rows keep a reaction gap, after generated and placed rows alike', () => {
  const fast = resolveRules({ speed: { start: 30, end: 30 } }); // floor 18 m on a 12 m grid: never two rows in a row
  for (const s of seeds.slice(0, 50)) {
    const zs = [...rowsOf(all(lvl({ density: { start: 1, end: 1 } }), s, fast).obstacles).keys()].sort((a, b) => a - b);
    for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= 18, `seed ${s}: rows at ${zs[i - 1]} and ${zs[i]}`);
  }
  const slow = resolveRules({ speed: { start: 12, end: 12 } }); // floor 7.2 m: every grid row is allowed
  const zs = [...rowsOf(all(lvl({ density: { start: 1, end: 1 } }), 3, slow).obstacles).keys()].sort((a, b) => a - b);
  assert.ok(zs.some((z, i) => i && z - zs[i - 1] === ROW_GAP), 'at 12 m/s consecutive rows still happen');
  const placed = lvl({ density: { start: 1, end: 1 }, sections: [{ from_m: 100, to_m: 400, placements: [{ at_m: 200, lane: 0, kind: 'obstacle', id: 'taxi' }] }] });
  for (const s of seeds.slice(0, 20)) for (const o of all(placed, s, fast).obstacles.filter((o) => !o.placed)) assert.ok(o.z <= 200 || o.z - 200 >= 18, `seed ${s}: generated row at ${o.z} right after the placement at 200`);
});

test('the floor remembers the last row across chunks and rises with a carried speed', () => {
  const fast = resolveRules({ speed: { start: 30, end: 30 } });
  const norm = normalizeLevel(lvl({ length_m: null, density: { start: 1, end: 1 } }));
  const r = rng(5), state = { lastRow: -Infinity, speedFrom: 30 };
  const zs = [...generate(norm, r, 0, 120, registry, fast, state).obstacles, ...generate(norm, r, 120, 240, registry, fast, state).obstacles].map((o) => o.z);
  const rows = [...new Set(zs)].sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i] - rows[i - 1] >= 18, `rows at ${rows[i - 1]} and ${rows[i]} straddle the chunk seam`);
  const carried = { lastRow: -Infinity, speedFrom: 24 }; // default rules ramp 12→24 but the run arrived at 24: floor 14.4 m from the first metre
  const c = [...new Set(generate(normalizeLevel(lvl({ density: { start: 1, end: 1 } })), rng(5), 0, 1500, registry, R, carried).obstacles.map((o) => o.z))].sort((a, b) => a - b);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 24, `carried speed: rows at ${c[i - 1]} and ${c[i]}`);
});

test('the chase camera sits where it always did, takes a section override and widens with speed', () => {
  const run = { x: 0, y: 0, z: 100 };
  const c = cameraFor(run);
  assert.deepEqual([c.x, c.y, c.z, c.lookX, c.lookY, c.lookZ, c.fov], [0, 3.6, 93.5, 0, 1.2, 112, 60]);
  assert.equal(cameraFor(run, {}, 12).fov, 60, 'no widening up to the base speed');
  assert.ok(Math.abs(cameraFor(run, {}, 24).fov - 67.2) < 1e-9, '0.6° per m/s over 12');
  const low = cameraFor(run, { height: 2.2, distance: 5, fov: 65 }, 0);
  assert.deepEqual([low.y, low.z, low.fov], [2.2, 95, 65]);
  const lane0 = cameraFor({ x: 2.5, y: 1, z: 0 });
  assert.deepEqual([lane0.x, lane0.y, lane0.lookX], [1.5, 3.9, 2]);
});

test('a magnet pulls a jug in over a few frames instead of collecting it 15 m out', () => {
  const run = createRun(R, COW);
  collect(run, MAGNET);
  const p = { id: 'jug', lane: 0, z: 10 };
  assert.equal(pulled(run, p), true);
  assert.equal(inReach(run, p), false, 'not collected the tick the pull starts');
  let frames = 0;
  while (!inReach(run, p) && frames < 120) { step(run, 1 / 60, 12); pull(run, p, 1 / 60); frames++; }
  assert.ok(frames > 2 && frames < 60, `pulled in over ${frames} frames`);
  assert.ok(Math.abs(p.x - run.x) < 1 && Math.abs(p.z - run.z) < 0.8);
  const far = { id: 'jug', lane: 2, z: run.z + 20 };
  assert.equal(pulled(run, far), false, 'beyond reach nothing moves');
  pull(run, far, 1 / 60);
  assert.equal(far.x, undefined);
  const none = createRun(R, COW);
  assert.equal(pulled(none, { lane: 1, z: 3 }), false, 'without a magnet nothing is pulled');
  assert.equal(inReach(none, { lane: 1, z: 0.5 }), true, 'but a jug in your lane is still picked up');
});

test('curveAt follows sections, inherits the level, fades at the finish and is reproducible when random', () => {
  const level = lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 300, to_m: 600, curve: { hill: -1 } }, { from_m: 600, to_m: 900, curve: 'random' }] });
  const norm = normalizeLevel(level);
  assert.deepEqual(curveAt(norm, 100), { turn: 1, hill: 0 }, 'the level curve applies outside sections');
  assert.deepEqual(curveAt(norm, 400), { turn: 0, hill: -1 }, 'a section curve replaces it');
  const r = curveAt(norm, 700, 7);
  assert.deepEqual(r, curveAt(norm, 700, 7));
  assert.ok(Math.abs(r.turn) <= 1 && Math.abs(r.hill) <= 1);
  assert.deepEqual(curveAt(norm, 1500), { turn: 0, hill: 0 }, 'straight at the finish');
  assert.deepEqual(curveAt(norm, 1440), { turn: 0.5, hill: 0 }, 'half way through the fade');
  assert.deepEqual(curveAt(normalizeLevel(lvl()), 500), { turn: 0, hill: 0 }, 'no curve means straight');
  const E = normalizeLevel(lvl({ length_m: null, curve: 'random' }));
  const segs = Array.from({ length: 10 }, (_, i) => i * 240);
  const a = segs.map((z) => curveAt(E, z, 7)), b = segs.map((z) => curveAt(E, z, 8));
  assert.deepEqual(a, segs.map((z) => curveAt(E, z, 7)), 'random targets come from the seed');
  assert.notDeepEqual(a, b);
  assert.ok(a.some((c, i) => i && (c.turn !== a[i - 1].turn || c.hill !== a[i - 1].hill)), 'and change from segment to segment');
  const F = normalizeLevel(lvl({ length_m: 480, curve: 'random' }));
  assert.deepEqual(curveAt(F, 480, 7), { turn: 0, hill: 0 }, 'random still fades out at a finite finish');
});

test('gfx.box subdivides along z so long road pieces bend', () => {
  assert.equal(gfx.box(1, 1, 120, '#ffffff').geometry.parameters.depthSegments, 30);
  assert.equal(gfx.box(1, 1, 3, '#ffffff').geometry.parameters.depthSegments, 1);
  assert.ok(gfx.box(1, 1, 1, '#ffffff').material.userData.bent, 'materials from the helpers are bendable');
  gfx.setBend({ turn: 1, hill: -0.5, origin: 100 });
  assert.deepEqual(gfx.bendUniform.value.toArray(), [-gfx.TURN_K, -0.5 * gfx.HILL_K, 100, gfx.DEAD], 'positive turn bends to screen-right (-x)');
  gfx.setBend();
  assert.deepEqual(gfx.bendUniform.value.toArray(), [0, 0, 0, gfx.DEAD]);
});

test('a section camera merges over the level camera', () => {
  const norm = normalizeLevel(lvl({ camera: { height: 5 }, sections: [{ from_m: 100, to_m: 200, camera: { fov: 70 } }] }));
  assert.deepEqual(cameraAt(norm, 50), { height: 5 });
  assert.deepEqual(cameraAt(norm, 150), { height: 5, fov: 70 });
  assert.deepEqual(cameraAt(normalizeLevel(lvl()), 50), {}, 'no camera means the defaults');
});

test('props land on their grid by weight, never overlap, never run past the end and keep out of placed ones', () => {
  const arch = { kind: 'prop', id: 'arch', length: 2, createView() {} }, tube = { kind: 'prop', id: 'tube', length: 60, createView() {} };
  const reg = { ...registry, prop: { arch, tube } };
  const { props } = generate(normalizeLevel(lvl({ length_m: 600, props: { per_100m: 5, ids: { tube: 1 } } })), rng(1), 0, 600, reg, R);
  assert.ok(props.length >= 2 && props.every((p) => p.id === 'tube' && p.length === 60));
  for (let i = 1; i < props.length; i++) assert.ok(props[i].z >= props[i - 1].z + 60, 'no overlap');
  assert.ok(props.every((p) => p.z + 60 <= 600 && p.z >= START_CLEAR));
  const placed = lvl({ length_m: 600, props: { per_100m: 5, ids: { arch: 1 } }, sections: [{ from_m: 100, to_m: 300, placements: [{ at_m: 200, kind: 'prop', id: 'tube' }] }] });
  const out = generate(normalizeLevel(placed), rng(1), 0, 600, reg, R).props;
  assert.ok(out.some((p) => p.id === 'tube' && p.placed && p.z === 200));
  assert.ok(out.filter((p) => p.id === 'arch').every((p) => p.z + 2 <= 200 || p.z >= 260), 'generated props keep out of the placed tunnel');
  const state = { lastRow: -Infinity, speedFrom: 12, propEnd: -Infinity };
  const norm = normalizeLevel(lvl({ length_m: null, props: { per_100m: 5, ids: { tube: 1 } } }));
  const two = [...generate(norm, rng(2), 0, 120, reg, R, state).props, ...generate(norm, rng(3), 120, 240, reg, R, state).props];
  for (let i = 1; i < two.length; i++) assert.ok(two[i].z >= two[i - 1].z + 60, 'the overlap guard remembers across chunks');
  assert.deepEqual(generate(normalizeLevel(lvl()), rng(1), 0, 600, reg, R).props, [], 'no props key, no props');
});

test('a pulled jug one lane over and close ahead is not overtaken before it arrives', () => {
  const run = createRun(R, COW);
  collect(run, MAGNET);
  const p = { id: 'jug', lane: 0, z: 3 }; // 2.5 m across at 12 m/s sideways takes 0.2 s; at 24 m/s the street moves 5 m in that time
  let collected = false;
  for (let i = 0; i < 60 && !collected; i++) { step(run, 1 / 60, 24); pull(run, p, 1 / 60); collected = inReach(run, p); }
  assert.ok(collected, `the jug ended ${(p.z - run.z).toFixed(2)} m along and ${(p.x - run.x).toFixed(2)} m across, never collected`);
});
