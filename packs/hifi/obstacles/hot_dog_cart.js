// HiFi hot_dog_cart: the generated cart in public/hifi/hot_dog_cart.glb, fitted to the shipped box (content/obstacles/hot_dog_cart.js).
// Caedon's exception to the inside-the-box rule (2026-10-13, "umbrella above the box"): the cart's BODY (wheels, cabinet, handles, lid)
// fills the jump box, and the umbrella's pole and canopy rise above it. The box, `avoid` and the hit timing stay the shipped ones.
import { gloss, painter, SATIN } from '../lib/paint.js';

const YAW = Math.PI / 2;  // ponytail: calibration knob — the model is longer along z (0.79) than x (0.67), its front +x; +π/2 turns its long side across the lane, broadside to the player (-z)
const BODY_H = 0.531;     // ponytail: calibration knob — model units above the wheels where the body ends (the lid is at 0.530) and the umbrella pole starts; measured on the GLB
// metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
const paint = painter((T, m) => gloss(T, m, { ...SATIN, metalness: 0, metalnessMap: null }));

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'obstacle', id: 'hot_dog_cart', assets: ['hifi/hot_dog_cart.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/hot_dog_cart.glb');
    model.rotation.y = YAW;
    parts ??= build(T, model, this.box);
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

// The body is every vertex up to BODY_H above the lowest one; it is scaled to the box as fitBox does the whole of a model (centred, on the box's y).
function build(T, model, box) {
  model.updateMatrixWorld(true);
  const cut = new T.Box3().setFromObject(model).min.y + BODY_H, body = new T.Box3(), v = new T.Vector3();
  model.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld); if (v.y <= cut) body.expandByPoint(v); }
  });
  const size = body.getSize(new T.Vector3()), c = body.getCenter(new T.Vector3());
  const scale = Math.min(box.w / size.x, box.d / size.z, box.h / size.y);
  return { scale, offset: new T.Vector3(-c.x * scale, (box.y ?? 0) - body.min.y * scale, -c.z * scale) };
}
