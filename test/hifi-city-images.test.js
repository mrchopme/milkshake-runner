import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt, release } from '../src/assets.js';
import { facadeMaterial } from '../packs/hifi/lib/facade.js';
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
const SHOPS = { downtown: 3, midtown: 4, uptown: 4 }; // downtown's blank cyan 04 retired (Task 32, Caedon's board 23 pick)

test('each street theme lists its five facade tiles, its storefronts, every sign image it draws and its far and near skylines', () => {
  const SIGNS = fileURLToPath(new URL('../public/hifi/city/signs/', import.meta.url));
  assert.deepEqual(Object.values(SIGN_FILES).flat().sort(), readdirSync(SIGNS).map((f) => `hifi/city/signs/${f}`).sort(), 'every generated sign, and nothing else');
  for (const [hifi] of STREET) {
    assert.ok(!hifi.assets.some((p) => p.startsWith('hifi/city/signs/led-')), `${hifi.id} loads no LED face`);
    assert.deepEqual(hifi.look.skyline, [[1, 2, 3, 4].map((n) => `hifi/city/sky/${hifi.id}-near-${n}.webp`)], `${hifi.id}: the near ring's four images, no far ring`);
    assert.ok(!hifi.assets.includes(`hifi/city/shops/${hifi.id}-0${SHOPS[hifi.id] + 1}.webp`), `${hifi.id}: no retired storefront`);
    for (const p of [...files('facades', hifi.id, 5), ...files('shops', hifi.id, SHOPS[hifi.id]), ...Object.values(SIGN_FILES).flat(), ...hifi.look.skyline.flat()]) assert.ok(hifi.assets.includes(p), `${hifi.id} lists ${p}`);
  }
  assert.deepEqual(bridge.look.skyline, files('sky', 'bridge', 2));
  assert.deepEqual(WATERFRONT.facades, files('facades', 'downtown', 5), 'the waterfront wears downtown\'s tiles');
  for (const p of [...WATERFRONT.facades, ...bridge.look.skyline]) assert.ok(bridge.assets.includes(p), `bridge lists ${p}`);
});

test('the facades and storefronts wear their theme\'s own tiles once loaded, and a missing tile falls back to the placeholder', () => {
  for (const theme of STREET) {
    const id = theme[0].id, tiles = [...files('facades', id, 5), ...files('shops', id, SHOPS[id])], missing = tiles[2];
    const worn = () => { const mats = new Set(); for (let seed = 1; seed <= 8; seed++) chunk(theme, seed).traverse((n) => { if (n.userData.building && n.material.map) mats.add(n.material); }); return [...mats]; };
    tiles.filter((p) => p !== missing).forEach(load);
    const before = worn().map((m) => m.map);
    assert.ok(before.some((m) => m.isDataTexture), `${id}: ${missing} is missing, so its facades wear the placeholder`);
    assert.deepEqual(before.filter((m) => !m.isDataTexture).map(pathOf).sort(), tiles.filter((p) => p !== missing).sort(), `${id}: the loaded tiles`);
    load(missing);
    const after = worn();
    assert.deepEqual(after.map((m) => pathOf(m.map)).sort(), [...tiles].sort(), `${id}: every facade and storefront on its own tile, no placeholder`);
    for (const m of after) assert.equal(m.emissiveIntensity, 0, `${id}: without a canvas (Node) nothing glows; the window cells light from a canvas pass (Task 32)`);
  }
});

// Task 32 (board 23): lit windows are whole 2.5 x 3.5 m window cells, about `share` of them, each glowing only in its own pane
// texels (Caedon's glow rule), on a 512^2 canvas; a theme's wall tint multiplies the wall texels, never the glass.
test('a facade tile\'s own glass is glossy, its window cells glow from their own panes at the theme\'s share, its walls tint, and without a canvas the tile is plain', () => {
  const path = 'hifi/test/t24-tile.webp', map = new T.Texture({});
  map.colorSpace = T.SRGBColorSpace;
  adopt(path, map);
  const glow = { share: 0.35, color: '#ffe7b8', intensity: 0.55 }, tint = { mul: [0.5, 1, 1] };
  const tile = (id, extra) => facadeMaterial(gfx, { id, facades: [path], buildings: { colors: ['#888888'] }, ...extra }, 0);
  const plain = tile('t24-node', { glow, facadeTint: tint }); // Node has no OffscreenCanvas
  assert.ok(plain.map === map && map.anisotropy === 16 && !plain.roughnessMap && plain.roughness === 0.6 && plain.emissive.getHex() === 0 && plain.emissiveIntensity === 0, 'no canvas: the plain tile, matte and dark');
  const saved = globalThis.OffscreenCanvas, TEXELS = [[150, 190, 235], [250, 200, 110], [150, 90, 60], [220, 190, 150]]; // sky-blue glass, a warm lit pane, brick, pale stone, across each row
  globalThis.OffscreenCanvas = class { // each canvas keeps its size and what was drawn on it
    constructor(w, h) { Object.assign(this, { width: w, height: h }); }
    getContext() { return { drawImage() {}, getImageData: (x, y, w, h) => ({ data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : TEXELS[(i >> 2) % 4][i % 4])) }), putImageData: (img) => { this.px = img.data; } }; }
  };
  try {
    const dusk = tile('t24-dusk', { glow }), day = tile('t24-day', {}), skip = tile('t24-skip', { glow: { ...glow, skip: [0] } }), warm = tile('t24-tint', { facadeTint: tint });
    const px = dusk.emissiveMap.image.px, n = dusk.emissiveMap.image.width, cell = n / 8; // the tile 4 x 4 on the canvas, 2 x 2 cells a tile
    assert.equal(n, 512, 'a 512^2 glow canvas');
    let lit = 0;
    for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) {
      let on = 0;
      for (let y = cy * cell; y < (cy + 1) * cell; y++) for (let x = cx * cell; x < (cx + 1) * cell; x++) {
        const i = (y * n + x) * 4, kind = (y * n + x) % 4, u = (x % cell) / cell, v = (y % cell) / cell;
        if (px[i]) { on++; assert.ok(kind < 2 && u > 0.12 && u < 0.88 && v > 0.05 && v < 0.88, `a ${['glass', 'lit', 'brick', 'stone'][kind]} texel at ${u.toFixed(2)}, ${v.toFixed(2)} of its cell glows`); }
      }
      lit += on > 0;
    }
    assert.ok(Math.abs(lit / 64 - glow.share) < 0.15, `${lit} of 64 window cells lit, the theme's share ${glow.share}`);
    assert.ok(dusk.emissive.getHexString() === 'ffe7b8' && dusk.emissiveIntensity === 0.55, 'lit in the theme\'s colour at its level');
    assert.ok(dusk.emissiveMap.repeat.x === 0.25 && dusk.emissiveMap.wrapS === T.RepeatWrapping, 'the cells repeat every 4 x 4 tiles, not every tile');
    assert.deepEqual([...dusk.roughnessMap.image.px.slice(0, 16)], [31, 31, 31, 255, 31, 31, 31, 255, 153, 153, 153, 255, 153, 153, 153, 255], 'glass (blue or lit) 0.12, brick and stone 0.6');
    assert.ok(dusk.roughness === 1 && dusk.roughnessMap.colorSpace === T.NoColorSpace, 'the roughness map is data, read as it is');
    assert.ok(day.emissiveMap === null && day.emissive.getHex() === 0 && day.emissiveIntensity === 0 && day.roughnessMap, 'a theme without glow builds no glow mask, only the gloss');
    assert.ok(skip.emissiveMap === null && skip.emissiveIntensity === 0, 'a skipped tile never glows (uptown-02\'s fire escape)');
    assert.ok(warm.map !== map && warm.map.anisotropy === 16, 'the tint draws its own copy of the tile');
    assert.deepEqual([...warm.map.image.px.slice(0, 16)], [150, 190, 235, 255, 250, 200, 110, 255, 75, 90, 60, 255, 110, 190, 150, 255], 'the walls tinted, the glass and the lit pane untouched');
  } finally { globalThis.OffscreenCanvas = saved; }
});

// Task 32 (Caedon, board 23, 2026-10-15: "As prototyped, signs: none"; board 18's colour blocks withdrawn, "weird blocks of
// colour"): nothing above the shop band but a framed poster about every 75 m a side and a blade per ~100 m, each on a block of
// the block list, lit by its own texels. RELIEF: the furthest buildings.js's facade relief reaches off the wall (a ledge).
const RELIEF = 0.18, FRAME = 0.15, signsOf = (g) => g.children.find((n) => n.userData.signs);
const poses = (n) => Array.from({ length: n.count }, (_, i) => { const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); n.getMatrixAt(i, m); m.decompose(p, q, s); return { p, q, s }; });

test('nothing above the shop band but framed posters on their blocks and the odd blade, at the theme\'s rates, lit by their own texels', () => {
  Object.values(SIGN_FILES).flat().forEach(load);
  const SEEDS = 40, KIND = { poster: SIGN_FILES.posters, blade: SIGN_FILES.blades }, ASPECT = { poster: 1024 / 573, blade: 688 / 1024 };
  for (const theme of STREET) {
    const id = theme[0].id, count = { poster: 0, blade: 0 };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = chunk(theme, seed), { blocks, cross } = g.userData, kids = signsOf(g).children, at = `${id} seed ${seed}`;
      let meshes = 0; g.traverse((x) => { if (x.isMesh) meshes++; });
      assert.ok(meshes <= 45, `${at}: ${meshes} meshes`);
      assert.ok(kids.length <= 5 && kids.every((n) => n.isInstancedMesh && n.material.isMeshStandardMaterial && !n.instanceColor), `${at}: ${kids.length} sign meshes, no colour blocks`);
      const frames = kids.filter((n) => !n.material.map).flatMap(poses), perSide = { [-1]: [], [1]: [] };
      for (const n of kids.filter((x) => x.material.map)) {
        const kind = Object.keys(KIND).find((k) => KIND[k].includes(pathOf(n.material.map)));
        assert.ok(kind, `${at}: a sign wears one of the generated images`);
        assert.ok(n.material.emissiveMap === n.material.map && n.material.emissiveIntensity === (id === 'uptown' ? 0.6 : 0.2), `${at}: a ${kind} glows from its own texels, 0.2 by day, 0.6 at dusk`);
        for (const { p, q, s } of poses(n)) {
          count[kind]++;
          const side = Math.sign(p.x), half = kind === 'poster' ? s.x / 2 + FRAME : 0, b = blocks.find((k) => k.side === side && p.z - half >= k.z0 - 1e-6 && p.z + half <= k.z1 + 1e-6);
          assert.ok(Math.abs(s.x / s.y / ASPECT[kind] - 1) < 1e-5, `${at}: a ${kind} ${s.x.toFixed(2)} x ${s.y.toFixed(2)}, its image's aspect`);
          assert.ok(b, `${at}: a ${kind} at z ${p.z.toFixed(2)} stands on one block, never across a gap`);
          assert.ok(p.z >= 0 && p.z <= 120 && (!cross || p.z < cross.z || p.z > cross.z + 12), `${at}: a ${kind} at z ${p.z.toFixed(2)}, inside its chunk and out of the side street`);
          assert.ok(p.y - s.y / 2 >= 4.5, `${at}: a ${kind}'s bottom ${(p.y - s.y / 2).toFixed(2)} m, over the 4.5 m line`);
          if (kind === 'blade') {
            assert.ok(p.y - s.y / 2 >= 6 && p.y + s.y / 2 <= 9 && Math.abs(s.x - 1.4) < 1e-5, `${at}: a 1.4 m blade from ${(p.y - s.y / 2).toFixed(2)} to ${(p.y + s.y / 2).toFixed(2)} m`);
            assert.ok(Math.abs(p.x) - s.x / 2 >= 4.5 && Math.abs(p.x) + s.x / 2 <= FACADE_X, `${at}: a blade at x ${p.x.toFixed(2)}, over the sidewalk`);
            assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(q).z < -0.999, `${at}: a blade faces the oncoming camera`);
            continue;
          }
          perSide[side].push(p.z);
          assert.ok(p.y >= 7 && p.y <= 10, `${at}: a poster hung at ${p.y.toFixed(2)} m`);
          assert.ok(p.y + s.y / 2 + FRAME <= Math.min(b.setAt, b.h) - CORNICE.h + 1e-6, `${at}: a poster's frame under its block's cornice`);
          assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(q).x * side < -0.999, `${at}: a poster faces the road`);
          const f = frames.find((x) => Math.abs(x.p.z - p.z) < 1e-4 && Math.abs(x.p.y - p.y) < 1e-4);
          assert.ok(f && Math.abs(f.s.x - FRAME) < 1e-5 && Math.abs(f.s.y - s.y - 2 * FRAME) < 1e-5 && Math.abs(f.s.z - s.x - 2 * FRAME) < 1e-5, `${at}: a poster in its ${FRAME} m frame`);
          assert.ok(Math.abs(f.p.x) + FRAME / 2 <= FACADE_X - RELIEF + 1e-6 && Math.abs(p.x) < Math.abs(f.p.x) - FRAME / 2, `${at}: the frame clear of the facade relief, the poster on its face`);
        }
      }
      for (const zs of Object.values(perSide)) zs.sort((a, c) => a - c).forEach((z, i) => assert.ok(!i || z - zs[i - 1] >= 60, `${at}: posters ${(z - zs[i - 1]).toFixed(1)} m apart on a side`));
      assert.equal(frames.length, Object.values(perSide).flat().length, `${at}: a frame per poster, nothing else`);
    }
    const per100 = (n) => n / (SEEDS * 120) * 100 / 2; // per side
    assert.ok(per100(count.poster) <= 100 / 60 && count.poster / SEEDS >= 1, `${id}: ${per100(count.poster).toFixed(2)} posters per side per 100 m, ${(count.poster / SEEDS).toFixed(2)} a chunk`);
    const blades = count.blade / SEEDS, want = { downtown: [1, 1.8], midtown: [0, 0], uptown: [0.5, 1.3] }[id]; // at most one a side a chunk; midtown none, uptown about one a chunk
    assert.ok(blades >= want[0] && blades <= want[1], `${id}: ${blades.toFixed(2)} blades a chunk`);
  }
});

test('no block list, no image or a short chunk: no stand-in signs', () => {
  const style = { ...SIGN_FILES, lit: 0, bladeRate: 1 }, block = (side, z0, z1) => ({ side, z0, z1, h: 30, setAt: 30 }), blocks = [];
  for (let z = 0; z < 120; z += 12) blocks.push(block(-1, z, z + 11.5), block(1, z, z + 11.5));
  Object.values(SIGN_FILES).flat().forEach(load);
  for (let seed = 1; seed <= 10; seed++) assert.equal(signs(gfx, { z0: 0, length: 120 }, style, rng(seed), null, []).children.length, 0, 'a theme without buildings draws no signs');
  release([]); // nothing loaded
  for (let seed = 1; seed <= 10; seed++) assert.equal(signs(gfx, { z0: 0, length: 120 }, style, rng(seed), null, blocks).children.length, 0, 'an image not loaded yet is left out, never a blank panel');
  Object.values(SIGN_FILES).flat().forEach(load);
  let drawn = 0;
  for (let seed = 1; seed <= 10; seed++) drawn += signs(gfx, { z0: 0, length: 120 }, style, rng(seed), null, blocks).children.length;
  assert.ok(drawn > 0, 'once loaded, the same blocks wear signs');
});

test('signs take one draw from the chunk stream, so furniture and traffic land where the boards had them', () => {
  const style = { ...SIGN_FILES, lit: 0, bladeRate: 1 }, blocks = [{ side: 1, z0: 2, z1: 14, h: 30, setAt: 30 }, { side: -1, z0: 60, z1: 74, h: 30, setAt: 30 }];
  for (let seed = 1; seed <= 10; seed++) { const a = rng(seed), b = rng(seed); signs(gfx, { z0: 0, length: 120 }, style, a, null, blocks); b(); assert.equal(a(), b(), `seed ${seed}`); }
});
