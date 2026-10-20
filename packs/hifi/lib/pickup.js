// The overlay every HiFi pickup shares: the generated model in public/hifi/<id>.glb, fitted to the 0.8 m sphere the shipped orb fills
// (radius 0.4, centred 0.9 m above the road), glossy, under the shipped ground shadow. Fitted once from the first copy; every pickup
// after that shares the paint. The world spins the group about y every frame (src/world.js), so the model's yaw sits on the model.
import { gloss, glowMap, painter } from './paint.js';

const SPHERE = { r: 0.4, y: 0.9 };
// Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling): metalness off, the roughness map stays.
// ponytail: calibration knobs — a satin coat and reflections below look.js's REFLECT (was 1 / 0.15 at 0.85; Caedon, board 29 pick 4):
// the full coat mirrored the sun ahead and blew the jug out into a white column at dusk.
const PAINT = { metalness: 0, metalnessMap: null, clearcoat: 0.3, clearcoatRoughness: 0.4 }, REFLECT = 0.3;

// yaw: turns the model's front (+x) toward the player (-z). glow: { test, intensity } lights the texels `test` accepts, in their own shape.
export function pickupOverlay(id, { yaw, glow }) {
  const path = `hifi/${id}.glb`;
  const paint = painter((T, m) => { // generated material -> a copy of it under a glossy clearcoat, its lit texels glowing
    const lit = glow && glowMap(T, m.map, glow.test);
    const p = gloss(T, m, lit ? { ...PAINT, emissive: '#ffffff', emissiveMap: lit, emissiveIntensity: glow.intensity } : PAINT);
    p.userData.reflect = REFLECT; // on the copied userData: setValues would replace it, and with it the shared flag
    return p;
  });
  let parts; // { scale, offset }, measured from the first copy
  return {
    assets: [path],
    createView(gfx) {
      const T = gfx.three, model = gfx.asset(path);
      model.rotation.y = yaw;
      parts ??= build(T, model);
      model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
      model.scale.setScalar(parts.scale);
      model.position.copy(parts.offset);
      return { object: gfx.group(gfx.blobShadow(0.3), model) };
    },
  };
}

function build(T, model) {
  model.updateMatrixWorld(true);
  const c = new T.Box3().setFromObject(model).getCenter(new T.Vector3()), v = new T.Vector3();
  let far = 0; // the farthest vertex from the centre is the model's own bounding sphere: tighter than its box's corners, which would shrink a round token
  model.traverse((n) => {
    if (n.isMesh) for (let i = 0, p = n.geometry.attributes.position; i < p.count; i++) far = Math.max(far, v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).distanceTo(c));
  });
  const scale = SPHERE.r / far;
  return { scale, offset: new T.Vector3(-c.x * scale, SPHERE.y - c.y * scale, -c.z * scale) };
}
