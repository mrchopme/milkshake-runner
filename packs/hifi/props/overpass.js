// HiFi overpass: the generated deck on four pillars in public/hifi/overpass.glb, fitted to the shipped overpass (content/props/overpass.js):
// 15 m across the street (road + 6), `length` m along it, 5 m clear under the deck, the pillars on the sidewalks. Fitted once from the
// first copy; every overpass after that shares the stone (Task 34 L-I).
import { stone } from '../lib/bridge.js';

const YAW = Math.PI / 2;  // ponytail: calibration knob — the model's road runs along its z and its front is +x: this lays the span across the street, the front toward the player (-z)
const CLEAR = 5;          // m between the street and the deck's underside, as the shipped overpass
const DECK_AT = 0.722;    // ponytail: calibration knob — the deck's underside as a fraction of the model's height (measured on the generated mesh: y 0.112 of -0.252 .. 0.252)
// Caedon, board 29 pick 5 (2026-10-20): the generated light-grey paint read as an unfinished building 150 m out; both props wear
// the bridge piers' and the quay's stone instead (its shared ashlar on metre UVs, one material), the overpass with a lighter top
// course. No theme reaches a prop (src/world.js passes z, length, lanes), so the tint is the piers' stone in every theme.
// ponytail: calibration knobs.
const STONE_TINT = '#5d6273';                   // the darkest of the piers' stones (bridge.js PIER_COLORS[2], not exported), as stone() tints them
export const PARAPET = { h: 0.5, tone: 1.3 };   // the top course: one ashlar course tall, this much lighter than the wall
let stoneMat;
const dressed = new WeakMap(); // generated geometry -> its stone copy, shared by every copy of the prop and freed with the source
// The generated mesh `n` (fitted: its matrices fresh) in stone: an unindexed copy of its geometry with float UVs in metres from
// where each corner stands in the prop, projected per FACE along its normal's largest axis (along x maps (z, y), along y (x, z),
// along z (x, y), as shapes.js metreUV): per vertex, a smooth mesh's triangle could take two axes and smear the ashlar across it.
// Its vertex colour is the tint, `parapet.tone` times lighter within `parapet.h` of `top` (the prop's highest point; no parapet: h 0).
export function dress(gfx, n, top, parapet = { h: 0, tone: 1 }) {
  const T = gfx.three, src = n.geometry;
  if (!dressed.has(src)) {
    const g = src.index ? src.toNonIndexed() : src.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2), c = new Float32Array(p.count * 3);
    const v = [0, 1, 2].map(() => new T.Vector3()), e = new T.Vector3(), f = new T.Vector3(), tint = new T.Color(STONE_TINT);
    for (let i = 0; i < p.count; i += 3) {
      v.forEach((x, k) => x.fromBufferAttribute(p, i + k).applyMatrix4(n.matrixWorld));
      f.subVectors(v[1], v[0]).cross(e.subVectors(v[2], v[0]));
      const [ax, ay, az] = [Math.abs(f.x), Math.abs(f.y), Math.abs(f.z)];
      v.forEach((x, k) => {
        uv.set(ax >= ay && ax >= az ? [x.z, x.y] : ay >= az ? [x.x, x.z] : [x.x, x.y], (i + k) * 2);
        tint.toArray(c, (i + k) * 3);
        if (x.y > top - parapet.h) for (let j = 0; j < 3; j++) c[(i + k) * 3 + j] *= parapet.tone;
      });
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(c, 3));
    g.userData.shared = true; // gfx.dispose leaves it; it goes when assets.release frees the generated geometry
    src.addEventListener('dispose', () => g.dispose());
    dressed.set(src, g);
  }
  n.geometry = dressed.get(src);
  // stone() hands out its material only on a block of its own (bridge.js stays as L-C left it): build one, keep the material, free the block
  if (!stoneMat) { const s = stone(gfx, [STONE_TINT], 1, 0, 1); s.geometry.dispose(); stoneMat = s.material; }
  n.material = stoneMat;
}

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'prop', id: 'overpass', assets: ['hifi/overpass.glb'],
  createView(gfx, { length, lanes }) {
    const model = gfx.asset('hifi/overpass.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx.three, model, lanes.roadHalf * 2 + 6, length);
    model.scale.copy(parts.scale);
    model.position.copy(parts.offset);
    model.updateMatrixWorld(true);
    model.traverse((n) => { if (n.isMesh) dress(gfx, n, parts.top, PARAPET); });
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
