import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { buildRegistry } from '../src/registry.js';
import { resolveRules } from '../src/rules.js';
import { passable, rng } from '../src/generator.js';
import { ROAD_HALF } from '../src/world.js';
import { discover } from './helpers.js';

// Every registered module (shipped, Newark and the fixture pack) is called the way src/world.js calls it. A vibe-coded module that
// throws, returns no object, or declares a box its move cannot clear fails here, before anyone opens the game.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const registry = buildRegistry([...(await discover(here('../content/'))), ...(await discover(here('./fixtures/content/')))]);
const R = resolveRules();
const lanes = { count: 3, width: R.laneWidth, roadHalf: ROAD_HALF };
const needsDom = (e) => e instanceof ReferenceError && /\b(document|window|navigator|Path2D|OffscreenCanvas)\b/.test(e.message);
async function draws(t, make) {
  let view;
  try { view = await make(); } catch (e) { if (needsDom(e)) return t.skip('needs the DOM: checked in the browser, not here'); throw e; } // ponytail: Node has no canvas; a module that labels itself is only checked where one exists
  assert.ok(view && view.object && view.object.isObject3D, 'createView returns { object: an Object3D }');
  view.dispose?.();
}

for (const def of Object.values(registry.obstacle)) test(`obstacle "${def.id}" draws, and its box agrees with its move`, async (t) => {
  assert.equal(passable(def, R), def.avoid === 'jump' || def.avoid === 'slide', `avoid "${def.avoid}" with box ${JSON.stringify(def.box)}: a jump box stands on the ground and fits under a jump, a slide box leaves ${R.slideHeight} m to slide under, a lane or timing box does neither`);
  await draws(t, () => def.createView(gfx, { id: def.id, lane: 1, z: 120, moveTo: null, def }));
});
for (const def of Object.values(registry.pickup)) if (def.createView) test(`pickup "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx)));
for (const def of Object.values(registry.prop)) test(`prop "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx, { z: 120, length: def.length, lanes })));
for (const def of Object.values(registry.theme)) if (def.createChunk) test(`theme "${def.id}" builds a chunk`, (t) => draws(t, () => ({ object: def.createChunk(gfx, { z0: 0, length: 120, lanes, rng: rng(1), theme: def }) })));
for (const def of Object.values(registry.character)) test(`character "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx)));
