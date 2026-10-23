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

// Re-pinned (Task 34 L-K): an entry may be a list of rects, one a cell across the tile in turn (downtown-04's two bays differ), on one v.
test('every street theme\'s facade tile has its window opening in the table: a rect inside the 2.5 x 3.5 m cell (or a rect per bay), or null', () => {
  for (const theme of [downtown, midtown, uptown]) for (const path of theme.assets.filter((a) => a.includes('/facades/'))) {
    assert.ok(path in OPENINGS, `${path} has no entry`);
    if (OPENINGS[path] === null) continue;
    const list = [].concat(OPENINGS[path]);
    assert.ok(list.length === 1 || list.length === 2, `${path}: a rect, or one per bay of the tile's two`);
    for (const o of list) {
      assert.deepEqual(Object.keys(o).sort(), ['u', 'v'], path);
      for (const [a, b] of [o.u, o.v]) assert.ok(a >= 0.04 - 1e-5 && b <= 0.96 + 1e-5 && b - a >= 0.2, `${path}: ${a}..${b}`);
      assert.deepEqual(o.v, list[0].v, `${path}: the bays share a floor's rows`);
    }
  }
  assert.equal(OPENINGS['hifi/city/facades/uptown-02.webp'], null, 'the fire escape tile stays flat');
});

// the x of every jamb (a body face looking along the wall, inside the frame's depth) but the caps at the wall's ends, wall-local from 0
const jambs = (body, w) => { const n = body.attributes.normal, out = new Set(); verts(body).forEach((v, i) => { if (Math.abs(n.getX(i)) > 0.99 && Math.abs(Math.abs(v.x) - w / 2) > 1e-4) out.add(+(v.x + w / 2).toFixed(4)); }); return [...out].sort((a, b) => a - b); };

test('downtown-04 is cut a rect per bay (Task 34 L-K): its two bays\' windows sit 0.08 cell apart, measured on the tile as P6 measured the table', () => {
  const list = OPENINGS['hifi/city/facades/downtown-04.webp'], CW = TILE.w / 2;
  assert.ok(Array.isArray(list) && list.length === 2, 'two rects, the left bay\'s then the right\'s');
  assert.deepEqual(list.map((o) => o.u), [[0.19, 0.78], [0.11, 0.69]], 'isPane on the tile at 256^2, per bay (the summed read gives the old 0.11..0.77)');
  const { body } = stamp({ w: 10, open: list });
  const want = [0, 1, 2, 3].flatMap((k) => list[k % 2].u.map((u) => +(k * CW + u * CW).toFixed(4)));
  assert.deepEqual(jambs(body, 10), want, 'every cell cut at its own bay\'s rect, alternating along the wall');
});

test('a window cut short at a wall\'s end is cut short (Task 34 L-K): the glass recessed to the end, the cut side open, the head and sill cut with it', () => {
  const w = 6.5, CW = TILE.w / 2, o = OPENINGS['hifi/city/facades/downtown-03.webp'], sa = 2 * CW + o.u[0] * CW; // the third cell's window would end at 6.925 m
  const { face, body } = stamp({ w });
  assert.deepEqual(jambs(body, w), [0, 1].flatMap((k) => o.u.map((u) => +(k * CW + u * CW).toFixed(4))).concat(+sa.toFixed(4)), 'two whole windows, then the cut one\'s left jamb alone');
  for (const v of [...verts(face), ...verts(body)]) assert.ok(Math.abs(v.x) <= w / 2 + 1e-5, `nothing past the wall's end: x ${v.x.toFixed(3)}`);
  const n = body.attributes.normal, rows = [], yb = (k) => 4.3 + k * 3.5;
  for (let k = 0; k < 6; k++) rows.push([yb(k) + (1 - o.v[1]) * 3.5, yb(k) + (1 - o.v[0]) * 3.5]);
  const inRow = (y) => rows.some(([a, b]) => y > a + 1e-4 && y < b - 1e-4);
  verts(body).forEach((v, i) => { if (n.getX(i) > 0.99 && Math.abs(v.x - w / 2) < 1e-4) assert.ok(!inRow(v.y), `the end cap stops at the cut opening: y ${v.y.toFixed(2)}`); });
  verts(body).forEach((v, i) => { if (n.getX(i) < -0.99) assert.ok(Math.abs(v.x - w / 2) > 1e-4, 'no jamb closing the cut side at the wall\'s end'); }); // jambs() leaves the ends out
  // which tile planes (z) cover the middle of the cut opening on each floor
  const fv = verts(face), covers = (x, y) => { const zs = new Set(); for (let t = 0; t < fv.length; t += 3) { const [a, b, c] = fv.slice(t, t + 3), s = (p, q) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x), d = [s(a, b), s(b, c), s(c, a)]; if (d.every((e) => e >= 0) || d.every((e) => e <= 0)) zs.add(+a.z.toFixed(6)); } return [...zs]; };
  for (const [a, b] of rows) assert.deepEqual(covers((sa + w) / 2 - w / 2, (a + b) / 2), [0], `the cut opening at y ${((a + b) / 2).toFixed(2)}: glass on the wall line, no frame over it`);
  assert.ok(verts(body).some((v) => v.z > RELIEF.jamb + 1e-3 && Math.abs(v.x - w / 2) < 1e-4), 'the sills and heads run to the end');
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

test('a cut opening narrower than RELIEF.cut (0.3 m) stays pier, a slit of glass reading as a crack; one at least that wide is cut (Task 34 L-K fix round)', () => {
  assert.equal(RELIEF.cut, 0.3);
  const CW = TILE.w / 2, o = OPENINGS['hifi/city/facades/downtown-03.webp'], sa = 2 * CW + o.u[0] * CW;
  for (const [left, cut] of [[0.29, false], [0.31, true]]) {
    const w = sa + left, js = jambs(stamp({ w }).body, w);
    assert.equal(js.includes(+sa.toFixed(4)), cut, `${left} m of window left at the end: ${cut ? 'cut' : 'pier'}`);
    assert.equal(js.length, cut ? 5 : 4, 'the two whole windows either way');
  }
});
