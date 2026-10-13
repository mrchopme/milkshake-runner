// HiFi taxi: the generated toy taxi in public/hifi/taxi.glb, fitted to the shipped taxi's footprint (content/obstacles/taxi.js),
// so it still reads "change lane". Built once from the first copy; every taxi after that shares the paint and the sign plate.
import { gloss, glowMap } from '../lib/paint.js';

const FOOTPRINT = { w: 2.0, d: 4.0 }; // the shipped taxi's box, metres
const YAW = -Math.PI / 2;             // ponytail: calibration knob — turns the generated model so its rear faces the player (-z)
const SIGN = { w: 0.46, h: 0.14, d: 0.2, y: 0.02, z: 0 }; // ponytail: calibration knob — the glow plate inside the roof sign
const LAMP_GLOW = 5;                  // ponytail: calibration knob — the model's own red tail lamps glow this bright, past the looks' bloom threshold

// The red tail-lamp texels: the paint's emissive map keeps only these, so the lamps glow in their own shape (boxes laid over
// them read as stickers).
export const isLamp = (r, g, b) => r > 150 && g < 90 && b < 90;

let parts; // { scale, offset, paint, lights }, measured from the first copy

export default {
  kind: 'obstacle', id: 'taxi', assets: ['hifi/taxi.glb'],
  createView(gfx) {
    const model = gfx.asset('hifi/taxi.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx, model);
    model.traverse((n) => { if (n.isMesh) n.material = parts.paint.get(n.material) ?? n.material; });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model, ...parts.lights.map((l) => l.clone())) };
  },
};

function build(gfx, model) {
  const T = gfx.three;
  const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
  const scale = Math.min(FOOTPRINT.w / size.x, FOOTPRINT.d / size.z);
  const offset = new T.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
  const paint = new Map(); // generated material -> the same maps under a glossy clearcoat
  model.traverse((n) => {
    if (!n.isMesh || paint.has(n.material)) return;
    const m = n.material, lamps = glowMap(T, m.map, isLamp);
    paint.set(m, gloss(T, m, { clearcoat: 1, clearcoatRoughness: 0.12, emissive: lamps ? '#ffffff' : '#000000', emissiveMap: lamps, emissiveIntensity: LAMP_GLOW }));
  });
  const h = size.y * scale;
  const sign = new T.Mesh(new T.BoxGeometry(SIGN.w, SIGN.h, SIGN.d), new T.MeshStandardMaterial({ color: '#000000', emissive: '#fff4c2', emissiveIntensity: 2.5 }));
  sign.position.set(0, h + SIGN.y - SIGN.h / 2, SIGN.z);
  sign.userData.shared = true; // every taxi uses it; gfx.dispose leaves it alone
  return { scale, offset, paint, lights: [sign] };
}
