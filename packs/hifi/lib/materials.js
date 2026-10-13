// One material per key for the whole session, flagged shared: dropping a chunk never frees it, and every chunk draws with it.
const cache = new Map();
export function material(key, make) {
  if (!cache.has(key)) { const m = make(); m.userData.shared = true; cache.set(key, m); }
  return cache.get(key);
}
