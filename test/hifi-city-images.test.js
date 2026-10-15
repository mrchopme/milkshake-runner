import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt } from '../src/assets.js';
import { facadeMaterial, SHOP_H } from '../packs/hifi/lib/facade.js';
import { signs, SIGN_FILES } from '../packs/hifi/lib/signs.js';
import { FACADE_X } from '../packs/hifi/lib/street.js';
import { CORNICE } from '../packs/hifi/lib/buildings.js';
import { WATERFRONT } from '../packs/hifi/lib/bridge.js';
import bridge from '../packs/hifi/themes/bridge.js';

// Task 24: the city on its generated images (public/hifi/city). A file of its own: it fills the asset cache with stand-ins,
// which would change what city.test.js's placeholder tests see.
const T = gfx.three, lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const files = (dir, name, n) => Array.from({ length: n }, (_, i) => `hifi/city/${dir}/${name}-0${i + 1}.webp`);
const STREET = await Promise.all(['downtown', 'midtown', 'uptown'].map(async (id) => [(await import(`../packs/hifi/themes/${id}.js`)).default, (await import(`../content/themes/${id}.js`)).default]));
const chunk = ([hifi, shipped], seed) => { const theme = { ...shipped, ...hifi }; return hifi.createChunk.call(theme, gfx, { z0: 0, length: 120, lanes, rng: rng(seed), theme }); };
const stand = new Map(); // a stand-in texture per file, adopted as if it had loaded
const load = (p) => { if (!stand.has(p)) stand.set(p, new T.Texture()); adopt(p, stand.get(p)); };
const pathOf = (map) => [...stand].find(([, t]) => t === map)?.[0];

test('each street theme lists its five facade tiles, four storefronts, every sign image it draws and its far and near skylines', () => {
  const SIGNS = fileURLToPath(new URL('../public/hifi/city/signs/', import.meta.url));
  assert.deepEqual(Object.values(SIGN_FILES).flat().sort(), readdirSync(SIGNS).map((f) => `hifi/city/signs/${f}`).sort(), 'every generated sign, and nothing else');
  for (const [hifi] of STREET) {
    assert.ok(!hifi.assets.some((p) => p.startsWith('hifi/city/signs/led-')), `${hifi.id} loads no LED face`);
    assert.deepEqual(hifi.look.skyline, [[1, 2, 3, 4].map((n) => `hifi/city/sky/${hifi.id}-near-${n}.webp`)], `${hifi.id}: the near ring's four images, no far ring`);
    for (const p of [...files('facades', hifi.id, 5), ...files('shops', hifi.id, 4), ...Object.values(SIGN_FILES).flat(), ...hifi.look.skyline.flat()]) assert.ok(hifi.assets.includes(p), `${hifi.id} lists ${p}`);
  }
  assert.deepEqual(bridge.look.skyline, files('sky', 'bridge', 2));
  assert.deepEqual(WATERFRONT.facades, files('facades', 'downtown', 5), 'the waterfront wears downtown\'s tiles');
  for (const p of [...WATERFRONT.facades, ...bridge.look.skyline]) assert.ok(bridge.assets.includes(p), `bridge lists ${p}`);
});

test('the facades and storefronts wear their theme\'s own tiles once loaded, and a missing tile falls back to the placeholder', () => {
  for (const theme of STREET) {
    const id = theme[0].id, tiles = [...files('facades', id, 5), ...files('shops', id, 4)], missing = tiles[2];
    const worn = () => { const mats = new Set(); for (let seed = 1; seed <= 8; seed++) chunk(theme, seed).traverse((n) => { if (n.userData.building && n.material.map) mats.add(n.material); }); return [...mats]; };
    tiles.filter((p) => p !== missing).forEach(load);
    const before = worn().map((m) => m.map);
    assert.ok(before.some((m) => m.isDataTexture), `${id}: ${missing} is missing, so its facades wear the placeholder`);
    assert.deepEqual(before.filter((m) => !m.isDataTexture).map(pathOf).sort(), tiles.filter((p) => p !== missing).sort(), `${id}: the loaded tiles`);
    load(missing);
    const after = worn();
    assert.deepEqual(after.map((m) => pathOf(m.map)).sort(), [...tiles].sort(), `${id}: every facade and storefront on its own tile, no placeholder`);
    for (const m of after.filter((x) => pathOf(x.map).includes('/facades/'))) assert.equal(m.emissiveIntensity, id === 'uptown' ? 0.8 : 0, `${id}: windows lit at dusk only`);
  }
});

test('a facade tile\'s own glass is glossy, only its warm lit panes glow (and only at dusk), its wall stays matte and dark, and without a canvas the tile is plain', () => {
  const path = 'hifi/test/t24-tile.webp', map = new T.Texture({});
  map.colorSpace = T.SRGBColorSpace;
  adopt(path, map);
  const tile = (id, lit) => facadeMaterial(gfx, { id, lit, facades: [path], buildings: { colors: ['#888888'] } }, 0);
  const plain = tile('t24-node', 0.8); // Node has no OffscreenCanvas
  assert.ok(plain.map === map && !plain.roughnessMap && plain.roughness === 0.6 && plain.emissive.getHex() === 0, 'no mask: a plain matte tile, nothing glows');
  const saved = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class { // sky-blue glass, a warm lit pane, brick, pale stone; each canvas keeps what was drawn on it
    getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([150, 190, 235, 255, 250, 200, 110, 255, 150, 90, 60, 255, 220, 190, 150, 255]) }), putImageData: (img) => { this.px = [...img.data]; } }; }
  };
  try {
    const dusk = tile('t24-dusk', 0.8), day = tile('t24-day', 0);
    assert.equal(dusk.map, map);
    assert.deepEqual(dusk.emissiveMap.image.px, [0, 0, 0, 255, 250, 200, 110, 255, 0, 0, 0, 255, 0, 0, 0, 255], 'only the lit pane glows, in its own colour');
    assert.deepEqual(dusk.roughnessMap.image.px, [31, 31, 31, 255, 31, 31, 31, 255, 153, 153, 153, 255, 153, 153, 153, 255], 'glass (blue or lit) 0.12, brick and stone 0.6');
    assert.ok(dusk.roughness === 1 && dusk.roughnessMap.colorSpace === T.NoColorSpace, 'the roughness map is data, read as it is');
    assert.ok(dusk.emissive.getHex() === 0xffffff && dusk.emissiveIntensity === 0.8, 'lit at the theme\'s level');
    assert.ok(day.emissiveMap === null && day.emissive.getHex() === 0 && day.roughnessMap, 'a daytime theme builds no glow mask, only the gloss');
    assert.ok([dusk.emissiveMap, dusk.roughnessMap].every((t) => t.wrapS === T.RepeatWrapping && t.wrapT === T.RepeatWrapping), 'the masks repeat with the tile');
  } finally { globalThis.OffscreenCanvas = saved; }
});

test('sign stacks are colour blocks and posters, blade signs hang over the storefronts: a block takes its drawn size, a poster or blade its image\'s aspect', () => {
  // the teaser's big flat colour panels (Caedon, 2026-10-14, board 18): unlit-bright, never blooming or blinking
  const style = { signs: ['#ff3b3b', '#2f7cff'], ...SIGN_FILES, buildings: STREET[1][1].buildings }, cross = { z: 50 };
  const build = (seed) => signs(gfx, { z0: 0, length: 120 }, style, rng(seed), cross).children;
  const block = (n) => n.material.isMeshBasicMaterial;
  for (let seed = 1; seed <= 5; seed++) {
    const kids = build(seed);
    assert.ok(kids.length === 2 && kids.every((n) => !n.material.map), 'nothing loaded: colour blocks in bezels, and no blade signs');
  }
  Object.values(SIGN_FILES).flat().forEach(load);
  const KIND = { poster: SIGN_FILES.posters, blade: SIGN_FILES.blades }, ASPECT = { poster: 1024 / 573, blade: 688 / 1024 };
  const seen = new Set(), m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  for (let seed = 1; seed <= 20; seed++) {
    const kids = build(seed);
    assert.ok(kids.length <= 6, `seed ${seed}: ${kids.length} sign meshes`);
    for (const n of kids) {
      if (block(n)) {
        seen.add('block');
        assert.ok(!n.material.map && n.instanceColor && n.count > 0 && n.material.onBeforeCompile === T.Material.prototype.onBeforeCompile, 'a block wears its palette colour, no image, and does not blink');
        assert.ok(Math.max(n.material.color.r, n.material.color.g, n.material.color.b) < 1.6, 'a white block stays under every look\'s bloom threshold');
        for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); m.decompose(p, q, s); assert.ok(s.x >= 4 - 1e-6 && s.x <= 6 + 1e-6 && s.y >= 3 - 1e-6 && s.y <= 4.2 + 1e-6, `a block ${s.x.toFixed(2)} x ${s.y.toFixed(2)} m`); }
        continue;
      }
      const path = pathOf(n.material.map), kind = Object.keys(KIND).find((k) => KIND[k].includes(path));
      if (!path) { assert.ok(n.material.isMeshStandardMaterial && !n.material.map, 'only the bezels and the blocks wear no image'); continue; }
      seen.add(kind);
      for (let i = 0; i < n.count; i++) {
        n.getMatrixAt(i, m); m.decompose(p, q, s);
        assert.ok(Math.abs(s.x / s.y / ASPECT[kind] - 1) < 1e-6, `${kind}: ${s.x.toFixed(2)} x ${s.y.toFixed(2)}`); // instance matrices are float32
        if (kind !== 'blade') continue;
        assert.ok(p.z >= 0 && p.z <= 120 && (p.z < cross.z || p.z > cross.z + 12), `a blade at z ${p.z.toFixed(2)}: inside its chunk, never in the side street`);
        assert.ok(Math.abs(p.x) + s.x / 2 <= FACADE_X + 1e-9 && Math.abs(p.x) - s.x / 2 >= 4.5, `a blade at x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)}: over the sidewalk`); // under the lowest stack: the test below
        assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(q).z < -0.999, 'a blade faces the oncoming camera');
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['blade', 'block', 'poster']);
  for (const theme of STREET) for (const seed of [1, 2, 3]) { let n = 0; chunk(theme, seed).traverse((x) => { if (x.isMesh) n++; }); assert.ok(n <= 45, `${theme[0].id} seed ${seed}: ${n} meshes with every image loaded`); }
});

test('every blade sign hangs under the lowest sign stack\'s bezel', () => {
  // 400 chunks of stacks: the lowest bezel (a tall poster at the stack's lowest start) came up about once in 400 lowest stacks
  Object.values(SIGN_FILES).flat().forEach(load);
  const style = { signs: ['#ff3b3b'], ...SIGN_FILES, buildings: STREET[1][1].buildings }, m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  let bezel = Infinity, blade = -Infinity;
  for (let seed = 1; seed <= 400; seed++) for (const n of signs(gfx, { z0: 0, length: 120 }, style, rng(seed), { z: 50 }).children) {
    const isBezel = !n.material.map, isBlade = SIGN_FILES.blades.includes(pathOf(n.material.map));
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m); m.decompose(p, q, s);
      if (isBezel) bezel = Math.min(bezel, p.y - s.y / 2);
      if (isBlade) blade = Math.max(blade, p.y + s.y / 2);
    }
  }
  assert.ok(blade > 0 && blade < bezel, `the highest blade's top ${blade.toFixed(3)} m, the lowest bezel's bottom ${bezel.toFixed(3)} m`);
});

test('a sign stack stays under the cornice of the shortest facade its theme builds', () => {
  // the shortest facade: measured on the theme's own buildings (a facade wall's top at the facade line); the cornice under it
  // juts out past the panels, so a stack's top bezel stays below it
  Object.values(SIGN_FILES).flat().forEach(load);
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3();
  for (const theme of STREET) {
    let facade = Infinity, top = -Infinity;
    for (let seed = 1; seed <= 60; seed++) {
      chunk(theme, seed).traverse((n) => {
        if (!n.userData.building) return;
        const pos = n.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (Math.abs(Math.abs(v.x) - FACADE_X) < 1e-3 && v.y > SHOP_H + 1e-3) facade = Math.min(facade, v.y); }
      });
      const bezels = signs(gfx, { z0: 0, length: 120 }, { signs: ['#ff3b3b'], ...SIGN_FILES, buildings: theme[1].buildings }, rng(seed), { z: 50 }).children.at(-1);
      for (let i = 0; i < bezels.count; i++) { bezels.getMatrixAt(i, m); m.decompose(p, q, s); top = Math.max(top, p.y + s.y / 2); }
    }
    assert.ok(top <= facade - CORNICE.h + 1e-6, `${theme[0].id}: the highest bezel's top ${top.toFixed(2)} m, the shortest facade ${facade.toFixed(2)} m under its ${CORNICE.h} m cornice`);
  }
});
