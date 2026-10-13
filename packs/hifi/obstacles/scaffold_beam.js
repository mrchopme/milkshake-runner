// HiFi scaffold_beam: the generated scaffold in public/hifi/scaffold_beam.glb, fitted to the shipped box (content/obstacles/scaffold_beam.js).
// The box (y 1.2 to 1.6) is only the plank's band, so the frame is fitted to the column from the road up to the box top: its posts stand on
// the road, the plank's underside lands on the box's bottom (1.21 m) and the post caps on its top. Under the plank is open: Milkshake slides there.
import { fitBox } from '../lib/fit.js';
import { gloss } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the model's long side runs along z and its face looks +x; +π/2 turns the face to the player (-z) and the long side across the lane

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
