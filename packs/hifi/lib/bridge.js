// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pickBy } from './rand.js';
import { box, instanced, metreUV } from './shapes.js';
import { material } from './materials.js';
import { DASH, EDGE, PAVE, KERB, pavingTexture, asphaltTexture, tintedMaterial } from './street.js';
// ponytail: calibration knobs, metres (Caedon's board 25 pick "Ship, water retuned in the clean build", 2026-10-15, reversing
// board 15's "no sidewalks" and Task 31's 32 m towers every 240 m): a 16 m deck, a 10 m road (the three lanes and 0.5 m either side)
// on the cool asphalt between two 3 m walkways in C4's paving, steel railings, a 45 m portal every 120 m with round cables on
// hangers (the low waterfront blocks 30-50 m out are gone: Caedon, board 29 pick 2, 2026-10-20, "there are still buildings floating
// in the water"; the river's banks are the city's paved shore at the bridge's ends). The water 2.5 m under the deck (Caedon, 2026-10-15: "the
// bridge water is too low"; was 6); whatever stands in it reaches `below` under the surface, so no seam of the bend shows a sliver
// of sky under it. It runs `half` out either side, past where the view's edges meet the fog's far end (about 210 m), so the horizon
// meets water, not a pale band. Retuned (board 25): a steel blue (aim: the frames' #4679b2-#628db7 with #aee1f7 glints), env 0.2
// (look.js honours userData.reflect while roughness <= 0.15, so 0.15 is the most satin it can be), a 7 m ripple tile, 60 facets
// across, and its own fog from `fogNear` m in the fog's colour (the bridge look's height-fog shade would darken it below the deck).
// A second ripple sample `tile2` m turned `turn` degrees, drifting `drift` (uv a second, x and y), averaged in (Caedon, board 28,
// Task 33 plan L-C "two-scale water normal", 2026-10-19: the one 7 m tile read as a checker).
export const WATER = { y: -2.5, below: 1.5, half: 300, color: '#2f6fb0', rough: 0.15, reflect: 0.2, tile: 7, tile2: 23, turn: 17, drift: [0.011, 0.017], segs: 60, fogNear: 40, scroll: 0.03 };
// ponytail: the walkway as high as the street's kerb (Caedon, board 28, Task 33 plan L-C "walkway step 0.25 -> 0.18", 2026-10-19:
// was 0.25, a 7 cm step where the deck meets the sidewalk)
const DECK = { w: 16, road: '#5a596e', walk: '#a9a8b6', walkW: 3, walkH: KERB, edge: 0.3, paint: '#f2f2f2' }; // edge lines at ±(roadHalf + edge)
// as wide as the deck (the portal's as its legs), its top 0.1 m up inside the deck's 1 m slab; an abutment `abut` m long under each
// deck end (Task 34 L-C): every bridge chunk has both, since a chunk cannot know it is its stretch's first or last, so a bridge seam
// stands on a 16 m stone pier (0 removes them)
const PIER = { every: 30, d: 3, top: -0.9, abut: 8 };
// ponytail: railings.glb sections stretched to `pitch`, standing on the walkway `inset` in from the deck edge, in one satin steel-blue
// (shade ~#4679b2, lit ~#aee1f7 in Caedon's board 25 frames; the main session confirms it on the re-shoot). pitch 4: 3 adds ~72k
// triangles a chunk (railings.glb is 3,578 a section, ~215k a 120 m chunk; the HiFi railings prop, which drew the same again on the
// shipped bridge sections, now draws nothing). Unmeasured in a browser: if frame time suffers, a decimated railings.glb or a
// box rail first, a distance LOD for anything past the first chunk.
const RAIL = { pitch: 4, height: 1.1, inset: 0.25 }, STEEL = { color: '#7aa6d4', rough: 0.4, metal: 0.25 };
// ponytail: board 25's portal and cables (Caedon's pick, 2026-10-15). The portal at z ≡ `at` (mod `every`), on the pier there:
// legs w × d at ±x from the water to `top`, a crown beam, a second beam at `beam2` and an X-brace between them. The cable: a
// parabola of world z between portals, its saddle `saddle` under the top, lowest `low` up at mid-span, x from the legs' centre in
// to `x`; tube `step` m a ring (cheapest trim: radial 24 -> 12).
const PORTAL = { every: 120, at: 45, top: 45, w: 3.2, d: 2.8, x: 9.7, beam: 1.8, beam2: 28, brace: 0.8 };
const CABLE = { r: 0.35, radial: 24, x: 8.0, low: 2.2, saddle: 1, step: 2, collar: { r: 0.5, len: 1.2 }, hanger: { r: 0.06, every: 5 } };
// ponytail: the theme's darkest building colour × dry; × wet below `band` above the water. dry 1.0 (Caedon, board 28, Task 33 plan L-C
// "lighter land stone", 2026-10-19; was 0.7: the near-black quay face read as a floating street). Ashlar courses `course` tall, blocks `block` long, joints `joint` at `jointTone`,
// blocks ±`tone` in tone, on metre UVs.
const STONE = { dry: 1.0, wet: 0.5, band: 0.6, row: 0.25, course: 0.5, block: 1.2, joint: 0.04, jointTone: 0.7, tone: 0.07 };
export const PIER_COLORS = ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3']; // the piers' stone: downtown's building colours
// A grey ashlar tile, 4 blocks by 4 courses, running bond, multiplying the stone's vertex colours; one shared 256 x 128 (~170 KB with mips).
let ashlar;
function ashlarTexture(T) {
  if (ashlar) return ashlar;
  const S = STONE, w = 256, h = 128, px = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = ((j + 0.5) / h) * 4 * S.course, row = Math.floor(v / S.course), u = ((i + 0.5) / w) * 4 * S.block + (row % 2) * S.block / 2, col = Math.floor(u / S.block) % 4;
    const joint = v - row * S.course < S.joint || u - Math.floor(u / S.block) * S.block < S.joint;
    const b = Math.round(255 * (joint ? S.jointTone : 1 - S.tone * (pickBy(row * 4 + col + 1, 1000) / 1000)));
    px.set([b, b, b, 255], (j * w + i) * 4);
  }
  ashlar = new T.DataTexture(px, w, h);
  Object.assign(ashlar, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, colorSpace: T.SRGBColorSpace, magFilter: T.LinearFilter, minFilter: T.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy: 8, needsUpdate: true });
  ashlar.repeat.set(1 / (4 * S.block), 1 / (4 * S.course));
  ashlar.userData.shared = true;
  return ashlar;
}

// A Node-safe ripple normal map: a few crossing sine waves, tiling, encoded as tangent-space normals.
function rippleTexture(T, n = 64) {
  const px = new Uint8Array(n * n * 4), k = (2 * Math.PI) / n;
  const slope = (x, y) => [ // d(height)/dx, d(height)/dy of sin(2kx + ky) + 0.6 sin(3ky - kx) + 0.4 sin(5kx)
    0.3 * (2 * k * Math.cos(2 * k * x + k * y) - 0.6 * k * Math.cos(3 * k * y - k * x) + 2 * k * Math.cos(5 * k * x)) * n / 8,
    0.3 * (k * Math.cos(2 * k * x + k * y) + 1.8 * k * Math.cos(3 * k * y - k * x)) * n / 8,
  ];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [dx, dy] = slope(x, y), l = Math.hypot(dx, dy, 1);
    px.set([(-dx / l) * 127.5 + 127.5, (-dy / l) * 127.5 + 127.5, (1 / l) * 127.5 + 127.5, 255], (y * n + x) * 4);
  }
  const t = new T.DataTexture(px, n, n); // filtered and mipmapped: a DataTexture's default nearest, unmipmapped, aliased far off
  Object.assign(t, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, magFilter: T.LinearFilter, minFilter: T.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy: 8, needsUpdate: true });
  t.userData.shared = true;
  return t;
}
// The water's own surface ripples: its normal map scrolls with the run clock (pause freezes it), sampled twice (waterN): the 7 m
// tile scrolling, and a `tile2` m one turned `turn` degrees drifting on its own, averaged.
export function waterMaterial(gfx) {
  const T = gfx.three, a = (WATER.turn * Math.PI) / 180, f = (x) => x.toFixed(4);
  return material('bridge/water', () => {
    const m = new T.MeshStandardMaterial({ color: WATER.color, roughness: WATER.rough, metalness: 0, normalMap: rippleTexture(T) });
    m.userData.reflect = WATER.reflect;
    m.onBeforeCompile = (s) => { // vNormalMapUv is a varying, read-only here: offset the uv where the chunk samples it
      s.uniforms.uTime = gfx.time;
      const waterN = `vec4 waterN( vec2 uv ) {
  vec2 b = mat2( ${f(Math.cos(a))}, ${f(Math.sin(a))}, ${f(-Math.sin(a))}, ${f(Math.cos(a))} ) * uv * ${f(WATER.tile / WATER.tile2)} + vec2( uTime * ${f(WATER.drift[0])}, uTime * ${f(WATER.drift[1])} );
  return 0.5 * ( texture2D( normalMap, uv + vec2( 0.0, uTime * ${WATER.scroll.toFixed(2)} ) ) + texture2D( normalMap, b ) );
}
void main() {`;
      s.fragmentShader = 'uniform float uTime;\n' + s.fragmentShader.replace('void main() {', waterN).replace('#include <normal_fragment_maps>',
        T.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )', 'waterN( vNormalMapUv )'))
        // its own fog start, and no height-fog shade (src/gfx.js inserts its mix over this include, after these lines)
        .replace('#include <fog_fragment>', `#define fogNear ${WATER.fogNear.toFixed(1)}\n#define uFogShade fogColor\n#include <fog_fragment>`);
    };
    return m;
  });
}

// railings.glb to metres: centred, its base at y = 0, a section `pitch` long and `height` tall (its thickness scaled with the height).
function railFit(T, model, pitch, height) {
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3()), s = height / size.y;
  return { fit: new T.Matrix4().makeScale(s, s, pitch / size.z).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z)) };
}

// Stone standing in the water (Task 31a): the quay under a street chunk, the bridge's piers and abutments. A block `w` wide and `d`
// long from under the water up to `top`, centred on x 0 and z 0, in the darkest of `colors` (a theme's buildings), darker in a wet
// band at the waterline; vertex-coloured on one shared material with ashlar courses on metre UVs, so a chunk's stone is one draw call.
export function stone(gfx, colors, w, top, d) {
  const T = gfx.three, foot = WATER.y - WATER.below, h = top - foot;
  const geo = new T.BoxGeometry(w, h, d, 1, Math.ceil(h / STONE.row), Math.max(1, Math.ceil(d / 4))).translate(0, foot + h / 2, 0);
  const dry = colors.map((c) => new T.Color(c)).sort((a, b) => a.getHSL({}).l - b.getHSL({}).l)[0].multiplyScalar(STONE.dry), wet = dry.clone().multiplyScalar(STONE.wet);
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) (p.getY(i) < WATER.y + STONE.band ? wet : dry).toArray(c, i * 3); // rows every 0.25 m: the band's edge blends over one
  geo.setAttribute('color', new T.BufferAttribute(c, 3));
  return metreUV(new T.Mesh(geo, material('stone', () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: ashlarTexture(T) }))));
}

export function bridgeChunk(gfx, args, style) {
  const T = gfx.three, { z0, length, lanes } = args, g = gfx.group(), zc = z0 + length / 2, end = z0 + length;
  args.rng(); // the one draw the chunk's waterfront rows took (gone, Task 34 L-C): kept, so the scenery stream through a bridge chunk stays where 15f00b7 left it and the cities after it do not reshuffle
  const half = DECK.w / 2, roadHalf = half - DECK.walkW, P = PORTAL, C = CABLE;
  const tinted = (...a) => tintedMaterial(T, style, ...a);
  // the deck on the asphalt grain, and the walkways on it: a kerb face toward the road, the paving's UVs as street.js's
  // (u metres out from the kerb, v metres along z on the 12 m period), one mesh for both
  const deck = metreUV(box(T, DECK.w, 1, length, tinted('deck', DECK.road, 0.85, asphaltTexture(T)), 0, -0.5, zc));
  deck.userData.road = true;
  const zp = PAVE.len * Math.floor(z0 / PAVE.len), sides = [-1, 1].map((s) => metreUV(box(T, DECK.walkW, DECK.walkH, length, null, s * (roadHalf + DECK.walkW / 2), DECK.walkH / 2, zc), (x, y, z, n) => [Math.abs(x) - roadHalf, Math.abs(n.z) > 0.5 ? y : z - zp]));
  const walk = new T.Mesh(mergeGeometries(sides.map((m) => m.geometry.translate(m.position.x, m.position.y, m.position.z))), tinted('walk', DECK.walk, 0.9, pavingTexture(T, {})));
  walk.userData.walkway = true;
  g.add(deck, walk);
  // the lane lines and the solid edge lines in one InstancedMesh, both in DASH.len pieces so they bend
  const marks = [];
  for (let z = z0; z < end - 1e-6; z += DASH.every) {
    const l = Math.min(DASH.len, end - z);
    if (l === DASH.len) for (const x of [lanes.width / 2, -lanes.width / 2]) marks.push(new T.Matrix4().makeTranslation(x, 0.011, z + l / 2));
    for (const s of [-1, 1]) marks.push(new T.Matrix4().makeTranslation(s * (lanes.roadHalf + DECK.edge), 0.011, z + l / 2).scale(new T.Vector3(EDGE.w / DASH.w, 1, l / DASH.len)));
  }
  const paint = instanced(T, new T.BoxGeometry(DASH.w, 0.02, DASH.len), material(`${style.id}/paint`, () => new T.MeshStandardMaterial({ color: DECK.paint, roughness: 0.6 })), marks);
  paint.userData.marks = true;
  g.add(paint);
  // stone piers every 30 m, 15 m in from each seam (Task 31a); the one under the portal as wide as its legs
  const zt = z0 + P.at, portal = zt + P.d / 2 <= end, legs = P.x + P.w / 2;
  const pier = stone(gfx, PIER_COLORS, DECK.w, PIER.top, PIER.d), piers = [];
  for (let z = z0 + PIER.every / 2; z + PIER.d / 2 <= end; z += PIER.every) piers.push(new T.Matrix4().makeTranslation(0, 0, z).scale(new T.Vector3(z === zt ? legs / half : 1, 1, 1)));
  const pierMesh = instanced(T, pier.geometry, pier.material, piers);
  pierMesh.userData.pier = true;
  g.add(pierMesh);
  // an abutment under each deck end, so leaving the bridge you never see under the street (Task 34 L-C); one mesh for both.
  // Each at most half the chunk long, so a short tail chunk (a level's length_m mod 120 under 8) keeps both inside [z0, end]
  // and the two never overlap (the whole-branch review, 2026-10-22)
  if (PIER.abut > 0) {
    const a = Math.min(PIER.abut, (end - z0) / 2);
    const one = stone(gfx, PIER_COLORS, DECK.w, PIER.top, a).geometry, ends = [z0 + a / 2, end - a / 2].map((z) => one.clone().translate(0, 0, z));
    one.dispose();
    const abut = new T.Mesh(mergeGeometries(ends), pier.material);
    ends.forEach((x) => x.dispose());
    abut.userData.abutment = true;
    g.add(abut);
  }
  // the water, its uvs in world metres so the ripples run on across chunks
  const water = new T.PlaneGeometry(WATER.half * 2, length, WATER.segs, Math.ceil(length / 4)).rotateX(-Math.PI / 2).translate(0, WATER.y, zc);
  const wp = water.attributes.position, uv = water.attributes.uv;
  for (let i = 0; i < wp.count; i++) uv.setXY(i, wp.getX(i) / WATER.tile, -wp.getZ(i) / WATER.tile);
  const waterMesh = new T.Mesh(water, waterMaterial(gfx));
  waterMesh.userData.water = true;
  g.add(waterMesh);
  const steel = material(`${style.id}/steel`, () => new T.MeshStandardMaterial({ color: STEEL.color, roughness: STEEL.rough, metalness: STEEL.metal }));
  // railings along both walkways' outer edges, from railings.glb (its one mesh), none crossing the seam; none until it loads
  let model = null;
  try { model = gfx.asset('hifi/railings.glb'); } catch { /* not loaded (Node tests): no railings */ }
  if (model) {
    model.updateMatrixWorld(true);
    const { fit } = railFit(T, model, RAIL.pitch, RAIL.height);
    for (const s of [-1, 1]) {
      const spots = [];
      for (let z = z0 + RAIL.pitch / 2; z + RAIL.pitch / 2 <= end + 1e-6; z += RAIL.pitch) spots.push(new T.Matrix4().makeTranslation(s * (half - RAIL.inset), DECK.walkH, z).multiply(fit));
      model.traverse((n) => { if (n.isMesh) { const m = instanced(T, n.geometry, steel, spots.map((x) => x.clone().multiply(n.matrixWorld))); m.userData.railing = true; g.add(m); } });
    }
  }
  if (portal) {
    const foot = WATER.y - WATER.below, parts = [], inner = P.x - P.w / 2, bTop = P.top - P.beam / 2;
    for (const s of [-1, 1]) parts.push(new T.BoxGeometry(P.w, P.top - foot, P.d).translate(s * P.x, (P.top + foot) / 2, zt));
    parts.push(new T.BoxGeometry(2 * legs, P.beam, P.d).translate(0, bTop, zt));
    parts.push(new T.BoxGeometry(2 * inner, P.beam * 0.8, P.d * 0.8).translate(0, P.beam2, zt));
    const y1 = P.beam2 + P.beam * 0.4, y2 = bTop - P.beam / 2, len = Math.hypot(2 * inner, y2 - y1), a = Math.atan2(y2 - y1, 2 * inner);
    for (const s of [-1, 1]) parts.push(new T.BoxGeometry(len, P.brace, P.brace).rotateZ(s * a).translate(0, (y1 + y2) / 2, zt));
    const m = new T.Mesh(mergeGeometries(parts), steel);
    m.userData.portal = true;
    g.add(m);
  }
  // the main cables: a pure function of world z (portals at z ≡ at mod every), so the pieces meet at every seam without the chunk
  // knowing its neighbours; k is 1 at a portal, 0 mid-span
  const H = P.every / 2, k = (z) => { const e = Math.abs(z - zt); return ((Math.min(e, P.every - e) - H) / H) ** 2; };
  const at = (s, z) => new T.Vector3(s * (C.x + (P.x - C.x) * k(z)), C.low + (P.top - C.saddle - C.low) * k(z), z);
  const cableParts = [], hangers = [], up = new T.Vector3(0, 1, 0), cuts = [z0, ...(zt < end ? [zt] : []), end];
  for (const s of [-1, 1]) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const n = Math.max(2, Math.ceil((cuts[i + 1] - cuts[i]) / C.step)), pts = [];
      for (let j = 0; j <= n; j++) pts.push(at(s, cuts[i] + ((cuts[i + 1] - cuts[i]) * j) / n));
      cableParts.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), n, C.r, C.radial, false));
    }
    if (portal) for (const dir of [-1, 1]) { // a collar where the cable leaves each face of the leg
      const z = zt + dir * (P.d / 2 + C.collar.len / 2), p = at(s, z), q = at(s, z + dir * 0.5).sub(p).normalize();
      cableParts.push(new T.CylinderGeometry(C.collar.r, C.collar.r, C.collar.len, C.radial).applyQuaternion(new T.Quaternion().setFromUnitVectors(up, q)).translate(p.x, p.y, p.z));
    }
    for (let z = z0 + C.hanger.every / 2; z < end; z += C.hanger.every) { // from the cable's underside down to the deck edge
      if (portal && Math.abs(z - zt) < P.d / 2 + C.collar.len) continue;
      const top = at(s, z).add(new T.Vector3(0, -C.r, 0)), bot = new T.Vector3(s * (half - 0.05), 0, z), d = top.clone().sub(bot);
      hangers.push(new T.Matrix4().compose(bot.clone().add(top).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(up, d.clone().normalize()), new T.Vector3(1, d.length(), 1)));
    }
  }
  const cableGeo = mergeGeometries(cableParts), cp = cableGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.min(end, Math.max(z0, cp.getZ(i)))); // a sloped tube's end ring leans past the seam: flatten it onto it
  const cable = new T.Mesh(cableGeo, steel);
  cable.userData.cable = true;
  // no shadow: a cable's long shadow over the deck reads as a stripe across the lanes. gfx.bend marks every opaque mesh a caster
  // as world.js adds the chunk, so the flag is set again once the chunk is added (three fires 'added' after the bend).
  cable.castShadow = false;
  g.addEventListener('added', () => { cable.castShadow = false; });
  const hangerMesh = instanced(T, new T.CylinderGeometry(C.hanger.r, C.hanger.r, 1, 6), steel, hangers);
  hangerMesh.userData.hanger = true;
  g.add(cable, hangerMesh);
  return g;
}
