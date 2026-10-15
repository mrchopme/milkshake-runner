import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt, release } from '../src/assets.js';
import { KIT, KIT_FILES, kitParts, placeholder } from '../packs/hifi/lib/kit.js';
import { furniture, FOOT } from '../packs/hifi/lib/furniture.js';
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
// the footprint, so it fits and anchors as the real model does.
const REAL = {
  lamp: [[-0.1516, -0.49059, -0.27532], [0.15129, 0.4908, 0.27511], [-0.0895, 0.0412], [0.1513, 0.2751]],
  traffic_light: [[-0.20752, -0.4896, -0.16442], [0.20794, 0.48998, 0.16374], [-0.2075, -0.1284], [0.0495, 0.1288]],
  hydrant: [[-0.36861, -0.48921, -0.40538], [0.36849, 0.48897, 0.40539], [-0.2352, -0.2412], [0.2347, 0.241]],
  bench: [[-0.2859, -0.38101, -0.49045], [0.2851, 0.38177, 0.49005], [-0.2379, -0.4887], [0.2782, 0.4869]],
  bin: [[-0.28695, -0.48944, -0.28576], [0.28743, 0.49029, 0.28623], [-0.2187, -0.2194], [0.2148, 0.216]],
  tree: [[-0.32407, -0.4901, -0.33912], [0.3248, 0.49014, 0.33846], [-0.1973, -0.2123], [0.2031, 0.1914]],
  newsstand: [[-0.35633, -0.43682, -0.49027], [0.35603, 0.43757, 0.49056], [-0.3293, -0.3661], [0.2165, 0.3652]],
  bus_shelter: [[-0.30145, -0.45037, -0.48947], [0.30162, 0.4506, 0.48967], [-0.2919, -0.4717], [0.2865, 0.4729]],
  subway: [[-0.48947, -0.39242, -0.41083], [0.48956, 0.39741, 0.4108], [-0.4895, -0.4108], [0.4896, 0.4107]],
};
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
  for (const [kind, entry] of Object.entries(KIT)) adopt(entry.path, REAL[kind] ? real(REAL[kind]) : standIn(FRONT[kind]));
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

test('at their real proportions no placed piece reaches into the buildings or the blade signs, and every footprint stands on the sidewalk', () => {
  // the sidewalk band runs from the kerb at the road's edge (roadHalf 4.5) to the facade line; every piece (a tree's canopy
  // included: the stand-in's body is its whole box) keeps WALL m off the wall, and every piece whose top reaches the blade
  // signs' bottom (a tree's canopy, a newsstand) stays clear of the band they hang over, out from the wall over the storefronts
  const KERB = 4.5, WALL = 0.2, BLADES = FACADE_X - BLADE.wall - BLADE.w, UNDER = BLADE.y - BLADE.w / ASPECT.blade / 2, seen = new Set(), m = new THREE.Matrix4();
  for (const [kind, entry] of Object.entries(KIT)) if (REAL[kind]) adopt(entry.path, real(REAL[kind]));
  for (let seed = 1; seed <= 40; seed++) furniture(gfx, { z0: 0, length: 120 }, null, rng(seed), { z: 60 }).traverse((n) => {
    const kind = n.userData.furniture;
    if (!kind) return;
    n.geometry.computeBoundingBox();
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m);
      const b = n.geometry.boundingBox.clone().applyMatrix4(m), [near, far] = [Math.abs(b.min.x), Math.abs(b.max.x)].sort((p, q) => p - q);
      assert.ok(far <= FACADE_X - WALL + 1e-6, `seed ${seed}: ${kind} reaches x ${far.toFixed(2)}`);
      if (b.max.y > UNDER) assert.ok(far <= BLADES + 1e-6, `seed ${seed}: a ${kind} ${b.max.y.toFixed(2)} m tall reaches x ${far.toFixed(2)}, the blade signs ${BLADES.toFixed(2)} from ${UNDER.toFixed(2)} m up`);
      if (n.geometry.userData.foot) { seen.add(kind); assert.ok(near >= KERB - 1e-6, `seed ${seed}: ${kind}'s footprint reaches x ${near.toFixed(2)}`); }
    }
  });
  assert.deepEqual([...seen].sort(), Object.keys(REAL).sort(), 'every placed kind\'s footprint was checked');
});

test('the footprints furniture spaces pieces by (FOOT) are the pieces\' own at KIT\'s sizes', () => {
  for (const [kind, [across, along]] of Object.entries(FOOT)) {
    adopt(KIT[kind].path, real(REAL[kind]));
    const p = kitParts(gfx, KIT[kind], placeholder(kind)).find((x) => x.geometry.userData.foot), size = new THREE.Vector3();
    p.geometry.computeBoundingBox();
    p.geometry.boundingBox.clone().applyMatrix4(p.matrix).getSize(size); // the kit's frame: z toward the road (across), x along the street
    assert.ok(Math.abs(size.z / 2 - across) <= 0.01 && Math.abs(size.x / 2 - along) <= 0.01, `${kind}: FOOT [${across}, ${along}], measured [${(size.z / 2).toFixed(3)}, ${(size.x / 2).toFixed(3)}]`);
  }
});

test('at their real proportions no two footprints on a side of the street overlap', () => {
  for (const [kind, entry] of Object.entries(KIT)) if (REAL[kind]) adopt(entry.path, real(REAL[kind]));
  const m = new THREE.Matrix4(), apart = (a, b, k) => a.max[k] <= b.min[k] + 1e-6 || b.max[k] <= a.min[k] + 1e-6;
  for (let seed = 1; seed <= 200; seed++) { // 200: a tree pit by a corner's traffic light came up about once in 25 chunks
    const feet = [], cross = { z: 30 + ((seed * 13) % 48) }; // anywhere a chunk puts it (lib/city.js)
    furniture(gfx, { z0: 0, length: 120 }, null, rng(seed), cross).traverse((n) => {
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
    assert.equal(kitParts(gfx, { ...KIT.traffic_light }, placeholder('traffic_light'))[0].material.emissiveIntensity, 1.2, 'the signal glows softer than the lamps (board 17c)');
    assert.ok(lamp.emissiveIntensity > 1.2, 'the lamps keep GLOW');
    adopt(KIT.bench.path, standIn([1, 0, 0], map));
    assert.equal(kitParts(gfx, { ...KIT.bench }, placeholder('bench'))[0].material.emissiveMap, null);
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

// release() disposes a freed file's materials; everything made from them must go too, or the look's CSM (which holds every lit
// material until its dispose) pins one more copy each level cycle.
const counts = (things) => { const n = new Map(things.map((x) => [x, 0])); for (const x of things) x.addEventListener('dispose', () => n.set(x, n.get(x) + 1)); return n; };
const freeOnly = (...paths) => release(KIT_FILES.filter((p) => !paths.includes(p)));

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
