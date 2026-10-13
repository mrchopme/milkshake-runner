// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chunkRng } from './rand.js';
import { box, wall, instanced } from './shapes.js';
import { material } from './materials.js';
import { DASH } from './street.js';
import { facadeMaterial, TILE } from './facade.js';
// ponytail: calibration knobs, metres (board 15): tower pairs 38 m tall every 240 m, cables down to the deck, low
// waterfront blocks 30–50 m out wearing downtown's facades, rippling water, no sidewalks or blocks on the deck.
const DECK = { w: 10, road: '#5a5c72', paint: '#f2f2f2' }, WATER = { y: -6, color: '#8ccfe0', tile: 10, scroll: 0.03 };
const TOWER = { every: 240, at: 60, h: 38, w: 1.6, x: 6.2, beam: 1.2 }, CABLE = { segs: 8, thick: 0.25, deckX: 4.8, deckY: 1.2, clear: 0.5 };
const LOW = { x: 30.5, spread: 20, w: 8, minH: 2, maxH: 8 };
export const WATERFRONT = { id: 'downtown', facades: [], buildings: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'] } }; // Task 24 points facades at downtown's tiles

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
    const m = new T.MeshStandardMaterial({ color: WATER.color, roughness: 0.08, metalness: 0, normalMap: rippleTexture(T) });
    m.onBeforeCompile = (s) => { // vNormalMapUv is a varying, read-only here: offset the uv where the chunk samples it
      s.uniforms.uTime = gfx.time;
      s.fragmentShader = 'uniform float uTime;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>',
        T.ShaderChunk.normal_fragment_maps.replaceAll('vNormalMapUv', `( vNormalMapUv + vec2( 0.0, uTime * ${WATER.scroll.toFixed(2)} ) )`));
    };
    return m;
  });
}

export function bridgeChunk(gfx, args, style) {
  const T = gfx.three, { z0, length, lanes } = args, r = chunkRng(args.rng), g = gfx.group(), zc = z0 + length / 2;
  const std = (key, color, rough) => material(`${style.id}/${key}`, () => new T.MeshStandardMaterial({ color, roughness: rough }));
  // the deck and its lane paint (as in street.js); no sidewalks
  const deck = box(T, DECK.w, 1, length, std('deck', DECK.road, 0.85), 0, -0.5, zc);
  deck.userData.road = true;
  g.add(deck);
  const dashes = [];
  for (let z = z0; z + DASH.len <= z0 + length; z += DASH.every) for (const x of [lanes.width / 2, -lanes.width / 2]) dashes.push(new T.Matrix4().makeTranslation(x, 0.011, z + DASH.len / 2));
  g.add(instanced(T, new T.BoxGeometry(DASH.w, 0.02, DASH.len), std('paint', DECK.paint, 0.6), dashes));
  // the water, its uvs in world metres so the ripples run on across chunks
  const water = new T.PlaneGeometry(400, length, 8, Math.ceil(length / 4)).rotateX(-Math.PI / 2).translate(0, WATER.y, zc);
  const p = water.attributes.position, uv = water.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / WATER.tile, -p.getZ(i) / WATER.tile);
  g.add(new T.Mesh(water, waterMaterial(gfx)));
  // a tower pair standing in the water, and its cables sagging down to the deck at both chunk edges
  if (z0 % TOWER.every === 0 && length >= 2 * TOWER.at) {
    const zt = z0 + TOWER.at, top = WATER.y + TOWER.h, steel = std('tower', '#c9ccd4', 0.5), cables = [];
    for (const side of [-1, 1]) g.add(box(T, TOWER.w, TOWER.h, TOWER.w, steel, side * TOWER.x, WATER.y + TOWER.h / 2, zt));
    g.add(box(T, TOWER.x * 2 + TOWER.w, TOWER.beam, TOWER.w, steel, 0, top - 2 * TOWER.beam, zt));
    const at = (side, dir, t) => new T.Vector3( // t 0 at the tower top, 1 at the deck; y sags as (1 - t)^2, a half catenary
      side * (TOWER.x + (CABLE.deckX - TOWER.x) * t), CABLE.deckY + (top - TOWER.beam - CABLE.deckY) * (1 - t) ** 2, zt + dir * (TOWER.at - CABLE.clear) * t);
    for (const side of [-1, 1]) for (const dir of [-1, 1]) for (let k = 0; k < CABLE.segs; k++) {
      const a = at(side, dir, k / CABLE.segs), b = at(side, dir, (k + 1) / CABLE.segs), d = b.clone().sub(a);
      cables.push(new T.Matrix4().compose(a.add(b).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.clone().normalize()), new T.Vector3(1, 1, d.length())));
    }
    g.add(instanced(T, new T.BoxGeometry(CABLE.thick, CABLE.thick, 1), steel, cables));
  }
  // waterfront low-rises on both banks, a facade looking at the road and a body behind, merged per material
  const groups = new Map(), put = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const colors = WATERFRONT.buildings.colors;
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    const depth = Math.min(6 + r() * 8, z0 + length - z), h = LOW.minH + r() * (LOW.maxH - LOW.minH), i = Math.floor(r() * colors.length), cx = LOW.x + r() * LOW.spread;
    if (depth < 3) break;
    const d = depth - 1, near = cx - LOW.w / 2, bz = z + depth / 2, y = WATER.y + h / 2;
    put(facadeMaterial(gfx, WATERFRONT, i), wall(T, d, h, -side, TILE.w, TILE.h).translate(side * near, y, bz));
    put(std(`body/${i}`, colors[i], 0.8), new T.BoxGeometry(LOW.w, h, d, 1, 1, Math.max(1, Math.ceil(d / 4))).translate(side * (near + 0.02 + LOW.w / 2), y, bz));
    z += depth;
  }
  for (const [mat, geos] of groups) { const m = new T.Mesh(mergeGeometries(geos), mat); geos.forEach((x) => x.dispose()); m.userData.building = true; g.add(m); }
  return g;
}
