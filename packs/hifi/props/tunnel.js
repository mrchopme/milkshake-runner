// HiFi tunnel: the generated stone vault in public/hifi/tunnel.glb, stretched over the shipped tube (content/props/tunnel.js): its `length`
// (60 m), its roof 6.6 m up, its walls clear of the road, the flared mouth at the near end. One mesh: its triangles are short enough along the
// tube (the longest 12 m at 60 m, so a chord off the bend by 0.2 m at the sharpest turn) for the bend shader to curve it with the street.
// Fitted once from the first copy; every tunnel after that shares the paint.
import { gloss, painter } from '../lib/paint.js';

const YAW = Math.PI / 2;  // ponytail: calibration knob — the tube's axis lies along the model's x and its flared mouth is the +x end: this lays it along the street, the mouth toward the player (-z)
const CLEAR = 9.6;        // ponytail: calibration knob — m between the walls inside the tube (the road is 9 m wide; the stone walls then reach x +-7.5, the old 7.5 m building line)
export const ROOF = 6.6;  // ponytail: calibration knob — m from the street to the top of the tube body's roof (the shipped tube's is 6): the default chase camera reaches 4.0 m on a jump, and the lamp globes hang from the crown
const SINK = 0.1;         // ponytail: calibration knob — the model carries its own road: it lies this far under the street, so the street's road and dashes show instead
// ponytail: calibration knob — measured on the generated mesh, as fractions of its bounds: the tube body's inner clear width of the width
// (0.185 of 0.411), its floor and its roof top of the height from the bottom (y -0.091 and 0.126 of -0.162 .. 0.162), and the lowest thing
// over the camera's reach (|x| <= 1.5 on the default lanes, anywhere along the tube): the bottom of a lamp globe, 0.6613 rounded down.
// The mouth flares wider and taller.
export const BODY = { clear: 0.45, floor: 0.2185, roof: 0.89, ceiling: 0.66 };
const paint = painter((T, m) => gloss(T, m, { metalness: 0, metalnessMap: null })); // generated material -> a copy of it with Tripo's random metal dropped

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'prop', id: 'tunnel', assets: ['hifi/tunnel.glb'],
  createView(gfx, { length }) {
    const model = gfx.asset('hifi/tunnel.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx.three, model, length);
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.copy(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

// Measured after the yaw, so x is the width and z the length; the scale goes on the model's own axes (its x lies along the street, its z across it).
function build(T, model, length) {
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const sx = CLEAR / (BODY.clear * size.x), sy = (ROOF + SINK) / ((BODY.roof - BODY.floor) * size.y), sz = length / size.z;
  return { scale: new T.Vector3(sz, sy, sx), offset: new T.Vector3(-c.x * sx, -SINK - (b.min.y + BODY.floor * size.y) * sy, length / 2 - c.z * sz) };
}
