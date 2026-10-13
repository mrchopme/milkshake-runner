import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import jug, { isMilk } from '../packs/hifi/pickups/jug.js';
import { checkPickup, paintOf } from './hifi-pickups.js';

// Node has no OffscreenCanvas: stand one in that hands glowMap four texels (milk, lavender cap, white, shadow) and records what it writes back.
const bytes = new Uint8ClampedArray([245, 235, 255, 255, 190, 165, 250, 255, 255, 255, 255, 255, 60, 50, 90, 255]);
let stored;
const saved = globalThis.OffscreenCanvas;
globalThis.OffscreenCanvas = class { getContext() { return { drawImage() {}, getImageData: () => ({ data: bytes }), putImageData: (img) => { stored = [...img.data]; } }; } };
after(() => { globalThis.OffscreenCanvas = saved; });

// the bottle: 0.496 x 0.979 x 0.497 m, round, so its farthest vertex is well inside its box's corners
checkPickup('jug', jug, new gfx.three.CylinderGeometry(0.248, 0.248, 0.979, 24), { glows: true });

test('the HiFi jug tells its milk from the lavender cap and base ring by texel', () => { // measured on public/hifi/jug.glb: body g 232+, lavender g 210 and below
  assert.deepEqual([[245, 235, 255], [255, 255, 255], [190, 165, 250], [225, 205, 250], [60, 50, 90]].map((c) => isMilk(...c)), [true, true, false, false, false]);
});

test('the HiFi jug glows from its own milky texels, not from a plate laid over it', () => {
  const p = paintOf(jug.createView(gfx));
  assert.deepEqual(stored, [245, 235, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255], 'the milk stays in the emissive map, the cap and the shadow go black');
  assert.ok(p.emissiveMap.isCanvasTexture && p.emissive.getHexString() === 'ffffff' && p.emissiveIntensity > 0, 'the paint is lit through that map');
});
