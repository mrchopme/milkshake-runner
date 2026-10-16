import { test } from 'node:test';
import assert from 'node:assert/strict';
import shield from '../packs/hifi/pickups/shield.js';
import * as gfx from '../src/gfx.js';
import { checkPickup } from './hifi-pickups.js';

// the badge: 0.277 x 0.98 x 0.848 m, flat along x (task-23-models.md)
checkPickup('shield', shield, new gfx.three.BoxGeometry(0.277, 0.98, 0.848));

test('the HiFi shield keeps Task 17\'s worn bubble beside its new pickup view', () => {
  assert.equal(typeof shield.createWorn, 'function');
  const worn = shield.createWorn(gfx);
  assert.ok(worn.object.isMesh && typeof worn.update === 'function' && typeof worn.dispose === 'function');
  worn.dispose();
});
