import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OPENINGS, RELIEF, relief } from '../packs/hifi/lib/windows.js';
import { TILE } from '../packs/hifi/lib/facade.js';
import downtown from '../packs/hifi/themes/downtown.js';
import midtown from '../packs/hifi/themes/midtown.js';
import uptown from '../packs/hifi/themes/uptown.js';

// The window relief (Task 33 pick 4, Caedon's board 28: "GRID, image faces, no generated pieces, 0 credits"; lane L-E).
const C = new THREE.Color('#808080'), TRIM = new THREE.Color('#ffffff');
const stamp = (o) => relief(THREE, { w: 15, y0: 4.3, y1: 25.3, base: 4.3, open: OPENINGS['hifi/city/facades/downtown-03.webp'], glass: false, color: C, trim: TRIM, ...o });
// positions are float32: the checks allow 1e-5
const verts = (g) => { const p = g.attributes.position, out = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i)); return out; };
const faceZ = (g) => [...new Set(verts(g).map((v) => +v.z.toFixed(6)))].sort((a, b) => a - b);

test('every street theme\'s facade tile has its window opening in the table: a rect inside the 2.5 x 3.5 m cell, or null', () => {
  for (const theme of [downtown, midtown, uptown]) for (const path of theme.assets.filter((a) => a.includes('/facades/'))) {
    assert.ok(path in OPENINGS, `${path} has no entry`);
    const o = OPENINGS[path];
    if (o === null) continue;
    assert.deepEqual(Object.keys(o).sort(), ['u', 'v'], path);
    for (const [a, b] of [o.u, o.v]) assert.ok(a >= 0.04 - 1e-5 && b <= 0.96 + 1e-5 && b - a >= 0.2, `${path}: ${a}..${b}`);
  }
  assert.equal(OPENINGS['hifi/city/facades/uptown-02.webp'], null, 'the fire escape tile stays flat');
});

test('the relief: the tile on the wall line as the glass, its frame faces RELIEF.jamb (<= 0.1 m) out, heads and sills no more than 0.1 m past them', () => {
  const { face, body } = stamp();
  assert.ok(RELIEF.jamb <= 0.1, `jambs ${RELIEF.jamb} m`);
  assert.deepEqual(faceZ(face), [0, RELIEF.jamb], 'tile pieces on the wall line and the frame line only');
  const n = body.attributes.normal, vs = verts(body);
  for (const [i, v] of vs.entries()) {
    assert.ok(v.z >= -1e-5 && v.z <= RELIEF.jamb + 0.1 + 1e-5, `a body vertex ${v.z.toFixed(3)} m out`);
    assert.ok(Math.abs(v.x) <= 7.5 + 1e-5 && v.y >= 4.3 - 1e-5 && v.y <= 25.3 + 1e-5, `a body vertex at ${v.toArray()}`);
    if (Math.abs(n.getX(i)) > 0.99) assert.ok(v.z <= RELIEF.jamb + 1e-5, `a jamb ${v.z.toFixed(3)} m deep`); // the jambs: the faces looking along the wall
  }
  assert.ok(vs.some((v) => v.z > RELIEF.jamb + 1e-3), 'heads and sills stand proud');
  for (const v of verts(face)) assert.ok(Math.abs(v.x) <= 7.5 + 1e-5 && v.y >= 4.3 - 1e-5 && v.y <= 25.3 + 1e-5, `a tile piece at ${v.toArray()}`);
});

test('the relief\'s body pieces carry a colour, darkened toward the glass and under the heads (the AO bake)', () => {
  const { body } = stamp(), col = body.attributes.color, seen = new Set();
  assert.equal(col.count, body.attributes.position.count);
  for (let i = 0; i < col.count; i++) seen.add(col.getX(i).toFixed(4));
  assert.ok(seen.has(C.r.toFixed(4)) && seen.has((C.r * RELIEF.ao).toFixed(4)), `colours ${[...seen]}`);
});

test('the relief stops at RELIEF.cap (30 m): plain tile above it', () => {
  assert.equal(RELIEF.cap, 30, 'plain planes above 30 m: up there the frames do not read, and they would only cost triangles (P6, board 28)');
  const { face, body } = stamp({ y1: 60 });
  for (const v of verts(body)) assert.ok(v.y <= RELIEF.cap + 1e-5, `a body vertex at ${v.y.toFixed(2)} m`);
  for (const v of verts(face)) if (v.y > RELIEF.cap + 1e-5) assert.ok(Math.abs(v.z) < 1e-5, `a frame piece at ${v.y.toFixed(2)} m`);
  assert.ok(verts(face).some((v) => v.y > 59.9), 'the plain tile reaches the top');
});

test('a tile with no opening (uptown-02, the fire escape) stays one flat plane; a curtain wall gets transoms, no sills', () => {
  const flat = stamp({ open: null });
  assert.ok(flat.body === null, 'no body pieces on a flat wall');
  assert.deepEqual(faceZ(flat.face), [0]);
  const b = new THREE.Box3().setFromBufferAttribute(flat.face.attributes.position);
  assert.ok(Math.abs(b.min.y - 4.3) < 1e-5 && Math.abs(b.max.y - 25.3) < 1e-5 && Math.abs(b.max.x - b.min.x - 15) < 1e-5);
  const glass = stamp({ open: OPENINGS['hifi/city/facades/downtown-01.webp'], glass: true }), proud = verts(glass.body).filter((v) => v.z > RELIEF.jamb + 1e-3);
  assert.ok(proud.length > 0, 'transoms stand proud');
  const xs = proud.map((v) => v.x);
  assert.ok(Math.min(...xs) <= -7.5 + 1e-5 && Math.max(...xs) >= 7.5 - 1e-5, 'a transom runs the wall\'s width');
});

test('the tile pieces keep the wall\'s pattern: u and v as one plane over the whole wall would have them', () => {
  const { face } = stamp(), p = face.attributes.position, uv = face.attributes.uv, n = face.attributes.normal;
  assert.deepEqual(Object.keys(face.attributes).sort(), ['normal', 'position', 'uv'], 'the facade meshes\' attributes, no colour');
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + 7.5) / TILE.w, v = (p.getY(i) - 4.3) / TILE.h;
    assert.ok(Math.abs(uv.getX(i) - u) < 1e-5 && Math.abs(uv.getY(i) - v) < 1e-5, `uv ${uv.getX(i)},${uv.getY(i)} at ${p.getX(i)},${p.getY(i)}`);
    assert.ok(n.getZ(i) === 1, 'every tile piece faces out');
  }
});

// The triangle budget (the prototype's +9-17k a chunk): a face the camera can only see from above is left out above the highest
// a camera rides (a section's 8 m, src/validate.js CAMERA_RANGES, + 0.3 x the rules' highest jump, 11.25 m = 11.375, rounded up to 11.5); seen from the
// street it is a back face.
test('no face looking up above RELIEF.eye (11.5 m): the bars\' tops and the sills\' reveals stop there', () => {
  assert.equal(RELIEF.eye, 11.5);
  for (const o of [{}, { open: OPENINGS['hifi/city/facades/downtown-01.webp'], glass: true }]) {
    const { body } = stamp(o), n = body.attributes.normal, p = body.attributes.position;
    let up = 0;
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.99) { up++; if (p.getY(i) > RELIEF.eye + 1e-5) assert.fail(`a face looking up at ${p.getY(i).toFixed(2)} m`); }
    if (!o.glass) assert.ok(up > 0, 'the low sills keep their tops');
  }
});
