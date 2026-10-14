import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const shipped = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
const overlay = (await import('../packs/hifi/obstacles/scaffold_beam.js')).default;
const { registry, problems } = applyPack(shipped, [{ path: 'packs/hifi/obstacles/scaffold_beam.js', module: overlay }]);
const def = registry.obstacle.scaffold_beam, { w, h, d, y } = def.box;
const DOORWAY = 1.5; // metres of open space at the feet: the redrawn Milkshake is about 1.13 m across with her arms down; the generated model leaves 0.93 m, the overlay spreads the posts apart

// A stand-in for the redrawn public/hifi/scaffold_beam.glb with its measured parts (model units, centred; measured on the optimised file):
// two posts with their feet at z +-0.32..0.45 and +-0.28..0.49, nothing between them, and the plank from y 0.334 to 0.490 on top
// (0.17 x 0.94 across z, the model's long side), its doorway facing +x (the marker). The real model is one mesh with one material.
const generated = new T.MeshStandardMaterial();
const mesh = (name, size, at) => { const m = new T.Mesh(new T.BoxGeometry(...size), generated); m.name = name; m.position.set(...at); return m; };
const raw = new T.Group().add(
  mesh('post', [0.1511, 0.7142, 0.1308], [0, -0.023, 0.3839]), mesh('post', [0.1511, 0.7142, 0.1308], [0, -0.023, -0.3839]),
  mesh('foot', [0.2295, 0.1091, 0.2045], [0, -0.4347, 0.3852]), mesh('foot', [0.2295, 0.1091, 0.2045], [0, -0.4347, -0.3852]),
  mesh('plank', [0.1737, 0.1556, 0.9353], [0, 0.4119, -0.0028]), mesh('face', [0.02, 0.02, 0.02], [0.075, 0.41, 0]));
const loadedPositions = []; raw.traverse((n) => { if (n.isMesh) loadedPositions.push([n.geometry, Array.from(n.geometry.attributes.position.array)]); });
adopt('hifi/scaffold_beam.glb', raw);

const bounds = (o) => { o.updateWorldMatrix(true, true); return new T.Box3().setFromObject(o); };
const find = (o, name) => { let f; o.traverse((n) => { if (n.name === name) f = n; }); return f; };
const named = (o, name) => { const out = []; o.traverse((n) => { if (n.name === name) out.push(n); }); return out; };
const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
const triangles = (o) => { // every triangle of the view as three world-space points: a long thin one has no vertex in the middle of the lane, so vertices alone would miss a brace
  o.updateWorldMatrix(true, true);
  const out = [];
  o.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position, ix = n.geometry.index.array, at = (i) => new T.Vector3().fromBufferAttribute(p, ix[i]).applyMatrix4(n.matrixWorld);
    for (let i = 0; i < ix.length; i += 3) out.push([at(i), at(i + 1), at(i + 2)]);
  });
  return out;
};
const lowest = (t) => Math.min(...t.map((v) => v.y));

test('the HiFi scaffold stands on the road inside its box column, its plank in the box, the posts clear of the lane', () => {
  assert.deepEqual(problems, []);
  const a = def.createView(gfx, {}).object, b = bounds(a), size = b.getSize(new T.Vector3()), p = bounds(find(a, 'plank'));
  assert.ok(b.min.x >= -w / 2 - 1e-6 && b.max.x <= w / 2 + 1e-6 && b.min.z >= -d / 2 - 1e-6 && b.max.z <= d / 2 + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m inside ${w} x ${d}`);
  assert.ok(Math.abs(b.min.y) < 1e-6, 'feet on the road');
  assert.ok(Math.abs(b.max.y - (y + h)) < 1e-6, 'the plank top is the box top');
  assert.ok(p.min.y >= y && p.max.y <= y + h + 1e-6, `the plank (${p.min.y.toFixed(2)} to ${p.max.y.toFixed(2)} m) sits inside the box band (${y} to ${y + h} m)`);
  assert.ok(Math.abs(b.min.x + b.max.x) < 1e-6 && Math.abs(b.min.z + b.max.z) < 0.02, 'centred in its lane');
  assert.ok(size.x > size.z, 'its long side runs across the lane');
});

test('the HiFi scaffold has daylight under its plank: nothing between the posts below it, so a slide passes through open space', () => {
  const a = def.createView(gfx, {}).object, plankBottom = bounds(find(a, 'plank')).min.y, all = triangles(a);
  const under = all.filter((t) => lowest(t) < plankBottom - 1e-6);
  assert.ok(under.length >= 20, 'there are posts and feet to test');
  const beside = (t) => t.every((v) => v.x >= DOORWAY / 2) || t.every((v) => v.x <= -DOORWAY / 2); // wholly on one side of the doorway
  assert.ok(under.every(beside), `every triangle below the plank's underside (${plankBottom.toFixed(2)} m) stays outside the ${DOORWAY} m doorway: no brace or bar across the lane`);
  assert.ok(all.some((t) => lowest(t) >= plankBottom - 1e-6 && t.some((v) => v.x < -0.1) && t.some((v) => v.x > 0.1)), 'and the plank itself does cross the lane above that');
});

test('the HiFi scaffold spreads its posts apart for Milkshake without stretching them, and leaves the loaded geometry alone', () => {
  const a = def.createView(gfx, {}).object, b = bounds(a);
  const [left, right] = named(a, 'foot').map(bounds).sort((p, q) => p.min.x - q.min.x);
  assert.ok(right.min.x - left.max.x >= DOORWAY, `${(right.min.x - left.max.x).toFixed(2)} m clear between the feet, at least ${DOORWAY} m`);
  const [pl, pr] = named(a, 'post').map(bounds).sort((p, q) => p.min.x - q.min.x);
  assert.ok(pr.min.x - pl.max.x >= DOORWAY, 'and between the posts');
  assert.ok(b.min.x >= -w / 2 && b.max.x <= w / 2, `both posts inside the box's ${w} m (${b.min.x.toFixed(2)} to ${b.max.x.toFixed(2)})`);
  // a rigid move: every post and foot keeps its own proportions (the scale is the model's own, from its height), so the posts stay round
  for (const [name, [sx, sy, sz]] of Object.entries({ post: [0.1511, 0.7142, 0.1308], foot: [0.2295, 0.1091, 0.2045] })) {
    for (const part of named(a, name)) {
      const size = bounds(part).getSize(new T.Vector3()), k = size.y / sy; // the yaw swaps the model's x and z
      assert.ok(Math.abs(size.z - sx * k) < 1e-6 && Math.abs(size.x - sz * k) < 1e-6, `a ${name} is ${size.x.toFixed(3)} x ${size.z.toFixed(3)} m, its model proportions at scale ${k.toFixed(3)}`);
    }
  }
  const view = find(a, 'plank');
  assert.ok(view.geometry.userData.shared && !loadedPositions.some(([g]) => g === view.geometry), 'the widened geometry is its own clone, flagged shared');
  for (const [g, positions] of loadedPositions) assert.deepEqual(Array.from(g.attributes.position.array), positions, 'the loaded geometry is untouched');
  assert.ok(named(def.createView(gfx, {}).object, 'plank')[0].geometry === view.geometry, 'every copy shares the one widened geometry');
});

test('the HiFi scaffold shows its doorway to the player, with one glossy paint for every copy', () => {
  const a = def.createView(gfx, {}).object, b = def.createView(gfx, {}).object;
  assert.ok(find(a, 'face').getWorldPosition(new T.Vector3()).z < bounds(a).getCenter(new T.Vector3()).z - 0.05, 'the +x doorway faces the camera, at -z');
  assert.ok(paint(a).clearcoat > 0 && paint(a).metalness === 0 && paint(a).metalnessMap === null, 'glossy, and not the random metal Tripo left in');
  assert.equal(paint(a), paint(b), 'every scaffold shares one paint material');
});
