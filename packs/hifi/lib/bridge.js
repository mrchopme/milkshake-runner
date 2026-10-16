// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chunkRng } from './rand.js';
import { box, wall, instanced, metreUV } from './shapes.js';
import { material } from './materials.js';
import { DASH, EDGE, PAVE, pavingTexture, asphaltTexture, tintedMaterial } from './street.js';
import { facadeMaterial, TILE, cityFiles } from './facade.js';
// ponytail: calibration knobs, metres (Caedon's board 25 pick "Ship, water retuned in the clean build", 2026-10-15, reversing
// board 15's "no sidewalks" and Task 31's 32 m towers every 240 m): a 16 m deck, a 10 m road (the three lanes and 0.5 m either side)
// on the cool asphalt between two 3 m walkways in C4's paving, steel railings, a 45 m portal every 120 m with round cables on
// hangers, low waterfront blocks 30-50 m out wearing downtown's facades. The water 2.5 m under the deck (Caedon, 2026-10-15: "the
// bridge water is too low"; was 6); whatever stands in it reaches `below` under the surface, so no seam of the bend shows a sliver
// of sky under it. It runs `half` out either side, past where the view's edges meet the fog's far end (about 210 m), so the horizon
// meets water, not a pale band. Retuned (board 25): a steel blue (aim: the frames' #4679b2-#628db7 with #aee1f7 glints), env 0.2
// (look.js honours userData.reflect while roughness <= 0.15, so 0.15 is the most satin it can be), a 7 m ripple tile, 60 facets
// across, and its own fog from `fogNear` m in the fog's colour (the bridge look's height-fog shade would darken it below the deck).
export const WATER = { y: -2.5, below: 1.5, half: 300, color: '#2f6fb0', rough: 0.15, reflect: 0.2, tile: 7, segs: 60, fogNear: 40, scroll: 0.03 };
const DECK = { w: 16, road: '#5a596e', walk: '#a9a8b6', walkW: 3, walkH: 0.25, edge: 0.3, paint: '#f2f2f2' }; // edge lines at ±(roadHalf + edge)
const PIER = { every: 30, d: 3, top: -0.9 }; // as wide as the deck (the portal's as its legs), its top 0.1 m up inside the deck's 1 m slab
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
const LOW = { x: 30.5, spread: 20, w: 8, minH: 2, maxH: 8 };
const STONE = { dry: 0.7, wet: 0.5, band: 0.6, row: 0.25 }; // the theme's darkest building colour × dry; × wet below `band` above the water
export const WATERFRONT = { id: 'downtown', facades: cityFiles('facades', 'downtown', 5), buildings: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'] } }; // downtown's tiles, untinted and unlit

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
  const t = new T.DataTexture(px, n, n);
  Object.assign(t, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, needsUpdate: true });
  t.userData.shared = true;
  return t;
}
// The water's own surface ripples: its normal map scrolls with the run clock (pause freezes it).
export function waterMaterial(gfx) {
  const T = gfx.three;
  return material('bridge/water', () => {
    const m = new T.MeshStandardMaterial({ color: WATER.color, roughness: WATER.rough, metalness: 0, normalMap: rippleTexture(T) });
    m.userData.reflect = WATER.reflect;
    m.onBeforeCompile = (s) => { // vNormalMapUv is a varying, read-only here: offset the uv where the chunk samples it
      s.uniforms.uTime = gfx.time;
      s.fragmentShader = 'uniform float uTime;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>',
        T.ShaderChunk.normal_fragment_maps.replaceAll('vNormalMapUv', `( vNormalMapUv + vec2( 0.0, uTime * ${WATER.scroll.toFixed(2)} ) )`))
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

// Stone standing in the water (Task 31a): the quay under a street chunk, the bridge's piers. A block `w` wide and `d` long from
// under the water up to `top`, centred on x 0 and z 0, in the darkest of `colors` (a theme's buildings) darkened, darker still in
// a wet band at the waterline; vertex-coloured on one shared material, so a chunk's stone is one draw call.
export function stone(gfx, colors, w, top, d) {
  const T = gfx.three, foot = WATER.y - WATER.below, h = top - foot;
  const geo = new T.BoxGeometry(w, h, d, 1, Math.ceil(h / STONE.row), Math.max(1, Math.ceil(d / 4))).translate(0, foot + h / 2, 0);
  const dry = colors.map((c) => new T.Color(c)).sort((a, b) => a.getHSL({}).l - b.getHSL({}).l)[0].multiplyScalar(STONE.dry), wet = dry.clone().multiplyScalar(STONE.wet);
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) (p.getY(i) < WATER.y + STONE.band ? wet : dry).toArray(c, i * 3); // rows every 0.25 m: the band's edge blends over one
  geo.setAttribute('color', new T.BufferAttribute(c, 3));
  return new T.Mesh(geo, material('stone', () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
}

export function bridgeChunk(gfx, args, style) {
  const T = gfx.three, { z0, length, lanes } = args, r = chunkRng(args.rng), g = gfx.group(), zc = z0 + length / 2, end = z0 + length;
  const half = DECK.w / 2, roadHalf = half - DECK.walkW, P = PORTAL, C = CABLE;
  const tinted = (...a) => tintedMaterial(T, style, ...a);
  // the deck on the asphalt grain, and the walkways on it: a 0.25 m kerb face toward the road, the paving's UVs as street.js's
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
  const pier = stone(gfx, WATERFRONT.buildings.colors, DECK.w, PIER.top, PIER.d), piers = [];
  for (let z = z0 + PIER.every / 2; z + PIER.d / 2 <= end; z += PIER.every) piers.push(new T.Matrix4().makeTranslation(0, 0, z).scale(new T.Vector3(z === zt ? legs / half : 1, 1, 1)));
  const pierMesh = instanced(T, pier.geometry, pier.material, piers);
  pierMesh.userData.pier = true;
  g.add(pierMesh);
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
  // waterfront low-rises on both banks, a facade looking at the road and on the -z end, a body behind, merged per material
  const groups = new Map(), put = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const colors = WATERFRONT.buildings.colors;
  for (const side of [-1, 1]) for (let z = z0; z < end;) {
    const depth = Math.min(6 + r() * 8, end - z), h = LOW.minH + r() * (LOW.maxH - LOW.minH), i = Math.floor(r() * colors.length), cx = LOW.x + r() * LOW.spread;
    if (depth < 3) break;
    const d = depth - 1, near = cx - LOW.w / 2, bz = z + depth / 2, y = WATER.y + h / 2, bx = side * (near + 0.02 + LOW.w / 2), face = facadeMaterial(gfx, WATERFRONT, i);
    put(face, wall(T, d, h, -side, TILE.w, TILE.h).translate(side * near, y, bz));
    put(face, wall(T, LOW.w, h, 0, TILE.w, TILE.h, 0, 'z').translate(bx, y, bz - d / 2 - 0.02));
    put(material(`${style.id}/body/${i}`, () => new T.MeshStandardMaterial({ color: colors[i], roughness: 0.8 })), new T.BoxGeometry(LOW.w, h + WATER.below, d, 1, 1, Math.max(1, Math.ceil(d / 4))).translate(bx, y - WATER.below / 2, bz)); // standing in the water (Task 31a)
    z += depth;
  }
  for (const [mat, geos] of groups) { const m = new T.Mesh(mergeGeometries(geos), mat); geos.forEach((x) => x.dispose()); m.userData.building = true; g.add(m); }
  return g;
}
