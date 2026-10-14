import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { lookState, cascadeHook, ringWrap } from '../src/look.js';
import { checkLook, checkModule } from '../src/registry.js';
import { createWorld } from '../src/world.js';
import { resolveRules } from '../src/rules.js';

const LOOK = { exposure: 1, sun: { color: '#fff3e0', intensity: 3 }, ambient: 0.5, env: 0.7, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 0.85, radius: 0.4 } };

test('a theme without a look keeps the low-fi path', () => {
  assert.equal(lookState({ sky: '#9fd3f5', fog: 0.3 }), null);
});

test('the cascades patch only lit materials, and CSM forgets each one when it is disposed', () => {
  const csm = { shaders: new Map(), setupMaterial(m) { this.shaders.set(m, null); } }; // CSM's own bookkeeping: a strong Map, by material
  gfx.hook.beforeBend = cascadeHook(csm);
  try {
    const lit = [THREE.MeshToonMaterial, THREE.MeshStandardMaterial, THREE.MeshPhysicalMaterial, THREE.MeshLambertMaterial, THREE.MeshPhongMaterial].map((T) => gfx.bendable(new T()));
    const unlit = [THREE.MeshBasicMaterial, THREE.SpriteMaterial].map((T) => gfx.bendable(new T()));
    assert.deepEqual([...csm.shaders.keys()], lit, 'every lit material, and no unlit one: a blob, a glow or a sprite has no lights chunk');
    lit[0].dispose();
    assert.ok(!csm.shaders.has(lit[0]) && csm.shaders.size === lit.length - 1, 'a disposed material leaves the Map, so spawned pickups and bubbles do not pile up');
    for (const m of [...lit, ...unlit]) m.dispose();
    assert.equal(csm.shaders.size, 0);
  } finally { gfx.hook.beforeBend = null; }
});

test('a look fills its defaults, and the sky fades to the level colour at the horizon', () => {
  const s = lookState({ sky: '#9fd3f5', look: { exposure: 1.2, bloom: { strength: 0.8 } } });
  assert.equal(s.exposure, 1.2);
  assert.deepEqual(s.bloom, { strength: 0.8, threshold: 0.85, radius: 0.4 });
  assert.deepEqual(s.sun, { color: '#ffffff', intensity: 3, dir: null });
  assert.equal(s.skyTop, '#9fd3f5', 'no skyTop: a flat sky in the level colour');
  assert.equal(s.skyBottom, '#9fd3f5');
  assert.equal(lookState({ sky: '#9fd3f5', look: LOOK }).skyTop, '#5ea9ec');
});

test('look values are checked on themes', () => {
  assert.deepEqual(checkLook(LOOK), []);
  assert.match(checkLook({ exposure: 9 }).join(), /look.exposure must be 0.2 to 3/);
  assert.match(checkLook({ sun: { color: 'warm' } }).join(), /look.sun.color must be a hex colour/);
  assert.match(checkLook({ sun: { tint: '#ffffff' } }).join(), /look.sun may only set color, intensity and dir/);
  assert.match(checkLook({ bloom: { glow: 1 } }).join(), /look.bloom may only set strength, threshold and radius/);
  assert.deepEqual(checkLook({ bloom: { threshold: 1.8 } }), [], 'the bloom reads the HDR scene, so lit white (about 2) can sit under a threshold past 1');
  assert.match(checkLook({ bloom: { threshold: 4 } }).join(), /look.bloom.threshold must be 0 to 3/);
  assert.match(checkLook({ fogColor: '#ffffff' }).join(), /look: unknown key "fogColor"/);
  assert.match(checkLook('bright').join(), /look must be an object/);
  const theme = { kind: 'theme', id: 'ari/sea', sky: '#9fd3f5', fog: 0.2, buildings: { colors: ['#ffffff'], minH: 5, maxH: 10 } };
  assert.equal(checkModule({ ...theme, look: LOOK }).length, 0);
  assert.match(checkModule({ ...theme, look: { env: 5 } }).join(), /look.env must be 0 to 3/);
});

test('the look follows the section theme, so a mid-level theme switch switches the look', () => {
  const base = { kind: 'theme', sky: '#000000', fog: 0.3, buildings: { colors: ['#000000'], minH: 1, maxH: 2 } };
  const registry = { obstacle: {}, pickup: {}, prop: {}, character: {}, ending: {}, theme: { lit: { ...base, id: 'lit', look: { exposure: 1.1 } }, plain: { ...base, id: 'plain' } } };
  const level = { id: 'w', length_m: 600, theme: { id: 'lit' }, obstacles: {}, density: { start: 0, end: 0 }, jugs: { per_100m: 0, powerups: [] }, sections: [{ from_m: 240, to_m: 480, theme: { id: 'plain' } }] };
  const world = createWorld(new THREE.Scene(), level, { registry, rules: resolveRules(), seed: 1, end: 600 });
  assert.equal(world.skyAt(10).id, 'lit');
  assert.deepEqual(world.skyAt(10).look, { exposure: 1.1 });
  assert.equal(world.skyAt(300).id, 'plain');
  assert.equal(world.skyAt(300).look, undefined);
  assert.equal(world.skyAt(500).id, 'lit');
  world.dispose();
});

test('opaque meshes cast and receive shadows; glows and blob shadows do not', () => {
  const g = gfx.bend(gfx.group(gfx.box(1, 1, 1, '#ffffff'), gfx.glow(0.5, '#ffffff'), gfx.blobShadow(0.5)));
  const [box, glow, blob] = g.children;
  assert.ok(box.castShadow && box.receiveShadow);
  assert.ok(!glow.castShadow && !glow.receiveShadow);
  assert.ok(!blob.castShadow && !blob.receiveShadow);
});

test('a look may name its skyline and the sun\'s direction', () => {
  assert.deepEqual(checkLook({ skyline: 'hifi/city/sky/downtown-01.webp', sun: { dir: [6, -16, 12] } }), []);
  assert.deepEqual(checkLook({ skyline: ['hifi/city/sky/downtown-01.webp', 'hifi/city/sky/downtown-02.webp'] }), []);
  assert.match(checkLook({ skyline: ['a.webp', 'b.webp', 'c.webp'] }).join(), /look.skyline must be one or two image paths/);
  assert.match(checkLook({ skyline: 'sky.jpg' }).join(), /look.skyline must be one or two image paths/);
  assert.match(checkLook({ sun: { dir: [0, 1, 0] } }).join(), /look.sun.dir must be \[x, y, z\] pointing down/);
  const s = lookState({ sky: '#9fd3f5', look: { skyline: 'hifi/city/sky/downtown-01.webp', sun: { dir: [1, -2, 1] } } });
  assert.deepEqual(s.skyline, ['hifi/city/sky/downtown-01.webp']);
  assert.deepEqual(s.sun.dir, [1, -2, 1]);
  assert.equal(lookState({ sky: '#000000', look: {} }).sun.dir, null);
});

test('a skyline wraps its ring a whole number of times in its own aspect, rounding the repeat count its target height asks for', () => {
  const lap = 2 * Math.PI * 360, near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
  const wide = ringWrap(360, 2048, 196, 90); // downtown's far strip: once round would stand 216 m tall
  assert.equal(wide.repeats, 2);
  near(wide.height / (lap / wide.repeats), 196 / 2048, 'each copy keeps the image\'s aspect');
  assert.equal(ringWrap(330, 2048, 301, 80).repeats, 4, 'downtown\'s near strip, 305 m once round: 3.81 repeats for 80 m rounds to four');
  assert.equal(ringWrap(360, 2048, 20, 90).repeats, 1, 'at least once round, however short the strip');
});
