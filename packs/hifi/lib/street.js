import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, instanced, metreUV } from './shapes.js';
import { material } from './materials.js';
// The ground (Task 32, Caedon board 24 "Ship as prototyped", 2026-10-15): a procedural paving tile the walk colour tints and an
// asphalt grain the road's tints, both grey DataTextures built at load (Node has no canvas) on UVs in metres (shapes.js metreUV).
// Paving UVs: u metres out from the kerb (0..6, the kerb band 0..0.3), v = z - 12 floor(z0 / 12): chunk z0 are multiples of 120,
// so the 12 m period never breaks at a seam. A theme's `ground` hexes are the mean colour the surface renders at: each is divided
// by its tile's linear mean (`userData.mean`).
// ponytail: calibration knobs, metres (style-gap gaps 7 and 9, board 24): the tile, the kerb band, joints 3.5 cm at -12 %, flags
// +/-3.5 % in tone, noise +/-2 % on a 0.75 m lattice, the facade foot 0.5 m at -6 %; asphalt +/-4 % every 4 m; edge lines 0.15 m,
// 0.5 m in from each kerb; the kerb top one value up, its road face shaded
export const PAVE = { w: 512, h: 1024, len: 12, kerb: 0.3, joint: 0.035, jointTone: 0.88, flagTone: 0.035, noise: 0.02, foot: 0.5, footTone: 0.94, base: 0.93 };
const ASPHALT = { n: 256, tile: 4, grain: 0.04 };
export const EDGE = { w: 0.15, in: 0.5 }, KERB_TONE = { top: 1.12, face: 0.8 };
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// value noise on a lattice wrapping every `nu` x `nv` cells, smoothstepped
const vnoise = (u, v, nu, nv, seed) => {
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
  const at = (a, b) => hash(((a % nu) + nu) % nu, ((b % nv) + nv) % nv, seed);
  return (at(i, j) * (1 - su) + at(i + 1, j) * su) * (1 - sv) + (at(i, j + 1) * (1 - su) + at(i + 1, j + 1) * su) * sv;
};
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function grey(T, w, h, value, repeat, wrapS) {
  const px = new Uint8Array(w * h * 4); let mean = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const b = Math.round(Math.min(1, Math.max(0, value(i, j))) * 255); px.set([b, b, b, 255], (j * w + i) * 4); mean += toLinear(b / 255); }
  const t = new T.DataTexture(px, w, h);
  Object.assign(t, { wrapS, wrapT: T.RepeatWrapping, colorSpace: T.SRGBColorSpace, magFilter: T.LinearFilter, minFilter: T.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy: 16, needsUpdate: true });
  t.repeat.set(...repeat);
  t.userData.shared = true; t.userData.mean = mean / (w * h);
  return t;
}
// The sidewalk's paving for a style (its `ground.flag` m flags, 1.5 by default), 512 x 1024 over 6 x 12 m; memoised per flag size,
// shared, never freed (about 2.8 MB of GPU each). The bridge walkway imports it.
const paving = new Map();
export function pavingTexture(T, style) {
  const flag = style.ground?.flag ?? 1.5, P = PAVE;
  if (!paving.has(flag)) paving.set(flag, grey(T, P.w, P.h, (i, j) => {
    const u = ((i + 0.5) / P.w) * 6, v = ((j + 0.5) / P.h) * P.len, near = (x, step) => Math.abs(x - step * Math.round(x / step)) < P.joint / 2;
    let val = P.base * (1 + P.noise * (2 * vnoise(u / 0.75, v / 0.75, 8, P.len / 0.75, 7) - 1));
    if (u < P.kerb) { // kerb stones 1 m long
      if (near(v, 1) || u > P.kerb - P.joint) val *= P.jointTone;
    } else {
      const fu = (u - P.kerb) / flag, fv = v / flag, rows = Math.round(P.len / flag);
      val *= 1 + P.flagTone * (2 * hash(Math.floor(fu), ((Math.floor(fv) % rows) + rows) % rows, 3) - 1);
      if (near(u - P.kerb, flag) || near(v, flag)) val *= P.jointTone;
    }
    if (u > 6 - P.foot) val *= 1 - (1 - P.footTone) * Math.min(1, (u - (6 - P.foot)) / 0.15); // the facade foot, ramped in over 15 cm
    return val;
  }, [1 / 6, 1 / P.len], T.ClampToEdgeWrapping));
  return paving.get(flag);
}
// Asphalt grain for the road and the cross streets (and the bridge deck): isotropic, one shared 256 x 256 (about 0.35 MB).
let asphalt;
export function asphaltTexture(T) {
  const A = ASPHALT, c = A.n / 16;
  return asphalt ??= grey(T, A.n, A.n, (i, j) => (1 - A.grain) * (1 + A.grain * (2 * (0.5 * hash(i, j, 11) + 0.3 * vnoise(i / 4, j / 4, A.n / 4, A.n / 4, 13) + 0.2 * vnoise(i / c, j / c, 16, 16, 17)) - 1)),
    [1 / A.tile, 1 / A.tile], T.RepeatWrapping);
}
// A material on one of the grey tiles above, coloured so the surface renders at `hex` on average (the tile's linear mean); the
// street's and the bridge deck's.
export const tintedMaterial = (T, style, key, hex, rough, map, extra) => material(`${style.id}/${key}`, () => new T.MeshStandardMaterial({ color: new T.Color(hex).multiplyScalar(1 / map.userData.mean), roughness: rough, map, ...extra }));
// ponytail: calibration knobs, metres (board 15); the lane lines solid, each dash meeting the next (Caedon, 2026-10-14, board 18:
// the teaser's road; was 0.12 wide, 3 long every 6)
export const KERB = 0.18, WALK = 6, DASH = { w: 0.16, len: 6, every: 6 };
export const FACADE_X = 4.5 + WALK; // the facade line: the road's edge (ROAD_HALF in src/world.js, which a pack cannot import; a test holds the two together) plus the sidewalk
export const CROSS = { width: 12, stripe: 0.6, reach: FACADE_X + 10 }; // reach: the back of the avenue's blocks (10 m deep), where the cars wrap
// The side street (Task 33 pick 2, Caedon board 28 "ON"; he saw "literally into space" at every T): paved out to `far` each side of the
// avenue, a walk along each wall with its kerb band from the paving tile, lined with blocks facing it (buildings.js) and an end block
// across it at `far`, trees and lamps on its walks (furniture.js), its cars on its road (traffic.js DRIVE.lanes). The walls stand
// where the avenue's lots already end: the before wall at cross.z - 0.5 (their GAP), the after wall at cross.z + CROSS.width.
// ponytail: calibration knobs, metres (the prototype P2's, board 28). far: fog at 70 m is 20 % downtown and 0 midtown and uptown, so
// the end block closes the view, not the fog; walk: 3 + 6.5 road + 3 in the 12.5 m between the walls (6 m walks left no road); lot /
// deep: a side block's frontage along x and depth into z; end: the end block's depth along x; tree: one every `every` m from x `from`,
// `in` m off the wall at scale `k` (its 2.31 k m canopy clears the wall and stays over the walk), the two walks half a pitch apart, a
// lamp halfway between every second pair (as far off its kerb as the avenue's, so its pool fits). every 24, not P2's 18: 10 trees a
// chunk, not 12 (a tree GLB is ~7.3k triangles; the brief's trim)
export const SIDE = { far: 70, walk: 3, lot: [12, 18], deep: [8, 10], end: 10, tree: { every: 24, in: 1.6, k: 0.6, from: 16 } };
export const sideWalls = (cz) => [cz - 0.5, cz + CROSS.width];

export function street(gfx, { z0, length, lanes }, style, cross) {
  const T = gfx.three, g = gfx.group(), half = lanes.roadHalf, zc = z0 + length / 2, G = style.ground;
  const std = (key, color, rough) => material(`${style.id}/${key}`, () => new T.MeshStandardMaterial({ color, roughness: rough }));
  const tinted = (...a) => tintedMaterial(T, style, ...a);
  const road = metreUV(box(T, half * 2, 0.1, length, tinted('road', G.road, G.roadRough, asphaltTexture(T)), 0, -0.05, zc));
  road.userData.road = true;
  g.add(road);
  // the sidewalks run up to the cross street and on from its far side (board 15); the cross street is paved between, one slab out to
  // SIDE.far both sides, 1 mm under the road (its material and metre UVs, so the overlap shows nothing)
  if (cross) {
    const paving = metreUV(box(T, SIDE.far * 2, 0.1, CROSS.width, road.material, 0, -0.051, cross.z + CROSS.width / 2));
    paving.userData.crossing = true;
    g.add(paving);
  }
  const spans = cross ? [[z0, cross.z], [cross.z + CROSS.width, z0 + length]] : [[z0, z0 + length]];
  const zp = PAVE.len * Math.floor(z0 / PAVE.len), map = pavingTexture(T, style), slab = WALK - PAVE.kerb;
  const walkMat = tinted('walk', G.walk, G.walkRough, map), kerbMat = tinted('kerb', new T.Color(G.walk).multiplyScalar(KERB_TONE.top), G.walkRough, map, { vertexColors: true });
  const uvs = (x, y, z, n) => [Math.abs(x) - half, Math.abs(n.z) > 0.5 ? y : z - zp]; // the kerb's road face samples the kerb band, the far face the facade foot
  for (const side of [-1, 1]) for (const [a, b] of spans) {
    const kerb = metreUV(box(T, PAVE.kerb, KERB, b - a, kerbMat, side * (half + PAVE.kerb / 2), KERB / 2, (a + b) / 2), uvs), n = kerb.geometry.attributes.normal, c = [];
    for (let i = 0; i < n.count; i++) { const t = n.getX(i) * side < -0.5 ? KERB_TONE.face / KERB_TONE.top : 1; c.push(t, t, t); } // the road face in shade
    kerb.geometry.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    kerb.userData.kerb = true;
    const walk = metreUV(box(T, slab, KERB, b - a, walkMat, side * (half + PAVE.kerb + slab / 2), KERB / 2, (a + b) / 2), uvs);
    walk.userData.walk = true;
    g.add(kerb, walk);
  }
  if (cross) { // the side street's walks, each turning the corner from the avenue's kerb, one mesh in the walk's material (the kerb band
    // is the tile's, u metres from the side kerb's road edge, v along x)
    const [wa, wb] = sideWalls(cross.z), W = SIDE.walk, slabs = [];
    const slab = (x0, x1, za, zb, zk) => { const m = metreUV(box(T, x1 - x0, KERB, zb - za, walkMat, (x0 + x1) / 2, KERB / 2, (za + zb) / 2), (x, y, z, n) => [Math.abs(z - zk), Math.abs(n.x) > 0.5 ? y : Math.abs(x)]); slabs.push(m.geometry.translate(m.position.x, m.position.y, m.position.z)); };
    for (const s of [-1, 1]) {
      const at = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
      slab(...at(half, FACADE_X), cross.z, wa + W, wa + W);
      slab(...at(FACADE_X, SIDE.far), wa, wa + W, wa + W);
      slab(...at(half, SIDE.far), wb - W, wb, wb - W);
    }
    const walks = new T.Mesh(mergeGeometries(slabs), walkMat);
    walks.userData.sideWalk = true;
    g.add(walks);
  }
  const dashes = [];
  for (let z = z0; z + DASH.len <= z0 + length; z += DASH.every) for (const x of [lanes.width / 2, -lanes.width / 2]) {
    if (cross && z + DASH.len > cross.z && z < cross.z + CROSS.width) continue; // no lane dashes across the crosswalk
    dashes.push(new T.Matrix4().makeTranslation(x, 0.011, z + DASH.len / 2));
  }
  // solid white edge lines along each kerb, the chunk's length but across the crosswalk: the lane lines' own instances in DASH.len
  // pieces, the last scaled to what is left, so each bends with the kerb (Caedon, board 29 item 3: one piece a span bent as a chord)
  for (const [a, b] of spans) for (const x of [half - EDGE.in, EDGE.in - half]) for (let z = a; z < b - 1e-6; z += DASH.len) {
    const l = Math.min(DASH.len, b - z);
    dashes.push(new T.Matrix4().makeTranslation(x, 0.011, z + l / 2).scale(new T.Vector3(EDGE.w / DASH.w, 1, l / DASH.len)));
  }
  const paint = std('paint', style.paint, 0.6);
  g.add(instanced(T, new T.BoxGeometry(DASH.w, 0.02, DASH.len), paint, dashes));
  if (cross) { // zebra stripes across the road at both edges of the cross street, centred (Task 32: was -half + 0.4)
    const stripes = [];
    for (const zEdge of [cross.z + 1, cross.z + CROSS.width - 1]) for (let x = -half + 0.6; x < half - 0.3; x += CROSS.stripe * 2) stripes.push(new T.Matrix4().makeTranslation(x + CROSS.stripe / 2, 0.012, zEdge));
    // and across each side street's mouth in line with the avenue's walks: the same stripe turned, five on its road, centred on it
    const [wa, wb] = sideWalls(cross.z), mid = (wa + wb) / 2;
    for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) stripes.push(new T.Matrix4().makeRotationY(Math.PI / 2).setPosition(s * (half + PAVE.kerb + FACADE_X) / 2, 0.012, mid + k * CROSS.stripe * 2));
    g.add(instanced(T, new T.BoxGeometry(CROSS.stripe, 0.02, 2), paint, stripes));
  }
  return g;
}
