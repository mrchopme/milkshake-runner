import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { adopt, release } from '../src/assets.js';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import { pickBy } from '../packs/hifi/lib/rand.js';
import hifiBillboard from '../packs/hifi/props/billboard.js';

const T = gfx.three, lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const CONTENT = fileURLToPath(new URL('../content/', import.meta.url)), SIGNS = fileURLToPath(new URL('../public/hifi/city/signs/', import.meta.url));
const POSTERS = readdirSync(SIGNS).filter((f) => /^poster-\d\d\.webp$/.test(f)).sort().map((f) => `hifi/city/signs/${f}`);
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });

const textures = new Map(); // stand-ins for the loaded posters, one per file
const loadPosters = () => POSTERS.forEach((p) => { if (!textures.has(p)) textures.set(p, new T.Texture()); adopt(p, textures.get(p)); });
const view = (z = 0) => hifiBillboard.createView(gfx, { z, length: 4, lanes }).object;
// Children, in the order the overlay documents: bezel, frame, poster, two posts.
const parts = (o) => { const [bezel, frame, poster, ...posts] = o.children; return { bezel, frame, poster, posts }; };
const boxOf = (...nodes) => { const b = new T.Box3(); nodes.forEach((n) => { n.updateMatrixWorld(true); b.union(new T.Box3().setFromObject(n)); }); return b; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
// The shipped billboard draws its glyph on a canvas, and Node has none: a stub canvas stands in while it builds.
function shippedView(z) {
  const had = { document: globalThis.document, Path2D: globalThis.Path2D };
  globalThis.document = { createElement: () => ({ getContext: () => ({ scale() {}, fill() {}, stroke() {} }) }) };
  globalThis.Path2D = class {};
  try { return shipped.prop.billboard.createView(gfx, { z, length: 4, lanes }).object; } finally { for (const k of Object.keys(had)) { if (had[k] === undefined) delete globalThis[k]; else globalThis[k] = had[k]; } }
}

test('the overlay re-skins the shipped billboard and lists every poster in the sign folder', () => {
  assert.ok(POSTERS.length > 0, 'the poster folder is not empty');
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/props/billboard.js', module: hifiBillboard }]);
  assert.deepEqual(problems, []);
  assert.equal(registry.prop.billboard.createView, hifiBillboard.createView);
  assert.equal(registry.prop.billboard.length, shipped.prop.billboard.length, 'the shipped length stays');
  assert.deepEqual([...registry.prop.billboard.assets].sort(), POSTERS);
});

test('a poster that has not loaded still builds the billboard, and the real poster replaces the stand-in once it lands', () => {
  release([]); // nothing loaded yet
  const bare = parts(view(0));
  assert.equal(bare.poster.material.map, null, 'flat stand-in panel');
  assert.equal(bare.posts.length, 2);
  loadPosters();
  assert.ok(parts(view(0)).poster.material.map?.isTexture, 'the next billboard wears the poster');
});

test('same size, same place and same side rule as the shipped billboard', () => {
  loadPosters();
  for (const z of [0, 40, 80, 120, 160, 200, -40]) {
    const was = shippedView(z), now = view(z);
    const a = boxOf(was.children[0], was.children[1]), b = boxOf(parts(now).bezel, parts(now).frame); // the shipped panel and bezel, then ours
    for (const k of ['x', 'y', 'z']) { near(b.min[k], a.min[k], `z ${z} min ${k}`); near(b.max[k], a.max[k], `z ${z} max ${k}`); }
  }
});

test('two posts stand on the road under the panel, within its width and inside the prop\'s 4 m', () => {
  loadPosters();
  const { frame, posts } = parts(view(0)), f = boxOf(frame);
  const [a, b] = posts.map((p) => boxOf(p));
  for (const p of [a, b]) {
    near(p.min.y, 0, 'post foot');
    near(p.max.y, f.min.y, 'post top meets the frame');
    assert.ok(p.min.x >= f.min.x && p.max.x <= f.max.x, 'under the panel');
    assert.ok(p.min.z >= 0 && p.max.z <= 4, 'inside the prop length');
  }
  near(a.min.x + a.max.x + b.min.x + b.max.x, 2 * (f.min.x + f.max.x), 'symmetric about the panel');
  assert.ok(a.max.x < b.min.x || b.max.x < a.min.x, 'two separate posts');
});

test('the poster is the panel\'s face: its own aspect, inside the frame, looking at the player, lit by its own texels', () => {
  loadPosters();
  const o = view(0), { frame, poster } = parts(o), f = boxOf(frame), p = boxOf(poster);
  near((p.max.x - p.min.x) / (p.max.y - p.min.y), 1024 / 573, 'the generated posters\' aspect, not stretched');
  assert.ok(p.min.x > f.min.x && p.max.x < f.max.x && p.min.y > f.min.y && p.max.y < f.max.y, 'inside the frame');
  assert.ok(p.max.z <= f.min.z && f.min.z - p.max.z < 0.05, 'just in front of the frame, on the player\'s side (-z)');
  near(poster.geometry.attributes.normal.getZ(0), -1, 'faces -z, where the camera is');
  const m = poster.material;
  assert.equal(m.emissiveMap, m.map, 'the glow is the poster\'s own texels');
  assert.ok(m.emissiveIntensity > 0 && m.emissive.getHexString() === 'ffffff');
  const lit = o.children.filter((n) => n.material.emissiveIntensity > 0 && n.material.emissive.getHex() !== 0);
  assert.deepEqual(lit, [poster], 'nothing else glows, no plate over the poster');
});

test('a billboard keeps its poster for its z, and different z pick different posters', () => {
  loadPosters();
  const seen = new Set(), at = (z) => parts(view(z)).poster.material.map;
  for (let k = 0; k < 400; k++) {
    const z = k * 37;
    assert.equal(at(z), at(z), `z ${z} is stable`);
    assert.ok(POSTERS.some((p) => textures.get(p) === at(z)), 'one of the sign folder\'s posters');
    seen.add(at(z));
  }
  assert.equal(seen.size, POSTERS.length, 'every poster is used somewhere');
});

test('pickBy is a stable draw in [0, n) from a number', () => {
  const draws = Array.from({ length: 200 }, (_, k) => pickBy(k * 40, 12));
  assert.deepEqual(draws, Array.from({ length: 200 }, (_, k) => pickBy(k * 40, 12)));
  assert.ok(draws.every((d) => Number.isInteger(d) && d >= 0 && d < 12));
  assert.ok(new Set(draws).size >= 10, 'spreads over the range');
});

test('every billboard shares its geometry and materials, and dropping one frees none of them', () => {
  loadPosters();
  const z0 = 0, z1 = (() => { let z = 40; while (parts(view(z)).poster.material === parts(view(z0)).poster.material) z += 40; return z; })();
  const a = parts(view(z0)), b = parts(view(z0)), c = parts(view(z1));
  for (const k of ['bezel', 'frame', 'poster']) { assert.equal(a[k].geometry, b[k].geometry); assert.equal(a[k].material, b[k].material); assert.equal(a[k].geometry, c[k].geometry); }
  assert.equal(a.posts[0].geometry, a.posts[1].geometry); assert.equal(a.posts[0].material, c.posts[1].material);
  assert.equal(a.poster.material, b.poster.material, 'two billboards with one poster share its paint');
  assert.notEqual(a.poster.material, c.poster.material, 'another poster, another paint');
  const freed = [], o = view(z0), nodes = Object.values(parts(o)).flat();
  for (const n of nodes) { n.geometry.dispose = () => freed.push('geometry'); n.material.dispose = () => freed.push('material'); n.material.map?.dispose && (n.material.map.dispose = () => freed.push('texture')); }
  gfx.dispose(o);
  assert.deepEqual(freed, []);
});
