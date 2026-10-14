// HiFi scaffold_beam: the redrawn scaffold in public/hifi/scaffold_beam.glb (a plank on two posts, nothing between them), fitted to the
// shipped box (content/obstacles/scaffold_beam.js). The box (y 1.2 to 1.6) is only the plank's band, so the model is fitted to the column
// from the road up to the box top: the feet stand on the road, the plank's top is the box top and its underside (1.35 m) is inside the box.
// Between the posts is open (1.04 m, 0.93 m between the feet): Milkshake slides through there.
import { fitBox } from '../lib/fit.js';
import { gloss } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the plank runs along z and the doorway between the posts faces +x; +π/2 turns the doorway to the player (-z) and the plank across the lane

let parts; // { scale, offset, paint }, measured from the first copy

export default {
  kind: 'obstacle', id: 'scaffold_beam', assets: ['hifi/scaffold_beam.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/scaffold_beam.glb');
    model.rotation.y = YAW;
    parts ??= build(T, model, { ...this.box, y: 0, h: this.box.y + this.box.h }, this.avoid !== 'lane');
    model.traverse((n) => { if (n.isMesh) n.material = parts.paint.get(n.material) ?? n.material; });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

function build(T, model, box, inside) {
  const { scale, offset } = fitBox(T, model, box, inside), paint = new Map();
  // metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
  model.traverse((n) => { if (n.isMesh && !paint.has(n.material)) paint.set(n.material, gloss(T, n.material, { clearcoat: 0.6, clearcoatRoughness: 0.2, metalness: 0, metalnessMap: null })); });
  return { scale, offset, paint };
}
