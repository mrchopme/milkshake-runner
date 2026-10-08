import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import milkshake, { SKIN, skinWeights } from '../content/characters/milkshake.js';
import { createRun, resolveRules, step, jumpHeight } from '../src/rules.js';
import { pickupName } from '../src/hud.js';
import magnet from '../content/pickups/magnet.js';
import barrier from '../content/obstacles/barrier_low.js';
import beam from '../content/obstacles/scaffold_beam.js';
import taxi from '../content/obstacles/taxi.js';

// In Node there is no GLB loader, so createView falls back to the shape-built cow; the motion code is the same for both.
test('Milkshake leans and strides harder with speed, and kicks up dust on the ground', async () => {
  const view = await milkshake.createView(gfx);
  const body = view.object.children[1];
  const run = createRun(resolveRules(), milkshake);
  run.time = 0.3;
  view.update(run);
  assert.equal(body.rotation.x, 0, 'no lean at the base pace');
  run.speed = 24;
  view.update(run);
  assert.ok(body.rotation.x > 0.05, 'leans forward at double pace');
  const puffs = view.object.children.find((c) => c.children.length === 6);
  assert.ok(puffs, 'six dust puffs are pooled');
  let frames = 0;
  for (let i = 0; i < 60; i++) { step(run, 1 / 60, 24); view.update(run); frames += puffs.children.some((p) => p.visible); }
  assert.ok(frames > 0, 'puffs show while running on the ground');
  run.y = 1; // airborne: no new puffs, the old ones fade within 0.35 s
  for (let i = 0; i < 40; i++) { run.time += 1 / 60; view.update(run); }
  assert.ok(puffs.children.every((p) => !p.visible));
});

test('a pickup is named by its module, or by its id in capitals', () => {
  assert.equal(pickupName({ id: 'ari/gem' }), 'GEM');
  assert.equal(pickupName(magnet), 'MAGNET');
  assert.ok(magnet.blurb.length <= 80);
});

test('dust puffs hold their place on the road when Milkshake changes lane or jumps', async () => {
  const view = await milkshake.createView(gfx);
  const puffs = view.object.children.find((c) => c.children.length === 6);
  const run = createRun(resolveRules(), milkshake);
  let puff;
  for (let i = 0; i < 60 && !puff; i++) { step(run, 1 / 60, 12); view.update(run); puff = puffs.children.find((p) => p.visible); }
  assert.ok(puff, 'a puff is born within a second');
  const world = () => puff.getWorldPosition(new gfx.three.Vector3());
  const born = world();
  run.x += 1.2; run.y = 0.8; // mid lane change and in the air, within the puff's 0.35 s life
  view.update(run);
  const now = world();
  assert.ok(Math.abs(now.x - born.x) < 1e-9, `the puff slid ${(now.x - born.x).toFixed(2)} m sideways with the lane change`);
  assert.ok(Math.abs(now.y - born.y) < 1e-9, `the puff rose ${(now.y - born.y).toFixed(2)} m with the jump`);
  assert.ok(Math.abs(now.z - born.z) < 1e-9, 'z is still held');
});

// Board 14: the silhouette says the move. The boxes must agree with it: a barrier you can jump, a beam you can slide under, a taxi you cannot jump.
test('the shipped obstacle boxes match their moves', () => {
  const R = resolveRules();
  assert.ok(barrier.avoid === 'jump' && (barrier.box.y ?? 0) === 0 && barrier.box.h <= jumpHeight(R), 'the barrier is low and on the ground');
  assert.ok(beam.avoid === 'slide' && beam.box.y >= R.slideHeight, 'the beam leaves room to slide under');
  assert.ok(taxi.avoid === 'lane' && taxi.box.h >= jumpHeight(R) + 0.6, 'the taxi stands well above a jump\'s apex');
});

// The Tripo mesh is skinned at load from these weights (v4 spec §3); Node cannot load the GLB, so the rule is tested on its own.
test('skinWeights gives each part of the Tripo mesh to its bone and blends at the joints', () => {
  const [HIPS, HEAD, ARM_L, ARM_R, LEG_L, LEG_R] = [0, 1, 2, 3, 4, 5];
  const at = (y, z) => { const w = skinWeights(y, z); assert.ok(Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-9, 'weights sum to 1'); assert.ok(w.filter((v) => v > 0).length <= 4, 'four weights at most'); return w; };
  assert.equal(at(-0.49, 0.1)[LEG_L], 1, 'a foot is all one leg');
  assert.equal(at(-0.49, 0.1)[LEG_R], 0, 'and never pulls on the other leg');
  assert.equal(at(-0.49, -0.1)[LEG_R], 1);
  assert.equal(at(0, 0.1)[HIPS], 1, 'the flank is all hips');
  assert.equal(at(-0.1, 0.22)[ARM_L], 1, 'an outboard belly-height vertex is all arm');
  assert.equal(at(-0.1, -0.22)[ARM_R], 1);
  assert.equal(at(0.4, 0)[HEAD], 1, 'above the neck is all head');
  const crotch = at(SKIN.crotch, 0.1);
  assert.ok(crotch[LEG_L] > 0.4 && crotch[LEG_L] < 0.6 && crotch[HIPS] > 0.4, 'the crotch band blends leg into hips');
  const shoulder = at(SKIN.shoulder + SKIN.shoulderBand / 2, 0.22);
  assert.ok(shoulder[ARM_L] > 0.3 && shoulder[ARM_L] < 0.7 && shoulder[HIPS] > 0.3, 'the shoulder band blends arm into hips');
});
