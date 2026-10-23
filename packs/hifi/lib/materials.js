import { freeWith } from './paint.js';
// One material per key for the whole session, flagged shared: dropping a chunk never frees it, and every chunk draws with it.
// One that wears a loaded image passes it as `map` and is kept per that texture instead (a WeakMap, as painter keeps paints) and
// freed with it: a file reloaded after assets.release is a new texture, so it gets a new material and the released one goes.
const cache = new Map(), worn = new WeakMap();
export function material(key, make, map) {
  if (map && !worn.has(map)) worn.set(map, new Map());
  const c = map ? worn.get(map) : cache;
  if (!c.has(key)) { const m = make(); m.userData.shared = true; c.set(key, map ? freeWith(map, m) : m); }
  return c.get(key);
}
