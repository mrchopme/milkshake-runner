import { safeCall } from './registry.js';
// A power-up's worn look (round 2): while its effect lasts, the pickup's createWorn view rides on the character.
export function wornLooks(registry, gfx) {
  const on = new Map(); // pickup id -> its view, or null when it has none or createWorn failed
  const drop = (id, view) => { view.object.removeFromParent(); if (view.dispose) safeCall(`pickup ${id} worn dispose`, () => view.dispose()); gfx.dispose(view.object); };
  return {
    update(run, parent) {
      for (const id of Object.keys(run.effects)) if (!on.has(id)) {
        const def = registry.pickup[id], view = def?.createWorn ? safeCall(`pickup ${id} createWorn`, () => def.createWorn(gfx), null) : null;
        on.set(id, view);
        if (view) parent.add(gfx.bend(view.object));
      }
      for (const [id, view] of on) if (!(id in run.effects)) { on.delete(id); if (view) drop(id, view); }
      for (const [id, view] of on) if (view?.update) safeCall(`pickup ${id} worn update`, () => view.update(run));
    },
    dispose() { for (const [id, view] of on) if (view) drop(id, view); on.clear(); },
  };
}
