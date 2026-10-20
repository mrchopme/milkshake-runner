import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack } from '../src/registry.js';
import { discover } from './helpers.js';
import * as gfx from '../src/gfx.js';
import { adopt, release } from '../src/assets.js';

const T = gfx.three;
const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
const PATH = 'packs/hifi/obstacles/pigeons.js';

// A stand-in for the generated GLB, shaped like the measured pigeon (task-23-models: 0.65 x 0.96 x 0.98, narrow along x),
// stored the way the optimiser leaves it (quantised: the node carries a scale and an offset) and painted metallic as Tripo does, with
// a colour map. Its head is a bump on top at +z, where the generated bird's is: the back and the middle of the top sit lower.
function standIn() {
  const g = new T.BoxGeometry(1.3, 1.92, 1.96, 4, 6, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.95 && p.getZ(i) < 0.5) p.setY(i, 0.7);
  const node = new T.Mesh(g, new T.MeshStandardMaterial({ map: new T.Texture(), metalness: 1, metalnessMap: new T.Texture() }));
  node.scale.setScalar(0.5);
  node.position.set(0.02, -0.03, 0.01);
  return new T.Group().add(node);
}
async function pigeons() {
  adopt('hifi/pigeon.glb', standIn());
  const shipped = buildRegistry(await discover(CONTENT));
  const mod = await import(`../${PATH}`);
  const { registry, problems } = applyPack(shipped, [{ path: PATH, module: mod.default }]);
  return { shipped, def: registry.obstacle.pigeons, problems, flap: mod.flap };
}
const flock = (o) => { let m; o.traverse((n) => { if (n.isInstancedMesh) m = n; }); return m; };

test('the HiFi pigeons: one bird instanced over the shipped flock, every bird inside the slide box wherever its wings are', async () => {
  const { shipped, def, problems, flap } = await pigeons();
  assert.deepEqual(problems, [], 'a looks-only overlay');
  assert.equal(def.avoid, 'slide');
  assert.equal(def.box, shipped.obstacle.pigeons.box, 'the shipped box, so the hit stays as it plays');
  assert.deepEqual(def.assets, ['hifi/pigeon.glb']);
  const a = def.createView(gfx).object, b = def.createView(gfx).object, birds = flock(a);
  assert.ok(birds, 'one InstancedMesh');
  // where the shipped (low-fi) view puts its birds' bodies
  const bodies = [];
  shipped.obstacle.pigeons.createView(gfx).object.traverse((n) => { if (n.geometry?.parameters?.radius === 0.14) bodies.push(n.position); });
  assert.equal(birds.count, bodies.length, 'a bird for each of the shipped flock');
  const g = birds.geometry, p = g.attributes.position, { w, h, d, y } = def.box, m = new T.Matrix4(), v = new T.Vector3(), at = new T.Vector3();
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new T.Vector3());
  assert.ok(size.x < size.z, 'after the yaw the wings spread along x, the body along z (the flap\'s frame)');
  const head = []; for (let i = 0; i < p.count; i++) if (p.getY(i) > g.boundingBox.max.y - 1e-6) head.push(p.getZ(i));
  assert.ok(head.length && head.every((z) => z < 0), `the head (+z in the model) faces the player, at -z (${head.length} top vertices)`);
  let low = Infinity;
  for (let i = 0; i < birds.count; i++) {
    birds.getMatrixAt(i, m);
    at.setFromMatrixPosition(m);
    assert.ok(at.distanceTo(bodies[i]) < 1e-6,`bird ${i} at ${at.toArray()}, the shipped body at ${bodies[i].toArray()}`);
    for (let j = 0; j < p.count; j++) for (let k = 0; k <= 32; k++) {
      v.set(...flap(p.getX(j), p.getY(j), k / 32), p.getZ(j)).applyMatrix4(m);
      assert.ok(Math.abs(v.x) <= w / 2 + 1e-3 && v.y >= y - 1e-3 && v.y <= y + h + 1e-3 && Math.abs(v.z) <= d / 2 + 1e-3, `bird ${i} reaches ${v.toArray().map((c) => c.toFixed(3))} at beat ${k}/32`);
      low = Math.min(low, v.y);
    }
  }
  assert.ok(Math.abs(low - y) < 1e-6, `as big as the box allows: the low birds' feet on its floor (${low.toFixed(3)})`);
  // shared, so a despawn frees only the instance buffers
  const other = flock(b);
  assert.equal(other.geometry, g, 'every flock draws one geometry');
  assert.equal(other.material, birds.material, 'and one paint');
  assert.ok(birds.material.isMeshPhysicalMaterial && birds.material.clearcoat === 0.3 && birds.material.clearcoatRoughness === 0.4, 'the template\'s satin (was 0.6 / 0.2; Caedon, board 29 pick 4)');
  assert.ok(birds.material.metalness === 0 && birds.material.metalnessMap === null, 'Tripo\'s random metal dropped (the Task 23 ruling)');
  let freed = 0;
  for (const x of [g, birds.material]) x.addEventListener('dispose', () => freed++);
  gfx.dispose(a);
  assert.equal(freed, 0, 'gfx.dispose leaves the shared geometry and paint alive');
});

test('the wings are the sides of the body above the belly: they lift up and out, and the head, the centre line and the legs stay', async () => {
  const { flap } = await pigeons();
  const stays = (x, y, k, what) => { const [fx, fy] = flap(x, y, k); assert.ok(Math.abs(fx - x) < 1e-12 && Math.abs(fy - y) < 1e-12, `${what} stays (${fx}, ${fy})`); };
  stays(0, 0.3, 1, 'the centre line');
  stays(0.1, 0.4, 1, 'the head');
  stays(0.2, -0.45, 1, 'a leg');
  stays(0.3, 0.05, 0, 'a wing folded at the bottom of the beat');
  const [x, y] = flap(0.3, 0.05, 1), [mx, my] = flap(-0.3, 0.05, 1);
  assert.ok(x > 0.3 && y > 0.05, `a wing lifts up and out (${x.toFixed(3)}, ${y.toFixed(3)})`);
  assert.ok(Math.abs(mx + x) < 1e-12 && Math.abs(my - y) < 1e-12, 'both wings alike');
});

test('the flap composes with the shader chain: the bird\'s own hook, then the look\'s cascades, then the bend; the run clock drives it', async () => {
  const { def } = await pigeons();
  const object = def.createView(gfx).object, paint = flock(object).material, chunk = T.ShaderChunk.begin_vertex, order = [];
  gfx.hook.beforeBend = (m) => { // as CSM.setupMaterial does: it replaces onBeforeCompile instead of chaining
    m.onBeforeCompile = (s) => order.push(s.vertexShader.includes('bendOffset') ? 'look, after the bend' : s.vertexShader.includes('uTime') ? 'look, after the flap' : 'look, before the flap');
  };
  try { gfx.bend(object); } finally { gfx.hook.beforeBend = null; }
  const shader = { uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader };
  paint.onBeforeCompile(shader, null);
  assert.deepEqual(order, ['look, after the flap']);
  assert.equal(shader.uniforms.uTime, gfx.time, 'the run clock: pause freezes the wings, a still pins them');
  const vs = shader.vertexShader, flapAt = vs.indexOf('gl_InstanceID'), begin = vs.indexOf('#include <begin_vertex>'), bent = vs.indexOf('bentWorld = instanceMatrix * bentWorld');
  assert.ok(begin > 0 && flapAt > begin && bent > flapAt, `the flap moves the bird's own vertices, before the instance, the model and the bend place them (${begin}, ${flapAt}, ${bent})`);
  assert.equal(T.ShaderChunk.begin_vertex, chunk, 'three\'s shared chunk is untouched: nothing reaches the low-fi materials');
  assert.notEqual(paint.customProgramCacheKey(), gfx.bendable(new T.MeshPhysicalMaterial()).customProgramCacheKey(), 'its own program, never shared with a plain bent material');
});

test('the bird\'s baked geometry goes with the file it was baked from, and a reload bakes its own (final review M3)', async () => {
  const { def } = await pigeons();
  const g = flock(def.createView(gfx).object).geometry;
  let freed = 0;
  g.addEventListener('dispose', () => freed++);
  release([]);
  assert.equal(freed, 1, 'released with the loaded geometry, not pinned for the session');
  adopt('hifi/pigeon.glb', standIn());
  assert.notEqual(flock(def.createView(gfx).object).geometry, g, 'the reload is fitted afresh, not drawn with the freed copy');
});
