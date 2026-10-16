import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import downtown from '../packs/hifi/themes/downtown.js';
import shipped from '../content/themes/downtown.js';
import { street, CROSS, WALK, FACADE_X, DASH, KERB, PAVE, EDGE, KERB_TONE, pavingTexture, asphaltTexture } from '../packs/hifi/lib/street.js';
import { buildings, CORNICE, GAP } from '../packs/hifi/lib/buildings.js';
import { cityChunk } from '../packs/hifi/lib/city.js';
import { SHOP_H, tintFor, tinted } from '../packs/hifi/lib/facade.js';
import { furniture, FOOT, SEAM, CLEAR, RHYTHM, PITS, PLANTER, TINT } from '../packs/hifi/lib/furniture.js';
import { ROAD_HALF } from '../src/world.js';
import { DRIVE } from '../packs/hifi/lib/traffic.js';
import { adopt } from '../src/assets.js';
import bridge from '../packs/hifi/themes/bridge.js';
import shippedBridge from '../content/themes/bridge.js';
import { waterMaterial, WATER } from '../packs/hifi/lib/bridge.js';

const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
// the shipped ground, pinned (Task 32: Caedon's picks of 2026-10-15, the stack's tuned hexes)
const GROUND = { downtown: { road: '#5c5d74', roadRough: 0.85, walk: '#9a96a3', walkRough: 0.9 }, midtown: { road: '#5f5c69', roadRough: 0.6, walk: '#b8a49c', walkRough: 0.55 }, uptown: { road: '#594a6e', roadRough: 0.5, walk: '#a896a2', walkRough: 0.55 } };
const flat = { id: 'test', ground: { road: '#000', roadRough: 0.85, walk: '#888', walkRough: 0.9 }, paint: '#fff' }; // a street style with its ground
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

// Facades with depth (Task 32, Caedon's board 23 pick "as prototyped"): the 0.4 m cap became bands. Above 4.5 m the cornices
// (0.85 m) and the relief; 3.0-4.5 m the awnings (shop planes, 1.5 m out) over the fascia (0.4 m); below 3.0 m nothing past 0.4 m.
test('buildings stand on the facade line: up to 0.9 m out above 4.5 m, only awnings up to 1.6 m at 3.0-4.5 m, 0.4 m below, never past x 4.5', () => {
  const v = new THREE.Vector3(); let n = 0, awning = -Infinity, lip = Infinity, cornice = -Infinity;
  for (const seed of [5, 6, 7]) {
    const g = chunk(seed);
    g.updateMatrixWorld(true);
    g.traverse((m) => {
      if (!m.userData.building) return;
      const p = m.geometry.attributes.position, body = m.material.vertexColors; // the body (and its trim) is the one vertex-coloured mesh
      for (let i = 0; i < p.count; i++, n++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        const out = FACADE_X - Math.abs(v.x), at = `seed ${seed}: a vertex ${out.toFixed(2)} m out at y ${v.y.toFixed(2)}`;
        assert.ok(Math.abs(v.x) >= 4.5 - 1e-6, at);
        if (v.y > 4.5 + 1e-6) { assert.ok(out <= 0.9 + 1e-6, at); cornice = Math.max(cornice, out); } else if (v.y >= 3 - 1e-6) assert.ok(out <= (body ? 0.4 : 1.6) + 1e-6, at); else assert.ok(out <= 0.4 + 1e-6, at);
        if (!body && out > 0.45) { awning = Math.max(awning, out); lip = Math.min(lip, v.y); }
      }
    });
  }
  assert.ok(n > 0, 'buildings were built');
  assert.ok(Math.abs(awning - 1.5) < 1e-6 && Math.abs(lip - 3.1) < 0.01, `awnings ${awning} m out, their lip at ${lip} m`);
  assert.ok(Math.abs(cornice - CORNICE.out) < 1e-6, `cornices ${cornice} m out`);
});

// The −z faces the camera sees (Task 32, board 23): every block's end, not only the first and the cross street's, since the
// stepped heights show any end above a shorter neighbour; the storefront band and the block's own tile in each tier.
test('every block\'s -z end wears a storefront and facade from the ground to its roof, never bare body colour', () => {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const seed of [1, 2, 3]) for (const [z0, length] of [[0, 120], [240, 80]]) {
    const g = chunk(seed, z0, length), blocks = g.userData.blocks, faces = [];
    g.traverse((m) => {
      if (!m.userData.building || m.material.vertexColors) return;
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        const nz = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize().z;
        if (nz < -0.99) faces.push({ z: a.z, x: a.x, y: [Math.min(a.y, b.y, c.y), Math.max(a.y, b.y, c.y)] });
      }
    });
    assert.ok(blocks.length >= 8, `seed ${seed}: ${blocks.length} blocks`);
    for (const k of blocks) {
      const ys = faces.filter((f) => Math.abs(f.z - (k.z0 - 0.02)) < 1e-4 && Math.sign(f.x) === k.side).map((f) => f.y).sort((p, q) => p[0] - q[0]);
      let top = 0; for (const [lo, hi] of ys) if (lo <= top + 1e-4) top = Math.max(top, hi);
      assert.ok(top >= k.h - 1e-4, `seed ${seed}, chunk ${z0}: the block at z ${k.z0.toFixed(2)} on side ${k.side} is finished to ${top.toFixed(2)} of ${k.h} m`);
    }
    assert.ok(blocks.filter((k) => k.side === -1)[0].z0 - CORNICE.ret >= z0 - 1e-6, 'the first block leaves room for its cornice return');
  }
});

// The block list (Task 32): buildings publish what they built, so signs and furniture anchor on real blocks. A contract: C3 and
// C5 read it; its shape is documented in buildings.js's header.
test('the block list holds every built block in build order, in its documented shape, and reaches a later part', () => {
  let seen;
  const spy = (gfx_, args, style, r, cross, blocks) => { seen = blocks.map((x) => ({ ...x })); return gfx_.group(); };
  const theme = { ...shipped, ...downtown }, style = { id: 'downtown', ground: { ...GROUND.downtown, flag: 1.5 }, paint: '#fff', buildings: shipped.buildings, parts: [buildings, spy] };
  const g = cityChunk(gfx, { z0: 0, length: 120, lanes, rng: rng(3), theme }, style), blocks = g.userData.blocks;
  assert.deepEqual(seen, blocks, 'the later part gets the same list');
  for (const [i, b] of blocks.entries()) {
    assert.deepEqual(Object.keys(b).sort(), ['awning', 'h', 'lot', 'setAt', 'shop', 'side', 'tile', 'z0', 'z1']);
    assert.ok(b.lot === i && b.z1 > b.z0 && b.setAt <= b.h && Number.isInteger(b.shop) && Number.isInteger(b.tile) && typeof b.awning === 'boolean', JSON.stringify(b));
    if (i && blocks[i - 1].side === b.side) assert.ok(b.z0 >= blocks[i - 1].z1 + GAP - 1e-6, 'low z to high, a gap between');
    else if (i) assert.ok(blocks[i - 1].side === -1 && b.side === 1, 'the -x side, then the +x side');
  }
  // count: each block's recessed storefront (and its end wall's edge) is one run of shop-material wall along z, a gap between runs
  const runs = { '-1': [], 1: [] }, v = new THREE.Vector3();
  g.traverse((m) => {
    if (!m.userData.building || m.material.vertexColors) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (Math.abs(Math.abs(v.x) - FACADE_X - 0.45) < 1e-4 && v.y < 3) runs[Math.sign(v.x)].push(v.z); }
  });
  for (const side of [-1, 1]) {
    const zs = [...new Set(runs[side])].sort((p, q) => p - q), count = 1 + zs.slice(1).filter((z, i) => { const dz = z - zs[i]; return (dz > 0.3 && dz < 0.9) || dz > 4.01; }).length; // a block gap or the side street, not a 2.7-4 m segment
    assert.equal(count, blocks.filter((b) => b.side === side).length, `side ${side}: storefronts against the list`);
  }
});

// A block's body (roof, shoulders, returns) wears its tile's own wall colour, tinted as the tile's texels are (Task 32, board 23).
test('a block\'s body is its facade tile\'s colour, tinted as the tile, and its street wall wears the cornice', () => {
  const style = { id: 't32-bodies', buildings: shipped.buildings, facades: [], bodies: ['#804020', '#208040', '#402080', '#406080', '#806040'], facadeTint: { mul: [0.5, 1, 1], only: [0, 1] },
    heights: { kind: 'runs', short: [14, 24], tall: [60, 100], tallShare: 0.5, shortTiles: [0, 2, 3], tallTiles: [1, 4] } };
  const want = (f) => { const n = parseInt(style.bodies[f].slice(1), 16), rgb = tinted(tintFor(style, f), n >> 16, (n >> 8) & 255, n & 255); return new THREE.Color().setRGB(...rgb.map((x) => x / 255), THREE.SRGBColorSpace); };
  assert.deepEqual(want(0).getHexString(THREE.SRGBColorSpace), '404020', 'the tint halves the red');
  for (const seed of [1, 2, 3, 4]) {
    const blocks = [], g = buildings(gfx, { z0: 0, length: 120 }, style, rng(seed), { z: 50 }, blocks), c = new THREE.Color(), v = new THREE.Vector3();
    let body; g.traverse((m) => { if (m.userData.building && m.material.vertexColors) body = m.geometry; });
    const pos = body.attributes.position, col = body.attributes.color;
    for (const b of blocks) {
      let back = 0, corn = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (Math.sign(v.x) !== b.side || v.z < b.z0 + 0.5 || v.z > b.z1) continue;
        const out = FACADE_X - Math.abs(v.x);
        if (out < -9 && v.y < b.setAt - CORNICE.h - 1e-3) { back++; c.fromBufferAttribute(col, i); assert.equal(c.getHexString(), want(b.tile).getHexString(), `seed ${seed}: block ${b.lot} (tile ${b.tile})`); }
        if (Math.abs(out - CORNICE.out) < 1e-6 && (Math.abs(v.y - b.setAt) < 1e-6 || Math.abs(v.y - b.setAt + CORNICE.h) < 1e-6)) corn = true;
      }
      assert.ok(back > 0 && corn, `seed ${seed}: block ${b.lot}: ${back} body vertices at its back, its cornice ${corn}`);
    }
  }
});

// Heights per theme (Task 32, board 23; pack-only: low-fi keeps defaultChunk): the tables in the street themes, on the floor grid.
const grid = (h) => SHOP_H + Math.round((h - SHOP_H) / 3.5) * 3.5, floors = (h) => Math.abs((h - SHOP_H) / 3.5 - Math.round((h - SHOP_H) / 3.5)) < 1e-9;
const HEIGHTS_RUNS = { kind: 'runs', short: [14, 24], tall: [60, 140], tallShare: 0.5, shortTiles: [0, 1], tallTiles: [2, 3], depth: [14, 26], back: { share: 0.4, x: [12, 25], w: [12, 20] } };
const HEIGHTS = { // short, tall, tall share (h > 40 m), shortest and longest frontage (a remainder joins the block before it)
  downtown: { short: [14, 24], tall: [60, 140], share: 0.5, front: [8, 22] },
  midtown: { short: [22, 36], tall: [60, 110], share: 0.45, front: [14, 40] },
  uptown: { short: [14, 28], tall: [31.5, 35], share: 0.1, front: [8, 22] }, // a random walk; its 10% outliers stand in for towers
};
test('each street theme\'s heights follow its table: walk-ups and towers in runs, a monotone setback, the floor grid, never the same tile twice', async () => {
  for (const [id, H] of Object.entries(HEIGHTS)) {
    const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi }, all = [];
    let tall = 0, back = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const g = hifi.createChunk.call(theme, gfx, { z0: 0, length: 120, lanes, rng: rng(seed), theme }), blocks = g.userData.blocks, at = `${id}, seed ${seed}`;
      for (const side of [-1, 1]) {
        const row = blocks.filter((b) => b.side === side), cls = row.map((b) => b.h > (id === 'uptown' ? 30 : 40));
        row.slice(1).forEach((b, i) => assert.notEqual(b.tile, row[i].tile, `${at}: the same tile on neighbours`));
        if (id !== 'uptown') for (let i = 0, k = 0; i < cls.length; i = k) { for (k = i; k < cls.length && cls[k] === cls[i]; k++); assert.ok(k - i >= 2 || k === cls.length, `${at}: a run of ${k - i} at lot ${row[i].lot}`); }
      }
      for (const b of blocks) {
        const front = b.z1 - b.z0 + GAP, t = b.h > (id === 'uptown' ? 30 : 40), [lo, hi] = t ? H.tall : H.short;
        assert.ok(b.h >= grid(lo) - 1e-9 && b.h <= grid(hi) + 1e-9, `${id}, seed ${seed}: a block ${b.h} m tall`);
        assert.ok(floors(b.h) && floors(b.setAt), `${id}: roof ${b.h} and street wall ${b.setAt} off the floor grid`);
        assert.ok(front >= H.front[0] - 1e-6 && front <= H.front[1] + 1e-6, `${id}: a ${front.toFixed(2)} m frontage`);
        tall += t; all.push(b);
      }
      g.traverse((m) => { if (m.userData.building && !m.material.vertexColors) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) > FACADE_X + 17 && p.getY(i) > 59) { back++; break; } } });
    }
    assert.ok(Math.abs(tall / all.length - H.share) < 0.08, `${id}: ${(100 * tall / all.length).toFixed(0)}% tall, the table ${100 * H.share}%`);
    assert.ok(id === 'downtown' ? back > 20 : back === 0, `${id}: ${back} chunks with a back-row tower`);
    all.sort((p, q) => p.h - q.h);
    all.slice(1).forEach((b, i) => assert.ok(b.setAt >= all[i].setAt - 1e-9, `${id}: a ${b.h} m block's street wall ${b.setAt} under a ${all[i].h} m one's ${all[i].setAt}`));
    for (const b of all) assert.ok(b.h <= 40 ? b.setAt === b.h : b.setAt < b.h && b.setAt >= 39, `${id}: a ${b.h} m block sets back at ${b.setAt}`);
    const fronts = all.map((b) => b.z1 - b.z0 + GAP).sort((p, q) => p - q), mid = fronts[fronts.length >> 1];
    if (id === 'midtown') assert.ok(mid >= 14 && mid <= 26, `midtown's median frontage ${mid.toFixed(1)} m`);
  }
});

test('the walls seed their sub-streams from one draw of the chunk stream: the same seed, the same blocks', () => {
  // a theme's walls tables never move the shared stream: whatever the style, buildings takes exactly one draw from it
  const plain = { id: 't32-plain', buildings: shipped.buildings, facades: [] }, walls = { ...plain, id: 't32-walls', heights: HEIGHTS_RUNS, bodies: ['#808080'], trim: '#ffffff' };
  for (let seed = 1; seed <= 10; seed++) for (const style of [plain, walls]) {
    const a = rng(seed), b = rng(seed), ref = rng(seed), one = [], two = [];
    buildings(gfx, { z0: 0, length: 120 }, style, a, { z: 50 }, one);
    buildings(gfx, { z0: 0, length: 120 }, style, b, { z: 50 }, two);
    assert.ok(one.length > 0, `${style.id} seed ${seed}: blocks built`);
    assert.deepEqual(one, two, `${style.id} seed ${seed}: the same seed builds the same blocks`);
    ref();
    assert.equal(a(), ref(), `${style.id} seed ${seed}: one draw, not the pre-Task-32 replay (it kept nothing still once C3 and C5 moved signs and furniture off the stream)`);
  }
});

test('a block squeezed under 7.5 m of frontage never stands as a full-height slab', () => {
  const style = { id: 't32-slab', buildings: shipped.buildings, facades: [], heights: { kind: 'runs', short: [14, 24], tall: [60, 140], tallShare: 1, shortTiles: [0], tallTiles: [1] } };
  for (let seed = 1; seed <= 20; seed++) {
    const blocks = [];
    buildings(gfx, { z0: 0, length: 7 }, style, rng(seed), null, blocks);
    assert.ok(blocks.length === 2 && blocks.every((b) => b.h <= grid(24) + 1e-9), `seed ${seed}: ${JSON.stringify(blocks)}`);
  }
});

test('a missing facade tile falls back to the placeholder tile', () => {
  const g = chunk(4); let tiles = 0;
  g.traverse((n) => { if (n.userData.building && n.material.map?.isDataTexture) tiles++; });
  assert.ok(tiles > 0, 'placeholder tiles in use');
});

test('the sidewalks stop at the cross street', () => {
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, flat, cross);
  let walks = 0, kerbs = 0;
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.userData.walk && !n.userData.kerb) return;
    if (n.userData.walk) walks++; else kerbs++;
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    assert.ok(b.max.z <= cross.z + 1e-6 || b.min.z >= cross.z + CROSS.width - 1e-6, `sidewalk ${b.min.z}..${b.max.z}`);
  });
  assert.equal(walks, 4, 'two sidewalk pieces a side');
  assert.equal(kerbs, 4, 'each with its own kerb piece (Task 32: the kerb is its own box, Caedon board 24)');
});

test('the cross street has ground under it from the road out to the back of the blocks', () => {
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, flat, cross);
  g.updateMatrixWorld(true);
  const covered = (x, z) => { let hit = false; g.traverse((n) => { if (!n.isMesh || n.isInstancedMesh) return; n.geometry.computeBoundingBox(); const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld); if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= 0.2) hit = true; }); return hit; };
  for (const x of [-20, -14, -7, 0, 7, 14, 20]) for (const z of [cross.z + 0.5, cross.z + 6, cross.z + CROSS.width - 0.5]) assert.ok(covered(x, z), `no ground at x ${x}, z ${z}`);
});

test('the facade line is the road\'s edge plus the sidewalk, and the sidewalk runs from the kerb up to it', () => {
  assert.equal(FACADE_X, ROAD_HALF + WALK);
  const g = street(gfx, { z0: 0, length: 120, lanes: { ...lanes, roadHalf: ROAD_HALF } }, flat, null), pieces = [];
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.userData.walk && !n.userData.kerb) return;
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld), [near, far] = [Math.abs(b.min.x), Math.abs(b.max.x)].sort((p, q) => p - q);
    pieces.push([n.userData.kerb ? 'kerb' : 'walk', near, far, b.max.y - b.min.y]);
  });
  const close = (a, b) => Math.abs(a - b) < 1e-6, kerbs = pieces.filter((p) => p[0] === 'kerb'), walks = pieces.filter((p) => p[0] === 'walk');
  assert.equal(walks.length, 2); assert.equal(kerbs.length, 2, 'a 0.3 m kerb box per sidewalk piece (Task 32, Caedon board 24)');
  for (const [, near, far, h] of kerbs) assert.ok(close(near, ROAD_HALF) && close(far, ROAD_HALF + PAVE.kerb) && close(h, KERB), `kerb ${near}..${far}, ${h} tall`);
  for (const [, near, far] of walks) assert.ok(close(near, ROAD_HALF + PAVE.kerb) && close(far, FACADE_X), `sidewalk ${near}..${far}`);
});

test('the kerb is one value lighter than the paving, its road face shaded', () => {
  const g = street(gfx, { z0: 0, length: 120, lanes }, flat, null); let kerb, walk;
  g.traverse((n) => { if (n.userData.kerb) kerb = n; if (n.userData.walk) walk = n; });
  assert.ok(Math.abs(kerb.material.color.r / walk.material.color.r - KERB_TONE.top) < 1e-6, 'the kerb top one value up');
  assert.equal(kerb.material.map, walk.material.map, 'the kerb wears the paving\'s kerb band');
  const n = kerb.geometry.attributes.normal, c = kerb.geometry.attributes.color, side = Math.sign(kerb.position.x);
  for (let i = 0; i < n.count; i++) assert.ok(Math.abs(c.getX(i) - (n.getX(i) * side < -0.5 ? KERB_TONE.face / KERB_TONE.top : 1)) < 1e-6, `vertex ${i}`);
});

test('the paving UVs are metres: u out from the kerb, v on a 12 m period unbroken across a chunk seam', () => {
  const tops = (z0) => { const out = []; street(gfx, { z0, length: 120, lanes }, flat, null).traverse((n) => {
    if (!n.userData.walk && !n.userData.kerb) return;
    const p = n.geometry.attributes.position, nor = n.geometry.attributes.normal, uv = n.geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) if (nor.getY(i) > 0.5) out.push({ x: p.getX(i) + n.position.x, z: p.getZ(i) + n.position.z, u: uv.getX(i), v: uv.getY(i) });
  }); return out; };
  const a = tops(120), b = tops(240), mod = (x) => ((x % PAVE.len) + PAVE.len) % PAVE.len;
  for (const t of [...a, ...b]) assert.ok(Math.abs(t.u - (Math.abs(t.x) - lanes.roadHalf)) < 1e-6, `u ${t.u} at x ${t.x}`);
  assert.ok(Math.abs(Math.min(...a.map((t) => t.u))) < 1e-6 && Math.abs(Math.max(...a.map((t) => t.u)) - WALK) < 1e-6, 'u runs 0..6 from the kerb');
  const end = a.filter((t) => Math.abs(t.z - 240) < 1e-6), start = b.filter((t) => Math.abs(t.z - 240) < 1e-6);
  assert.ok(end.length && start.length);
  for (const t of [...end, ...start]) assert.ok(Math.abs(mod(t.v + 1e-9) - mod(end[0].v + 1e-9)) < 1e-6, `v ${t.v} at the seam`);
  for (const t of a) assert.ok(Math.abs(mod(t.v - t.z + 1e-9)) < 1e-6 || Math.abs(mod(t.v - t.z + 1e-9) - PAVE.len) < 1e-6, `v ${t.v} at z ${t.z}`);
});

test('the paving and the asphalt are built once, shared, and the theme hex is divided by their mean', async () => {
  const maps = (g, key) => { const out = new Set(); g.traverse((n) => { if (n.userData[key]) out.add(n.material.map); }); return [...out]; };
  const [p1] = maps(street(gfx, { z0: 0, length: 120, lanes }, flat, null), 'walk'), [p2] = maps(street(gfx, { z0: 120, length: 120, lanes }, { ...flat, id: 'test2' }, null), 'walk');
  assert.ok(p1.isDataTexture && p1 === p2 && p1.userData.shared, 'one paving per flag size, on every chunk');
  assert.equal(pavingTexture(THREE, { ground: { flag: 1.5 } }), p1);
  assert.notEqual(pavingTexture(THREE, { ground: { flag: 1.2 } }), p1, 'uptown\'s smaller flags get their own');
  assert.equal(asphaltTexture(THREE), asphaltTexture(THREE)); assert.ok(asphaltTexture(THREE).userData.shared);
  assert.equal(p1.image.width, PAVE.w); assert.equal(p1.image.height, PAVE.h);
  for (const [t, mean] of [[p1, 0.830], [pavingTexture(THREE, { ground: { flag: 1.2 } }), 0.833], [asphaltTexture(THREE), 0.911]]) assert.ok(Math.abs(t.userData.mean - mean) < 0.005, `mean ${t.userData.mean}`);
  for (const id of ['downtown', 'midtown', 'uptown']) {
    const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi };
    let walk; hifi.createChunk.call(theme, gfx, { z0: 1200, length: 120, lanes, rng: rng(1), theme }).traverse((n) => { if (n.userData.walk) walk = n; });
    const want = new THREE.Color(GROUND[id].walk).multiplyScalar(1 / walk.material.map.userData.mean);
    assert.equal(walk.material.color.getHexString(), want.getHexString(), `${id}: the walk renders at its hex on average`);
    assert.equal(walk.material.roughness, GROUND[id].walkRough);
  }
});

test('solid white edge lines 0.5 m in from each kerb, the chunk\'s length but across the crosswalk; the zebra centred', () => {
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, flat, cross);
  let lines, zebra; g.traverse((n) => { if (n.isInstancedMesh && n.geometry.parameters.width === DASH.w) lines = n; if (n.isInstancedMesh && n.geometry.parameters.width === CROSS.stripe) zebra = n; });
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), edges = [];
  for (let i = 0; i < lines.count; i++) { lines.getMatrixAt(i, m); m.decompose(p, q, s); if (Math.abs(Math.abs(p.x) - (lanes.roadHalf - EDGE.in)) < 1e-6) edges.push([p.x, p.z - s.z * DASH.len / 2, p.z + s.z * DASH.len / 2, s.x * DASH.w]); }
  for (const x of [1, -1]) {
    const mine = edges.filter((e) => Math.sign(e[0]) === x).sort((a, b) => a[1] - b[1]);
    assert.deepEqual(mine.map((e) => [e[1], e[2]].map((v) => +v.toFixed(3))), [[0, cross.z], [cross.z + CROSS.width, 120]], `side ${x}`);
    for (const e of mine) assert.ok(Math.abs(e[3] - EDGE.w) < 1e-5, `${e[3]} wide`);
  }
  const xs = []; for (let i = 0; i < zebra.count; i++) { zebra.getMatrixAt(i, m); p.setFromMatrixPosition(m); xs.push(p.x); }
  assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 1e-6, `zebra ${Math.min(...xs)}..${Math.max(...xs)}`);
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

// The kerb's rhythm (Task 32; Caedon, 2026-10-15: "Regular rhythm like the frames", board 24 "Ship as prototyped"; it reverses board 18's
// random stretches): per side a tree every 8-10 m in a pit, a lamp halfway between every second pair, planters at shop doors.
const pieces = (g) => { let n = 0; const first = new Set(); g.traverse((m) => { const k = m.userData.furniture; if (k && !first.has(k)) { first.add(k); n += m.count; } }); return n; }; // one instance a piece in each of its kind's part meshes
const THEMES = ['downtown', 'midtown', 'uptown'];
const themeChunk = async (id) => { const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi }; return (seed, z0 = 0) => hifi.createChunk.call(theme, gfx, { z0, length: 120, lanes, rng: rng(seed), theme }); };
const placed = (g) => { // per side: each kind's instances (the first of its part meshes) and the pits, as { x, z, m, kind }; both tree models under `tree`
  const out = { [-1]: {}, 1: {} }, seen = new Set();
  g.traverse((n) => {
    const kind = n.userData.furniture ?? (n.userData.pit && 'pit'), k = kind in RHYTHM.trees ? 'tree' : kind;
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    for (let i = 0; i < n.count; i++) { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); const x = m.elements[12], z = m.elements[14]; (out[Math.sign(x)][k] ??= []).push({ x, z, m, kind }); }
  });
  for (const s of [-1, 1]) for (const l of Object.values(out[s])) l.sort((a, b) => a.z - b.z);
  return out;
};

test('the same seed places the same furniture, and another seed different extras', () => {
  const at = (seed) => { const out = []; furniture(gfx, { z0: 0, length: 120 }, null, rng(seed), { z: 50 }).traverse((n) => { if (n.isInstancedMesh) out.push(n.userData.furniture, ...n.instanceMatrix.array); }); return out.join(); };
  assert.equal(at(7), at(7));
  assert.notEqual(at(7), at(8));
});

// per side: the footprints along z (a tree's its pit) as [z0, z1], sorted; the empty stretches are the holes between them
const spans = (by, s) => Object.entries(by[s]).filter(([k]) => k !== 'tree').flatMap(([k, list]) => list.map(({ z }) => { const h = k === 'pit' ? PITS.size / 2 : FOOT[k][1]; return [z - h, z + h]; }));
const holes = (iv, from, at) => { iv.sort((a, b) => a[0] - b[0]); let reach = from; for (const [a, b] of iv) { assert.ok(a - reach <= 10 + 1e-4, `${at}: ${(a - reach).toFixed(2)} m empty from z ${reach.toFixed(2)}`); reach = Math.max(reach, b); } };
const sideStreet = (g) => { const cz = g.userData.cross.z; return [cz - CLEAR, cz + CROSS.width + CLEAR]; };

test('one tree pitch of 8-10 m a chunk, the +x trees halfway between the -x ones; a lamp every 2P (16-20 m) halfway between two trees, no empty stretch over 10 m', async (t) => {
  for (const id of THEMES) {
    const make = await themeChunk(id);
    let n = 0, N = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const z0 = 120 * (seed % 11), g = make(seed, z0), [c0, c1] = sideStreet(g), by = placed(g), at = `${id}, seed ${seed}, chunk ${z0}`;
      n += pieces(g); N++;
      const pitch = (s) => { const z = by[s].tree.map((x) => x.z); return Math.min(...z.slice(1).map((v, i) => v - z[i])); }, P = pitch(-1);
      assert.ok(Math.abs(pitch(1) - P) < 1e-4 && P >= RHYTHM.pitch[0] - 1e-6 && P <= RHYTHM.pitch[1] + 1e-6 && Math.round(120 / P) % 2 === 1, `${at}: pitches ${P.toFixed(2)} and ${pitch(1).toFixed(2)}, one odd n a chunk`);
      const minus = by[-1].tree.map((x) => x.z), off = (z) => z > c0 - PITS.size / 2 && z < c1 + PITS.size / 2; // a spot the side street's clear zone took
      for (const { z } of by[1].tree) for (const w of [z - P / 2, z + P / 2]) assert.ok(off(w) || minus.some((v) => Math.abs(v - w) < 1e-3), `${at}: the +x tree at z ${z.toFixed(2)} is not halfway between two -x trees`);
      for (const s of [-1, 1]) {
        const trees = by[s].tree.map((x) => x.z), lamps = (by[s].lamp ?? []).map((l) => l.z);
        for (const d of trees.slice(1).map((z, i) => z - trees[i])) assert.ok(Math.abs(d / P - Math.round(d / P)) < 1e-4, `${at}, side ${s}: a ${d.toFixed(2)} m gap is not a run of the ${P.toFixed(2)} m pitch (a skipped tree)`);
        const slot = (z, of) => { const u = ((z - z0) / P + of) % 1; return Math.min(u, 1 - u) < 1e-4; }; // z on the pitch's grid (instance matrices are float32), shifted by `of` pitches
        for (const z of trees) assert.ok(slot(z, s < 0 ? 0.5 : 0), `${at}: the ${s < 0 ? '-x side\'s trees stand at half pitches' : '+x side\'s at whole ones'}, z ${z.toFixed(2)}`);
        for (const z of lamps) assert.ok(slot(z, s < 0 ? 0 : 0.5), `${at}: a lamp at z ${z.toFixed(2)}, not halfway between two trees`);
        // every 2P from the chunk's start (+x from 0.5P to length - 0.5P); -x's last at length - P, the one short gap its odd n costs
        const grid = lamps.filter((z) => s > 0 || Math.abs(z - z0 - 120 + P) > 1e-3);
        assert.ok(lamps.length >= 3 && 2 * P >= 10 - 1e-6 && 2 * P <= 20 + 1e-6, `${at}, side ${s}: ${lamps.length} lamps, a ${(2 * P).toFixed(2)} m lamp pitch`);
        for (const z of grid) assert.ok(slot((z - z0) / 2 + z0, s < 0 ? 0.5 : 0.75), `${at}, side ${s}: a lamp at z ${z.toFixed(2)} off the 2P grid`);
        assert.ok(s > 0 || grid.length === lamps.length - 1, `${at}: -x's lamp at length - P`);
        // the 2 m seams are the two-chunk test's
        holes([...spans(by, s), [-Infinity, z0 + SEAM], [z0 + 120 - SEAM, Infinity], [c0, c1]], z0, `${at}, side ${s}`);
      }
    }
    const mean = n / N;
    t.diagnostic(`${id}: ${mean.toFixed(1)} pieces a chunk`);
    assert.ok(mean >= 45 && mean <= 70, `${id}: ${mean.toFixed(1)} pieces a chunk (the prototype's rhythm with planters: about 58)`);
  }
});

test('across a seam: no empty stretch over 10 m on either side, the lamps P to 2P apart (two chunks, z0 and z0 + 120)', async () => {
  for (const id of THEMES) {
    const make = await themeChunk(id);
    for (let seed = 1; seed <= 60; seed++) {
      const z0 = 120 * (seed % 11), A = make(seed, z0), B = make(seed + 100, z0 + 120), a = placed(A), b = placed(B), at = `${id}, seed ${seed}, seam ${z0 + 120}`;
      for (const s of [-1, 1]) {
        holes([...spans(a, s), ...spans(b, s), [-Infinity, z0 + 60], [z0 + 180, Infinity], sideStreet(A), sideStreet(B)], z0, `${at}, side ${s}`);
        const last = a[s].lamp.at(-1).z, first = b[s].lamp[0].z;
        assert.ok(first - last >= RHYTHM.pitch[0] - 1e-3 && first - last <= 20 + 1e-3, `${at}, side ${s}: lamps ${(first - last).toFixed(2)} m apart across the seam`);
      }
    }
  }
});

// Task 32 C7 (Caedon: "One new tree", T3; the current tree stays as a second variant now its guard is cut): each tree slot draws one
// of the two models from its place (pickBy), never from the chunk's stream.
test('the kerb draws both tree models, about half each, slot by slot from its place, and the chunk\'s stream untouched', async () => {
  for (const id of THEMES) {
    const make = await themeChunk(id), count = { tree: 0, tree2: 0 };
    for (let seed = 1; seed <= 30; seed++) for (const s of [-1, 1]) for (const t of placed(make(seed, 120 * seed))[s].tree) count[t.kind]++;
    const share = count.tree2 / (count.tree + count.tree2);
    assert.ok(share > 0.4 && share < 0.6, `${id}: ${count.tree} tree and ${count.tree2} tree2`);
  }
  const kinds = (g) => placed(g)[1].tree.map((t) => `${t.z.toFixed(3)}:${t.kind}`).join();
  assert.equal(kinds(furniture(gfx, { z0: 240, length: 120 }, null, rng(3), null)), kinds(furniture(gfx, { z0: 240, length: 120 }, null, rng(4), null)), 'the same place, the same model, whatever the chunk\'s seed');
});

test('a flush pit stands under every tree, one instanced mesh a chunk; trees come in sizes 0.75-0.9, turned in 90 degree steps', async () => {
  const make = await themeChunk('downtown'), sizes = new Set(), turns = new Set(), p = new THREE.Vector3(), q = new THREE.Quaternion(), k = new THREE.Vector3(), e = new THREE.Euler();
  for (let seed = 1; seed <= 20; seed++) {
    const g = make(seed, 120 * seed), by = placed(g);
    let pits = 0; g.traverse((n) => { if (n.userData.pit) pits++; });
    assert.equal(pits, 1, `seed ${seed}: ${pits} pit meshes`);
    for (const s of [-1, 1]) {
      assert.equal(by[s].pit.length, by[s].tree.length, `seed ${seed}: a pit a tree`);
      by[s].tree.forEach((t, i) => {
        const pit = by[s].pit[i];
        assert.ok(Math.abs(pit.x - t.x) < 1e-6 && Math.abs(pit.z - t.z) < 1e-6 && Math.abs(pit.m.elements[13] - t.m.elements[13]) < 1e-6, `seed ${seed}: the pit at ${pit.x}, ${pit.z} and its tree at ${t.x}, ${t.z}`);
        t.m.decompose(p, q, k); e.setFromQuaternion(q, 'YXZ');
        const turn = (e.y - (s > 0 ? -Math.PI / 2 : Math.PI / 2)) / (Math.PI / 2), snap = turn - Math.round(turn);
        assert.ok(k.y >= RHYTHM.scale[0] - 1e-6 && k.y <= RHYTHM.scale[1] + 1e-6 && Math.abs(snap) * Math.PI / 2 <= RHYTHM.jitter + 1e-6, `seed ${seed}: a tree at ${k.y.toFixed(3)}, turned ${turn.toFixed(3)} quarters`);
        sizes.add(k.y.toFixed(3)); turns.add(((Math.round(turn) % 4) + 4) % 4);
        assert.ok(Math.abs(Math.abs(t.x) - RHYTHM.trees[t.kind]) < 1e-6, `a ${t.kind} at x ${t.x}`);
      });
    }
  }
  assert.ok(sizes.size > 10 && turns.size === 4, `${sizes.size} sizes and ${turns.size} quarter turns`);
  // the pit: 1.5 m square, its top just over the sidewalk's (flush to the eye)
  let pit; make(1).traverse((n) => { if (n.userData.pit) pit = n; });
  pit.geometry.computeBoundingBox();
  const b = pit.geometry.boundingBox, top = b.max.y + pit.instanceMatrix.array[13];
  assert.ok(Math.abs(b.max.x - b.min.x - PITS.size) < 1e-6 && Math.abs(b.max.z - b.min.z - PITS.size) < 1e-6 && top > KERB && top < KERB + 0.02, `a ${(b.max.x - b.min.x).toFixed(2)} m pit, its top at ${top.toFixed(3)}`);
  assert.ok(pit.geometry.attributes.color && pit.material.vertexColors, 'stone rim and soil in its own colours');
});

test('planter pairs stand at shop doors from the block list, on about half the lots', async () => {
  for (const id of THEMES) {
    const make = await themeChunk(id);
    let lots = 0, with_ = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = make(seed, 120 * seed), blocks = g.userData.blocks, by = placed(g);
      for (const s of [-1, 1]) {
        const planters = by[s].planter ?? [];
        for (const pl of planters) {
          assert.ok(Math.abs(Math.abs(pl.x) - PLANTER.x) < 1e-4, `${id}: a planter at x ${pl.x}`);
          assert.ok(blocks.some((b) => b.side === s && b.shop != null && [-PLANTER.dz, PLANTER.dz].some((d) => Math.abs((b.z0 + b.z1) / 2 + d - pl.z) < 1e-3)), `${id}, seed ${seed}: a planter at z ${pl.z.toFixed(2)} by no shop door`);
        }
        for (const b of blocks.filter((x) => x.side === s)) { lots++; if (planters.some((pl) => Math.abs(pl.z - (b.z0 + b.z1) / 2) <= PLANTER.dz + 1e-6)) with_++; }
      }
    }
    assert.ok(with_ / lots > 0.3 && with_ / lots < 0.6, `${id}: planters at ${(100 * with_ / lots).toFixed(0)}% of the lots`);
  }
});

test('uptown\'s lamps throw a light pool, one instanced mesh, on the road and the sidewalk at their own heights, inside the chunk; the day themes none', async () => {
  for (const id of THEMES) {
    const make = await themeChunk(id);
    for (let seed = 1; seed <= 10; seed++) {
      const z0 = 120 * seed, g = make(seed, z0);
      let pool, lamps = 0, meshes = 0; g.traverse((n) => { if (n.userData.pool) { pool = n; meshes++; } if (n.userData.furniture === 'lamp') lamps = n.count; });
      if (id !== 'uptown') { assert.equal(meshes, 0, `${id}: no pools by day`); continue; }
      assert.ok(meshes === 1 && pool.count === lamps && pool.material.blending === THREE.AdditiveBlending && !pool.material.depthWrite, `seed ${seed}: ${meshes} pool meshes, ${pool?.count} pools for ${lamps} lamps`);
      const v = new THREE.Vector3(), m = new THREE.Matrix4(), p = pool.geometry.attributes.position;
      for (let i = 0; i < pool.count; i++) {
        pool.getMatrixAt(i, m);
        for (let k = 0; k < p.count; k++) {
          v.fromBufferAttribute(p, k).applyMatrix4(m);
          assert.ok(v.z >= z0 - 1e-6 && v.z <= z0 + 120 + 1e-6, `seed ${seed}: a pool reaches z ${v.z.toFixed(2)}`);
          const road = v.y > 0.021 && v.y < 0.05, walk = v.y > KERB + 0.015 && v.y < KERB + 0.05, x = Math.abs(v.x); // the two meet at the kerb
          assert.ok(x < ROAD_HALF - 1e-4 ? road : x > ROAD_HALF + 1e-4 ? walk : road || walk, `seed ${seed}: a pool's corner at x ${v.x.toFixed(2)}, y ${v.y.toFixed(3)}`);
        }
      }
    }
  }
});

test('each tree\'s canopy is tinted on its own (instanceColor), toward its theme\'s green', async () => {
  for (const id of THEMES) {
    const make = await themeChunk(id), c = new THREE.Color(), seen = new Set(), sum = [0, 0, 0];
    let n = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const meshes = {}; make(seed, 120 * seed).traverse((m) => { if (m.userData.furniture in RHYTHM.trees) meshes[m.userData.furniture] ??= m; }); // tree2's leaves are lifted to tree.glb's green (kit.js): one tint
      for (const mesh of Object.values(meshes)) {
        assert.ok(mesh.instanceColor, `${id}: a colour per tree`);
        for (let i = 0; i < mesh.count; i++) { mesh.getColorAt(i, c); seen.add(c.toArray().map((x) => x.toFixed(4)).join()); sum[0] += c.r; sum[1] += c.g; sum[2] += c.b; n++; }
      }
    }
    const [from, to] = TINT[id].map((h) => new THREE.Color(h)), want = [to.r / from.r, to.g / from.g, to.b / from.b];
    assert.ok(seen.size > n / 2, `${id}: ${seen.size} tints among ${n} trees`);
    sum.forEach((v, k) => assert.ok(Math.abs(v / n / want[k] - 1) < 0.1, `${id}: channel ${k} at ${(v / n).toFixed(3)}, the theme's ${want[k].toFixed(3)}`));
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
  for (const seed of [1, 2, 3]) for (const z0 of [1080, 1200]) { // Task 32: every chunk has its portal at z0 + 45 (was a tower pair every 240 m)
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
test('the bridge water lies 2.5 m under the deck, out to the horizon either side, and the portal stands in it, 45 m up', () => {
  const g = bridgeChunk(1200), water = bounds(g, (n) => n.material === waterMaterial(gfx)), portal = bounds(g, (n) => n.userData.portal);
  assert.ok(water.min.y === -2.5 && water.max.y === -2.5, `the water at ${water.min.y}`);
  assert.ok(water.min.x <= -300 && water.max.x >= 300, `the water spans x ${water.min.x}..${water.max.x}: it stops short of the fog's far end (the main session's Task 31a fix round 1)`);
  // re-pinned (Task 32): Caedon's board 25 pick replaces Task 31's 32 m tower pair every 240 m with one 45 m portal every 120 m
  assert.ok(portal.min.y < water.min.y && Math.abs(portal.max.y - 45) < 1e-6, `the portal from ${portal.min.y} to ${portal.max.y}`);
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
    assert.ok(land.min.x <= -300 && land.max.x >= 300, `${at}: the land spans x ${land.min.x}..${land.max.x}, not the wide shore the bridge water meets`);
  }
});

test('stone piers carry the bridge deck every 30 m, seam to seam, from its underside down into the water', () => {
  for (const z0 of [1080, 1200]) {
    const g = bridgeChunk(z0), deck = bounds(g, (n) => n.userData.road), piers = bounds(g, (n) => n.userData.pier), zs = [], m = new THREE.Matrix4();
    assert.ok(piers.max.y >= deck.min.y && piers.max.y < 0 && piers.min.y < WATER.y, `chunk ${z0}: piers from ${piers.min.y} to ${piers.max.y}, the deck's underside at ${deck.min.y}`); // under the road, so out of the play space
    // re-pinned (Task 32): board 25's portal stands on the pier under it, sized to its legs, so that one pier is wider than the deck
    const legs = bounds(g, (n) => n.userData.portal);
    assert.ok(piers.min.x <= deck.min.x && piers.max.x >= deck.max.x && piers.min.x >= legs.min.x - 1e-6 && piers.max.x <= legs.max.x + 1e-6, `chunk ${z0}: piers ${piers.min.x}..${piers.max.x}, the deck ${deck.min.x}..${deck.max.x}, the legs ${legs.min.x}..${legs.max.x}`);
    g.traverse((n) => { if (n.userData.pier) for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); zs.push(m.elements[14]); } });
    assert.deepEqual(zs, [15, 45, 75, 105].map((z) => z0 + z), 'every 30 m, 15 m in from each seam, so the spacing runs on across chunks');
  }
});

test('every waterfront block stands in the water, its body reaching under the surface', () => {
  for (const seed of [1, 2, 3]) for (const z0 of [1080, 1200]) {
    const g = bridgeChunk(z0, seed), sides = { '-1': [], 1: [] }; // each side's triangles as [z from, z to, lowest y]
    g.updateMatrixWorld(true);
    g.traverse((n) => {
      if (!n.userData.building) return;
      const p = n.geometry.attributes.position, idx = n.geometry.index, at = (k) => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(k) : k).applyMatrix4(n.matrixWorld);
      for (let t = 0; t < (idx ?? p).count; t += 3) { const v = [at(t), at(t + 1), at(t + 2)]; sides[Math.sign(v[0].x)].push([Math.min(...v.map((q) => q.z)), Math.max(...v.map((q) => q.z)), Math.min(...v.map((q) => q.y))]); }
    });
    for (const tris of Object.values(sides)) { // a block's facade and body share its z span; blocks stand 1 m apart along z
      const blocks = [];
      for (const [lo, hi, y] of tris.sort((a, b) => a[0] - b[0])) { const b = blocks.at(-1); if (b && lo - b.hi < 0.5) Object.assign(b, { hi: Math.max(b.hi, hi), foot: Math.min(b.foot, y) }); else blocks.push({ lo, hi, foot: y }); }
      assert.ok(blocks.length >= 8, `seed ${seed}, chunk ${z0}: ${blocks.length} blocks on a side`);
      for (const b of blocks) assert.ok(b.foot < WATER.y, `seed ${seed}, chunk ${z0}: the block at z ${b.lo.toFixed(2)}..${b.hi.toFixed(2)} stands at ${b.foot}, the water at ${WATER.y}`);
    }
  }
});

test('the road is a cool grey per scene over asphalt grain, its lane lines solid but across the crosswalk (Caedon, board 18; 2026-10-15)', async () => {
  for (const id of ['downtown', 'midtown', 'uptown']) {
    const hifi = (await import(`../packs/hifi/themes/${id}.js`)).default, theme = { ...(await import(`../content/themes/${id}.js`)).default, ...hifi }, roads = new Set();
    hifi.createChunk.call(theme, gfx, { z0: 1200, length: 120, lanes, rng: rng(1), theme }).traverse((n) => { if (n.userData.road) roads.add(n.material); });
    const want = new THREE.Color(GROUND[id].road).multiplyScalar(1 / asphaltTexture(THREE).userData.mean).getHexString();
    // Caedon 2026-10-15, "Cool grey per scene" like the style frames, replacing board 18's warm #6b675a
    assert.deepEqual([...roads].map((r) => [r.color.getHexString(), r.map, r.roughness]), [[want, asphaltTexture(THREE), GROUND[id].roadRough]], id);
  }
  const cross = { z: 50 }, g = street(gfx, { z0: 0, length: 120, lanes }, flat, cross);
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
