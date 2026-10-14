import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';
import milkshake, { skinWeights, SKIN as SHIPPED } from '../content/characters/milkshake.js';

const [HIPS, HEAD, ARM_L, ARM_R, LEG_L, LEG_R] = [0, 1, 2, 3, 4, 5];

// Points on public/hifi/milkshake.glb (v2, arms down) in its geometry frame (y -1..1, +x the muzzle, z left-right), read with
// gltf-transform on 2026-10-14: each must land on the right bone; the tail and the belly never on an arm.
test('the HiFi Milkshake\'s skin knobs give each part of the generated mesh to its bone', async () => {
  const { SKIN, BONES } = await import('../packs/hifi/characters/milkshake.js');
  const on = ([x, y, z], bone, what) => assert.equal(skinWeights(y, z, SKIN, x)[bone], 1, what);
  on([0.02, -0.95, 0.25], LEG_L, 'a hoof is all one leg'); on([0.03, -0.95, -0.24], LEG_R, 'the other hoof the other leg');
  on([0.01, -0.73, 0.2], LEG_L, 'a leg up to the blend under where the legs join'); on([0.01, -0.73, -0.2], LEG_R, 'and the other');
  on([0, -0.2, 0.44], ARM_L, 'an arm hanging at the side'); on([0, -0.2, -0.43], ARM_R, 'and the other');
  on([0, -0.38, 0.42], ARM_L, 'a hand'); on([0, -0.38, -0.42], ARM_R, 'the other hand');
  on([0, -0.55, 0.355], HIPS, 'the belly\'s flank under a hand, as wide as the arm\'s root');
  on([-0.42, -0.36, -0.55], HIPS, 'the tail\'s tip, at the hands\' height and further out, never swings with an arm');
  on([-0.3, -0.35, -0.42], HIPS, 'the tail where it passes behind the right arm');
  on([-0.26, -0.47, -0.4], HIPS, 'the tail\'s root on the rump: armFloor and armBack fade over armBand, so a wider band must not reach it');
  on([0, 0.09, 0.35], HIPS, 'the top of the shoulder, between the arm and the head, is neither');
  on([0.4, 0.3, 0], HEAD, 'the muzzle'); on([-0.05, 0.67, 0.55], HEAD, 'an ear'); on([-0.03, 0.95, 0.25], HEAD, 'a horn');
  const crotch = skinWeights(SKIN.crotch, 0.2, SKIN, 0);
  assert.ok(crotch[LEG_L] > 0.4 && crotch[LEG_L] < 0.6 && crotch[HIPS] > 0.4, 'the crotch band blends leg into hips');
  assert.ok(SKIN.shoulder + SKIN.shoulderBand <= SKIN.neck, 'the arm-top and neck bands do not overlap: no vertex is torn between a swinging arm and a nodding head');
  assert.ok(BONES.legL[1] === SKIN.crotch && BONES.legR[1] === SKIN.crotch, 'the legs swing from where they join');
  assert.ok(BONES.head[1] > SKIN.neck && BONES.head[1] < SKIN.neck + SKIN.neckBand, 'the head nods from inside its neck band');
  assert.ok([BONES.armL, BONES.armR].every((b) => Math.abs(b[2]) > SKIN.armZ && b[0] > SKIN.armBack && b[1] <= SKIN.shoulder + SKIN.shoulderBand), 'each arm swings from about its own elbow');
});

// skinWeights as it shipped before the optional knobs (550e1be), frozen here: the shipped weights must stay bit-identical to it.
function v4Weights(y, z, K = SHIPPED) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const leg = 1 - sm(K.crotch - K.crotchBand / 2, K.crotch + K.crotchBand / 2, y), left = sm(-0.02, 0.02, z);
  const arm = sm(K.armZ, K.armZ + K.armBand, Math.abs(z)) * (1 - sm(K.shoulder, K.shoulder + K.shoulderBand, y)) * (1 - leg);
  const w = [0, sm(K.neck, K.neck + K.neckBand, y), z > 0 ? arm : 0, z > 0 ? 0 : arm, leg * left, leg * (1 - left)];
  w[0] = Math.max(0, 1 - w[1] - w[2] - w[3] - w[4] - w[5]);
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

test('the arm floor and back knobs are off for the shipped Milkshake, so its weights (and ?lofi) do not change', () => {
  assert.ok(!('armFloor' in SHIPPED) && !('armBack' in SHIPPED), 'the shipped SKIN sets neither knob');
  for (const [y, z] of [[-0.49, 0.1], [-0.1, 0.22], [-0.1, -0.22], [0.05, 0.2], [0.4, 0], [-0.3, 0.3]]) {
    for (const x of [-0.4, 0, 0.4]) assert.deepEqual(skinWeights(y, z, SHIPPED, x), v4Weights(y, z), `y ${y}, z ${z}, x ${x}`);
  }
});

test('the HiFi Milkshake wears the generated model: skinned, glossy, unshadowed by a blob, 1.9 m tall, face ahead, arms swinging', async () => {
  const T = gfx.three;
  // A stand-in in the optimised GLB's shape: positions in the quantised frame (y -1..1), the node scaling them down.
  const map = new T.Texture(), orm = new T.Texture();
  const source = new T.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, metalness: 1, roughness: 1 });
  const verts = [[0, -0.38, 0.42], [0, -0.38, -0.42], [-0.42, -0.36, -0.55], [0, -0.55, 0.355], [0.02, -0.95, 0.25], [0.46, 1, 0.596], [-0.46, -1, -0.596]]; // two hands, the tail, the belly, a hoof, the extents
  const mesh = new T.Mesh(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(verts.flat(), 3)), source);
  mesh.scale.setScalar(0.4897);
  adopt('hifi/milkshake.glb', new T.Group().add(mesh));
  const { default: hifi } = await import('../packs/hifi/characters/milkshake.js');
  assert.deepEqual(hifi.assets, ['hifi/milkshake.glb']);
  const view = await { ...milkshake, ...hifi }.createView(gfx); // the registry merges an overlay over the shipped module
  view.object.updateMatrixWorld(true);
  const skinned = [], blobs = [];
  view.object.traverse((n) => { if (n.isSkinnedMesh) skinned.push(n); if (n.geometry?.type === 'CircleGeometry') blobs.push(n); });
  assert.equal(skinned.length, 1, 'the generated mesh, skinned (not the shape cow)');
  assert.equal(blobs.length, 0, 'no blob shadow: the HiFi look casts real ones');
  const m = skinned[0].material;
  assert.ok(m.isMeshPhysicalMaterial && m.clearcoat === 1 && m.clearcoatRoughness === 0.15, 'a glossy clearcoat');
  assert.ok(m.metalness === 0 && m.metalnessMap === null, 'Tripo\'s random metal dropped');
  assert.ok(m.map === map && m.roughnessMap === orm, 'its own colour and roughness maps');
  const box = new T.Box3().setFromObject(skinned[0]);
  assert.ok(Math.abs(box.max.y - box.min.y - milkshake.height) < 1e-6 && Math.abs(box.min.y) < 1e-6, 'fitted to 1.9 m and standing on the road');
  const face = new T.Vector3(1, 0, 0).transformDirection(skinned[0].matrixWorld);
  assert.ok(face.distanceTo(new T.Vector3(0, 0, 1)) < 1e-6, `the muzzle (+x in the GLB) faces +z, the way Milkshake runs; got ${face.toArray().map((v) => v.toFixed(2))}`);
  view.pose(Math.PI / 28); // the stride's peak at the base pace
  view.object.updateMatrixWorld(true);
  const moved = verts.map((v, i) => skinned[0].getVertexPosition(i, new T.Vector3()).distanceTo(new T.Vector3(...v)));
  assert.ok(moved[0] > 0.1 && moved[1] > 0.1, `both hands swing with their arm bones (${moved[0].toFixed(3)}, ${moved[1].toFixed(3)})`);
  assert.ok(moved[2] < 1e-6 && moved[3] < 1e-6, `the tail and the belly hold still (${moved[2].toFixed(3)}, ${moved[3].toFixed(3)})`);
  assert.ok(moved[4] > 0.1, 'the hoof swings with its leg');
  assert.doesNotThrow(() => view.update({ x: 0, y: 0, z: 0, lane: 1, time: 0.3, slideT: 0, over: false, speed: 12, rules: { laneWidth: 2.5 } }));
});
