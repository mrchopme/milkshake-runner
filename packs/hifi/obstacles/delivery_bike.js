// HiFi delivery_bike: the generated cargo bike in public/hifi/delivery_bike.glb, fitted to the shipped box (content/obstacles/delivery_bike.js).
// A lane blocker: the footprint is kept, the rider may stand above the box. The swerve is the engine's (rules.js updateObstacle moves the
// view's x), so this overlay only replaces createView.
import { fitBox } from '../lib/fit.js';
import { gloss, painter, SATIN } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the model is long along x, its front (cargo box, rider's face) +x; +π/2 turns the front to the player (-z), the bike coming up the street
// metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
const paint = painter((T, m) => gloss(T, m, { ...SATIN, metalness: 0, metalnessMap: null }));

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'obstacle', id: 'delivery_bike', assets: ['hifi/delivery_bike.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/delivery_bike.glb');
    model.rotation.y = YAW;
    parts ??= fitBox(T, model, this.box, this.avoid !== 'lane');
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};
