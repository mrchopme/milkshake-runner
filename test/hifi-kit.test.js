import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt, release } from '../src/assets.js';
import { KIT, KIT_FILES, kitParts, placeholder, GUARD } from '../packs/hifi/lib/kit.js';
import { furniture, FOOT, PITS, RHYTHM } from '../packs/hifi/lib/furniture.js';
import { traffic } from '../packs/hifi/lib/traffic.js';
import { material } from '../packs/hifi/lib/materials.js';
import { FACADE_X } from '../packs/hifi/lib/street.js';
import { BLADE, ASPECT } from '../packs/hifi/lib/signs.js';
import downtown from '../packs/hifi/themes/downtown.js';
import midtown from '../packs/hifi/themes/midtown.js';
import uptown from '../packs/hifi/themes/uptown.js';

// A stand-in for a generated kit model: a unit body and a nub on its front, Tripo's material (metal-rough map, metalness 1).
// Every generated model faces +x, except the lamp, whose arm reaches -z (task-23-models.md, measured on the decoded meshes).
const FRONT = { lamp: [0, 0, -1] };
const tripo = (map = null) => new THREE.MeshStandardMaterial({ map, metalness: 1, metalnessMap: new THREE.Texture(), roughnessMap: new THREE.Texture() });
const standIn = ([x, y, z] = [1, 0, 0], map = null) => {
  const paint = tripo(map), body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paint), nub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), paint);
  nub.position.set(0.6 * x, 0.6 * y, 0.6 * z);
  return new THREE.Group().add(body, nub);
};
// The placed pieces at their real proportions, measured on the decoded GLBs (model units): the bounding box, and the x, z box
// of the lowest 5% of the height, where the piece stands. A stand-in: a body filling the box above that band and a slab on
// the footprint, so it fits and anchors as the real model does. The tree is its own stand-in (TREE below): the kit cuts its guard.
const REAL = {
  lamp: [[-0.1516, -0.49059, -0.27532], [0.15129, 0.4908, 0.27511], [-0.0895, 0.0412], [0.1513, 0.2751]],
  traffic_light: [[-0.20752, -0.4896, -0.16442], [0.20794, 0.48998, 0.16374], [-0.2075, -0.1284], [0.0495, 0.1288]],
  hydrant: [[-0.36861, -0.48921, -0.40538], [0.36849, 0.48897, 0.40539], [-0.2352, -0.2412], [0.2347, 0.241]],
  bench: [[-0.2859, -0.38101, -0.49045], [0.2851, 0.38177, 0.49005], [-0.2379, -0.4887], [0.2782, 0.4869]],
  bin: [[-0.28695, -0.48944, -0.28576], [0.28743, 0.49029, 0.28623], [-0.2187, -0.2194], [0.2148, 0.216]],
  newsstand: [[-0.35633, -0.43682, -0.49027], [0.35603, 0.43757, 0.49056], [-0.3293, -0.3661], [0.2165, 0.3652]],
  bus_shelter: [[-0.30145, -0.45037, -0.48947], [0.30162, 0.4506, 0.48967], [-0.2919, -0.4717], [0.2865, 0.4729]],
  subway: [[-0.48947, -0.39242, -0.41083], [0.48956, 0.39741, 0.4108], [-0.4895, -0.4108], [0.4896, 0.4107]],
  planter: [[-0.40591, -0.48997, -0.45718], [0.40462, 0.48793, 0.45853], [-0.34597, -0.42524], [0.34665, 0.42445]],
};
// The tree as generated (tree.glb decoded, metres at KIT's 6 m; the Task 32 P5 report): one mesh, an iron guard 2.45 m square from the
// ground to 1.9 m, the trunk standing on soil at 0.75 m with a root flare (r 0.6 at its foot, 0.42 up the trunk), the canopy (r 2.31,
// the reach that matters: a tree turns any way) from 2.22 m to the top.
const TREE = () => new THREE.Group().add(new THREE.Mesh(mergeGeometries([
  new THREE.BoxGeometry(2.45, 1.9, 2.45).translate(0, 0.95, 0),
  new THREE.CylinderGeometry(0.42, 0.6, 2.25, 8, 4).translate(0, 0.75 + 1.125, 0),
  new THREE.CylinderGeometry(2.31, 2.31, 3.78, 32).translate(0, 2.22 + 1.89, 0),
]), tripo()));
// tree2 as generated (tree2.glb decoded, metres at KIT's 6 m; Task 32 C7, Caedon's T3): one mesh, its own pit a 3.01 m square slab
// 0.12 m deep (the kit cuts it: the kit's pit is its pit), a slim trunk (r 0.32 at its foot, 0.27 under the canopy), the ball canopy
// (reach 2.26) from 2.1 m to the top.
const TREE2 = () => new THREE.Group().add(new THREE.Mesh(mergeGeometries([
  new THREE.BoxGeometry(3.01, 0.12, 3.01).translate(0, 0.06, 0),
  new THREE.CylinderGeometry(0.27, 0.316, 2.14, 8, 4).translate(0, 0.06 + 1.07, 0),
  new THREE.CylinderGeometry(2.26, 2.26, 3.9, 32).translate(0, 2.1 + 1.95, 0),
]), tripo()));
const model = (kind) => (kind === 'tree' ? TREE() : kind === 'tree2' ? TREE2() : real(REAL[kind]));
const real = ([min, max, footMin, footMax]) => {
  const paint = tripo(), h = max[1] - min[1], body = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], 0.94 * h, max[2] - min[2]), paint);
  body.position.set((min[0] + max[0]) / 2, min[1] + 0.53 * h, (min[2] + max[2]) / 2);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(footMax[0] - footMin[0], 0.04 * h, footMax[1] - footMin[1]), paint);
  foot.position.set((footMin[0] + footMax[0]) / 2, min[1] + 0.02 * h, (footMin[1] + footMax[1]) / 2);
  foot.geometry.userData.foot = true;
  return new THREE.Group().add(body, foot);
};
// OffscreenCanvas for Node: draws another canvas's (or an image's) texels and hands them back to be changed.
class Canvas {
  getContext() { return { drawImage: (src) => { this.px = Uint8ClampedArray.from(src.px); }, getImageData: () => ({ data: this.px }), putImageData: (img) => { this.px = img.data; } }; }
}
const withCanvas = (fn) => { const saved = globalThis.OffscreenCanvas; globalThis.OffscreenCanvas = Canvas; try { fn(); } finally { globalThis.OffscreenCanvas = saved; } };
// release() disposes a freed file's materials; everything made from them must go too, or the look's CSM (which holds every lit
// material until its dispose) pins one more copy each level cycle.
const counts = (things) => { const n = new Map(things.map((x) => [x, 0])); for (const x of things) x.addEventListener('dispose', () => n.set(x, n.get(x) + 1)); return n; };
const freeOnly = (...paths) => release(KIT_FILES.filter((p) => !paths.includes(p)));

test('every kit piece turns its front (the lamp its arm) toward +z: the road for furniture, ahead for a car', () => {
  for (const [kind, entry] of Object.entries(KIT)) {
    adopt(entry.path, standIn(FRONT[kind]));
    const parts = kitParts(gfx, { ...entry }, placeholder(kind)), nub = parts.find((p) => p.geometry.parameters.width === 0.2);
    const at = new THREE.Vector3().applyMatrix4(nub.matrix);
    assert.ok(at.z > 0 && Math.abs(at.x) < 1e-6, `${kind}: front at ${at.toArray().map((v) => v.toFixed(2))}`);
  }
});

test('a kit piece stands on its footprint: a lamp\'s pole at the placed x, its arm reaching out from there', () => {
  // a pole at z +0.3 and an arm reaching to -0.3 along the top: its bounding box is centred 0.3 in front of the pole
  const paint = tripo(), pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), paint), arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.65), paint);
  pole.position.set(0, 0, 0.3); arm.position.set(0, 0.45, 0);
  adopt(KIT.lamp.path, new THREE.Group().add(pole, arm));
  const parts = kitParts(gfx, { ...KIT.lamp }, placeholder('lamp'));
  const [p, a] = [pole, arm].map((m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(parts.find((x) => x.geometry === m.geometry).matrix); });
  const c = p.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(c.x) < 1e-6 && Math.abs(c.z) < 1e-6 && Math.abs(p.min.y) < 1e-6, `the pole stands at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`);
  assert.ok(a.max.z > KIT.lamp.h / 2, 'the arm reaches toward the road'); // 0.625 of the stand-in's height out from the pole
});

test('each kit piece is painted once without the generator\'s random metal, and every copy in every chunk shares that paint', () => {
  for (const [kind, entry] of Object.entries(KIT)) adopt(entry.path, REAL[kind] || kind in RHYTHM.trees ? model(kind) : standIn(FRONT[kind]));
  for (const kind of Object.keys(KIT)) {
    const parts = kitParts(gfx, KIT[kind], placeholder(kind)), m = parts[0].material;
    assert.equal(kitParts(gfx, KIT[kind], placeholder(kind)), parts, `${kind}: built once`);
    assert.ok(m.isMeshPhysicalMaterial && m.metalness === 0 && m.metalnessMap === null && m.roughnessMap, `${kind}: metal off, roughness kept`);
    assert.ok(m.userData.shared, `${kind}: chunks never free it`);
  }
  const paints = (g) => { const out = {}; g.traverse((n) => { if (n.userData.furniture) (out[n.userData.furniture] ??= new Set()).add(n.material); }); return out; };
  const a = paints(furniture(gfx, { z0: 0, length: 120 }, null, rng(1), { z: 60 })), b = paints(furniture(gfx, { z0: 120, length: 120 }, null, rng(2), { z: 180 }));
  for (const kind of Object.keys(a)) if (b[kind]) assert.ok(a[kind].size === 1 && b[kind].has([...a[kind]][0]), `${kind}: one paint across chunks`);
  assert.ok(a.lamp && a.traffic_light, 'lamps and signals were placed');
});

// shop lots on both sides, 15 m apart, as the buildings part lists them (its header): the planters stand at their doors
const LOTS = [-1, 1].flatMap((side) => Array.from({ length: 8 }, (_, i) => ({ side, z0: i * 15 + 0.5, z1: i * 15 + 15, shop: 0 })));
const pitFoot = (n) => n.userData.pit && PITS.size / 2; // a tree spaces by its pit, which is where it stands on the sidewalk
const footBox = (n, m) => { const h = pitFoot(n); return h ? new THREE.Box3(new THREE.Vector3(-h, 0, -h), new THREE.Vector3(h, 0.02, h)).applyMatrix4(m) : (n.geometry.computeBoundingBox(), n.geometry.boundingBox.clone().applyMatrix4(m)); };

test('at their real proportions no placed piece reaches into the buildings or the blade signs, every footprint stands on the sidewalk and no canopy over a lane', () => {
  // the sidewalk band runs from the kerb at the road's edge (roadHalf 4.5) to the facade line; every piece (a tree's canopy
  // included: the stand-in's body is its whole box) keeps WALL m off the wall, and every piece whose top reaches the blade
  // signs' bottom (a tree's canopy, a newsstand) stays clear of the band they hang over, out from the wall over the storefronts;
  // a canopy leans over the kerb but stays out of the outer lane (3 lanes of 2.5 m: its edge at 3.75)
  const KERB = 4.5, WALL = 0.2, LANE = 3.75, BLADES = FACADE_X - BLADE.wall - BLADE.w, UNDER = BLADE.y - BLADE.w / ASPECT.blade / 2, seen = new Set(), m = new THREE.Matrix4();
  for (const [kind, entry] of Object.entries(KIT)) if (REAL[kind] || kind in RHYTHM.trees) adopt(entry.path, model(kind));
  for (let seed = 1; seed <= 40; seed++) furniture(gfx, { z0: 120 * (seed % 5), length: 120 }, null, rng(seed), { z: 120 * (seed % 5) + 60 }, LOTS.map((b) => ({ ...b, z0: b.z0 + 120 * (seed % 5), z1: b.z1 + 120 * (seed % 5) }))).traverse((n) => {
    const kind = n.userData.furniture ?? (n.userData.pit && 'tree');
    if (!kind) return;
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m);
      const b = n.userData.pit ? footBox(n, m) : new THREE.Box3().setFromBufferAttribute(n.geometry.attributes.position.clone().applyMatrix4(m)), [near, far] = [Math.abs(b.min.x), Math.abs(b.max.x)].sort((p, q) => p - q);
      assert.ok(far <= FACADE_X - WALL + 1e-6, `seed ${seed}: ${kind} reaches x ${far.toFixed(2)}`);
      if (b.max.y > UNDER) assert.ok(far <= BLADES + 1e-6, `seed ${seed}: a ${kind} ${b.max.y.toFixed(2)} m tall reaches x ${far.toFixed(2)}, the blade signs ${BLADES.toFixed(2)} from ${UNDER.toFixed(2)} m up`);
      if (kind in RHYTHM.trees && !n.userData.pit) assert.ok(near >= LANE - 1e-6, `seed ${seed}: a canopy over the lane at x ${near.toFixed(2)}`);
      if (n.geometry.userData.foot || n.userData.pit) { seen.add(kind); assert.ok(near >= KERB - 1e-6, `seed ${seed}: ${kind}'s footprint reaches x ${near.toFixed(2)}`); }
    }
  });
  assert.deepEqual([...seen].sort(), [...Object.keys(REAL), 'tree'].sort(), 'every placed kind\'s footprint was checked');
});

test('the footprints furniture spaces pieces by (FOOT) are the pieces\' own at KIT\'s sizes: the tree\'s its trunk, the guard cut', () => {
  const v = new THREE.Vector3();
  for (const [kind, [across, along]] of Object.entries(FOOT)) {
    adopt(KIT[kind].path, model(kind));
    const box = new THREE.Box3(); // the kit's own rule: the lowest 5% of the piece's height (in the kit's frame z is toward the road, across; x along the street)
    for (const p of kitParts(gfx, KIT[kind], placeholder(kind))) {
      const pos = p.geometry.attributes.position, used = p.geometry.index ? new Set(p.geometry.index.array) : null;
      for (let i = 0; i < pos.count; i++) if ((!used || used.has(i)) && v.fromBufferAttribute(pos, i).applyMatrix4(p.matrix).y <= 0.05 * KIT[kind].h + 1e-6) box.expandByPoint(v);
    }
    const size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.z / 2 - across) <= 0.01 && Math.abs(size.x / 2 - along) <= 0.01, `${kind}: FOOT [${across}, ${along}], measured [${(size.z / 2).toFixed(3)}, ${(size.x / 2).toFixed(3)}]`);
  }
  for (const k of Object.keys(RHYTHM.trees)) assert.ok(FOOT[k][0] * RHYTHM.scale[1] < PITS.size / 2 - PITS.rim, `${k}: its trunk stands inside the pit's soil`);
});

test('at their real proportions no two footprints on a side of the street overlap', () => {
  for (const [kind, entry] of Object.entries(KIT)) if (REAL[kind] || kind in RHYTHM.trees) adopt(entry.path, model(kind));
  const m = new THREE.Matrix4(), apart = (a, b, k) => a.max[k] <= b.min[k] + 1e-6 || b.max[k] <= a.min[k] + 1e-6;
  for (let seed = 1; seed <= 200; seed++) { // 200: a tree pit by a corner's traffic light came up about once in 25 chunks
    const feet = [], z0 = 120 * (seed % 9), cross = { z: z0 + 30 + ((seed * 13) % 48) }; // anywhere a chunk puts it (lib/city.js); z0 moves the kerb's pitch
    furniture(gfx, { z0, length: 120 }, null, rng(seed), cross, LOTS.map((b) => ({ ...b, z0: b.z0 + z0, z1: b.z1 + z0 }))).traverse((n) => {
      if (n.userData.pit) { for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); feet.push(['tree pit', footBox(n, m)]); } return; }
      if (!n.geometry?.userData.foot) return;
      n.geometry.computeBoundingBox();
      for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); feet.push([n.userData.furniture, n.geometry.boundingBox.clone().applyMatrix4(m)]); } // signed x: the two sides never meet
    });
    feet.forEach(([ka, a], i) => feet.slice(i + 1).forEach(([kb, b]) => assert.ok(apart(a, b, 'x') || apart(a, b, 'z'), `seed ${seed}: a ${ka} at x ${a.getCenter(new THREE.Vector3()).x.toFixed(2)}, z ${a.getCenter(new THREE.Vector3()).z.toFixed(2)} and a ${kb} at z ${b.getCenter(new THREE.Vector3()).z.toFixed(2)}`)));
  }
});

test('the street themes load every kit file before play', () => {
  for (const theme of [downtown, midtown, uptown]) for (const path of KIT_FILES) assert.ok(theme.assets.includes(path), `${theme.id} lists ${path}`);
  assert.equal(KIT_FILES.length, Object.keys(KIT).length);
});

test('a kit file that never loaded builds its code stand-in, and the model replaces it once it lands', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const entry = { path: 'hifi/furniture/not-generated.glb', h: 1, yaw: 0, glow: null };
  const before = kitParts(gfx, entry, placeholder('bench'));
  assert.ok(before.length > 0 && before.every((p) => p.matrix.equals(new THREE.Matrix4())), 'the bench stand-in');
  assert.equal(warn.mock.callCount(), 0, 'not loaded yet is not an error');
  adopt(entry.path, standIn());
  assert.ok(kitParts(gfx, entry, placeholder('bench'))[0].material.isMeshPhysicalMaterial, 'the model');
});

test('a loaded model without UVs still builds: the sedan keeps its map as it is', () => {
  withCanvas(() => {
    const g = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv'), map = new THREE.Texture({ width: 1, height: 1, px: new Uint8ClampedArray(4) });
    adopt(KIT.sedan.path, new THREE.Group().add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map }))));
    assert.equal(kitParts(gfx, { ...KIT.sedan }, placeholder('sedan'))[0].material.map, map);
  });
});

test('only the lights glow, picked by their own colours (measured on the generated textures)', () => {
  const lit = {
    lamp: [[210, 184, 129], [213, 184, 124], [226, 186, 120]], // the warm lens under the head
    lamp_double: [[236, 208, 116], [234, 186, 79], [234, 178, 56]], // the lantern glass
    traffic_light: [[244, 46, 48], [253, 74, 85], [60, 228, 54], [69, 234, 69]], // red and green lenses
    subway: [[253, 253, 253]], // the globes
    sedan: [[232, 82, 71], [247, 54, 45]], // the red tail lamp
  };
  const dark = {
    lamp: [[132, 139, 147], [51, 94, 71], [124, 137, 151]], // housing, pole
    lamp_double: [[143, 145, 153], [55, 91, 69], [170, 169, 179]],
    traffic_light: [[238, 177, 57], [242, 193, 72], [243, 148, 45], [78, 78, 87]], // the yellow housing (amber cannot be told from it)
    subway: [[48, 114, 78], [184, 211, 196]],
    sedan: [[56, 185, 177], [251, 243, 185], [73, 72, 77]], // teal paint, the cream headlights, the grey trim
  };
  for (const [kind, colours] of Object.entries(lit)) for (const c of colours) assert.ok(KIT[kind].glow(...c), `${kind} lights ${c}`);
  for (const [kind, colours] of Object.entries(dark)) for (const c of colours) assert.ok(!KIT[kind].glow(...c), `${kind} keeps ${c} dark`);
  assert.deepEqual(Object.keys(KIT).filter((k) => KIT[k].glow).sort(), Object.keys(lit).sort(), 'nothing else glows (the van has no red lamps)');
});

test('a lit kit piece glows through an emissive map of its own texels; an unlit one has none', () => {
  withCanvas(() => {
    const map = new THREE.Texture({ px: new Uint8ClampedArray([210, 184, 129, 255, 132, 139, 147, 255]) }); // lens, housing
    adopt(KIT.lamp.path, standIn(FRONT.lamp, map));
    const lamp = kitParts(gfx, { ...KIT.lamp }, placeholder('lamp'))[0].material;
    assert.deepEqual([...lamp.emissiveMap.image.px], [210, 184, 129, 255, 0, 0, 0, 255], 'the lens alone');
    assert.ok(lamp.emissive.getHexString() === 'ffffff' && lamp.emissiveIntensity > 1);
    adopt(KIT.traffic_light.path, standIn([1, 0, 0], map));
    assert.equal(kitParts(gfx, { ...KIT.traffic_light }, placeholder('traffic_light'))[0].material.emissiveIntensity, 1.2, 'the signal glows softer than GLOW (board 17c)');
    assert.equal(lamp.emissiveIntensity, 1.2, 'the lamps glow 1.2 by day, lit at noon as in the frames (Task 32, board 24; they were GLOW, 5)');
    adopt(KIT.bench.path, standIn([1, 0, 0], map));
    assert.equal(kitParts(gfx, { ...KIT.bench }, placeholder('bench'))[0].material.emissiveMap, null);
  });
});

test('the lamp\'s green paint turns charcoal blue-grey, its shading kept, on a copy of its map; its lens and steel stay (Task 32, board 24)', () => {
  withCanvas(() => {
    const lens = [210, 184, 129, 255], steel = [132, 139, 147, 255], green = [51, 94, 71, 255], image = { px: new Uint8ClampedArray([...lens, ...steel, ...green]) };
    adopt(KIT.lamp.path, standIn(FRONT.lamp, new THREE.Texture(image)));
    const m = kitParts(gfx, { ...KIT.lamp }, placeholder('lamp'))[0].material, px = m.map.image.px, [r, g, b] = px.slice(8, 11);
    assert.deepEqual([...px.slice(0, 8)], [...lens, ...steel], 'the lens and the steel as they were');
    assert.ok(b > g && g > r && b - r < 20 && r + g + b <= 51 + 94 + 71, `the green ${green} painted ${[r, g, b]}`);
    assert.deepEqual([...image.px.slice(8)], green, 'the model\'s own map is untouched');
    assert.deepEqual([...m.emissiveMap.image.px], [...lens, 0, 0, 0, 255, 0, 0, 0, 255], 'the lens alone glows');
  });
});

// The lamps glow 1.2 by day and 2 at dusk (`lit`), per theme: one shared paint let the last chunk built set every theme's glow.
test('a day theme\'s lamps and a dusk theme\'s, built in one session, each keep their own glow, and the dusk paint goes with the file', () => {
  withCanvas(() => {
    adopt(KIT.lamp.path, new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tripo(new THREE.Texture({ px: new Uint8ClampedArray([210, 184, 129, 255]) }))))); // one mesh, one material, as generated
    const lamps = (style, z0) => { const out = new Set(); furniture(gfx, { z0, length: 120 }, style, rng(1), null).traverse((n) => { if (n.userData.furniture === 'lamp') out.add(n.material); }); return [...out]; };
    const [day] = lamps({ id: 'downtown', lit: 0 }, 0), [dusk] = lamps({ id: 'uptown', lit: 0.8 }, 120), [again] = lamps({ id: 'midtown', lit: 0 }, 240);
    assert.ok(day.emissiveMap && day.emissiveIntensity === 1.2 && dusk.emissiveIntensity === RHYTHM.dusk && RHYTHM.dusk === 2, `day ${day.emissiveIntensity}, dusk ${dusk.emissiveIntensity}`);
    assert.ok(again === day && day.emissiveIntensity === 1.2, 'the day paint kept its glow after a dusk chunk');
    assert.ok(dusk.emissiveMap === day.emissiveMap && dusk.map === day.map && dusk.userData.shared, 'the dusk paint shares the day\'s textures, and chunks never free it');
    assert.equal(lamps({ id: 'uptown', lit: 0.8 }, 360)[0], dusk, 'one dusk paint for every chunk');
    const n = counts([dusk, day.emissiveMap]);
    freeOnly(KIT.lamp.path);
    assert.deepEqual([...n.values()], [1, 1], 'the dusk paint freed with its file, the glow once');
  });
});

// The guard cut (Task 32, Caedon's board 24 pick "as prototyped": the guards gone): the tree's iron cage, its soil and the root flare
// are dropped from a clone of the loaded geometry, the trunk standing on the pit. The new tree (tree2, his T3) stands beside it in the rhythm.
test('the tree stands free of its guard: below 1.1 m nothing but the trunk, the canopy as it was, on a clone shared per load and freed with it', () => {
  const tree = TREE(), loaded = tree.children[0].geometry, tris = loaded.index.count;
  adopt(KIT.tree.path, tree);
  const [p] = kitParts(gfx, KIT.tree, placeholder('tree')), g = p.geometry, v = new THREE.Vector3(), used = [...new Set(g.index.array)];
  assert.ok(g !== loaded && g.userData.shared && loaded.index.count === tris, 'a shared clone; the loaded geometry untouched');
  assert.ok(g.index.count < tris && g.index.count > 0, `${g.index.count / 3} of ${tris / 3} triangles kept`);
  let low = Infinity, reach = 0, top = 0;
  for (const i of used) {
    v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(p.matrix);
    const r = Math.hypot(v.x, v.z);
    if (v.y < 1.1) assert.ok(r <= 0.45 + 1e-6, `a vertex ${r.toFixed(2)} m from the trunk's axis at y ${v.y.toFixed(2)}`); // the trunk measured on tree.glb, not the knob
    if (v.y < GUARD.top) assert.ok(r <= GUARD.out + 1e-6, `the guard left at r ${r.toFixed(2)}, y ${v.y.toFixed(2)}`);
    low = Math.min(low, v.y); top = Math.max(top, v.y); if (v.y > 2.2) reach = Math.max(reach, r);
  }
  const kept = new Set(used), src = loaded.attributes.position; let cage = 0; // the guard box's own corners (r 1.73 at y 0 and 1.9) are out of the index
  for (let i = 0; i < src.count; i++) { v.fromBufferAttribute(src, i).applyMatrix4(p.matrix); if (v.y < GUARD.top && Math.hypot(v.x, v.z) > 1) { cage++; assert.ok(!kept.has(i), `the guard's vertex ${i} kept`); } }
  assert.ok(cage > 0, 'the stand-in has its guard');
  assert.ok(Math.abs(low) < 1e-6 && Math.abs(top - KIT.tree.h) < 1e-6 && Math.abs(reach - 2.31) < 0.01, `the trunk from ${low.toFixed(3)} m, the top at ${top.toFixed(2)}, the canopy's reach ${reach.toFixed(2)}`);
  const n = counts([g]);
  freeOnly(KIT.tree.path);
  assert.equal(n.get(g), 1, 'the cut freed with its file');
});

test('the tree is matte: specular down, its leaves rough from their own texels, the env dimmed on the material (Task 32, board 24)', () => {
  withCanvas(() => {
    const leaf = [112, 160, 64, 255], bark = [92, 70, 52, 255], tree = TREE();
    tree.children[0].material.map = new THREE.Texture({ px: new Uint8ClampedArray([...leaf, ...bark]) });
    adopt(KIT.tree.path, tree);
    const m = kitParts(gfx, KIT.tree, placeholder('tree'))[0].material;
    assert.equal(m.specularIntensity, 0.4);
    assert.ok(m.roughness === 1 && m.roughnessMap.colorSpace === THREE.NoColorSpace, 'the roughness from the map alone');
    assert.deepEqual([...m.roughnessMap.image.px], [230, 230, 230, 255, 191, 191, 191, 255], 'the leaves 0.9, the trunk 0.75');
    // three r186 writes scene.environmentIntensity over envMapIntensity on a material without its own envMap: the shader's
    // uniform reads a fifth of whatever the look writes
    const shader = { uniforms: { envMapIntensity: { value: 1 } } };
    m.onBeforeCompile(shader);
    shader.uniforms.envMapIntensity.value = 0.4;
    assert.ok(Math.abs(shader.uniforms.envMapIntensity.value - 0.08) < 1e-9, `env ${shader.uniforms.envMapIntensity.value}`);
  });
});

// The new tree (Task 32 C7; Caedon's T3 from page 26, Tripo, "Download it" 2026-10-16) comes in its own flat pit: the kit cuts the slab
// so it stands in the kit's pit as the first tree does, one pit size and colour on every sidewalk (the tint and the scale would recolour
// and resize a model pit).
test('tree2 stands on its own slim trunk, its model pit cut away: below 1.1 m nothing but the trunk, the canopy from 2.1 m to its 6 m', () => {
  const tree = TREE2(), loaded = tree.children[0].geometry, tris = loaded.index.count;
  adopt(KIT.tree2.path, tree);
  const [p] = kitParts(gfx, KIT.tree2, placeholder('tree2')), g = p.geometry, v = new THREE.Vector3(), used = [...new Set(g.index.array)];
  assert.ok(g !== loaded && g.userData.shared && loaded.index.count === tris && g.index.count < tris, 'a shared clone, the loaded geometry untouched');
  let low = Infinity, reach = 0, top = 0, under = Infinity;
  for (const i of used) {
    v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(p.matrix);
    const r = Math.hypot(v.x, v.z);
    if (v.y < 1.1) assert.ok(r <= 0.32 + 1e-6, `a vertex ${r.toFixed(2)} m from the trunk's axis at y ${v.y.toFixed(2)}`); // the trunk measured on tree2.glb
    if (r > 0.45) under = Math.min(under, v.y);
    low = Math.min(low, v.y); top = Math.max(top, v.y); reach = Math.max(reach, r);
  }
  const kept = new Set(used), src = loaded.attributes.position;
  for (let i = 0; i < src.count; i++) { v.fromBufferAttribute(src, i).applyMatrix4(p.matrix); if (v.y < 0.2 && Math.hypot(v.x, v.z) > 1) assert.ok(!kept.has(i), `the slab's vertex ${i} kept`); }
  assert.ok(Math.abs(low) < 1e-6 && Math.abs(top - KIT.tree2.h) < 1e-6 && Math.abs(reach - 2.26) < 0.01 && Math.abs(under - 2.1) < 0.01, `the trunk from ${low.toFixed(3)} m, the canopy from ${under.toFixed(2)} to ${top.toFixed(2)}, its reach ${reach.toFixed(2)}`);
  assert.equal(KIT.tree2.h, 6, 'tree.glb\'s 6 m: at the rhythm\'s scale 0.75-0.9 it tops out 4.5-5.4 m, about 5, the canopy from 1.6-1.9 m');
});

test('tree2 is matte as the first tree, its leaves lifted to tree.glb\'s green on a copy of its map and its bark kept, so one tint serves both', () => {
  withCanvas(() => {
    const leaf = [79, 130, 40, 255], dark = [31, 72, 6, 255], bark = [138, 94, 49, 255], stone = [137, 134, 133, 255], tree = TREE2();
    const image = { px: new Uint8ClampedArray([...leaf, ...dark, ...bark, ...stone]) };
    tree.children[0].material.map = new THREE.Texture(image);
    adopt(KIT.tree2.path, tree);
    const m = kitParts(gfx, KIT.tree2, placeholder('tree2'))[0].material, px = m.map.image.px;
    assert.deepEqual([...px.slice(0, 4)], [118, 162, 68, 255], 'the mean leaf (#4f8228, measured) lifted to tree.glb\'s mean (#76a244)');
    assert.ok(KIT.tree2.matte.leaf(...px.slice(4, 7)), `the dark leaf ${[...px.slice(4, 7)]} still a leaf`);
    assert.deepEqual([...px.slice(8)], [...bark, ...stone], 'the bark and the stone as they were');
    assert.deepEqual([...image.px], [...leaf, ...dark, ...bark, ...stone], 'the model\'s own map is untouched');
    assert.ok(m.specularIntensity === 0.4 && m.roughness === 1, 'matte');
    assert.deepEqual([...m.roughnessMap.image.px].filter((_, i) => i % 4 === 0), [230, 230, 191, 191], 'the leaves 0.9, the bark and stone 0.75');
  });
});

test('the sedan paints its cream rear lamp red on a copy of its colour map, keeps its cream headlights, and both rear lamps glow', () => {
  withCanvas(() => {
    // a 4 x 1 colour map: texels 0 (the cream lamp) and 1 (the teal body) lie on a triangle at the rear (-x), texels 2 and 3
    // (the cream headlights) on one at the front
    const cream = [251, 243, 185, 255], teal = [56, 185, 177, 255], image = { width: 4, height: 1, px: new Uint8ClampedArray([...cream, ...teal, ...cream, ...cream]) };
    const map = Object.assign(new THREE.Texture(image), { flipY: false, colorSpace: THREE.SRGBColorSpace });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, -0.9, 0, 0.1, -0.9, 0.1, 0, 1, 0, 0, 0.9, 0, 0.1, 0.9, 0.1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0], 2));
    adopt(KIT.sedan.path, new THREE.Group().add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map }))));
    const m = kitParts(gfx, { ...KIT.sedan }, placeholder('sedan'))[0].material;
    const [rear, body, front] = [m.map.image.px.slice(0, 4), m.map.image.px.slice(4, 8), m.map.image.px.slice(8)];
    assert.ok(KIT.sedan.glow(...rear), `the rear lamp is red: ${rear}`);
    assert.deepEqual([...body], teal, 'the paint beside it stays');
    assert.deepEqual([...front], [...cream, ...cream], 'the headlights stay cream');
    assert.deepEqual([...image.px], [...cream, ...teal, ...cream, ...cream], 'the model\'s own map is untouched');
    assert.ok(m.map !== map && m.map.flipY === false && m.map.colorSpace === THREE.SRGBColorSpace, 'a copy, read the way the source is');
    assert.deepEqual([...m.emissiveMap.image.px], [...rear, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255], 'the rear lamp glows, nothing else');
  });
});

test('a kit file released and loaded again is built from the new model, not the freed one', () => {
  adopt(KIT.bin.path, standIn());
  const before = kitParts(gfx, KIT.bin, placeholder('bin'));
  release(KIT_FILES.filter((p) => p !== KIT.bin.path)); // a level without bins frees the file
  adopt(KIT.bin.path, standIn()); // a later level loads it again: new geometry and materials
  const after = kitParts(gfx, KIT.bin, placeholder('bin'));
  assert.notEqual(after[0].geometry, before[0].geometry, 'the reloaded geometry');
  assert.ok(after[0].material !== before[0].material && after[0].material.isMeshPhysicalMaterial, 'fresh paint');
  assert.equal(kitParts(gfx, KIT.bin, placeholder('bin')), after, 'built once per load');
});

test('a loaded kit model whose build throws warns once and stays a stand-in, without building again every chunk', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  let builds = 0;
  const entry = { path: 'hifi/furniture/broken.glb', h: 1, get yaw() { builds++; return 0; }, glow: null };
  adopt(entry.path, new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))); // gloss takes a MeshStandardMaterial
  for (let chunk = 0; chunk < 3; chunk++) assert.ok(kitParts(gfx, entry, placeholder('bench')).every((p) => p.matrix.equals(new THREE.Matrix4())), 'the bench stand-in');
  assert.equal(builds, 1, 'built once, not every chunk');
  assert.equal(warn.mock.callCount(), 1, 'one warning');
  assert.match(String(warn.mock.calls[0].arguments[0]), /broken\.glb/);
});

test('a released kit file frees its paint and the glow the paint made, and leaves the model\'s own map to release', () => {
  withCanvas(() => {
    const map = new THREE.Texture({ px: new Uint8ClampedArray([210, 184, 129, 255, 132, 139, 147, 255]) }); // lens, housing
    adopt(KIT.lamp.path, new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tripo(map)))); // one mesh, one material, as generated
    const paint = kitParts(gfx, KIT.lamp, placeholder('lamp'))[0].material, n = counts([paint, paint.emissiveMap, map]);
    freeOnly(KIT.lamp.path);
    assert.deepEqual([...n.values()], [1, 1, 1], 'the paint and its glow freed once each; the colour map once, by release');
  });
});

test('a released vehicle file frees the traffic made from its paint, and no cache keeps it: a reload drives new copies', () => {
  const kinds = ['sedan', 'van', 'taxi'], cars = kinds.map((k) => KIT[k].path);
  const load = () => { for (const path of cars) adopt(path, new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), tripo()))); };
  const drive = () => { const made = new Set(); for (let seed = 1; seed <= 10; seed++) traffic(gfx, {}, null, rng(seed), { z: 60 }).traverse((m) => { if (m.userData.traffic) made.add(m.material).add(m.geometry); }); return made; };
  load();
  const made = drive(), n = counts([...made]), paints = kinds.map((k) => kitParts(gfx, KIT[k], placeholder(k))[0].material);
  freeOnly(...cars);
  assert.ok(made.size >= 4 && [...n.values()].every((c) => c === 1), `each freed once: ${[...n.values()]}`);
  load();
  assert.ok([...drive()].every((x) => !made.has(x)), 'the reload drives new copies');
  // the session's material cache does not hold the old copy (and through it the freed file's images) under the old paint's key
  for (const p of paints) { const probe = { userData: {} }; assert.equal(material(`traffic/${p.uuid}`, () => probe), probe, 'nothing cached for the old paint'); }
});
