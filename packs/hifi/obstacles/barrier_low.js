// HiFi barrier_low: the generated jersey barrier in public/hifi/barrier_low.glb, fitted to the shipped box (content/obstacles/barrier_low.js).
// One copy stretched per axis to fill the whole 2.2 x 0.9 x 0.4 m box (about 2.24 x 1.69 x 0.95 the model): scaled evenly, the stout model
// (0.98 long, 0.53 tall, 0.42 deep) came out 0.51 m tall, two copies knee-high against the 0.9 m box (Caedon, board 19, 2026-10-15: "too tiny").
// It stays inside the box, which is jumped (Caedon's rule).
import { gloss, painter } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the model's long side runs along z and its face looks +x; +π/2 turns the face to the player (-z) and the long side across the lane
// metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
const paint = painter((T, m) => gloss(T, m, { clearcoat: 0.3, clearcoatRoughness: 0.4, metalness: 0, metalnessMap: null }));

let fit; // { scale, offset }, measured from the first copy: the turned model's bounds stretched onto the box, centred, on the road

export default {
  kind: 'obstacle', id: 'barrier_low', assets: ['hifi/barrier_low.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/barrier_low.glb'), { w, h, d } = this.box;
    model.rotation.y = YAW;
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    if (!fit) {
      model.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
      fit = { scale: new T.Vector3(w / size.x, h / size.y, d / size.z), offset: new T.Vector3(-c.x, -b.min.y, -c.z) };
    }
    model.position.copy(fit.offset);
    const object = gfx.group(model);
    object.scale.copy(fit.scale); // in the group, so the stretch runs along the lane's axes whatever YAW turns the model
    return { object };
  },
};
