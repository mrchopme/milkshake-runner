import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { lookState, cascadeHook, ringWrap, lookFog } from '../src/look.js';
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

test('under a look the fog starts at 120 m and fades to the level sky paled 45% toward white; no look keeps the low-fi fog (Caedon, board 19)', () => {
  const sky = '#c98bd8', far = 260 - 0.35 * 160, lowFi = () => new THREE.Fog(sky, far * 0.3, far); // uptown's, as engine.setSky makes it
  const c = new THREE.Color(sky), fog = lookFog(lowFi(), lookState({ sky, look: {} }));
  assert.equal(fog.near, 120);
  assert.equal(fog.far, far, 'the far, the streaming edge, stays');
  for (const k of ['r', 'g', 'b']) assert.ok(Math.abs(fog.color[k] - (c[k] + (1 - c[k]) * 0.45)) < 1e-9, `${k}: ${fog.color[k]} is not 45% of the way from ${c[k]} to white`);
  assert.ok(lookFog(fog, lookState({ sky, look: {} })).color.equals(fog.color), 'applied twice, the same pale');
  const plain = lookFog(lowFi(), lookState({ sky, fog: 0.35 }));
  assert.ok(plain.near === far * 0.3 && plain.far === far && plain.color.equals(c), 'no look: the low-fi fog as it was');
  assert.equal(lookFog(new THREE.Fog(sky, 30, 100), lookState({ sky, look: {} })).near, 30, 'a fog too thick to start at 120 m keeps its own near');
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
  assert.match(checkLook({ skyline: 'hifi/sky.glb' }).join(), /look.skyline must be one or two image paths/, 'an asset, but a model');
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

test('a look may set its skyline rings\' target heights (far, near), checked like the rest; without one they stay 90 and 80 m', () => {
  assert.deepEqual(lookState({ sky: '#9fd3f5', look: {} }).skylineHeight, [90, 80]);
  assert.deepEqual(lookState({ sky: '#9fd3f5', look: { skylineHeight: [140, 120] } }).skylineHeight, [140, 120]);
  assert.deepEqual(checkLook({ skylineHeight: [140, 120] }), []);
  for (const bad of [90, [90], [90, 80, 70], [90, '80'], [5, 80], [90, 900], [NaN, 80]]) assert.match(checkLook({ skylineHeight: bad }).join(), /look.skylineHeight must be \[far, near\], each 10 to 400 metres/, String(bad));
});

test('each skyline ring turns a quarter of one image, so an image\'s middle faces the avenue and no mirror seam does', () => {
  // the strips are tiled A|mirror(A): a mirror axis wherever u × repeats is a multiple of 0.5. createLook needs a WebGL
  // renderer, so this turns three's own cylinder, built as the ring is, by the turn apply() gives it (RING.yaw is 0)
  for (const [height, repeats] of [[20, 1], [196, 2]]) {
    const wrap = ringWrap(360, 2048, height, 90);
    assert.equal(wrap.repeats, repeats);
    assert.equal(wrap.turn, Math.PI / (2 * repeats));
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(360, 360, 1, 96, 1, true));
    ring.rotation.y = wrap.turn; ring.updateMatrixWorld();
    const p = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv, v = new THREE.Vector3();
    let nearest = Infinity;
    for (let i = 0; i < p.count; i++) {
      const u2 = uv.getX(i) * repeats * 2;
      if (Math.abs(u2 - Math.round(u2)) > 1e-6) continue;
      v.fromBufferAttribute(p, i).applyMatrix4(ring.matrixWorld);
      nearest = Math.min(nearest, Math.abs(Math.atan2(v.x, v.z))); // radians off the avenue's end (+z)
    }
    assert.ok(Math.abs(nearest - wrap.turn) < 1e-6, `${repeats} repeat(s): the nearest mirror axis ${nearest.toFixed(4)} rad off the avenue, a quarter image is ${wrap.turn.toFixed(4)}`);
  }
});
