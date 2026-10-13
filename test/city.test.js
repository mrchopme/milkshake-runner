import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import downtown from '../packs/hifi/themes/downtown.js';
import shipped from '../content/themes/downtown.js';
import { street, CROSS } from '../packs/hifi/lib/street.js';

const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const chunk = (seed, z0 = 0, length = 120) => downtown.createChunk.call({ ...shipped, ...downtown }, gfx, { z0, length, lanes, rng: rng(seed), theme: { ...shipped, ...downtown } });
const zSpan = (g) => { // world z extent of everything, instances included
  let lo = Infinity, hi = -Infinity;
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.geometry) return;
    n.geometry.computeBoundingBox();
    const each = n.isInstancedMesh ? Array.from({ length: n.count }, (_, i) => { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); return m.premultiply(n.matrixWorld); }) : [n.matrixWorld];
    for (const m of each) { const b = n.geometry.boundingBox.clone().applyMatrix4(m); lo = Math.min(lo, b.min.z); hi = Math.max(hi, b.max.z); }
  });
  return [lo, hi];
};
const fingerprint = (g) => { const out = []; g.traverse((n) => { if (n.geometry) out.push(n.type, n.geometry.attributes.position.count, ...(n.isInstancedMesh ? n.instanceMatrix.array.slice(0, 32) : [])); }); return out.join(','); };

test('the same seed builds the same city chunk, and another seed a different one', () => {
  assert.equal(fingerprint(chunk(7)), fingerprint(chunk(7)));
  assert.notEqual(fingerprint(chunk(7)), fingerprint(chunk(8)));
});

test('nothing a city chunk builds leaves its stretch of street', () => {
  for (let seed = 1; seed <= 30; seed++) for (const [z0, length] of [[0, 120], [120, 120], [240, 80]]) {
    const [lo, hi] = zSpan(chunk(seed, z0, length));
    assert.ok(lo >= z0 - 1e-6 && hi <= z0 + length + 1e-6, `seed ${seed}, chunk ${z0}: ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  }
});

test('a city chunk builds its street even when every kit file is missing', () => {
  const g = chunk(3);
  assert.ok(g.children.length > 0);
  let road = false; g.traverse((n) => { if (n.userData.road) road = true; });
  assert.ok(road, 'the road is there');
});

test('a city chunk stays inside its draw-call budget', () => {
  for (const seed of [1, 2, 3]) { let meshes = 0; chunk(seed).traverse((n) => { if (n.isMesh) meshes++; }); assert.ok(meshes <= 45, `seed ${seed}: ${meshes} meshes`); }
});

test('buildings stand on the facade line, never on the sidewalk or the road', () => {
  // Every vertex, not the bounding box: one merged mesh holds both sides of the street, so its box spans the road.
  const g = chunk(5), v = new THREE.Vector3(); let n = 0;
  g.updateMatrixWorld(true);
  g.traverse((m) => {
    if (!m.userData.building) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++, n++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); assert.ok(Math.abs(v.x) >= 7.5 - 0.4 - 1e-6, `vertex at x ${v.x}`); } // cornices may overhang the sidewalk by 0.35 m, high up
  });
  assert.ok(n > 0, 'buildings were built');
});

test('a missing facade tile falls back to the placeholder tile', () => {
  const g = chunk(4); let tiles = 0;
  g.traverse((n) => { if (n.userData.building && n.material.map?.isDataTexture) tiles++; });
  assert.ok(tiles > 0, 'placeholder tiles in use');
});

test('the sidewalks stop at the cross street', () => {
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, { id: 'test', road: '#000', walk: '#888', paint: '#fff' }, cross);
  let walks = 0;
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.userData.walk) return;
    walks++;
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    assert.ok(b.max.z <= cross.z + 1e-6 || b.min.z >= cross.z + CROSS.width - 1e-6, `sidewalk ${b.min.z}..${b.max.z}`);
  });
  assert.equal(walks, 4, 'two sidewalk pieces a side');
});
