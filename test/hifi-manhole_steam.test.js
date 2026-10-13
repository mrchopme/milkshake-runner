import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';
import * as hifi from '../packs/hifi/obstacles/manhole_steam.js';

const T = gfx.three;
let shipped, def, a, b, top; // def: the shipped manhole with the HiFi view over it, as the registry hands it to the world
const metal = new T.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1);
const steamOf = (v) => v.object.children[1];

before(async () => {
  shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
  const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/manhole_steam.js', module: hifi.default }]);
  assert.deepEqual(problems, []);
  def = registry.obstacle.manhole_steam;
  // A stand-in for the generated GLB: 0.98 x 0.22 x 0.98 units, off-centre and below the origin, as generators leave them.
  const raw = new T.Group(), cover = new T.Mesh(new T.BoxGeometry(0.98, 0.22, 0.98), new T.MeshStandardMaterial({ metalnessMap: metal }));
  cover.position.set(0.1, -0.3, 0.2);
  raw.add(cover);
  adopt('hifi/manhole_steam.glb', raw);
  a = def.createView(gfx);
  b = def.createView(gfx);
  a.object.updateMatrixWorld(true);
  top = new T.Box3().setFromObject(a.object.children[0]).max.y;
});

test('the overlay keeps how the manhole plays and only replaces its view', () => {
  assert.equal(def.box, shipped.obstacle.manhole_steam.box);
  assert.equal(def.cycle, shipped.obstacle.manhole_steam.cycle);
  assert.equal(def.avoid, 'timing');
  assert.notEqual(def.createView, shipped.obstacle.manhole_steam.createView);
  assert.deepEqual(def.assets, ['hifi/manhole_steam.glb']);
});

test('the HiFi cover sits inside the shipped box, flat on the road, centred, and every copy shares one paint', () => {
  const box = new T.Box3().setFromObject(a.object.children[0]), size = box.getSize(new T.Vector3()), { w, h, d } = def.box;
  assert.ok(size.x <= w + 1e-6 && size.y <= h + 1e-6 && size.z <= d + 1e-6, `cover ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m`);
  assert.ok(Math.abs(size.x - w) < 1e-6 || Math.abs(size.z - d) < 1e-6 || Math.abs(size.y - h) < 1e-6, 'fills the box along one side');
  assert.ok(Math.abs(box.min.y) < 1e-6, 'lies on the road');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, 'centred on its lane');
  const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
  assert.ok(paint(a.object)?.clearcoat > 0, 'a sheen over the metal');
  assert.equal(paint(a.object).metalnessMap, metal, 'bare metal: the model keeps its own metal map (Task 23 ruling)');
  assert.equal(paint(a.object), paint(b.object), 'every manhole shares one paint material');
});

test('the steam is one shared Points cloud that follows the shipped cycle, and gfx.dispose leaves it for the other copies', () => {
  const steam = steamOf(a);
  assert.ok(steam.isPoints);
  assert.equal(steam.geometry, steamOf(b).geometry);
  assert.equal(steam.material, steamOf(b).material);
  for (const part of [steam, steam.geometry, steam.material]) assert.ok(part.userData.shared, 'flagged shared');
  assert.equal(steam.geometry.getAttribute('aSeed').count, hifi.STEAM.count);
  const o = {};
  a.update(o, { time: 0 }, 0.016, false);
  assert.equal(steam.visible, false, 'no steam while the cycle is off');
  assert.equal(a.object.children[0].visible, true, 'the cover stays');
  a.update(o, { time: 0 }, 0.016, true);
  assert.equal(steam.visible, true, 'steam while the cycle is on');
  let freed = 0;
  for (const part of [steam.geometry, steam.material]) part.addEventListener('dispose', () => freed++);
  gfx.dispose(a.object);
  assert.equal(freed, 0, 'one despawned manhole must not free the steam every other manhole draws');
});

test('every puff of the column, at every moment of every cycle, stays inside the shipped box and above the cover', () => {
  const { w, h, d } = def.box, { count, large } = hifi.STEAM, eps = 1e-9, out = [];
  assert.ok(large <= Math.min(w, d), 'the largest puff fits the box');
  let lowest = Infinity, highest = 0;
  for (let i = 0; i < count; i++) for (let k = 0; k < 8; k++) for (let ph = 0; ph < def.cycle.period; ph += 0.01) {
    const p = hifi.puff(hifi.seed(i), ph, k, def.box, top), r = p.d / 2;
    lowest = Math.min(lowest, p.y - r); highest = Math.max(highest, p.y + r);
    if (Math.abs(p.x) + r > w / 2 + eps || Math.abs(p.z) + r > d / 2 + eps || p.y - r < top - eps || p.y + r > h + eps || p.fade < 0 || p.fade > 1) out.push([i, k, ph, p]);
  }
  assert.deepEqual(out.slice(0, 3), [], `${out.length} puffs leave the box`);
  assert.ok(lowest < top + 0.05, 'the column starts at the grate');
  assert.ok(highest > h - 0.05, 'and fills the box up to its top');
});

test('the steam is not a light: unlit, normal blending, below the bloom threshold', () => {
  const m = steamOf(a).material, c = m.color;
  assert.ok(m.isPointsMaterial && m.transparent && m.depthWrite === false);
  assert.equal(m.blending, T.NormalBlending, 'additive steam would bloom');
  assert.ok(Math.max(c.r, c.g, c.b) < 0.85, 'linear colour under the look\'s bloom threshold (0.85)');
});

test('the steam\'s shader hooks find their anchors in three\'s points shader and sit alongside the world bend', () => {
  gfx.bend(a.object); // what the world does to every view
  const m = steamOf(a).material;
  assert.ok(m.userData.bent);
  const sh = { uniforms: {}, vertexShader: T.ShaderLib.points.vertexShader, fragmentShader: T.ShaderLib.points.fragmentShader };
  m.onBeforeCompile(sh, {});
  assert.equal(sh.uniforms.uTime, gfx.time, 'the run clock the world drives, so pause freezes the steam');
  assert.match(sh.vertexShader, /attribute vec4 aSeed/);
  assert.match(sh.vertexShader, /transformed = vec3/);
  assert.match(sh.vertexShader, /projectionMatrix\[ 1 \]\[ 1 \]/, 'puff size in metres, not pixels');
  assert.ok(!sh.vertexShader.includes('gl_PointSize = size;'), 'the stock point size is replaced');
  assert.match(sh.vertexShader, /bendOffset/, 'the world bend is patched in too');
  assert.match(sh.fragmentShader, /vFade/);
  assert.match(sh.fragmentShader, /gl_PointCoord/, 'a soft round puff');
});
