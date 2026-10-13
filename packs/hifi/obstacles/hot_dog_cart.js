// HiFi hot_dog_cart: the generated cart in public/hifi/hot_dog_cart.glb, fitted to the shipped box (content/obstacles/hot_dog_cart.js).
// It is a jump obstacle, so the umbrella stays inside the box's 1.0 m: the height sets the scale, and the cart fills only part of the footprint.
import { fitBox } from '../lib/fit.js';
import { gloss } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the model is longer along z (0.79) than x (0.67), its front +x; +π/2 turns its long side across the lane, broadside to the player (-z)

let parts; // { scale, offset, paint }, measured from the first copy

export default {
  kind: 'obstacle', id: 'hot_dog_cart', assets: ['hifi/hot_dog_cart.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/hot_dog_cart.glb');
    model.rotation.y = YAW;
    parts ??= build(T, model, this.box, this.avoid !== 'lane');
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
