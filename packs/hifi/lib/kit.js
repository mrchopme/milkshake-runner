import { material } from './materials.js';
import { freeWith, gloss, glowMap, redraw, roughMap } from './paint.js';
// The lights, picked from each model's own texels (measured on the generated textures, Task 23): only these glow.
const warm = (r, g, b) => r > 170 && r - b > 45;                               // the lamp's lens, the double lamp's lanterns
const signal = (r, g, b) => (r > 200 && g < 100 && b < 110) || (g > 180 && r < 120 && b < 120); // red, green; the middle lens is the housing's yellow
const globe = (r, g, b) => r > 245 && g > 245 && b > 245;                     // the subway's white globes
const red = (r, g, b) => r > 150 && g < 90 && b < 90;                         // a red tail lamp (the taxi's isLamp)
const leaf = (r, g, b) => g > r + 20 && g > b + 40;                           // the tree's leaves (~#70a040); the bark and the guard's iron fail it
// ponytail: calibration knob (Task 32, Caedon's board 24 pick "as prototyped": charcoal lamps, as the style frames): the lamp's dark-green
// paint (~#306040-#507060: g past r, at least b) turned blue-grey from each texel's mean, so the model's own shading stays: ~#305a44 -> ~#3a3d48.
// The lens and the steel fail the test.
const charcoal = (px, i) => { const [r, g, b] = [px[i], px[i + 1], px[i + 2]], l = (r + g + b) / 3; if (g > r + 12 && g >= b) px.set([l * 0.8, l * 0.84, l * 0.98], i); };
// ponytail: calibration knobs, metres at KIT's 6 m (Task 32, board 24; measured on the decoded tree.glb, see the P5 report): the generated
// tree stands in an iron guard, a 2.45 m square box from the ground to 1.9 m, its trunk (r ~0.42) on soil at ~0.75 m with a root flare out
// to r 0.8 between 0.8 and 1.5 m. A triangle wholly below `top` that is wholly below `free` or wholly beyond `out` from the trunk's axis goes
// (the guard, its soil, the flare); the trunk's kept vertices below `free` drop to the ground, pulled in to `trunk`, so it stands in its pit.
export const GUARD = { top: 1.95, free: 1.6, out: 0.8, trunk: 0.45 };
// ponytail: calibration knobs, metres at KIT's 6 m (Task 32 C7, Caedon's T3; measured on the decoded tree2.glb): the new tree stands on
// its own pit, a 3 m square slab 0.12 m deep, its trunk r 0.31 at the slab and 0.27 under the canopy. Every triangle below 0.2 m goes
// (the slab, the trunk's cap); the trunk's foot drops to the ground within r 0.32, so it stands in the kit's pit as the first tree does.
const SLAB = { top: 0.2, free: 0.2, out: 0, trunk: 0.32 };
// ponytail: calibration knob (Task 32 C7): tree2's leaves (mean #4f8228, measured over its map's leaf texels) times LIFT come to tree.glb's
// mean (#76a244), so TINT (lib/furniture.js), calibrated on tree.glb's rendered green, lands both trees on the frames' (keying TINT's
// `from` by model instead multiplied tree2's blue 6x, the trunk going mauve). Its bark and nothing else stay as generated.
const LIFT = [1.49, 1.25, 1.7];
const lift = (px, i) => { if (leaf(px[i], px[i + 1], px[i + 2])) px.set([px[i] * LIFT[0], px[i + 1] * LIFT[1], px[i + 2] * LIFT[2]], i); }; // clamped at 255
// matte (style gap 12): the leaves' roughness `rough[0]` from their own texels, the rest `rough[1]`, the specular and the env reflection down
// (tree2's leaf texels measured: `leaf` takes 99% of its greens and none of its bark or stone, so it keeps the thresholds)
const MATTE = { leaf, rough: [0.9, 0.75], specular: 0.4, env: 0.2 };
// Furniture and side-street vehicles. path: the generated model; h: its height in metres (board 15); yaw: turns its front
// (+x on every generated model; the lamp's arm reaches -z) to +z, the way the piece faces; glow: the texel test of its lights;
// repaint: texels recoloured before the glow (see recolour); texels: each texel of the whole map redrawn by it, before the glow;
// bright: its glow strength, GLOW unless set; cut: the base cut away (cutGuard: the first tree's guard, the second's slab); matte:
// the matte dress (MATTE). Until the model loads, a code placeholder stands in.
// ponytail: calibration knobs.
const FRONT = -Math.PI / 2;
export const KIT = {
  // h 4.5 (was 6.5; Caedon, 2026-10-14, board 18): the lamps stood too big. bright 1.2 (was GLOW; Task 32, board 24): lit in every scene as
  // in the frames, softly by day; a dusk theme's chunks wear a copy at RHYTHM.dusk (lib/furniture.js)
  lamp: { path: 'hifi/furniture/lamp.glb', h: 4.5, yaw: Math.PI, glow: warm, texels: charcoal, bright: 1.2 },
  lamp_double: { path: 'hifi/furniture/lamp_double.glb', h: 6.5, yaw: FRONT, glow: warm }, // arms along the street, clear of the facades
  // bright 1.2 (Caedon, 2026-10-14, board 17c): at GLOW the red lens washes out to pink and the green throws a halo over the housing
  traffic_light: { path: 'hifi/furniture/traffic_light.glb', h: 5.5, yaw: FRONT, glow: signal, bright: 1.2 },
  hydrant: { path: 'hifi/furniture/hydrant.glb', h: 0.8, yaw: FRONT, glow: null },
  bench: { path: 'hifi/furniture/bench.glb', h: 0.9, yaw: FRONT, glow: null },
  bin: { path: 'hifi/furniture/bin.glb', h: 0.9, yaw: FRONT, glow: null },
  bin_box: { path: 'hifi/furniture/bin_box.glb', h: 1.0, yaw: FRONT, glow: null },
  planter: { path: 'hifi/furniture/planter.glb', h: 1.0, yaw: FRONT, glow: null },
  tree: { path: 'hifi/furniture/tree.glb', h: 6.0, yaw: FRONT, glow: null, cut: GUARD, matte: MATTE }, // board 15's: on the 6 m sidewalk its 4 m canopy clears the facades and the blade signs
  // tree.glb's 6 m, so the two models stand alike in the rhythm (4.5-5.4 m at its scale); a third of it clear trunk, as prompted.
  // Its file optimised at --texture-size 1024 like tree.glb's (at 2048 its nearly flat normal map alone cost 22.4 MB of GPU)
  tree2: { path: 'hifi/furniture/tree2.glb', h: 6.0, yaw: FRONT, glow: null, cut: SLAB, texels: lift, matte: MATTE },
  newsstand: { path: 'hifi/furniture/newsstand.glb', h: 2.6, yaw: FRONT, glow: null },
  bus_shelter: { path: 'hifi/furniture/bus_shelter.glb', h: 2.7, yaw: FRONT, glow: null },
  subway: { path: 'hifi/furniture/subway.glb', h: 2.4, yaw: FRONT, glow: globe }, // board 15's: 3 m deep, it fits mid-sidewalk on the 6 m sidewalk
  // The sedan's rear has one red lamp and one cream one (Caedon, 2026-10-13: paint it in code): the cream texels on the rear
  // fifth of the mesh turn the red lamp's colour; the cream headlights at the front stay. h: the taxi's scale (its model is short).
  sedan: { path: 'hifi/vehicles/sedan.glb', h: 1.9, yaw: FRONT, glow: red, repaint: { test: (r, g, b) => r > 220 && g > 120 && b > 90, rear: 0.2, to: [232, 82, 71] } },
  van: { path: 'hifi/vehicles/van.glb', h: 2.2, yaw: FRONT, glow: null }, // no red lamps on the model
  taxi: { path: 'hifi/taxi.glb', h: 2.08, yaw: -Math.PI / 2, glow: null },
};
export const KIT_FILES = Object.values(KIT).map((e) => e.path); // the street themes list these in `assets`, so they load before play
const GLOW = 5; // ponytail: calibration knob — the lights glow this bright, past the looks' bloom threshold (the taxi's LAMP_GLOW)
// Code stand-ins until the generated models land, roughly the right size and colour: boxes { w along x, h, d along z (the
// way the piece faces: the road for furniture, ahead for a vehicle), y of the base, z offset, colour, glow }. The lamp's
// glow is its own head, never a plate laid over it. ponytail: calibration knobs.
const STAND = {
  lamp: [{ w: 0.18, h: 4.5, d: 0.18, color: '#3a3d48' }, { w: 0.35, h: 0.18, d: 0.9, y: 4.3, z: 0.45, color: '#fff1c4', glow: true }],
  traffic_light: [{ w: 0.25, h: 5.5, d: 0.25, color: '#2a2c34' }],
  hydrant: [{ w: 0.35, h: 0.8, d: 0.35, color: '#c8352e' }],
  bench: [{ w: 1.8, h: 0.9, d: 0.6, color: '#7a5636' }],
  bin: [{ w: 0.6, h: 0.9, d: 0.6, color: '#2f5d4a' }],
  tree: [{ w: 0.3, h: 2.5, d: 0.3, color: '#5b4330' }, { w: 2.4, h: 3.5, d: 1.8, y: 2.5, z: 0.3, color: '#3f8a4a' }],
  newsstand: [{ w: 2, h: 2.6, d: 1.2, color: '#2f5d4a' }],
  bus_shelter: [{ w: 3, h: 2.7, d: 1.4, color: '#8fa3b0' }],
  subway: [{ w: 2.6, h: 2.4, d: 1.6, color: '#2f5d4a' }],
  sedan: [{ w: 2.0, h: 1.9, d: 3.15, color: '#5c6f8f' }],
  van: [{ w: 2, h: 2.2, d: 4.8, color: '#d9d9de' }],
  taxi: [{ w: 1.9, h: 2.08, d: 4.4, color: '#ffc21f' }],
};
STAND.tree2 = STAND.tree;
export const placeholder = (kind) => (T) => (STAND[kind] ?? [{ w: 0.5, h: KIT[kind].h, d: 0.5, color: '#2f5d4a' }]).map((b) => ({
  geometry: new T.BoxGeometry(b.w, b.h, b.d).translate(0, (b.y ?? 0) + b.h / 2, b.z ?? 0),
  material: material(`kit/${b.color}${b.glow ? '/glow' : ''}`, () => new T.MeshStandardMaterial({ color: b.color, roughness: 0.6, ...(b.glow && { emissive: b.color, emissiveIntensity: 2 }) })),
  matrix: new T.Matrix4(),
}));
const FOOT = 0.05; // ponytail: calibration knob — the lowest fraction of a piece's height that is its footprint (a pole's foot)
// entry -> { from, list }: list is [{ geometry, material, matrix }], the model fitted to its height, its base at y = 0, its footprint
// centred, or null when the build threw; from is the loaded geometry it was built from (every gfx.asset copy shares it), so a file
// released and loaded again (src/main.js between levels) is built again from the new one.
const parts = new Map();
export function kitParts(gfx, entry, placeholder) {
  const T = gfx.three;
  let model, from;
  try { model = gfx.asset(entry.path); } catch { return placeholder(T); } // not generated or not loaded yet: the stand-in, not cached, so the model replaces it once it lands
  model.traverse((n) => { if (n.isMesh) from ??= n.geometry; });
  const hit = parts.get(entry);
  if (hit && hit.from === from) return hit.list ?? placeholder(T);
  let list = null;
  try { list = build(T, model, entry); } catch (err) { console.warn(`kit ${entry.path} loaded but failed to build; its stand-in stays:`, err); } // once per load, not every chunk
  parts.set(entry, { from, list });
  return list ?? placeholder(T);
}
function build(T, model, entry) {
  const list = [], paint = new Map(); // generated material -> its paint, shared by every copy in every chunk
  model.rotation.y = entry.yaw;
  model.updateMatrixWorld(true);
  // Anchored on its footprint, not its bounding box: a lamp's pole stands at the placed x, its arm reaching out from there.
  const b = new T.Box3().setFromObject(model), v = new T.Vector3(), top = b.min.y + FOOT * (b.max.y - b.min.y), s = entry.h / (b.max.y - b.min.y), geo = new Map();
  const footOf = () => { const foot = new T.Box3(); model.traverse((n) => { if (!n.isMesh) return; const p = (geo.get(n) ?? n.geometry).attributes.position; for (let i = 0; i < p.count; i++) if (v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).y <= top) foot.expandByPoint(v); }); return foot.getCenter(new T.Vector3()); };
  let c = footOf();
  if (entry.cut) { model.traverse((n) => { if (n.isMesh) geo.set(n, cutGuard(T, n, entry.cut, c, b.min.y, s)); }); c = footOf(); } // anchored on the trunk left standing
  const fit = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
  model.traverse((n) => {
    if (!n.isMesh) return;
    if (!paint.has(n.material)) paint.set(n.material, freeWith(n.material, dress(T, n, entry))); // released with its file, superseded lists too
    list.push({ geometry: geo.get(n) ?? n.geometry, material: paint.get(n.material), matrix: fit.clone().multiply(n.matrixWorld) });
  });
  return list;
}
// The generated material without Tripo's random metal (it reads as dark paint; main session's ruling), its lights lit from
// their own texels. gloss copies the source's shared flag, so dropping a chunk never frees it.
function dress(T, mesh, { glow, repaint, texels, bright = GLOW, matte }) {
  const own = mesh.material.map, map = repaint ? recolour(T, mesh, repaint) : (texels && redraw(T, own, 1024, texels)) || own, lights = glow && glowMap(T, map, glow);
  const rough = matte && roughMap(T, map, matte.leaf, ...matte.rough); // null in Node: the model's own roughness map stays
  const p = gloss(T, mesh.material, { map, metalness: 0, metalnessMap: null, ...(lights && { emissive: '#ffffff', emissiveMap: lights, emissiveIntensity: bright }), ...(matte && { specularIntensity: matte.specular }), ...(rough && { roughness: 1, roughnessMap: rough }) });
  if (matte) p.onBeforeCompile = dimEnv(matte.env);
  return p;
}
// three r186 writes scene.environmentIntensity over a material's envMapIntensity whenever it has no envMap of its own
// (WebGLRenderer.js:2737), so a per-material dimmer wraps the shader's uniform: whatever the look writes, the shader reads k times it.
// Named: gfx.bendable keys the program cache by the material's own onBeforeCompile source.
const dimEnv = (k) => function dimEnv(shader) { let v = shader.uniforms.envMapIntensity.value; shader.uniforms.envMapIntensity = { get value() { return v * k; }, set value(x) { v = x; } }; };
// A clone of the mesh's geometry without the tree's guard (GUARD) or slab (SLAB), flagged shared and freed with the loaded geometry (the
// scaffold_beam.js widen() pattern); the loaded one stays untouched. Vertices no kept triangle uses collapse onto the trunk's foot, so
// the bounds and the footprint are the trunk's. axis: the uncut footprint's centre (the guard's, within 2 cm of the trunk's); y0 its
// base, s the fit's scale (model units to metres).
function cutGuard(T, mesh, cut, axis, y0, s) {
  const src = mesh.geometry, p = src.attributes.position, idx = src.index, at = (i) => (idx ? idx.getX(i) : i), v = new T.Vector3(), back = mesh.matrixWorld.clone().invert();
  const m = Array.from({ length: p.count }, (_, i) => { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); return [(v.x - axis.x) * s, (v.y - y0) * s, (v.z - axis.z) * s]; }); // metres from the foot
  const r = (i) => Math.hypot(m[i][0], m[i][2]), keep = [], used = new Uint8Array(p.count);
  for (let t = 0; t < (idx ?? p).count; t += 3) {
    const tri = [at(t), at(t + 1), at(t + 2)];
    if (tri.every((i) => m[i][1] < cut.top) && (tri.every((i) => m[i][1] < cut.free) || tri.every((i) => r(i) > cut.out))) continue;
    keep.push(...tri); for (const i of tri) used[i] = 1;
  }
  const g = src.clone(), moved = new T.Float32BufferAttribute(p.count * 3, 3); // the loaded positions are quantised integers: the clone's are floats
  for (let i = 0; i < p.count; i++) {
    let [x, y, z] = m[i];
    if (!used[i]) x = y = z = 0;
    else if (y < cut.free) { const k = Math.min(1, cut.trunk / (r(i) || 1)); x *= k; z *= k; y = 0; }
    moved.setXYZ(i, ...v.set(x / s + axis.x, y / s + y0, z / s + axis.z).applyMatrix4(back).toArray());
  }
  g.setAttribute('position', moved);
  g.setIndex(keep);
  g.computeBoundingBox(); g.computeBoundingSphere(); // clone() copied the loaded geometry's bounds
  g.userData.shared = true;
  src.addEventListener('dispose', () => g.dispose());
  return g;
}
// A copy of the colour map with the texels `test` accepts painted `to`, on the triangles wholly inside the rear fraction
// `rear` of the mesh (-x in its own frame; the generated GLBs carry only a uniform scale on the node). The source map is
// left alone. Without a canvas (Node), the map as it is.
function recolour(T, mesh, { test, rear, to }) {
  const map = mesh.material.map, g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv;
  if (!map?.image || !uv || typeof OffscreenCanvas === 'undefined') return map;
  const W = map.image.width, H = map.image.height, canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext('2d');
  ctx.drawImage(map.image, 0, 0);
  const img = ctx.getImageData(0, 0, W, H), px = img.data;
  g.computeBoundingBox();
  const cut = g.boundingBox.min.x + rear * (g.boundingBox.max.x - g.boundingBox.min.x), at = (i) => (g.index ? g.index.getX(i) : i);
  for (let i = 0; i < (g.index ?? pos).count; i += 3) {
    const v = [at(i), at(i + 1), at(i + 2)];
    if (v.some((j) => pos.getX(j) > cut)) continue;
    const [x0, x1, x2] = v.map((j) => uv.getX(j) * W), [y0, y1, y2] = v.map((j) => (map.flipY ? 1 - uv.getY(j) : uv.getY(j)) * H);
    const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (!d) continue;
    for (let y = Math.max(0, Math.floor(Math.min(y0, y1, y2))); y < Math.min(H, Math.ceil(Math.max(y0, y1, y2))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(x0, x1, x2))); x < Math.min(W, Math.ceil(Math.max(x0, x1, x2))); x++) {
        const px0 = x + 0.5, py = y + 0.5, k = 4 * (y * W + x); // the texel's centre, barycentric
        const a = ((x1 - px0) * (y2 - py) - (x2 - px0) * (y1 - py)) / d, b = ((x2 - px0) * (y0 - py) - (x0 - px0) * (y2 - py)) / d;
        if (a >= 0 && b >= 0 && a + b <= 1 && test(px[k], px[k + 1], px[k + 2])) px.set(to, k);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = map.clone(); // every sampler setting of the source (flipY, colour space, channel, wrap), its own image
  t.source = new T.TextureSource(canvas);
  t.needsUpdate = true;
  return t;
}
