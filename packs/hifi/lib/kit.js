import { material } from './materials.js';
import { freeWith, gloss, glowMap } from './paint.js';
// The lights, picked from each model's own texels (measured on the generated textures, Task 23): only these glow.
const warm = (r, g, b) => r > 170 && r - b > 45;                               // the lamp's lens, the double lamp's lanterns
const signal = (r, g, b) => (r > 200 && g < 100 && b < 110) || (g > 180 && r < 120 && b < 120); // red, green; the middle lens is the housing's yellow
const globe = (r, g, b) => r > 245 && g > 245 && b > 245;                     // the subway's white globes
const red = (r, g, b) => r > 150 && g < 90 && b < 90;                         // a red tail lamp (the taxi's isLamp)
// Furniture and side-street vehicles. path: the generated model; h: its height in metres (board 15); yaw: turns its front
// (+x on every generated model; the lamp's arm reaches -z) to +z, the way the piece faces; glow: the texel test of its lights;
// repaint: texels recoloured before the glow (see recolour); bright: its glow strength, GLOW unless set. Until the model loads,
// a code placeholder stands in.
// ponytail: calibration knobs.
const FRONT = -Math.PI / 2;
export const KIT = {
  lamp: { path: 'hifi/furniture/lamp.glb', h: 4.5, yaw: Math.PI, glow: warm }, // 4.5 (was 6.5; Caedon, 2026-10-14, board 18): the lamps stood too big
  lamp_double: { path: 'hifi/furniture/lamp_double.glb', h: 6.5, yaw: FRONT, glow: warm }, // arms along the street, clear of the facades
  // bright 1.2 (Caedon, 2026-10-14, board 17c): at GLOW the red lens washes out to pink and the green throws a halo over the housing
  traffic_light: { path: 'hifi/furniture/traffic_light.glb', h: 5.5, yaw: FRONT, glow: signal, bright: 1.2 },
  hydrant: { path: 'hifi/furniture/hydrant.glb', h: 0.8, yaw: FRONT, glow: null },
  bench: { path: 'hifi/furniture/bench.glb', h: 0.9, yaw: FRONT, glow: null },
  bin: { path: 'hifi/furniture/bin.glb', h: 0.9, yaw: FRONT, glow: null },
  bin_box: { path: 'hifi/furniture/bin_box.glb', h: 1.0, yaw: FRONT, glow: null },
  planter: { path: 'hifi/furniture/planter.glb', h: 1.0, yaw: FRONT, glow: null },
  tree: { path: 'hifi/furniture/tree.glb', h: 6.0, yaw: FRONT, glow: null }, // board 15's: on the 6 m sidewalk its 4 m canopy clears the facades and the blade signs
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
  const b = new T.Box3().setFromObject(model), foot = new T.Box3(), v = new T.Vector3(), top = b.min.y + FOOT * (b.max.y - b.min.y);
  model.traverse((n) => { if (n.isMesh) for (let i = 0; i < n.geometry.attributes.position.count; i++) if (v.fromBufferAttribute(n.geometry.attributes.position, i).applyMatrix4(n.matrixWorld).y <= top) foot.expandByPoint(v); });
  const c = foot.getCenter(new T.Vector3()), s = entry.h / (b.max.y - b.min.y);
  const fit = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
  model.traverse((n) => {
    if (!n.isMesh) return;
    if (!paint.has(n.material)) paint.set(n.material, freeWith(n.material, dress(T, n, entry))); // released with its file, superseded lists too
    list.push({ geometry: n.geometry, material: paint.get(n.material), matrix: fit.clone().multiply(n.matrixWorld) });
  });
  return list;
}
// The generated material without Tripo's random metal (it reads as dark paint; main session's ruling), its lights lit from
// their own texels. gloss copies the source's shared flag, so dropping a chunk never frees it.
function dress(T, mesh, { glow, repaint, bright = GLOW }) {
  const map = repaint ? recolour(T, mesh, repaint) : mesh.material.map, lights = glow && glowMap(T, map, glow);
  return gloss(T, mesh.material, { map, metalness: 0, metalnessMap: null, ...(lights && { emissive: '#ffffff', emissiveMap: lights, emissiveIntensity: bright }) });
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
