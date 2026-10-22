import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, resolveRules, laneX, jumpHeight, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  inReach, collect, updateObstacle, multiplier, MAX_DT, RULE_RANGES, pulled, pull,
} from '../src/rules.js';
import { classifySwipe, KEYS } from '../src/input.js';
import { cameraFor, easeCamera, streakOpacity, CAMERA } from '../src/engine.js';

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
import { generate, normalizeLevel, densityAt, rng, passable, curveSegments, turnedBy, FINISH_STRAIGHT_M, cameraAt, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
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

test('curveSegments lists the bending stretches of street: sections, the inherited level curve, random picks, nothing in the last 120 m', () => {
  const level = lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 300, to_m: 600, curve: { hill: -1 } }, { from_m: 600, to_m: 900, curve: 'random' }] });
  const norm = normalizeLevel(level);
  const segs = curveSegments(norm, 0, 1500, 7);
  assert.deepEqual(segs[0], { from: 0, to: 300, turn: 1, hill: 0 }, 'the level curve applies outside sections');
  assert.deepEqual(segs[1], { from: 300, to: 600, turn: 0, hill: -1 }, 'a section curve replaces it');
  const random = segs.filter((s) => s.from >= 600 && s.from < 900);
  assert.ok(random.length <= 2 && random.every((s) => s.to <= 900 && Math.abs(s.turn) <= 1 && Math.abs(s.hill) <= 1 && (s.turn || s.hill)), 'random stretches stay inside their section, carry a pick and skip the straight ones');
  assert.deepEqual(random, curveSegments(norm, 0, 1500, 7).filter((s) => s.from >= 600 && s.from < 900), 'random picks come from the seed');
  assert.deepEqual(segs.at(-1), { from: 900, to: 1500 - FINISH_STRAIGHT_M, turn: 1, hill: 0 }, 'the level curve resumes and stops 120 m before the finish');
  assert.deepEqual(curveSegments(norm, 1380, 1500, 7), [], 'the last 120 m are straight');
  assert.deepEqual(curveSegments(norm, 100, 200, 7), [{ from: 0, to: 300, turn: 1, hill: 0 }], 'only stretches overlapping the asked range, with their real ends');
  assert.deepEqual(curveSegments(normalizeLevel(lvl()), 0, 1500), [], 'no curve means straight');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ sections: [{ from_m: 100, to_m: 200, curve: { turn: 0 } }] })), 0, 1500), [], 'explicit zeros are a straight stretch');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ length_m: 100, curve: { turn: 1 } })), 0, 100), [], 'a level shorter than the finish straight is straight');
  const E = normalizeLevel(lvl({ length_m: null, curve: 'random' }));
  const a = curveSegments(E, 0, 2400, 7), b = curveSegments(E, 0, 2400, 8);
  assert.ok(a.length >= 5 && a.every((s) => (s.to - s.from) % 240 === 0 && s.from % 240 === 0), 'random is cut every 240 m (neighbours with the same pick merge into one stretch)');
  assert.deepEqual(a, curveSegments(E, 0, 2400, 7));
  assert.notDeepEqual(a, b, 'and differs between seeds');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ length_m: 480, curve: 'random' })), 0, 480, 7).filter((s) => s.to > 360), [], 'random stops 120 m before a finite finish too');
});

test('curveSegments scales each section\'s hill by hillOf(section), 1 by default (today\'s numbers exactly); turns and random picks never move', () => {
  const norm = normalizeLevel(lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 300, to_m: 600, curve: { turn: 0.3, hill: 0.7 }, theme: { id: 'bridge' } }, { from_m: 600, to_m: 900, curve: 'random' }] }));
  const today = curveSegments(norm, 0, 1500, 7);
  assert.deepEqual(curveSegments(norm, 0, 1500, 7, () => 1), today, 'a factor of 1 is no change');
  const level = curveSegments(norm, 0, 1500, 7, (s) => (s.theme?.id === 'bridge' ? 0 : 1));
  assert.deepEqual(level[1], { from: 300, to: 600, turn: 0.3, hill: 0 }, 'a level section keeps its turn and drops its hill');
  assert.deepEqual(level.filter((s) => s.from !== 300), today.filter((s) => s.from !== 300), 'every other section is as before');
  const half = curveSegments(norm, 0, 1500, 7, () => 0.5);
  assert.deepEqual(half.map((s) => [s.from, s.to, s.turn, s.hill]), today.map((s) => [s.from, s.to, s.turn, s.hill * 0.5]), 'random hills scale too, from the same picks');
  const down = normalizeLevel(lvl({ length_m: 1500, sections: [{ from_m: 300, to_m: 600, curve: { turn: 0.3, hill: -0.5 } }, { from_m: 600, to_m: 1380, curve: 'random' }] }));
  assert.ok(curveSegments(down, 0, 1500, 7, () => 0).every((s) => Object.is(s.hill, 0)), 'a downhill levelled is +0, never -0, as setBend keeps a straight road');
});

test('curveSegments merges touching stretches with the same bend, so a level-wide curve over many sections is one stretch and never fills the slots', () => {
  const norm = normalizeLevel(lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 100, to_m: 200, density: { start: 1, end: 1 } }, { from_m: 200, to_m: 300, jugs: { per_100m: 0, powerups: [] } }] }));
  assert.deepEqual(curveSegments(norm, 0, 1500), [{ from: 0, to: 1500 - FINISH_STRAIGHT_M, turn: 1, hill: 0 }], 'four sections under the inherited curve are one stretch');
  assert.deepEqual(curveSegments(norm, 150, 250), [{ from: 100, to: 300, turn: 1, hill: 0 }], 'inside a window the merge covers the sections in view');
  const split = normalizeLevel(lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 100, to_m: 200, curve: { turn: 1, hill: 0.5 } }] }));
  assert.equal(curveSegments(split, 0, 1500).length, 3, 'a different bend in the middle keeps three stretches');
});

test('turnedBy is how far the street has turned by z (turn × metres): 0 on the straight, each turn whole after it, continuous, and blind to how stretches merge', () => {
  assert.equal(turnedBy(normalizeLevel(lvl()), 1000), 0, 'a straight level never turns');
  const two = normalizeLevel(lvl({ sections: [{ from_m: 150, to_m: 400, curve: { turn: 1 } }, { from_m: 600, to_m: 800, curve: { turn: -0.5, hill: 0.5 } }, { from_m: 900, to_m: 1000, curve: { hill: 1 } }] }));
  assert.equal(turnedBy(two, 150), 0, 'nothing before the first turn');
  assert.equal(turnedBy(two, 275), 125, 'half way through it, half of it');
  assert.equal(turnedBy(two, 1400), 250 * 1 + 200 * -0.5, 'after the last: every turn times its length, summed; a hill turns nothing');
  const E = normalizeLevel(lvl({ length_m: null, curve: 'random' }));
  for (const seed of [3, 7, 11]) {
    const segs = curveSegments(E, 0, 2400, seed);
    assert.ok(segs.some((s) => s.turn), `seed ${seed} turns somewhere`);
    assert.equal(turnedBy(E, 2400, seed), segs.reduce((sum, s) => sum + s.turn * (s.to - s.from), 0), `seed ${seed}: the random picks behind, summed`);
  }
  for (const [norm, seed, to] of [[two, 0, 1500], [E, 3, 4000], [E, 7, 4000], [E, 11, 4000]]) {
    let prev = turnedBy(norm, 0, seed);
    for (let z = 0.5; z <= to; z += 0.5) {
      const t = turnedBy(norm, z, seed);
      assert.ok(Math.abs(t - prev) <= 0.5 + 1e-9, `seed ${seed}: ${prev} to ${t} between ${z - 0.5} and ${z} m`); // at most a full turn's half metre
      prev = t;
    }
  }
  const merged = normalizeLevel(lvl({ curve: { turn: 1 }, sections: [{ from_m: 100, to_m: 200, density: { start: 1, end: 1 } }] }));
  for (const z of [50, 150, 250, 1450]) assert.equal(turnedBy(merged, z), Math.min(z, 1500 - FINISH_STRAIGHT_M), `${z} m under one merged stretch`);
});

test('gfx.box subdivides along z so long road pieces bend', () => {
  assert.equal(gfx.box(1, 1, 120, '#ffffff').geometry.parameters.depthSegments, 30);
  assert.equal(gfx.box(1, 1, 3, '#ffffff').geometry.parameters.depthSegments, 1);
  assert.ok(gfx.box(1, 1, 1, '#ffffff').material.userData.bent, 'materials from the helpers are bendable');
});

test('the bend is anchored to its stretch of street: straight before the start line, continuous across it, straight at the end line', () => {
  const seg = { from: 150, to: 400, turn: 0.7, hill: 0 };
  gfx.setBend({ origin: 0, segments: [seg] });
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [150, 400, -0.7 * gfx.TURN_K, 0], 'positive turn bends to screen-right (-x)');
  assert.deepEqual(gfx.bendOffset(100), { x: 0, y: 0 }, 'straight up to the lead-in line');
  assert.equal(gfx.bendOffset(150 - gfx.BEND_LEAD).x, 0, 'the bend begins BEND_LEAD metres before the stretch\'s start line');
  assert.ok(gfx.bendOffset(150).x < -3, 'so the line itself is already turning: the corner reads before you reach it (Caedon, 2026-10-09)');
  const far = gfx.bendOffset(250).x;
  assert.ok(far < -30, 'bends to screen-right beyond it');
  gfx.setBend({ origin: 80, segments: [seg] });
  assert.equal(gfx.bendOffset(250).x, far, 'a fixed point on the street looks the same as Milkshake approaches');
  gfx.setBend({ origin: 90, segments: [seg] }); // 20 m ahead is the lead-in line: from here the stretch rides with Milkshake
  const atLine = gfx.bendOffset(250).x;
  gfx.setBend({ origin: 90.01, segments: [seg] });
  assert.ok(Math.abs(gfx.bendOffset(250).x - atLine) < 0.02, 'and crossing the line moves the picture by the slope alone, a centimetre for a centimetre: no step');
  gfx.setBend({ origin: 340, segments: [seg] }); // 60 m before the end line
  assert.ok(gfx.bendOffset(400).x < 0 && gfx.bendOffset(400).x > -6, 'the last of the bend is a few metres');
  assert.ok(gfx.bendOffset(500).x < gfx.bendOffset(400).x, 'and the far road keeps the turn\'s heading');
  gfx.setBend({ origin: 380, segments: [seg] }); // the end line is inside the dead zone
  assert.deepEqual(gfx.bendOffset(600), { x: 0, y: 0 }, 'a stretch ending within 20 m ahead, or behind, bends nothing');
  gfx.setBend({ origin: 0, segments: [{ from: 100, to: 200, turn: 1, hill: 0 }, { from: 200, to: 300, turn: -1, hill: 0 }] });
  assert.ok(Math.abs(gfx.bendOffset(200.001).x - gfx.bendOffset(199.999).x) < 0.01, 'a right turn straight into a left turn meets without a step (the slope there is 1 m per m, so 2 mm apart differ by about 2 mm)');
  assert.ok(gfx.bendOffset(300).x < gfx.bendOffset(200).x, 'the right turn\'s heading carries into the left turn');
  assert.ok(Math.abs(gfx.bendOffset(400).x - gfx.bendOffset(300).x) < 1e-9, 'and an equal left turn brings the far road back to parallel');
  gfx.setBend({ origin: 0, segments: [{ from: 100, to: 300, turn: 0, hill: -0.5 }] });
  const crest = gfx.bendOffset(300).y;
  assert.ok(crest < -50, 'a dip drops out of sight');
  assert.equal(gfx.bendOffset(500).y, crest, 'and holds its depth past the end line');
  assert.equal(gfx.bendOffset(500).x, 0);
  gfx.setBend({ origin: 0, segments: Array.from({ length: 5 }, (_, i) => ({ from: 20 + i, to: 500, turn: 0.2, hill: 0 })) });
  const four = [0, 1, 2, 3].reduce((s) => s - 0.2 * gfx.TURN_K * 280 ** 2, 0); // the lead-in puts every start line behind the dead zone, so all four begin at 20 m
  assert.ok(Math.abs(gfx.bendOffset(300).x - four) < 1e-9, 'only the first four stretches in view bend');
  gfx.setBend();
  assert.deepEqual(gfx.bendOffset(300), { x: 0, y: 0 }, 'no stretches, straight street');
  assert.equal(gfx.bendStart.value, gfx.DEAD);
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

test('gfx.bend takes a mesh with a material array, as three.js allows', () => {
  const mesh = new gfx.three.Mesh(new gfx.three.BoxGeometry(1, 1, 1), [new gfx.three.MeshBasicMaterial(), new gfx.three.MeshBasicMaterial()]);
  assert.doesNotThrow(() => gfx.bend(mesh));
  assert.ok(mesh.material.every((m) => m.userData.bent));
});

test('the reaction floor also holds before a placed row that sits on the grid', () => {
  const fast = resolveRules({ speed: { start: 30, end: 30 } }); // floor 18 m
  const placed = lvl({ density: { start: 1, end: 1 }, sections: [{ from_m: 100, to_m: 400, placements: [{ at_m: 204, lane: 0, kind: 'obstacle', id: 'taxi' }] }] });
  for (const s of seeds.slice(0, 20)) for (const o of all(placed, s, fast).obstacles.filter((o) => !o.placed)) assert.ok(o.z >= 204 || 204 - o.z >= 18, `seed ${s}: generated row at ${o.z} right before the placement at 204`);
});

test('gfx.bendable chains a material\'s own onBeforeCompile and keys the program cache by it', () => {
  const calls = [];
  const own = gfx.bendable(Object.assign(new gfx.three.MeshBasicMaterial(), { onBeforeCompile: (shader) => calls.push(shader) }));
  const shader = { uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}' };
  own.onBeforeCompile(shader, null);
  assert.equal(calls[0], shader, 'the module\'s own hook still runs');
  assert.ok(shader.uniforms.uSeg === gfx.bendSegments && shader.uniforms.uBendStart === gfx.bendStart && shader.vertexShader.includes('uSeg'), 'and the bend is patched in after it');
  const plain = gfx.bendable(new gfx.three.MeshBasicMaterial());
  assert.notEqual(own.customProgramCacheKey(), plain.customProgramCacheKey(), 'three caches programs by this key: different hooks, different programs');
  assert.notEqual(plain.customProgramCacheKey(), new gfx.three.MeshBasicMaterial().customProgramCacheKey(), 'a bent material never shares a program with an unbent one');
});

test('the camera eases the speed that widens the view like its overrides, so a carried speed does not pop the first frame', () => {
  const live = easeCamera({ ...CAMERA, speed: 0 }, {}, 24, 1 / 60); // level 2 opens at the 24 m/s level 1 ended with
  assert.ok(live.speed > 0 && live.speed < 2.4, `one frame in, the eased speed has barely moved (${live.speed})`);
  assert.ok(Math.abs(cameraFor({ x: 0, y: 0, z: 0 }, live, live.speed).fov - 60) < 1, 'so the view opens at the base field of view instead of popping to 67°');
  assert.equal(easeCamera(live, {}, 24, Infinity).speed, 24, 'dt = Infinity snaps, as it does for the overrides');
});

test('a snap keeps the felt speed and switches the streaks off, so the frame a Bonk or an ending starts on is as wide as the last one', () => {
  const live = easeCamera({ ...CAMERA, fov: 70, speed: 24 }, {}, 24, Infinity); // the end snap: the section override back to its default, the run's speed kept
  assert.deepEqual([live.fov, live.speed], [60, 24]);
  assert.ok(Math.abs(cameraFor({ x: 0, y: 0, z: 0 }, live, live.speed).fov - 67.2) < 1e-9, 'no 7° drop at 24 m/s');
  assert.ok(Math.abs(streakOpacity(24) - (0.6 * 8) / 14) < 1e-9, 'a frame at 24 m/s draws the streaks');
  assert.equal(streakOpacity(24, Infinity), 0, 'a snap is a still: no motion lines');
});

test('the bend keeps instanced and batched copies where three puts them: batching, then instancing, then the model, then the street', () => {
  const shader = { uniforms: {}, vertexShader: gfx.three.ShaderLib.standard.vertexShader };
  gfx.bendable(new gfx.three.MeshStandardMaterial()).onBeforeCompile(shader, null);
  const v = shader.vertexShader;
  assert.ok(!v.includes('#include <project_vertex>'), 'three\'s projection is replaced');
  const at = ['bentWorld = batchingMatrix * bentWorld', 'bentWorld = instanceMatrix * bentWorld', 'bentWorld = modelMatrix * bentWorld', 'bendOffset( bentWorld.z )'].map((s) => v.indexOf(s));
  assert.ok(at.every((i, k) => i > 0 && (k === 0 || i > at[k - 1])), `in three's order: ${at}`);
  assert.deepEqual(gfx.three.ShaderChunk.project_vertex.match(/\w+Matrix(?= \*)/g), ['batchingMatrix', 'instanceMatrix', 'modelViewMatrix', 'projectionMatrix'], 'three applies the same matrices in the same order; a three upgrade that changes them fails here');
});

test('a clone of a bent material is bent too, instead of silently rendering straight', () => {
  const clone = gfx.bendable(new gfx.three.MeshStandardMaterial()).clone();
  const shader = { uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}' };
  gfx.bendable(clone).onBeforeCompile(shader, null);
  assert.ok(shader.vertexShader.includes('bendOffset'), 'the clone is patched');
});

test('HiFi lets the skyline through what the fog has fully hidden, and low-fi compiles three\'s fragment shaders untouched', () => {
  assert.ok(gfx.fogCut.value === 0 && gfx.hook.cutFog === false, 'the cut starts off, compiled out');
  const CUT = '#include <fog_fragment>\n#ifdef USE_FOG\n  if ( uFogCut > 0.5 && fogFactor > 0.999 ) discard;';
  const compile = (T, lib) => {
    const shader = { uniforms: {}, vertexShader: gfx.three.ShaderLib[lib].vertexShader, fragmentShader: gfx.three.ShaderLib[lib].fragmentShader };
    gfx.bendable(new T()).onBeforeCompile(shader, null);
    return shader;
  };
  for (const [T, lib] of [[gfx.three.MeshToonMaterial, 'toon'], [gfx.three.SpriteMaterial, 'sprite']]) {
    const low = compile(T, lib);
    assert.ok(low.fragmentShader === gfx.three.ShaderLib[lib].fragmentShader && !('uFogCut' in low.uniforms), `${lib}: low-fi has no uFogCut and no discard`);
    gfx.hook.cutFog = true; // what createLook sets, once, before anything compiles
    try {
      const hi = compile(T, lib), f = hi.fragmentShader, decl = f.indexOf('uniform float uFogCut;');
      assert.equal(hi.uniforms.uFogCut, gfx.fogCut, `${lib}: one shared uniform the look switches per theme`);
      assert.ok(decl >= 0 && decl < f.indexOf('void main() {') && f.includes(CUT), `${lib}: declared before main; the cut right after three's fog, behind USE_FOG and uFogCut`);
      // Task 32 height fog (Caedon, board 22): a bent mesh fogs toward uFogShade low down; Task 34 L-I (board 29 pick 5): by its
      // bent height, and far off toward the dome's colour at its elevation
      const lit = lib === 'toon', v = hi.vertexShader, MIX = 'mix( uFogShade, fogColor, smoothstep( uFogHeight.x, uFogHeight.y, vFogWorld.y ) )';
      assert.equal(v.includes('varying vec3 vFogWorld;') && f.includes('varying vec3 vFogWorld;'), lit, `${lib}: the varying only where three projects the vertex (a sprite has no project_vertex)`);
      if (lit) {
        assert.ok(v.indexOf('vFogWorld = bentWorld.xyz;') > v.indexOf('bentWorld.xyz += bendOffset'), 'taken after the bend: a hill\'s street fogs like the sky it rises into');
        assert.ok(!v.includes('- bendOffset( bentWorld.z ).y'), 'the lift no longer comes off');
        assert.ok(f.includes(MIX) && f.indexOf(MIX) < f.indexOf('#include <fog_fragment>') && f.includes('#define fogColor'), 'three\'s fog mixes toward the height fog colour');
        const SKY = 'hFogColor = fogSky( hFogColor, normalize( vFogWorld - cameraPosition ).y, smoothstep( fogNear, fogFar, vFogDepth ) );';
        assert.ok(f.indexOf(SKY) > f.indexOf(MIX) && f.indexOf(SKY) < f.indexOf('#define fogColor') && f.indexOf('vec3 fogSky(') < f.indexOf('void main() {'), 'then toward the dome by the view\'s elevation, as far as the fog is thick');
        assert.ok(hi.uniforms.uFogShade === gfx.fogShade && hi.uniforms.uFogHeight === gfx.fogHeight, 'shared uniforms the look sets per theme');
        assert.ok(hi.uniforms.uSkyTop === gfx.fogSkyTop && hi.uniforms.uSkyBottom === gfx.fogSkyBottom, 'the dome\'s colours, shared with the dome itself');
      } else assert.ok(!f.includes('uFogShade') && !f.includes('fogSky') && !('uFogShade' in hi.uniforms), 'a sprite keeps the plain fog');
    } finally { gfx.hook.cutFog = false; }
  }
});

test('low-fi\'s bent shaders are pinned: without hook.cutFog every program compiles as it did before Task 34', async () => {
  const { createHash } = await import('node:crypto'), T = gfx.three, got = {};
  for (const [M, lib] of [[T.MeshToonMaterial, 'toon'], [T.MeshStandardMaterial, 'standard'], [T.SpriteMaterial, 'sprite']]) {
    const s = { uniforms: {}, vertexShader: T.ShaderLib[lib].vertexShader, fragmentShader: T.ShaderLib[lib].fragmentShader };
    gfx.bendable(new M()).onBeforeCompile(s, null);
    got[lib] = createHash('sha256').update(s.vertexShader + '\0' + s.fragmentShader + '\0' + Object.keys(s.uniforms).sort().join()).digest('hex').slice(0, 16);
  }
  assert.deepEqual(got, { toon: 'eb814d46f4b0bed2', standard: 'bb60a27b073dba39', sprite: '8d085bfbce9103d3' }, 'hashed at 159fb14 (three 0.186): a three upgrade re-pins, a gfx change must not');
});

test('far off, the fog gives way to the dome\'s colour at the fragment\'s elevation: near fragments keep the plain fog (Task 34 L-I)', () => {
  const fog = [0.4, 0.3, 0.5], top = [0.2, 0.1, 0.6], bottom = [0.9, 0.5, 0.8], close = (a, b, m) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-9, `${m}: ${a} vs ${b}`));
  close(gfx.fogSky(fog, top, bottom, 0.1, gfx.FOG_SKY[0]), fog, 'up to FOG_SKY[0] of the fog: the fog as it is');
  close(gfx.fogSky(fog, top, bottom, -0.2, gfx.FOG_SKY[1]), bottom, 'from FOG_SKY[1]: below the horizon, the dome\'s horizon colour');
  close(gfx.fogSky(fog, top, bottom, gfx.SKY_EDGE, 1), top, 'at SKY_EDGE up: the dome\'s top');
  close(gfx.fogSky(fog, top, bottom, gfx.SKY_EDGE / 2, 1), bottom.map((b, i) => (b + top[i]) / 2), 'halfway up: the dome\'s own smoothstep middle');
  const k = (gfx.FOG_SKY[0] + gfx.FOG_SKY[1]) / 2;
  close(gfx.fogSky(fog, top, bottom, -1, k), fog.map((f, i) => (f + bottom[i]) / 2), 'between: a smoothstep on the fog factor');
  assert.deepEqual(gfx.FOG_SKY, [0.6, 0.95]);
  assert.ok(gfx.FOG_SKY[1] < 0.999, 'all sky before the fog cut drops the fragment, so the cut shows no edge');
});

test('HiFi bends without three\'s culling on the unbent bounds: a mesh the bend swings into view is drawn; low-fi keeps the culling', () => {
  const T = gfx.three, camera = new T.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.set(0, 3, -6); camera.lookAt(0, 1.2, 12); camera.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const block = () => { const m = gfx.box(10, 20, 10, '#888888', 130, 10, 180); m.updateMatrixWorld(); return m; }; // straight, 130 m off to the left at 180 m: out of view
  gfx.setBend({ origin: 0, segments: [{ from: 20, to: 200, turn: 1, hill: 0 }] });
  try {
    const x = 130 + gfx.bendOffset(180).x;
    assert.ok(Math.abs(x) < 20, `a right turn swings it to x ${x.toFixed(1)}, ahead in view`);
    const drawn = (m) => !m.frustumCulled || frustum.intersectsObject(m); // three's own test (WebGLRenderer.projectObject)
    assert.equal(drawn(gfx.bend(block())), false, 'low-fi: culled on its unbent bounds, as before');
    gfx.hook.cutFog = true; // what createLook sets, once, before anything is added
    try {
      const g = gfx.bend(gfx.group(block(), gfx.group(block())));
      g.traverse((n) => { if (n.isMesh) assert.ok(drawn(n), 'every mesh the HiFi bend marks is drawn'); });
    } finally { gfx.hook.cutFog = false; }
  } finally { gfx.setBend(); }
});

test('gfx.bendable runs the look\'s beforeBend hook before the bend wraps: the module\'s hook, then the look\'s, then the bend', () => {
  assert.equal(gfx.hook.beforeBend, null, 'low-fi sets no hook');
  const order = [], own = () => order.push('own');
  gfx.hook.beforeBend = (m) => { // as CSM.setupMaterial does: it replaces onBeforeCompile instead of chaining
    order.push(m.onBeforeCompile === own ? 'hooked before the wrap' : 'hooked after the wrap');
    m.onBeforeCompile = (shader) => order.push(shader.vertexShader.includes('bendOffset') ? 'look, after the bend' : 'look');
  };
  try {
    const shader = { uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}' };
    gfx.bendable(Object.assign(new gfx.three.MeshToonMaterial(), { onBeforeCompile: own })).onBeforeCompile(shader, null);
    assert.deepEqual(order, ['hooked before the wrap', 'own', 'look']);
    assert.ok(shader.vertexShader.includes('bendOffset'), 'and the bend is patched in last');
  } finally { gfx.hook.beforeBend = null; }
});
