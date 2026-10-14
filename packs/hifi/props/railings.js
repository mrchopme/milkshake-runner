// HiFi railings: the generated rail section in public/hifi/railings.glb, one segment every 4 m along the prop's 40 m on both sides of the deck,
// where the shipped railings stand (content/props/railings.js). An InstancedMesh, so each segment bends with the street at its own z.
import { gloss, painter } from '../lib/paint.js';
import { instanced } from '../lib/shapes.js';

const PITCH = 4;    // m between segments; each is stretched to span it, so the end posts of neighbours touch
const HEIGHT = 1.1; // m from the deck to the top of the posts, as the shipped posts
const paint = painter((T, m) => gloss(T, m, { metalness: 0, metalnessMap: null })); // generated material -> a copy of it with Tripo's random metal dropped

let parts; // { fit }, measured from the first copy

export default {
  kind: 'prop', id: 'railings', assets: ['hifi/railings.glb'],
  createView(gfx, { length, lanes }) {
    const T = gfx.three, model = gfx.asset('hifi/railings.glb'), g = gfx.group(), spots = [];
    model.updateMatrixWorld(true);
    parts ??= build(T, model);
    for (const side of [-1, 1]) for (let z = PITCH / 2; z < length; z += PITCH) spots.push(new T.Matrix4().makeTranslation(side * (lanes.roadHalf + 0.5), 0, z).multiply(parts.fit));
    model.traverse((n) => { if (n.isMesh) g.add(instanced(T, n.geometry, paint(gfx, n.material), spots.map((m) => m.clone().multiply(n.matrixWorld)))); });
    return { object: g };
  },
};

// fit: the model's units to metres, centred, its base at y = 0, the section PITCH long and HEIGHT tall (its thickness scaled with the height).
function build(T, model) {
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3()), s = HEIGHT / size.y;
  const fit = new T.Matrix4().makeScale(s, s, PITCH / size.z).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
  return { fit };
}
