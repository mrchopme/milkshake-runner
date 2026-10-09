// HiFi taxi: the generated toy taxi in public/hifi/taxi.glb, fitted to the shipped taxi's footprint (content/obstacles/taxi.js),
// so it still reads "change lane". Built once from the first copy; every taxi after that shares the paint and the sign plate.
const FOOTPRINT = { w: 2.0, d: 4.0 }; // the shipped taxi's box, metres
const YAW = -Math.PI / 2;             // ponytail: calibration knob — turns the generated model so its rear faces the player (-z)
const SIGN = { w: 0.46, h: 0.14, d: 0.2, y: 0.02, z: 0 }; // ponytail: calibration knob — the glow plate inside the roof sign
const LAMP_GLOW = 5;                  // ponytail: calibration knob — the model's own red tail lamps glow this bright, past the looks' bloom threshold

// RGBA bytes in, the red tail-lamp texels kept and everything else black: the paint's emissive map, so the lamps glow in
// their own shape (boxes laid over them read as stickers).
export function lampMask(px) {
  for (let i = 0; i < px.length; i += 4) if (!(px[i] > 150 && px[i + 1] < 90 && px[i + 2] < 90)) px[i] = px[i + 1] = px[i + 2] = 0;
  return px;
}

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
    const m = n.material, lamps = lampMap(T, m.map);
    paint.set(m, new T.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, aoMap: m.aoMap, roughness: m.roughness, metalness: m.metalness, clearcoat: 1, clearcoatRoughness: 0.12, emissive: lamps ? '#ffffff' : '#000000', emissiveMap: lamps, emissiveIntensity: LAMP_GLOW }));
  });
  const h = size.y * scale;
  const sign = new T.Mesh(new T.BoxGeometry(SIGN.w, SIGN.h, SIGN.d), new T.MeshStandardMaterial({ color: '#000000', emissive: '#fff4c2', emissiveIntensity: 2.5 }));
  sign.position.set(0, h + SIGN.y - SIGN.h / 2, SIGN.z);
  sign.userData.shared = true; // every taxi uses it; gfx.dispose leaves it alone
  return { scale, offset, paint, lights: [sign] };
}

// The colour map with only the lamps left in it, or null without a canvas to read it (Node tests, a map-less model).
function lampMap(T, map) {
  if (!map?.image || typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(1024, 1024), ctx = canvas.getContext('2d');
  ctx.drawImage(map.image, 0, 0, 1024, 1024);
  const img = ctx.getImageData(0, 0, 1024, 1024);
  lampMask(img.data);
  ctx.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(canvas);
  Object.assign(t, { flipY: map.flipY, colorSpace: map.colorSpace, channel: map.channel }); // read the same way as the map it came from
  return t;
}
