import { material } from './materials.js';
// Furniture and side-street vehicles. path: the generated model (Task 23 sets yaw, h and glow from the real file);
// until it is loaded, a code placeholder of the same height stands in. ponytail: calibration knobs.
export const KIT = {
  lamp: { path: 'hifi/furniture/lamp.glb', h: 6.5, yaw: 0, glow: null },
  lamp_double: { path: 'hifi/furniture/lamp_double.glb', h: 6.5, yaw: 0, glow: null },
  traffic_light: { path: 'hifi/furniture/traffic_light.glb', h: 5.5, yaw: 0, glow: null },
  hydrant: { path: 'hifi/furniture/hydrant.glb', h: 0.8, yaw: 0, glow: null },
  bench: { path: 'hifi/furniture/bench.glb', h: 0.9, yaw: 0, glow: null },
  bin: { path: 'hifi/furniture/bin.glb', h: 0.9, yaw: 0, glow: null },
  bin_box: { path: 'hifi/furniture/bin_box.glb', h: 1.0, yaw: 0, glow: null },
  planter: { path: 'hifi/furniture/planter.glb', h: 1.0, yaw: 0, glow: null },
  tree: { path: 'hifi/furniture/tree.glb', h: 6.0, yaw: 0, glow: null },
  newsstand: { path: 'hifi/furniture/newsstand.glb', h: 2.6, yaw: 0, glow: null },
  bus_shelter: { path: 'hifi/furniture/bus_shelter.glb', h: 2.7, yaw: 0, glow: null },
  subway: { path: 'hifi/furniture/subway.glb', h: 2.4, yaw: 0, glow: null },
  sedan: { path: 'hifi/vehicles/sedan.glb', h: 1.5, yaw: 0, glow: null },
  van: { path: 'hifi/vehicles/van.glb', h: 2.2, yaw: 0, glow: null },
  taxi: { path: 'hifi/taxi.glb', h: 2.08, yaw: -Math.PI / 2, glow: null },
};
// Code stand-ins until the generated models land, roughly the right size and colour: boxes { w along x, h, d along z (the
// way the piece faces: the road for furniture, ahead for a vehicle), y of the base, z offset, colour, glow }. The lamp's
// glow is its own head, never a plate laid over it. ponytail: calibration knobs.
const STAND = {
  lamp: [{ w: 0.18, h: 6.5, d: 0.18, color: '#3a3d48' }, { w: 0.35, h: 0.18, d: 0.9, y: 6.3, z: 0.45, color: '#fff1c4', glow: true }],
  traffic_light: [{ w: 0.25, h: 5.5, d: 0.25, color: '#2a2c34' }],
  hydrant: [{ w: 0.35, h: 0.8, d: 0.35, color: '#c8352e' }],
  bench: [{ w: 1.8, h: 0.9, d: 0.6, color: '#7a5636' }],
  bin: [{ w: 0.6, h: 0.9, d: 0.6, color: '#2f5d4a' }],
  tree: [{ w: 0.3, h: 2.5, d: 0.3, color: '#5b4330' }, { w: 2.4, h: 3.5, d: 1.8, y: 2.5, z: 0.3, color: '#3f8a4a' }],
  newsstand: [{ w: 2, h: 2.6, d: 1.2, color: '#2f5d4a' }],
  bus_shelter: [{ w: 3, h: 2.7, d: 1.4, color: '#8fa3b0' }],
  subway: [{ w: 2.6, h: 2.4, d: 1.6, color: '#2f5d4a' }],
  sedan: [{ w: 1.8, h: 1.5, d: 4.2, color: '#5c6f8f' }],
  van: [{ w: 2, h: 2.2, d: 4.8, color: '#d9d9de' }],
  taxi: [{ w: 1.9, h: 2.08, d: 4.4, color: '#ffc21f' }],
};
export const placeholder = (kind) => (T) => (STAND[kind] ?? [{ w: 0.5, h: KIT[kind].h, d: 0.5, color: '#2f5d4a' }]).map((b) => ({
  geometry: new T.BoxGeometry(b.w, b.h, b.d).translate(0, (b.y ?? 0) + b.h / 2, b.z ?? 0),
  material: material(`kit/${b.color}${b.glow ? '/glow' : ''}`, () => new T.MeshStandardMaterial({ color: b.color, roughness: 0.6, ...(b.glow && { emissive: b.color, emissiveIntensity: 2 }) })),
  matrix: new T.Matrix4(),
}));
const parts = new Map(); // entry -> [{ geometry, material, matrix }]: the model fitted to its height, its base at y = 0, centred
export function kitParts(gfx, entry, placeholder) {
  if (parts.has(entry)) return parts.get(entry);
  const T = gfx.three;
  let model;
  try { model = gfx.asset(entry.path); } catch { return placeholder(T); } // not generated or not loaded yet: not cached, so the model replaces it once it lands
  model.rotation.y = entry.yaw;
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const s = entry.h / size.y, fit = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
  const list = [];
  model.traverse((n) => { if (n.isMesh) list.push({ geometry: n.geometry, material: n.material, matrix: fit.clone().multiply(n.matrixWorld) }); });
  parts.set(entry, list);
  return list;
}
