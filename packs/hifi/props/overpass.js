// HiFi overpass: the generated deck on four pillars in public/hifi/overpass.glb, fitted to the shipped overpass (content/props/overpass.js):
// 15 m across the street (road + 6), `length` m along it, 5 m clear under the deck, the pillars on the sidewalks. Built once from the
// first copy; every overpass after that shares the paint.
import { gloss } from '../lib/paint.js';

const YAW = Math.PI / 2;  // ponytail: calibration knob — the model's road runs along its z and its front is +x: this lays the span across the street, the front toward the player (-z)
const CLEAR = 5;          // m between the street and the deck's underside, as the shipped overpass
const DECK_AT = 0.722;    // ponytail: calibration knob — the deck's underside as a fraction of the model's height (measured on the generated mesh: y 0.112 of -0.252 .. 0.252)

let parts; // { scale, offset, paint }, measured from the first copy

export default {
  kind: 'prop', id: 'overpass', assets: ['hifi/overpass.glb'],
  createView(gfx, { length, lanes }) {
    const model = gfx.asset('hifi/overpass.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx.three, model, lanes.roadHalf * 2 + 6, length);
    model.traverse((n) => { if (n.isMesh) n.material = parts.paint.get(n.material) ?? n.material; });
    model.scale.copy(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

// Measured after the yaw, so x is the span and z the depth; the scale goes on the model's own axes (its x lies along the street, its z across it).
function build(T, model, width, length) {
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const sx = width / size.x, sy = CLEAR / (DECK_AT * size.y), sz = length / size.z;
  const paint = new Map(); // generated material -> a copy of it with Tripo's random metal dropped
  model.traverse((n) => { if (n.isMesh && !paint.has(n.material)) paint.set(n.material, gloss(T, n.material, { metalness: 0, metalnessMap: null })); });
  return { scale: new T.Vector3(sz, sy, sx), offset: new T.Vector3(-c.x * sx, -b.min.y * sy, length / 2 - c.z * sz), paint };
}
