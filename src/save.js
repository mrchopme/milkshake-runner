const KEY = 'milkshake-runner';
const fresh = () => ({ best: {}, completed: [] });

// Storage can be missing, blocked (private mode) or corrupt: the game must still play.
export function loadSave(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY) || '{}');
    const s = { ...fresh(), ...(data && typeof data === 'object' ? data : {}) };
    if (!Array.isArray(s.completed)) s.completed = [];
    if (!s.best || typeof s.best !== 'object') s.best = {};
    return s;
  } catch {
    return fresh();
  }
}
export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* progress just is not kept */ }
}
export function recordRun(save, id, jugs) { save.best[id] = Math.max(save.best[id] || 0, jugs); return save; }
