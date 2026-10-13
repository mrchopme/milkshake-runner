import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import { adopt } from '../src/assets.js';
import { KIT, kitParts, placeholder } from '../packs/hifi/lib/kit.js';
import { furniture } from '../packs/hifi/lib/furniture.js';

// A stand-in for a generated kit model: a unit body and a nub on its front, Tripo's material (metal-rough map, metalness 1).
// Every generated model faces +x, except the lamp, whose arm reaches -z (task-23-models.md, measured on the decoded meshes).
const FRONT = { lamp: [0, 0, -1] };
const standIn = ([x, y, z] = [1, 0, 0], map = null) => {
  const paint = new THREE.MeshStandardMaterial({ map, metalness: 1, metalnessMap: new THREE.Texture(), roughnessMap: new THREE.Texture() });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paint), nub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), paint);
  nub.position.set(0.6 * x, 0.6 * y, 0.6 * z);
  return new THREE.Group().add(body, nub);
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

test('each kit piece is painted once without the generator\'s random metal, and every copy in every chunk shares that paint', () => {
  for (const [kind, entry] of Object.entries(KIT)) adopt(entry.path, standIn(FRONT[kind]));
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

test('a kit file that never loaded builds its code stand-in, and the model replaces it once it lands', () => {
  const entry = { path: 'hifi/furniture/not-generated.glb', h: 1, yaw: 0, glow: null };
  const before = kitParts(gfx, entry, placeholder('bench'));
  assert.ok(before.length > 0 && before.every((p) => p.matrix.equals(new THREE.Matrix4())), 'the bench stand-in');
  adopt(entry.path, standIn());
  assert.ok(kitParts(gfx, entry, placeholder('bench'))[0].material.isMeshPhysicalMaterial, 'the model');
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
    // a 2 x 1 colour map, both texels the cream lamp: texel 0 lies on a triangle at the rear (-x), texel 1 on one at the front
    const cream = [251, 243, 185, 255], image = { width: 2, height: 1, px: new Uint8ClampedArray([...cream, ...cream]) };
    const map = Object.assign(new THREE.Texture(image), { flipY: false, colorSpace: THREE.SRGBColorSpace });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, -0.9, 0, 0.1, -0.9, 0.1, 0, 1, 0, 0, 0.9, 0, 0.1, 0.9, 0.1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0], 2));
    adopt(KIT.sedan.path, new THREE.Group().add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map }))));
    const m = kitParts(gfx, { ...KIT.sedan }, placeholder('sedan'))[0].material;
    const [rear, front] = [m.map.image.px.slice(0, 4), m.map.image.px.slice(4)];
    assert.ok(KIT.sedan.glow(...rear), `the rear lamp is red: ${rear}`);
    assert.deepEqual([...front], cream, 'the headlight stays cream');
    assert.deepEqual([...image.px], [...cream, ...cream], 'the model\'s own map is untouched');
    assert.ok(m.map !== map && m.map.flipY === false && m.map.colorSpace === THREE.SRGBColorSpace, 'a copy, read the way the source is');
    assert.deepEqual([...m.emissiveMap.image.px], [...rear, 0, 0, 0, 255], 'the rear lamp glows, the headlight does not');
  });
});
