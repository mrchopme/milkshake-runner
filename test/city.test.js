import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import downtown from '../packs/hifi/themes/downtown.js';
import shipped from '../content/themes/downtown.js';
import { street, CROSS } from '../packs/hifi/lib/street.js';
import { buildings } from '../packs/hifi/lib/buildings.js';
import { DRIVE } from '../packs/hifi/lib/traffic.js';
import { adopt } from '../src/assets.js';
import bridge from '../packs/hifi/themes/bridge.js';
import shippedBridge from '../content/themes/bridge.js';
import { waterMaterial } from '../packs/hifi/lib/bridge.js';

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

test('the cross street has ground under it from the road out to the back of the blocks', () => {
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, { id: 'test', road: '#000', walk: '#888', paint: '#fff' }, cross);
  g.updateMatrixWorld(true);
  const covered = (x, z) => { let hit = false; g.traverse((n) => { if (!n.isMesh || n.isInstancedMesh) return; n.geometry.computeBoundingBox(); const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld); if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= 0.2) hit = true; }); return hit; };
  for (const x of [-17, -12, -6, 0, 6, 12, 17]) for (const z of [cross.z + 0.5, cross.z + 6, cross.z + CROSS.width - 0.5]) assert.ok(covered(x, z), `no ground at x ${x}, z ${z}`);
});

test('a facade tile that loads after a chunk was built still shows on the next chunk', () => {
  const path = 'hifi/test/task10-late-facade.webp', style = { id: 'task10-late', buildings: shipped.buildings, facades: Array(5).fill(path), shops: [] };
  const maps = (g) => { const out = []; g.traverse((n) => { if (n.userData.building) out.push(n.material.map); }); return out; };
  const before = maps(buildings(gfx, { z0: 0, length: 120 }, style, rng(4), null));
  assert.ok(before.some((m) => m?.isDataTexture && m.image.width === 64), 'the facade falls back to the placeholder while the tile is missing');
  const late = new THREE.Texture();
  adopt(path, late);
  assert.ok(maps(buildings(gfx, { z0: 0, length: 120 }, style, rng(4), null)).includes(late), 'the loaded tile replaces the placeholder');
});

test('furniture stands only on the sidewalk band, never in a lane', () => {
  let seen = 0;
  for (const seed of [1, 2, 3, 4]) chunk(seed).traverse((n) => {
    if (!n.userData.furniture) return;
    seen++;
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) >= 4.8 - 1e-6 && Math.abs(p.x) <= 7.3 + 1e-6, `seed ${seed}: x = ${p.x.toFixed(2)}`); }
  });
  assert.ok(seen > 0, 'furniture was built');
});

test('side-street traffic never enters the avenue', () => {
  let seen = 0;
  chunk(6).traverse((n) => { if (n.userData.traffic) { seen++; const m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) >= 9, `x = ${p.x}`); } } });
  assert.ok(seen > 0, 'traffic was built');
});

test('board 15: nothing but the traffic lights within 2 m of the side street, at most one shelter or subway a chunk', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = chunk(seed), cz = g.userData.cross.z, rare = new Set();
    g.traverse((n) => {
      const kind = n.userData.furniture;
      if (!kind || kind === 'traffic_light') return;
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(p.z <= cz - 2 || p.z >= cz + CROSS.width + 2, `seed ${seed}: ${kind} at z ${p.z.toFixed(2)}, side street at ${cz}`); if (kind === 'bus_shelter' || kind === 'subway') rare.add(`${p.x},${p.z}`); }
    });
    assert.ok(rare.size <= 1, `seed ${seed}: ${rare.size} shelters or subways`);
  }
});

test('two hundred dropped chunks free every instanced mesh they made and no shared material', () => {
  const made = [], freedShared = [];
  const orig = THREE.InstancedMesh.prototype.dispose;
  THREE.InstancedMesh.prototype.dispose = function () { made.push(this); return orig.call(this); };
  try {
    let instancedBuilt = 0;
    for (let i = 0; i < 200; i++) {
      const g = chunk(i, (i % 10) * 120);
      g.traverse((n) => { if (n.isInstancedMesh) instancedBuilt++; if (n.material?.userData?.shared) { const d = n.material.dispose; n.material.dispose = () => { freedShared.push(n.material); d.call(n.material); }; } });
      gfx.dispose(g);
    }
    assert.equal(made.length, instancedBuilt, 'every instanced mesh freed its buffers');
    assert.equal(freedShared.length, 0, 'no shared material freed');
  } finally { THREE.InstancedMesh.prototype.dispose = orig; }
});

test('a loaded car model drives along the cross street whatever its own frame, and stays on the paving', () => {
  // a stand-in for the generated taxi: centimetres, long along x, its node turned half round (the kit's yaw makes x ahead z)
  const body = new THREE.Mesh(new THREE.BoxGeometry(450, 208, 190), new THREE.MeshStandardMaterial());
  body.scale.setScalar(0.01); body.rotation.y = Math.PI;
  adopt('hifi/taxi.glb', new THREE.Group().add(body));
  const kinds = new Set();
  for (let seed = 1; seed <= 20; seed++) chunk(seed).traverse((n) => {
    if (!n.userData.traffic) return;
    kinds.add(n.userData.traffic);
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox, m = new THREE.Matrix4(), p = new THREE.Vector3(), ahead = new THREE.Vector3();
    assert.ok(b.max.z - b.min.z > b.max.x - b.min.x, `${n.userData.traffic}: its length lies along the drive axis (+z)`);
    assert.ok(DRIVE.to + b.max.z <= 4.5 + CROSS.reach + 1e-6, `${n.userData.traffic}: its nose leaves the paving at ${(DRIVE.to + b.max.z).toFixed(2)}`);
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m); p.setFromMatrixPosition(m); ahead.set(0, 0, 1).applyMatrix4(m).sub(p); // the drive's +z in the world, unscaled
      assert.ok(Math.abs(ahead.x - Math.sign(p.x)) < 1e-6 && Math.abs(ahead.y) < 1e-6 && Math.abs(ahead.z) < 1e-6, `${n.userData.traffic}: drives along ${ahead.toArray().map((v) => v.toFixed(2))} from x ${p.x}`);
    }
  });
  assert.ok(kinds.has('taxi'), 'the loaded taxi drove');
});

test('the HiFi bridge stays inside its chunk and keeps a road', () => {
  for (const seed of [1, 2, 3]) for (const z0 of [1080, 1200]) { // 1200 % 240 === 0: the chunk with a tower pair and its cables
    const g = bridge.createChunk.call({ ...shippedBridge, ...bridge }, gfx, { z0, length: 120, lanes, rng: rng(seed), theme: { ...shippedBridge, ...bridge } });
    const [lo, hi] = zSpan(g);
    assert.ok(lo >= z0 - 1e-6 && hi <= z0 + 120 + 1e-6, `${lo}..${hi}`);
    let road = false, meshes = 0; g.traverse((n) => { if (n.userData.road) road = true; if (n.isMesh) meshes++; });
    assert.ok(road);
    assert.ok(meshes <= 45, `${meshes} meshes`);
  }
});

test('the bridge water ripples through its own normal map, scrolled by the run clock', () => {
  const m = waterMaterial(gfx), s = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(s);
  assert.equal(s.uniforms.uTime, gfx.time);
  assert.ok(!s.fragmentShader.includes('#include <normal_fragment_maps>') && s.fragmentShader.includes('vNormalMapUv + vec2( 0.0, uTime * 0.03 )'));
});
