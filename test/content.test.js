import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import milkshake from '../content/characters/milkshake.js';
import { createRun, resolveRules, step } from '../src/rules.js';

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
