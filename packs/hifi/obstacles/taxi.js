// HiFi taxi: the generated toy taxi in public/hifi/taxi.glb, fitted to the shipped taxi's footprint (content/obstacles/taxi.js),
// so it still reads "change lane". Fitted once from the first copy; every taxi after that shares the paint. Its roof sign is
// unlit, as the teaser's: the glowing plate it wore was a box laid over a light (Caedon, 2026-10-14, board 18).
import { gloss, glowMap, painter, REFLECT_PROP } from '../lib/paint.js';

const FOOTPRINT = { w: 2.0, d: 4.0 }; // the shipped taxi's box, metres
const YAW = -Math.PI / 2;             // ponytail: calibration knob — turns the generated model so its rear faces the player (-z)
const LAMP_GLOW = 5;                  // ponytail: calibration knob — the model's own red tail lamps glow this bright, past the looks' bloom threshold

// The red tail-lamp texels: the paint's emissive map keeps only these, so the lamps glow in their own shape (boxes laid over
// them read as stickers).
export const isLamp = (r, g, b) => r > 150 && g < 90 && b < 90;
// generated material -> a copy of it under a satin clearcoat, its red lamps lit, Tripo's random metal dropped (as the pickups and
// the cow do). ponytail: calibration knobs — clearcoat 0.2, roughness 0.6, reflections 0.3 (1 / 0.12 until Caedon's board 18, then
// 0.5 / 0.45 at look.js's 0.85 until his board 29 pick 4, 2026-10-20): the coat on the white roof sign caught the sun as a halo
const paint = painter((T, m) => {
  const lamps = glowMap(T, m.map, isLamp);
  const p = gloss(T, m, { clearcoat: 0.2, clearcoatRoughness: 0.6, metalness: 0, metalnessMap: null, emissive: lamps ? '#ffffff' : '#000000', emissiveMap: lamps, emissiveIntensity: LAMP_GLOW });
  p.userData.reflect = REFLECT_PROP; // on the copied userData: setValues would replace it, and with it the shared flag
  return p;
});

let parts; // { scale, offset }, measured from the first copy

export default {
  kind: 'obstacle', id: 'taxi', assets: ['hifi/taxi.glb'],
  createView(gfx) {
    const model = gfx.asset('hifi/taxi.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx, model);
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

function build(gfx, model) {
  const T = gfx.three;
  const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
  const scale = Math.min(FOOTPRINT.w / size.x, FOOTPRINT.d / size.z);
  return { scale, offset: new T.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale) };
}
