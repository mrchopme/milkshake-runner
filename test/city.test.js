import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import downtown from '../packs/hifi/themes/downtown.js';
import shipped from '../content/themes/downtown.js';
import { street, CROSS, WALK, FACADE_X, DASH } from '../packs/hifi/lib/street.js';
import { buildings } from '../packs/hifi/lib/buildings.js';
import { furniture, FOOT, SEAM } from '../packs/hifi/lib/furniture.js';
import { ROAD_HALF } from '../src/world.js';
import { DRIVE } from '../packs/hifi/lib/traffic.js';
import { adopt } from '../src/assets.js';
import bridge from '../packs/hifi/themes/bridge.js';
import shippedBridge from '../content/themes/bridge.js';
import { waterMaterial, WATER } from '../packs/hifi/lib/bridge.js';

const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const chunk = (seed, z0 = 0, length = 120) => downtown.createChunk.call({ ...shipped, ...downtown }, gfx, { z0, length, lanes, rng: rng(seed), theme: { ...shipped, ...downtown } });
const bridgeChunk = (z0, seed = 1, length = 120) => bridge.createChunk.call({ ...shippedBridge, ...bridge }, gfx, { z0, length, lanes, rng: rng(seed), theme: { ...shippedBridge, ...bridge } });
const bounds = (g, keep = () => true) => { // world box of the meshes `keep` picks, instances included (empty when none)
  const out = new THREE.Box3();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.geometry || !keep(n)) return;
    n.geometry.computeBoundingBox();
    const each = n.isInstancedMesh ? Array.from({ length: n.count }, (_, i) => { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); return m.premultiply(n.matrixWorld); }) : [n.matrixWorld];
    for (const m of each) out.union(n.geometry.boundingBox.clone().applyMatrix4(m));
  });
  return out;
};
const zSpan = (g) => { const b = bounds(g); return [b.min.z, b.max.z]; }; // world z extent of everything
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
    for (let i = 0; i < p.count; i++, n++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); assert.ok(Math.abs(v.x) >= FACADE_X - 0.4 - 1e-6, `vertex at x ${v.x}`); } // cornices may overhang the sidewalk by 0.35 m, high up
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
  for (const x of [-20, -14, -7, 0, 7, 14, 20]) for (const z of [cross.z + 0.5, cross.z + 6, cross.z + CROSS.width - 0.5]) assert.ok(covered(x, z), `no ground at x ${x}, z ${z}`);
});

test('the facade line is the road\'s edge plus the sidewalk, and the sidewalk runs from the kerb up to it', () => {
  assert.equal(FACADE_X, ROAD_HALF + WALK);
  const g = street(gfx, { z0: 0, length: 120, lanes: { ...lanes, roadHalf: ROAD_HALF } }, { id: 'test', road: '#000', walk: '#888', paint: '#fff' }, null);
  let walks = 0;
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.userData.walk) return;
    walks++;
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld), [near, far] = [Math.abs(b.min.x), Math.abs(b.max.x)].sort((p, q) => p - q);
    assert.ok(Math.abs(near - ROAD_HALF) < 1e-6 && Math.abs(far - FACADE_X) < 1e-6, `sidewalk ${near}..${far}`);
  });
  assert.equal(walks, 2);
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
    for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) >= 4.8 - 1e-6 && Math.abs(p.x) <= FACADE_X - 0.2 + 1e-6, `seed ${seed}: x = ${p.x.toFixed(2)}`); }
  });
  assert.ok(seen > 0, 'furniture was built');
});

test('at most one car drives each side of the cross street: the 6 m loop has no room for two', () => {
  let cars = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const sides = [];
    chunk(seed).traverse((n) => { if (n.userData.traffic) { const m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); sides.push(Math.sign(p.setFromMatrixPosition(m).x)); } } });
    cars += sides.length;
    assert.ok(sides.length === new Set(sides).size, `seed ${seed}: two cars on one side (${sides})`);
  }
  assert.ok(cars > 100, `${cars} cars in 100 chunks`);
});

test('side-street traffic never enters the avenue: each car reappears behind the corner building line', () => {
  let seen = 0;
  chunk(6).traverse((n) => { if (n.userData.traffic) { seen++; const m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) > FACADE_X, `x = ${p.x}`); } } });
  assert.ok(seen > 0, 'traffic was built');
});

test('nothing but the traffic lights within 2 m of the side street, at most one shelter or subway a chunk', () => {
  for (let seed = 1; seed <= 100; seed++) {
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

test('a crossing\'s two traffic lights stand on diagonal corners, one before the side street and one past it across the avenue, facing the road (Caedon, board 19)', () => {
  const nearSides = new Set(), m = new THREE.Matrix4();
  for (let seed = 1; seed <= 100; seed++) {
    const length = seed % 2 ? 120 : 100, g = chunk(seed, 0, length), cz = g.userData.cross.z; // 100 m: the shortest chunk with a crossing, nearest its end
    let mesh; g.traverse((n) => { if (n.userData.furniture === 'traffic_light') mesh ??= n; }); // the stand-in: one part, so one mesh
    const lights = [];
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); lights.push({ x: m.elements[12], z: m.elements[14], face: new THREE.Vector3(0, 0, 1).transformDirection(m) }); }
    assert.equal(lights.length, 2, `seed ${seed}: ${lights.length} signals`);
    const [near, far] = lights.sort((a, b) => a.z - b.z);
    assert.ok(near.z < cz && far.z > cz + CROSS.width, `seed ${seed}: signals at z ${near.z} and ${far.z}, the side street ${cz} to ${cz + CROSS.width}`);
    assert.ok(Math.sign(near.x) === -Math.sign(far.x), `seed ${seed}: both on the ${near.x > 0 ? 'right' : 'left'}`);
    for (const l of lights) assert.ok(l.face.x * Math.sign(l.x) < -0.99, `seed ${seed}: the signal at x ${l.x} turns from the road`);
    assert.ok(near.z - FOOT.traffic_light[1] >= SEAM && far.z + FOOT.traffic_light[1] <= length - SEAM, `seed ${seed}: a signal past the chunk's seam`);
    nearSides.add(Math.sign(near.x));
  }
  assert.equal(nearSides.size, 2, 'the near corner falls on either side');
});

// Furniture in random stretches (Caedon, 2026-10-14, board 18): "WAY too many trees and streetlamps ... trees are too repetitive".
const pieces = (g) => { let n = 0; const first = new Set(); g.traverse((m) => { const k = m.userData.furniture; if (k && !first.has(k)) { first.add(k); n += m.count; } }); return n; }; // one instance a piece in each of its kind's part meshes

test('furniture stands in random stretches: the same seed places the same pieces, and a chunk holds well under half of board 15\'s rhythm', () => {
  const placed = (seed) => { const out = []; furniture(gfx, { z0: 0, length: 120 }, null, rng(seed), { z: 50 }).traverse((n) => { if (n.isInstancedMesh) out.push(n.userData.furniture, ...n.instanceMatrix.array); }); return out.join(); };
  assert.equal(placed(7), placed(7));
  assert.notEqual(placed(7), placed(8));
  const N = 300, RHYTHM = 37.7; // board 15's rhythm, counted the same way over 500 chunks at f07cc2a
  let n = 0;
  for (let seed = 1; seed <= N; seed++) n += pieces(chunk(seed));
  assert.ok(n / N < RHYTHM / 2, `${(n / N).toFixed(1)} pieces a chunk on average; board 15's rhythm placed ${RHYTHM}`);
});

test('trees come in more than one size and turn', () => {
  const sizes = new Set(), turns = new Set(), m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let seed = 1; seed <= 20; seed++) {
    let done = false;
    chunk(seed).traverse((n) => {
      if (done || n.userData.furniture !== 'tree') return;
      done = true; // the first of the tree's part meshes: every part carries the same placement
      for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); m.decompose(p, q, s); if (p.x > 0) { sizes.add(s.y.toFixed(3)); turns.add(q.toArray().map((v) => v.toFixed(3)).join()); } }
    });
  }
  assert.ok(sizes.size > 1 && turns.size > 1, `${sizes.size} sizes and ${turns.size} turns among the right side's trees`);
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
  for (let seed = 1; seed <= 20; seed++) { const g = chunk(seed), cz = g.userData.cross.z; g.traverse((n) => {
    if (!n.userData.traffic) return;
    kinds.add(n.userData.traffic);
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox, m = new THREE.Matrix4(), p = new THREE.Vector3(), ahead = new THREE.Vector3(), half = Math.max(-b.min.x, b.max.x);
    assert.ok(b.max.z - b.min.z > b.max.x - b.min.x, `${n.userData.traffic}: its length lies along the drive axis (+z)`);
    // the paving runs from the kerb out to CROSS.reach, the back of the blocks: the whole car stays on it, out of the avenue
    assert.ok(DRIVE.to + b.max.z <= CROSS.reach + 1e-6, `${n.userData.traffic}: its nose leaves the paving at ${(DRIVE.to + b.max.z).toFixed(2)}`);
    assert.ok(DRIVE.from + b.min.z >= ROAD_HALF, `${n.userData.traffic}: its tail starts in the avenue at ${(DRIVE.from + b.min.z).toFixed(2)}`);
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m); p.setFromMatrixPosition(m); ahead.set(0, 0, 1).applyMatrix4(m).sub(p); // the drive's +z in the world, unscaled
      assert.ok(Math.abs(ahead.x - Math.sign(p.x)) < 1e-6 && Math.abs(ahead.y) < 1e-6 && Math.abs(ahead.z) < 1e-6, `${n.userData.traffic}: drives along ${ahead.toArray().map((v) => v.toFixed(2))} from x ${p.x}`);
      assert.ok(p.z - half >= cz && p.z + half <= cz + CROSS.width, `seed ${seed}: ${n.userData.traffic} at z ${p.z}, its sides in the blocks beside the cross street at ${cz}`);
    }
  }); }
  assert.ok(kinds.has('taxi'), 'the loaded taxi drove');
});

test('the HiFi bridge stays inside its chunk and keeps a road', () => {
  for (const seed of [1, 2, 3]) for (const z0 of [1080, 1200]) { // 1200 % 240 === 0: the chunk with a tower pair and its cables
    const g = bridgeChunk(z0, seed);
    const [lo, hi] = zSpan(g);
    assert.ok(lo >= z0 - 1e-6 && hi <= z0 + 120 + 1e-6, `${lo}..${hi}`);
    let road = false, meshes = 0; g.traverse((n) => { if (n.userData.road) road = true; if (n.isMesh) meshes++; });
    assert.ok(road);
    assert.ok(meshes <= 45, `${meshes} meshes`);
  }
});

// Smooth transitions to and from the bridge (Task 31a, Caedon, 2026-10-15): "the bridge water is too low and when you're moving
// from that to the buildings you see floating buildings with nothing underneath it".
test('the bridge water lies 2.5 m under the deck, and the tower pair stands in it with its tops still 32 m up', () => {
  const g = bridgeChunk(1200), water = bounds(g, (n) => n.material === waterMaterial(gfx)), towers = [];
  g.traverse((n) => { if (n.isMesh && !n.isInstancedMesh) { const b = bounds(n); if (b.max.y - b.min.y > 20) towers.push(b); } });
  assert.ok(water.min.y === -2.5 && water.max.y === -2.5, `the water at ${water.min.y}`);
  assert.equal(towers.length, 2);
  for (const b of towers) assert.ok(b.min.y < water.min.y && Math.abs(b.max.y - 32) < 1e-6, `a tower from ${b.min.y} to ${b.max.y}`);
});

test('a street chunk stands on land: a stone quay under the whole chunk, from just under the street down into the water', async () => {
  for (const id of ['downtown', 'midtown', 'uptown']) for (const seed of [1, 2, 3]) for (const [z0, length] of [[0, 120], [240, 80]]) {
    const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi };
    const g = hifi.createChunk.call(theme, gfx, { z0, length, lanes, rng: rng(seed), theme }), at = `${id}, seed ${seed}, chunk ${z0}`;
    const land = bounds(g, (n) => n.userData.land), rest = bounds(g, (n) => !n.userData.land);
    assert.ok(Math.abs(land.min.z - z0) < 1e-6 && Math.abs(land.max.z - (z0 + length)) < 1e-6, `${at}: the land runs ${land.min.z}..${land.max.z}`);
    assert.ok(land.min.y < WATER.y, `${at}: its foot at ${land.min.y}, above the water`);
    assert.ok(land.max.y < rest.min.y && land.max.y < 0, `${at}: its top at ${land.max.y}, the street's lowest part at ${rest.min.y}`); // so nothing of it enters the play space either
    assert.ok(land.min.x <= rest.min.x && land.max.x >= rest.max.x, `${at}: the land spans x ${land.min.x}..${land.max.x}, the chunk builds ${rest.min.x}..${rest.max.x}`);
  }
});

test('the road is one warm grey from the avenues onto the bridge, its lane lines solid but across the crosswalk (Caedon, board 18)', async () => {
  const roads = new Set();
  for (const id of ['downtown', 'midtown', 'uptown', 'bridge']) {
    const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi };
    hifi.createChunk.call(theme, gfx, { z0: 1200, length: 120, lanes, rng: rng(1), theme }).traverse((n) => { if (n.userData.road) roads.add(n.material.color.getHexString()); });
  }
  assert.deepEqual([...roads], ['6b675a'], 'the teaser\'s road, measured');
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, { id: 'test', road: '#000', walk: '#888', paint: '#fff' }, cross);
  let lines; g.traverse((n) => { if (n.isInstancedMesh && n.geometry.parameters.width === DASH.w) lines = n; });
  const spans = [], m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < lines.count; i++) { lines.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (p.x > 0) spans.push([p.z - DASH.len / 2, p.z + DASH.len / 2]); }
  spans.sort((a, b) => a[0] - b[0]);
  const gaps = spans.slice(1).map((x, i) => [spans[i][1], x[0]]).filter(([a, b]) => b - a > 1e-6);
  assert.ok(spans[0][0] < 1e-6 && spans.at(-1)[1] > 120 - 1e-6, 'from one end of the chunk to the other');
  assert.ok(gaps.length === 1 && gaps[0][0] <= cross.z && gaps[0][1] >= cross.z + CROSS.width, `breaks at ${gaps.map(([a, b]) => `${a}..${b}`).join(', ')}`);
});

test('the bridge water ripples through its own normal map, scrolled by the run clock', () => {
  const m = waterMaterial(gfx), s = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(s);
  assert.equal(s.uniforms.uTime, gfx.time);
  assert.ok(!s.fragmentShader.includes('#include <normal_fragment_maps>') && s.fragmentShader.includes('vNormalMapUv + vec2( 0.0, uTime * 0.03 )'));
});
