const KEY = 'milkshake-runner';
const fresh = () => ({ best: {}, completed: [], helpSeen: false });

// Storage can be missing, blocked (private mode, blocked cookies: even reading `localStorage` throws) or corrupt:
// the game must still play. The storage lookup therefore happens inside the try, not in a default parameter.
export function loadSave(storage) {
  try {
    const s = storage ?? globalThis.localStorage;
    const data = JSON.parse(s.getItem(KEY) || '{}');
    const save = { ...fresh(), ...(data && typeof data === 'object' ? data : {}) };
    if (!Array.isArray(save.completed)) save.completed = [];
    if (!save.best || typeof save.best !== 'object') save.best = {};
    if (typeof save.helpSeen !== 'boolean') save.helpSeen = false;
    return save;
  } catch {
    return fresh();
  }
}
export function writeSave(save, storage) {
  try { (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify(save)); } catch { /* progress just is not kept */ }
}
export function recordRun(save, id, jugs) { save.best[id] = Math.max(save.best[id] || 0, jugs); return save; }
