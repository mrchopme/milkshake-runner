// src/generator.js (stub; Task 5 writes the real module and keeps this export)
import { jumpHeight } from './rules.js';
// Can the player get past this obstacle in its own lane under these rules?
export function passable(def, rules) {
  if (def.avoid === 'timing') return true;
  const bottom = def.box.y ?? 0;
  if (def.avoid === 'jump') return bottom === 0 && def.box.h <= jumpHeight(rules);
  if (def.avoid === 'slide') return bottom >= rules.slideHeight;
  return false;
}
