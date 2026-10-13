import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';
import milkshake, { skinWeights } from '../content/characters/milkshake.js';

const [HIPS, HEAD, , , LEG_L, LEG_R] = [0, 1, 2, 3, 4, 5]; // the arms' slots are 2 and 3

// Points on public/hifi/milkshake.glb in its geometry frame (y -1..1, +x the muzzle, z left-right), read with gltf-transform
// on 2026-10-13: each must land on the right bone, the tail and the belly never on an arm.
test('the HiFi Milkshake\'s skin knobs give each part of the generated mesh to its bone', async () => {
  const { SKIN, BONES } = await import('../packs/hifi/characters/milkshake.js');
  const on = (y, z, bone, what) => assert.equal(skinWeights(y, z, SKIN)[bone], 1, what);
  on(-0.95, 0.27, LEG_L, 'a hoof is all one leg'); on(-0.95, -0.27, LEG_R, 'the other hoof the other leg');
  on(-0.75, 0.2, LEG_L, 'a leg up to the blend under where the legs join'); on(-0.75, -0.2, LEG_R, 'and the other');
  on(-0.56, 0.36, HIPS, 'the belly\'s flank, wider than the chest');
  on(-0.33, -0.55, HIPS, 'the tail\'s tip, out to the side below the arms, never swings with an arm');
  on(-0.5, -0.4, HIPS, 'the tail\'s root');
  on(0.015, 0.66, HIPS, 'an arm rides the torso'); on(0.015, -0.66, HIPS, 'and the other');
  on(0.3, 0, HEAD, 'the muzzle'); on(0.66, 0.55, HEAD, 'an ear'); on(0.95, 0.23, HEAD, 'a horn');
  const crotch = skinWeights(SKIN.crotch, 0.2, SKIN);
  assert.ok(crotch[LEG_L] > 0.4 && crotch[LEG_L] < 0.6 && crotch[HIPS] > 0.4, 'the crotch band blends leg into hips');
  assert.ok(BONES.legL[1] === SKIN.crotch && BONES.legR[1] === SKIN.crotch, 'the legs swing from where they join');
  assert.ok(BONES.head[1] > SKIN.neck && BONES.head[1] < SKIN.neck + SKIN.neckBand, 'the head nods from inside its neck band');
});

test('the HiFi Milkshake wears the generated model: skinned, glossy, unshadowed by a blob, 1.9 m tall, face ahead', async () => {
  const T = gfx.three;
  // A stand-in in the optimised GLB's shape: positions in the quantised frame (y -1..1), the node scaling them down.
  const map = new T.Texture(), orm = new T.Texture();
  const source = new T.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, metalness: 1, roughness: 1 });
  const mesh = new T.Mesh(new T.BoxGeometry(1.02, 2, 1.38, 2, 16, 4), source);
  mesh.scale.setScalar(0.4894);
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
  assert.doesNotThrow(() => view.update({ x: 0, y: 0, z: 0, lane: 1, time: 0.3, slideT: 0, over: false, speed: 12, rules: { laneWidth: 2.5 } }));
});
