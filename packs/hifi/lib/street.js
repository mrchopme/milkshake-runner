import { box, instanced } from './shapes.js';
import { material } from './materials.js';
// ponytail: calibration knobs, metres (board 15)
export const KERB = 0.18, WALK = 3, DASH = { w: 0.12, len: 3, every: 6 }, CROSS = { width: 12, stripe: 0.6 };

export function street(gfx, { z0, length, lanes }, style, cross) {
  const T = gfx.three, g = gfx.group(), half = lanes.roadHalf, zc = z0 + length / 2;
  const std = (key, color, rough) => material(`${style.id}/${key}`, () => new T.MeshStandardMaterial({ color, roughness: rough }));
  const road = box(T, half * 2, 0.1, length, std('road', style.road, 0.85), 0, -0.05, zc);
  road.userData.road = true;
  g.add(road);
  for (const side of [-1, 1]) g.add(box(T, WALK, KERB, length, std('walk', style.walk, 0.9), side * (half + WALK / 2), KERB / 2, zc));
  const dashes = [];
  for (let z = z0; z + DASH.len <= z0 + length; z += DASH.every) for (const x of [lanes.width / 2, -lanes.width / 2]) {
    if (cross && z + DASH.len > cross.z && z < cross.z + CROSS.width) continue; // no lane dashes across the crosswalk
    dashes.push(new T.Matrix4().makeTranslation(x, 0.011, z + DASH.len / 2));
  }
  const paint = std('paint', style.paint, 0.6);
  g.add(instanced(T, new T.BoxGeometry(DASH.w, 0.02, DASH.len), paint, dashes));
  if (cross) { // zebra stripes across the road at both edges of the cross street
    const stripes = [];
    for (const zEdge of [cross.z + 1, cross.z + CROSS.width - 1]) for (let x = -half + 0.4; x < half - 0.3; x += CROSS.stripe * 2) stripes.push(new T.Matrix4().makeTranslation(x + CROSS.stripe / 2, 0.012, zEdge));
    g.add(instanced(T, new T.BoxGeometry(CROSS.stripe, 0.02, 2), paint, stripes));
  }
  return g;
}
