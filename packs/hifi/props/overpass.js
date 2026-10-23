// HiFi overpass: the generated deck on four pillars in public/hifi/overpass.glb, fitted to the shipped overpass (content/props/overpass.js):
// 15 m across the street (road + 6), `length` m along it, 5 m clear under the deck, the pillars on the sidewalks. Fitted once from the
// first copy; every overpass after that shares the stone (Task 34 L-I).
import { stone, PIER_COLORS } from '../lib/bridge.js';

const YAW = Math.PI / 2;  // ponytail: calibration knob — the model's road runs along its z and its front is +x: this lays the span across the street, the front toward the player (-z)
const CLEAR = 5;          // m between the street and the deck's underside, as the shipped overpass
const DECK_AT = 0.722;    // ponytail: calibration knob — the deck's underside as a fraction of the model's height (measured on the generated mesh: y 0.112 of -0.252 .. 0.252)
// Caedon, board 29 pick 5 (2026-10-20): the generated light-grey paint read as an unfinished building 150 m out; both props wear
// the bridge piers' and the quay's stone instead (its shared ashlar on metre UVs, one material), the overpass with a lighter top
// course, tinted by the section theme's look.stone (Task 34 L-K: world.js passes the theme; ledger, Lanes L-E and L-I, "one stone
// tint in every theme" read cool grey under the Garden's warm sky). A theme with none (downtown, the bridge) wears the piers' darkest.
// ponytail: calibration knobs.
export const PARAPET = { h: 0.5, tone: 1.3 };   // the top course: one ashlar course tall, this much lighter than the wall
// A face whose texel in the model's own paint is brighter than this keeps the paint (Caedon, 2026-10-22, Task 34 L-K; ledger, Lanes
// L-E and L-I: the stone took the tunnel's cream lamp globes). Measured on the GLBs' faces (Rec. 709 luma of the texel under each
// face's uv centre): the tunnel's vault tops out at 0.80, its globes 0.86-0.98 (171 faces at the crown, plus 8 of its own road lines
// under the street); the overpass's brightest, 16 faces of its deck-top centre line, 0.85-0.88, out of a runner's sight.
export const LAMP = 0.85;
let stoneMat;
const dressed = new WeakMap(); // generated geometry -> { base: its stone copy, tone: each corner's parapet factor, paint, tints: hex -> geometry }, freed with the source
// The generated mesh `n` (fitted: its matrices fresh) in stone: an unindexed copy of its geometry with float UVs in metres from
// where each corner stands in the prop, projected per FACE along its normal's largest axis (along x maps (z, y), along y (x, z),
// along z (x, y), as shapes.js metreUV): per vertex, a smooth mesh's triangle could take two axes and smear the ashlar across it.
// Its vertex colour is `tint`, `parapet.tone` times lighter within `parapet.h` of `top` (the prop's highest point; no parapet: h 0).
// The faces over a bright texel of the model's own map (bright()) go last, a second group in its own material on its own uv: +1 draw.
// A tint is a geometry of its own colours over the one copy's position, normal and uv buffers (one upload whatever the themes).
export function dress(gfx, n, top, parapet = { h: 0, tone: 1 }, tint = PIER_COLORS[2]) {
  const T = gfx.three, src = n.geometry;
  let d = dressed.get(src);
  if (!d) {
    const raw = src.index ? src.toNonIndexed() : src.clone(), lit = bright(T, raw, n.material), order = [...lit.keys()].sort((a, b) => lit[a] - lit[b]), stoneN = lit.filter((b) => !b).length;
    const g = new T.BufferGeometry(); // raw with its faces stone first, painted last
    for (const [k, a] of Object.entries(raw.attributes)) {
      const s = a.itemSize * 3, arr = new a.array.constructor(a.array.length);
      order.forEach((f, o) => arr.set(a.array.subarray(f * s, f * s + s), o * s));
      g.setAttribute(k, new T.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    const p = g.attributes.position, own = g.attributes.uv, uv = new Float32Array(p.count * 2), tone = new Float32Array(p.count);
    const v = [0, 1, 2].map(() => new T.Vector3()), e = new T.Vector3(), f = new T.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      v.forEach((x, k) => x.fromBufferAttribute(p, i + k).applyMatrix4(n.matrixWorld));
      f.subVectors(v[1], v[0]).cross(e.subVectors(v[2], v[0]));
      const [ax, ay, az] = [Math.abs(f.x), Math.abs(f.y), Math.abs(f.z)];
      v.forEach((x, k) => {
        uv.set(i >= stoneN * 3 ? [own.getX(i + k), own.getY(i + k)] : ax >= ay && ax >= az ? [x.z, x.y] : ay >= az ? [x.x, x.z] : [x.x, x.y], (i + k) * 2);
        tone[i + k] = x.y > top - parapet.h ? parapet.tone : 1;
      });
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (stoneN < lit.length) g.addGroup(0, stoneN * 3, 0), g.addGroup(stoneN * 3, (lit.length - stoneN) * 3, 1);
    raw.dispose();
    d = { base: g, tone, paint: stoneN < lit.length ? n.material : null, tints: new Map() };
    src.addEventListener('dispose', () => { g.dispose(); for (const t of d.tints.values()) t.dispose(); });
    dressed.set(src, d);
  }
  if (!d.tints.has(tint)) {
    const g = new T.BufferGeometry(), c = new Float32Array(d.tone.length * 3), col = new T.Color(tint);
    for (const [k, a] of Object.entries(d.base.attributes)) g.setAttribute(k, a);
    g.groups = d.base.groups;
    d.tone.forEach((t, i) => c.set([col.r * t, col.g * t, col.b * t], i * 3));
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    g.userData.shared = true; // gfx.dispose leaves it; it goes when assets.release frees the generated geometry
    d.tints.set(tint, g);
  }
  n.geometry = d.tints.get(tint);
  // stone() hands out its material only on a block of its own (bridge.js stays as L-C left it): build one, keep the material, free the block
  if (!stoneMat) { const s = stone(gfx, PIER_COLORS, 1, 0, 1); s.geometry.dispose(); stoneMat = s.material; }
  n.material = d.paint ? [stoneMat, d.paint] : stoneMat;
}

// 1 for each face of the unindexed `g` whose texel under its uv centre in `mat`'s map is brighter than LAMP, else 0. The map's pixels
// are read once a model: a DataTexture's own (Node, the tests), else its image drawn into a canvas; none readable, or no uv: all stone.
function bright(T, g, mat) {
  const n = g.attributes.position.count / 3, uv = g.attributes.uv, map = mat?.map, px = uv && pixels(map), at = new T.Vector2();
  if (!px) return new Array(n).fill(0);
  const { data, width: w, height: h } = px;
  map.updateMatrix();
  return Array.from({ length: n }, (_, f) => {
    at.set(0, 0);
    for (let k = 0; k < 3; k++) at.x += uv.getX(f * 3 + k) / 3, at.y += uv.getY(f * 3 + k) / 3;
    map.transformUv(at); // the map's wrap and flipY, as the GPU samples it
    const i = 4 * (Math.min(h - 1, Math.floor(at.y * h)) * w + Math.min(w - 1, Math.floor(at.x * w)));
    return +((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 > LAMP);
  });
}
function pixels(map) {
  const im = map?.image;
  if (im?.data) return im;
  try { const x = new OffscreenCanvas(im.width, im.height).getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height); } catch { return null; }
}

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'prop', id: 'overpass', assets: ['hifi/overpass.glb'],
  createView(gfx, { length, lanes, theme }) {
    const model = gfx.asset('hifi/overpass.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx.three, model, lanes.roadHalf * 2 + 6, length);
    model.scale.copy(parts.scale);
    model.position.copy(parts.offset);
    model.updateMatrixWorld(true);
    model.traverse((n) => { if (n.isMesh) dress(gfx, n, parts.top, PARAPET, theme?.look?.stone); });
    return { object: gfx.group(model) };
  },
};

// Measured after the yaw, so x is the span and z the depth; the scale goes on the model's own axes (its x lies along the street, its z across it).
function build(T, model, width, length) {
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const sx = width / size.x, sy = CLEAR / (DECK_AT * size.y), sz = length / size.z;
  return { scale: new T.Vector3(sz, sy, sx), offset: new T.Vector3(-c.x * sx, -b.min.y * sy, length / 2 - c.z * sz), top: (b.max.y - b.min.y) * sy };
}
