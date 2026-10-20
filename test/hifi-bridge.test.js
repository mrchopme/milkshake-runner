// The HiFi bridge (Task 32, Caedon's board 25 pick "Ship, water retuned in the clean build", 2026-10-15): a 16 m deck with two
// walkways and steel railings, round main cables on hangers, a 45 m portal every 120 m; since Task 34 (Caedon, board 29, 2026-10-20) no
// waterfront blocks, stone abutments under the deck ends instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt } from '../src/assets.js';
import bridge from '../packs/hifi/themes/bridge.js';
import shippedBridge from '../content/themes/bridge.js';
import { waterMaterial, WATER } from '../packs/hifi/lib/bridge.js';
import { pavingTexture, asphaltTexture, PAVE, KERB } from '../packs/hifi/lib/street.js';

const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
// a stand-in for railings.glb, off-centre and below the origin as generators leave it (as test/hifi-railings.test.js)
const raw = new THREE.Group(), section = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.39, 0.98), new THREE.MeshStandardMaterial());
section.position.set(0.3, -0.2, 0.5); raw.add(section);
adopt('hifi/railings.glb', raw);
const theme = { ...shippedBridge, ...bridge };
const chunk = (z0, seed = 1, length = 120) => bridge.createChunk.call(theme, gfx, { z0, length, lanes, rng: rng(seed), theme });
const worldBoxes = (n) => { // one world box per instance (or the mesh's own)
  n.geometry.computeBoundingBox();
  const each = n.isInstancedMesh ? Array.from({ length: n.count }, (_, i) => { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); return m.premultiply(n.matrixWorld); }) : [n.matrixWorld];
  return each.map((m) => n.geometry.boundingBox.clone().applyMatrix4(m));
};
const find = (g, key) => { const out = []; g.updateMatrixWorld(true); g.traverse((n) => { if (n.userData[key]) out.push(n); }); return out; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('the deck is 16 m wide on the cool asphalt, its lane lines where the lanes are', () => {
  const g = chunk(1200), [deck] = find(g, 'road'), [b] = worldBoxes(deck);
  assert.ok(near(b.min.x, -8) && near(b.max.x, 8) && near(b.max.y, 0), `deck ${b.min.x}..${b.max.x}, top ${b.max.y}`);
  const want = new THREE.Color('#5a596e').multiplyScalar(1 / asphaltTexture(THREE).userData.mean).getHexString(); // the frames' cool grey (Caedon, 2026-10-15)
  assert.equal(deck.material.map, asphaltTexture(THREE));
  assert.equal(deck.material.color.getHexString(), want);
  const [marks] = find(g, 'marks'), xs = new Set(), m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < marks.count; i++) { marks.getMatrixAt(i, m); p.setFromMatrixPosition(m); xs.add(+p.x.toFixed(3)); }
  assert.deepEqual([...xs].sort((a, c) => a - c), [-4.8, -1.25, 1.25, 4.8], 'the lane lines at ±width/2, the edge lines at ±(roadHalf + 0.3)');
});

test('solid edge lines at ±(roadHalf + 0.3), 0.15 m wide, the chunk\'s whole length', () => {
  for (const length of [120, 80]) {
    const [marks] = find(chunk(1200, 1, length), 'marks'), m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const side of [-1, 1]) {
      const spans = [];
      for (let i = 0; i < marks.count; i++) { marks.getMatrixAt(i, m); m.decompose(p, q, s); if (near(p.x, side * 4.8)) { spans.push([p.z - s.z * 3, p.z + s.z * 3]); assert.ok(near(s.x * 0.16, 0.15, 1e-5), `${s.x * 0.16} wide`); } }
      spans.sort((a, b) => a[0] - b[0]);
      assert.ok(near(spans[0][0], 1200) && near(spans.at(-1)[1], 1200 + length), `side ${side}: ${spans[0][0]}..${spans.at(-1)[1]}`);
      spans.slice(1).forEach((x, i) => assert.ok(near(x[0], spans[i][1]), 'unbroken'));
    }
  }
});

// re-pinned (Task 34 L-C): 0.18 m, the street's kerb, so the walkway meets the sidewalk at a seam with no 7 cm step (was 0.25)
test('two 3 m walkways as high as the street\'s kerb outside the road, wearing the paving with metre UVs', () => {
  const g = chunk(1200), [walk] = find(g, 'walkway'), [b] = worldBoxes(walk);
  assert.equal(KERB, 0.18);
  assert.ok(near(b.min.x, -8) && near(b.max.x, 8) && near(b.min.y, 0) && near(b.max.y, KERB), `walkways ${b.min.x}..${b.max.x}, ${b.min.y}..${b.max.y}`);
  assert.equal(walk.material.map, pavingTexture(THREE, {}));
  const pos = walk.geometry.attributes.position, nor = walk.geometry.attributes.normal, uv = walk.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    assert.ok(Math.abs(x) >= 5 - 1e-6, `a walkway vertex at x ${x}, inside the 10 m road`);
    if (nor.getY(i) > 0.5) {
      assert.ok(near(uv.getX(i), Math.abs(x) - 5), `u ${uv.getX(i)} at x ${x}: metres out from the kerb`);
      assert.ok(near(uv.getY(i), z - PAVE.len * Math.floor(1200 / PAVE.len)), `v ${uv.getY(i)} at z ${z}: metres on the 12 m period`);
    }
  }
});

test('steel railings along both walkway edges, one section every 4 m, 1.1 m tall, inside the chunk', () => {
  for (const length of [120, 80]) {
    const rails = find(chunk(1200, 1, length), 'railing');
    assert.equal(rails.length, 2, 'one InstancedMesh a side');
    for (const r of rails) {
      const boxes = worldBoxes(r), side = Math.sign(boxes[0].max.x);
      assert.equal(r.count, Math.floor(length / 4), `side ${side}: ${r.count} sections`);
      for (const b of boxes) {
        assert.ok(near(b.min.y, KERB) && near(b.max.y - b.min.y, 1.1), `from ${b.min.y} to ${b.max.y}`); // on the walkway (Task 34: 0.18, was 0.25)
        assert.ok(b.min.z >= 1200 - 1e-6 && b.max.z <= 1200 + length + 1e-6, `z ${b.min.z}..${b.max.z}`);
        assert.ok(Math.sign(b.min.x) === side && Math.abs(b.min.x) > 5 && Math.abs(b.max.x) <= 8 + 1e-6, `x ${b.min.x}..${b.max.x}, off the walkway`);
      }
      assert.equal(r.material, rails[0].material, 'one steel');
      assert.ok(r.material.isMeshStandardMaterial && near(r.material.roughness, 0.4));
    }
  }
});

test('the main cables are round, 0.35 m, cast no shadow even once the engine has added the chunk, and meet across a seam', () => {
  const g = chunk(1200), [cable] = find(g, 'cable');
  // the ring nearest mid-span (z 1305, where the cable runs flat along z) is the tube's cross-section: 0.7 m tall and wide
  const pos = cable.geometry.attributes.position, xs = [], ys = [];
  for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0 && Math.abs(pos.getZ(i) - 1305) < 1.05) { xs.push(pos.getX(i)); ys.push(pos.getY(i)); }
  const span = (v) => Math.max(...v) - Math.min(...v);
  assert.ok(near(span(ys), 0.7, 0.03) && near(span(xs), 0.7, 0.03), `mid-span cross-section ${span(xs)} x ${span(ys)}, want 0.7 (r 0.35)`);
  gfx.bend(g); new THREE.Group().add(g); // what world.js does: gfx.bend marks every opaque mesh a caster, then adds it
  assert.equal(cable.castShadow, false);
  // the end rings either side of the seam (a ring leans about 0.1 m along z at the seam's slope): the same tube, to 5 cm
  const ends = (z0, z) => { const out = []; find(chunk(z0), 'cable')[0].geometry.attributes.position.array.forEach((v, i, a) => { if (i % 3 === 2 && Math.abs(v - z) < 0.2 && a[i - 2] > 0) out.push(a[i - 1]); }); return [Math.min(...out), Math.max(...out)]; };
  const a = ends(1200, 1320), b = ends(1320, 1320);
  assert.ok(near(a[0], b[0], 0.05) && near(a[1], b[1], 0.05), `the cable at the seam: ${a} against ${b}`);
});

test('hangers every 5 m from the cable down to the deck edge, never over the road', () => {
  const g = chunk(1200), [h] = find(g, 'hanger'), zs = { '-1': [], 1: [] }, m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  assert.ok(h.geometry.parameters.radiusTop === 0.06);
  for (const b of worldBoxes(h)) {
    assert.ok(Math.sign(b.min.x) === Math.sign(b.max.x) && Math.min(Math.abs(b.min.x), Math.abs(b.max.x)) > 7.8, `a hanger at x ${b.min.x}..${b.max.x}, over the walkway`);
    assert.ok(near(b.min.y, 0, 0.1), `its foot at ${b.min.y}`);
  }
  for (let i = 0; i < h.count; i++) { h.getMatrixAt(i, m); m.decompose(p, q, s); zs[Math.sign(p.x)].push(p.z); }
  for (const list of Object.values(zs)) { list.sort((a, b) => a - b); list.slice(1).forEach((z, i) => assert.ok(Math.abs(((z - list[i]) % 5)) < 1e-4 || Math.abs((z - list[i]) % 5 - 5) < 1e-4, `${list[i]} then ${z}`)); assert.ok(list.length >= 20); }
});

test('a portal every 120 m, 45 m up, its legs 3.2 m wide, standing on a pier sized to them', () => {
  for (const z0 of [1080, 1200]) {
    const g = chunk(z0), portals = find(g, 'portal');
    assert.equal(portals.length, 1, `chunk ${z0}`);
    const [b] = worldBoxes(portals[0]);
    assert.ok(near(b.max.y, 45) && b.min.y < WATER.y, `the portal from ${b.min.y} to ${b.max.y}`);
    assert.ok(near(b.min.x, -11.3) && near(b.max.x, 11.3), `legs out to ${b.max.x}: 3.2 m wide at ±9.7`);
    assert.ok(near((b.min.z + b.max.z) / 2, z0 + 45));
    const [piers] = find(g, 'pier'), boxes = worldBoxes(piers), under = boxes.find((p) => near((p.min.z + p.max.z) / 2, z0 + 45));
    assert.ok(near(under.min.x, -11.3) && near(under.max.x, 11.3), `the portal's pier ${under.min.x}..${under.max.x}`);
    for (const p of boxes.filter((x) => x !== under)) assert.ok(near(p.min.x, -8) && near(p.max.x, 8), `a deck pier ${p.min.x}..${p.max.x}`);
  }
});

// Task 34 L-C (Task 33 plan): leaving the bridge you never see under the street. Every bridge chunk has both (a chunk cannot know
// it is its stretch's first or last), so a bridge-to-bridge seam stands on a 16 m stone pier.
test('a stone abutment under each deck end, the deck\'s width, from its underside down into the water, inside the chunk', () => {
  for (const [z0, length] of [[1080, 120], [1200, 80]]) {
    const g = chunk(z0, 1, length), [deck] = worldBoxes(find(g, 'road')[0]), abut = find(g, 'abutment');
    assert.equal(abut.length, 1, 'both ends in one mesh');
    const p = abut[0].geometry.attributes.position, v = new THREE.Vector3(), ends = { lo: [], hi: [] };
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(abut[0].matrixWorld); (v.z < z0 + length / 2 ? ends.lo : ends.hi).push(v.clone()); }
    for (const [key, pts] of Object.entries(ends)) {
      const b = new THREE.Box3().setFromPoints(pts), at = `chunk ${z0}, ${key} end`;
      assert.ok(near(b.min.x, -8) && near(b.max.x, 8), `${at}: x ${b.min.x}..${b.max.x}`);
      assert.ok(b.min.y < WATER.y && b.max.y >= deck.min.y && b.max.y < 0, `${at}: from ${b.min.y} to ${b.max.y}, the deck's underside at ${deck.min.y}`);
      assert.ok(near(b.max.z - b.min.z, 8, 1e-3) && (key === 'lo' ? near(b.min.z, z0, 1e-3) : near(b.max.z, z0 + length, 1e-3)), `${at}: z ${b.min.z}..${b.max.z}`);
    }
  }
});

// Task 34 L-C (Caedon, board 29 pick 2, 2026-10-20: "there are still buildings floating in the water"): the river has banks at the
// bridge's ends, not houses beside the deck; the water, the deck and its steel stay.
test('no buildings on a bridge chunk, and nothing else of it missing', () => {
  for (const seed of [1, 2, 3]) {
    const g = chunk(1200, seed);
    assert.equal(find(g, 'building').length, 0, `seed ${seed}: a building on the bridge`);
    for (const key of ['water', 'road', 'walkway', 'marks', 'pier', 'abutment', 'portal', 'cable', 'hanger', 'railing']) assert.ok(find(g, key).length, `seed ${seed}: no ${key}`);
  }
  assert.ok(!theme.assets.some((p) => p.includes('/facades/')), 'the bridge loads no facade tiles');
});

test('nothing new stands over the road below the portal beams', () => {
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  const g = chunk(1200);
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.geometry || n.userData.road || n.userData.marks) return;
    const p = n.geometry.attributes.position, mats = n.isInstancedMesh ? Array.from({ length: n.count }, (_, i) => { n.getMatrixAt(i, m); return m.clone(); }) : [n.matrixWorld];
    for (const w of mats) for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(w); if (Math.abs(v.x) < 5 - 1e-6) assert.ok(v.y <= 0 || v.y >= 20, `a vertex at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`); }
  });
});

test('the water, retuned: a steel blue, faint reflections, finer ripples, facets, and a fog fade from 40 m without the height fog\'s shade', () => {
  const g = chunk(1200), w = find(g, 'water')[0], m = waterMaterial(gfx);
  assert.equal(w.material, m);
  assert.equal(m.color.getHexString(), new THREE.Color('#2f6fb0').getHexString(), 'deeper than C6\'s #3a92cf, which read pale in the merged build (the main session\'s re-shoot; Caedon, board 25: "water retuned in the clean build")');
  assert.ok(m.roughness <= 0.15 && m.userData.reflect === 0.2, 'glossy, so look.js gives it the env at userData.reflect');
  assert.equal(w.geometry.parameters.widthSegments, 60);
  const p = w.geometry.attributes.position, uv = w.geometry.attributes.uv;
  for (let i = 0; i < p.count; i += 97) assert.ok(near(uv.getX(i), p.getX(i) / WATER.tile, 1e-3) && near(uv.getY(i), -p.getZ(i) / WATER.tile, 1e-3), `a ${WATER.tile} m tile in world metres`);
  const s = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader }; // the material may be bent by now (gfx.bend above)
  m.onBeforeCompile(s);
  assert.ok(s.fragmentShader.includes('#define fogNear 40.0\n#define uFogShade fogColor\n#include <fog_fragment>'), 'the water fogs from 40 m, in the fog colour at any height');
  // Task 34 L-C (Task 33 P3): a DataTexture defaults to nearest with no mipmaps, so the far ripples aliased into a checker
  const n = m.normalMap;
  assert.ok(n.magFilter === THREE.LinearFilter && n.minFilter === THREE.LinearMipmapLinearFilter && n.generateMipmaps, 'the ripple map filtered and mipmapped');
});

test('a bridge chunk takes one draw from the scenery stream, as at 15f00b7, so the cities after it keep their seeds', () => {
  const r = rng(7); bridge.createChunk.call(theme, gfx, { z0: 1200, length: 120, lanes, rng: r, theme }); const base = rng(7); base();
  assert.equal(r(), base(), 'the next draw after a bridge chunk is the one after a single draw');
});

test('the deck chunk stays under the mesh cap with railings loaded', () => {
  for (const seed of [1, 2, 3]) { let meshes = 0; chunk(1200, seed).traverse((n) => { if (n.isMesh) meshes++; }); assert.ok(meshes <= 45, `${meshes} meshes`); }
});
