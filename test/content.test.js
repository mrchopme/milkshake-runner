import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import milkshake, { SKIN, skinWeights, fitModel } from '../content/characters/milkshake.js';
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

// The GLB path, in Node: a synthetic scene with one mesh in the Tripo export's frame (y -0.5..0.5, +x the muzzle, z left-right).
test('fitModel skins the loaded mesh in place: six bones under the hips under the mesh, weights that sum to 1, the swing axis z, the model fitted to its height', () => {
  const THREE = gfx.three;
  const verts = [[0, -0.49, 0.1], [0, -0.49, -0.1], [0, 0, 0.1], [-0.1, -0.1, 0.22], [-0.1, -0.1, -0.22], [-0.05, 0.4, 0], [0.24, 0.5, 0.3], [-0.24, -0.5, -0.3]]; // a foot each side, the flank, an arm nub each side, the head, the extents
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(verts.flat(), 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  const scene = new THREE.Group(); scene.add(mesh);
  const { model, arms, legs, head, limbAxis } = fitModel(THREE, scene, milkshake);
  assert.equal(model, scene);
  const skinned = scene.children[0];
  assert.ok(skinned.isSkinnedMesh && !scene.children.includes(mesh), 'the skinned mesh takes the mesh\'s place in its parent');
  assert.ok(skinned.material.isMeshToonMaterial, 'with the toon material');
  assert.equal(skinned.bindMode, 'attached');
  const hips = skinned.skeleton.bones[0];
  assert.ok(skinned.skeleton.bones.length === 6 && hips.parent === skinned && [head, ...arms, ...legs].every((b) => b.parent === hips), 'six bones: the hips under the mesh, the rest under the hips');
  assert.equal(limbAxis, 'z');
  const w = g.attributes.skinWeight, j = g.attributes.skinIndex;
  for (let i = 0; i < verts.length; i++) assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-6, `vertex ${i} weights sum to 1`);
  assert.deepEqual([j.getX(0), j.getX(1), j.getX(2), j.getX(3), j.getX(4), j.getX(5)], [4, 5, 0, 2, 3, 1], 'feet on the legs, the flank on the hips, nubs on the arms, the head on the head bone');
  const box = new THREE.Box3().setFromObject(scene);
  assert.ok(Math.abs(box.max.y - box.min.y - milkshake.height) < 1e-6 && Math.abs(box.min.y) < 1e-6, 'fitted to 1.9 m and standing on the ground');
});

test('a model that breaks after skinning is thrown away whole, so the fallback cow keeps its own limb axis', async () => {
  const THREE = gfx.three;
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3));
  const scene = new THREE.Group(); scene.add(new THREE.Mesh(g, null)); // the skinning succeeds, the material swap throws
  assert.throws(() => fitModel(THREE, scene, milkshake), TypeError);
  const view = await milkshake.createView(gfx); // in Node the loader fails: the same catch installs the shape cow
  view.pose(0.11); // a stride near its peak
  const pivots = view.object.children[1].children[0].children.filter((c) => c.isGroup);
  assert.ok(pivots.length === 4 && pivots.every((p) => p.rotation.x !== 0 && p.rotation.z === 0), 'the shape cow swings its capsule limbs about x');
});
