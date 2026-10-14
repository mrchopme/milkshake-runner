// HiFi barrier_low: the generated jersey barrier in public/hifi/barrier_low.glb, fitted to the shipped box (content/obstacles/barrier_low.js).
// The model is stout (0.98 long by 0.42 deep, the box 2.2 by 0.4), so the depth caps one copy at 0.93 m: two in a row, one per half of the
// box, fill the 2.2 m hit zone instead of leaving 0.6 m of invisible barrier either side of a lone one.
import { fitBox } from '../lib/fit.js';
import { gloss, painter } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the model's long side runs along z and its face looks +x; +π/2 turns the face to the player (-z) and the long side across the lane
// metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
const paint = painter((T, m) => gloss(T, m, { clearcoat: 0.6, clearcoatRoughness: 0.2, metalness: 0, metalnessMap: null }));

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'obstacle', id: 'barrier_low', assets: ['hifi/barrier_low.glb'],
  createView(gfx) {
    const T = gfx.three, row = [gfx.asset('hifi/barrier_low.glb'), gfx.asset('hifi/barrier_low.glb')];
    for (const m of row) m.rotation.y = YAW;
    parts ??= fitBox(T, row[0], { ...this.box, w: this.box.w / 2 }, this.avoid !== 'lane');
    row.forEach((m, i) => {
      m.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
      m.scale.setScalar(parts.scale);
      m.position.copy(parts.offset).x += (i - 0.5) * (this.box.w / 2);
    });
    return { object: gfx.group(...row) };
  },
};
