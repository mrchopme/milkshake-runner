import * as gfx from './gfx.js';

const cache = new Map();

// One view per character id per session. A level picks its character by id; the engine never names one.
export function loadCharacter(def) {
  if (!cache.has(def.id)) {
    cache.set(def.id, Promise.resolve().then(() => def.createView(gfx)).catch((err) => {
      console.warn(`character ${def.id} createView failed:`, err);
      return fallbackView(def);
    }));
  }
  return cache.get(def.id);
}

function fallbackView(def) {
  const object = gfx.group(gfx.box(def.width * 0.7, def.height, def.width * 0.5, '#ff00ff', 0, def.height / 2));
  return { object, update(run) { object.position.set(run.x, run.y, run.z); }, pose() {}, dispose() {} };
}
