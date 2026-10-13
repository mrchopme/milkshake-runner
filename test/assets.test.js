import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { adopt, preload, asset, gateLoads, levelAssets, release } from '../src/assets.js';

const model = () => gfx.group(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() })));

test('an asset copy shares its geometry and materials with every other copy', () => {
  adopt('test/a.glb', model());
  const a = asset('test/a.glb'), b = asset('test/a.glb');
  assert.notEqual(a, b);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
  assert.equal(a.children[0].material, b.children[0].material);
  assert.ok(a.children[0].userData.shared, 'copies carry the shared flag');
});

test('dropping a copy leaves the shared asset alone, and still frees what a module added to it', () => {
  adopt('test/b.glb', model());
  const copy = asset('test/b.glb'), own = gfx.box(1, 1, 1, '#ffffff');
  copy.add(own);
  const freed = [];
  copy.children[0].geometry.dispose = () => freed.push('shared geometry');
  copy.children[0].material.dispose = () => freed.push('shared material');
  own.geometry.dispose = () => freed.push('own geometry');
  gfx.dispose(copy);
  assert.deepEqual(freed, ['own geometry']);
});

test('an asset nobody preloaded fails loudly, naming the file', () => {
  assert.throws(() => asset('test/missing.glb'), /asset "test\/missing.glb" is not loaded: list it in the module's assets/);
});

test('preload loads each file once and never rejects when one fails', async () => {
  const asked = [];
  const load = async (p) => { asked.push(p); if (p.includes('bad')) throw new Error('404'); return model(); };
  const warn = console.warn;
  console.warn = () => {};
  try { await preload(['test/c.glb', 'test/bad.glb', 'test/c.glb'], load); } finally { console.warn = warn; }
  assert.deepEqual(asked.sort(), ['test/bad.glb', 'test/c.glb']);
  assert.ok(asset('test/c.glb'));
  assert.throws(() => asset('test/bad.glb'), /not loaded/);
  await preload(['test/c.glb'], load);
  assert.equal(asked.length, 2, 'a cached file is not loaded again');
});

test('a level\'s files include every module it names, section themes, the default jug and its character', () => {
  const reg = {
    theme: { a: { assets: ['t/a.webp'] }, b: { assets: ['t/b.webp'] } }, obstacle: { o: { assets: ['o.glb'] }, unused: { assets: ['no.glb'] } },
    pickup: { jug: { assets: ['jug.glb'] }, s: { assets: ['s.glb'] } }, prop: { p: { assets: ['p.glb'] }, q: { assets: ['q.glb'] } },
    character: { milkshake: { assets: ['m.glb'] } }, ending: { finish: {} },
  };
  const level = { theme: { id: 'a' }, obstacles: { o: 1 }, jugs: { powerups: ['s'] }, props: { ids: { p: 1 } }, sections: [{ theme: { id: 'b' }, placements: [{ kind: 'prop', id: 'q' }] }] };
  assert.deepEqual(levelAssets(level, reg).sort(), ['jug.glb', 'm.glb', 'o.glb', 'p.glb', 'q.glb', 's.glb', 't/a.webp', 't/b.webp']);
});

test('a second start while a level\'s files load is dropped', async () => {
  let done;
  const start = gateLoads(() => new Promise((r) => { done = r; }));
  const first = start(['x.glb']), second = start(['x.glb']);
  done();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(await gateLoads(async () => {})(['y.glb']), true);
});

test('dropping an instanced copy frees its instance buffers, never the shared model or a shared texture', () => {
  adopt('test/i.glb', model());
  const src = asset('test/i.glb').children[0];
  const inst = new THREE.InstancedMesh(src.geometry, src.material, 4);
  const own = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: src.material.map }));
  const freed = [];
  inst.dispose = () => freed.push('instances');
  src.geometry.dispose = () => freed.push('shared geometry');
  src.material.dispose = () => freed.push('shared material');
  src.material.map.dispose = () => freed.push('shared texture');
  own.geometry.dispose = () => freed.push('own geometry');
  own.material.dispose = () => freed.push('own material');
  gfx.dispose(gfx.group(inst, own));
  assert.deepEqual(freed.sort(), ['instances', 'own geometry', 'own material']);
});

test('an image asset is one shared texture; asking for it as a model, or for a missing one, fails loudly', async () => {
  const tex = new THREE.Texture();
  await preload(['test/sky.webp'], async () => tex);
  assert.equal(gfx.texture('test/sky.webp'), tex);
  assert.ok(tex.userData.shared, 'flagged shared, so dropping a chunk never frees it');
  assert.throws(() => asset('test/sky.webp'), /asset "test\/sky.webp" is an image: use gfx.texture/);
  assert.throws(() => gfx.texture('test/none.webp'), /texture "test\/none.webp" is not loaded: list it in the module's assets/);
});

test('release frees every cached file a level does not keep, and keeps the rest', () => {
  adopt('test/keep.glb', model()); adopt('test/drop.glb', model());
  const t = new THREE.Texture(); adopt('test/drop.webp', t);
  const d = asset('test/drop.glb').children[0], freed = [];
  d.geometry.dispose = () => freed.push('geometry'); d.material.dispose = () => freed.push('material');
  d.material.map.dispose = () => freed.push('map'); t.dispose = () => freed.push('texture');
  release(['test/keep.glb']);
  assert.deepEqual(freed.sort(), ['geometry', 'map', 'material', 'texture']);
  assert.ok(asset('test/keep.glb'));
  assert.throws(() => asset('test/drop.glb'), /not loaded/);
});

test('release keeps what the next level needs', () => {
  adopt('test/next.glb', model()); adopt('test/old.glb', model());
  release(levelAssets({ theme: { id: 'a' } }, { theme: { a: { assets: ['test/next.glb'] } }, obstacle: {}, pickup: {}, prop: {}, character: {}, ending: {} }));
  assert.ok(asset('test/next.glb'));
  assert.throws(() => asset('test/old.glb'), /not loaded/);
});
