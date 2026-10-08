import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, resolveRules, laneX, jumpHeight, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  inReach, collect, updateObstacle, multiplier, MAX_DT,
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

test('speed rises across a level and caps in endless', () => {
  assert.equal(speedAt({ length_m: 1000 }, 0, R), 12);
  assert.equal(speedAt({ length_m: 1000 }, 1000, R), 20);
  assert.equal(speedAt({ length_m: null }, 1e6, R), 28);
  assert.equal(speedAt({ length_m: 1000 }, 500, resolveRules({ speed: { start: 10, end: 30 } })), 20);
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
