import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { adopt, preload, asset, gate } from '../src/assets.js';

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

test('while the files load, a second start is dropped, so a double click on LOADING… starts one level', async () => {
  let loaded;
  const start = gate(new Promise((r) => { loaded = r; }));
  const first = start(), second = start();
  loaded();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(await start(), true, 'once the files are in, the next start goes through');
});
