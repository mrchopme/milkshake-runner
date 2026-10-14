import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt } from '../src/assets.js';
import { KIT, KIT_FILES, kitParts, placeholder } from '../packs/hifi/lib/kit.js';
import { furniture } from '../packs/hifi/lib/furniture.js';
import { FACADE_X } from '../packs/hifi/lib/buildings.js';
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
// The placed pieces at their real proportions, measured on the decoded GLBs (model units): the bounding box, and the centre
// (x, z) of the lowest 5% of the height, where the piece stands. A stand-in: a body filling the box above that band and a
// speck at the footprint, so it fits and anchors as the real model does.
const REAL = {
  lamp: [[-0.1516, -0.49059, -0.27532], [0.15129, 0.4908, 0.27511], [0.0309, 0.1582]],
  traffic_light: [[-0.20752, -0.4896, -0.16442], [0.20794, 0.48998, 0.16374], [-0.079, 0.0002]],
  hydrant: [[-0.36861, -0.48921, -0.40538], [0.36849, 0.48897, 0.40539], [-0.0002, -0.0001]],
  bench: [[-0.2859, -0.38101, -0.49045], [0.2851, 0.38177, 0.49005], [0.0201, -0.0009]],
  bin: [[-0.28695, -0.48944, -0.28576], [0.28743, 0.49029, 0.28623], [-0.002, -0.0017]],
  tree: [[-0.32407, -0.4901, -0.33912], [0.3248, 0.49014, 0.33846], [0.0029, -0.0104]],
  newsstand: [[-0.35633, -0.43682, -0.49027], [0.35603, 0.43757, 0.49056], [-0.0564, -0.0005]],
  bus_shelter: [[-0.30145, -0.45037, -0.48947], [0.30162, 0.4506, 0.48967], [-0.0027, 0.0006]],
  subway: [[-0.48947, -0.39242, -0.41083], [0.48956, 0.39741, 0.4108], [0, -0.0001]],
};
const real = ([min, max, foot]) => {
  const paint = tripo(), h = max[1] - min[1], body = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], 0.94 * h, max[2] - min[2]), paint);
  body.position.set((min[0] + max[0]) / 2, min[1] + 0.53 * h, (min[2] + max[2]) / 2);
  const speck = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), paint);
  speck.position.set(foot[0], min[1] + 0.005, foot[1]);
  return new THREE.Group().add(body, speck);
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
  assert.ok(a.max.z > 3, 'the arm reaches toward the road');
});

test('each kit piece is painted once without the generator\'s random metal, and every copy in every chunk shares that paint', () => {
  for (const [kind, entry] of Object.entries(KIT)) adopt(entry.path, REAL[kind] ? real(REAL[kind]) : standIn(FRONT[kind])); // real sizes, for the facade test too
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

test('at their real proportions no placed piece reaches into the buildings', () => {
  const seen = new Set(), m = new THREE.Matrix4();
  for (let seed = 1; seed <= 40; seed++) furniture(gfx, { z0: 0, length: 120 }, null, rng(seed), { z: 60 }).traverse((n) => {
    if (!n.userData.furniture) return;
    seen.add(n.userData.furniture);
    n.geometry.computeBoundingBox();
    for (let i = 0; i < n.count; i++) {
      n.getMatrixAt(i, m);
      const b = n.geometry.boundingBox.clone().applyMatrix4(m), far = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
      assert.ok(far <= FACADE_X + 1e-6, `seed ${seed}: ${n.userData.furniture} reaches x ${far.toFixed(2)}`);
    }
  });
  assert.deepEqual([...seen].sort(), Object.keys(REAL).sort(), 'every placed kind was measured');
});

test('the street themes load every kit file before play', () => {
  for (const theme of [downtown, midtown, uptown]) for (const path of KIT_FILES) assert.ok(theme.assets.includes(path), `${theme.id} lists ${path}`);
  assert.equal(KIT_FILES.length, Object.keys(KIT).length);
});

test('a kit file that never loaded builds its code stand-in, and the model replaces it once it lands', () => {
  const entry = { path: 'hifi/furniture/not-generated.glb', h: 1, yaw: 0, glow: null };
  const before = kitParts(gfx, entry, placeholder('bench'));
  assert.ok(before.length > 0 && before.every((p) => p.matrix.equals(new THREE.Matrix4())), 'the bench stand-in');
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
