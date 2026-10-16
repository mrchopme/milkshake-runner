import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for downtown (level 1, a clear blue day). ponytail: calibration knobs, tuned against board 01's keyframes; `lit` marks dusk (0: day); `road` the teaser's warm grey (Caedon, 2026-10-14, board 18).
// The walls (Task 32, Caedon's board 23 pick, "as prototyped"; buildings.js reads them). ponytail: calibration knobs. heights: 50% walk-ups
// 14-24 m, 50% towers 60-140 m in runs of 2-4, a tower behind 40% of walk-ups; tiles by class (g glass, s stone, m masonry); bodies:
// each tile's wall colour; facadeTint: the brick toward h357-17 s0.33-0.53 (wall texels only); shopBands: [sign bottom, awning top,
// lip] from each shop image's top; storefront 04 (blank cyan) retired.
const STYLE = { id: 'downtown', road: '#6b675a', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0, facades: cityFiles('facades', 'downtown', 5), shops: cityFiles('shops', 'downtown', 3), ...SIGN_FILES,
  heights: { kind: 'runs', short: [14, 24], tall: [60, 140], tallShare: 0.5, shortTiles: [2, 3, 4], tallTiles: [0, 1], back: { share: 0.4, x: [12, 25], w: [12, 20] } }, tileClass: ['g', 'g', 'm', 's', 'm'], bodies: ['#8fa3b8', '#4e5562', '#a37a60', '#9b9289', '#9c6145'], trim: '#c9bda3', facadeTint: { mul: [1.02, 0.96, 1.68], only: [2, 4], warm: true }, shopBands: [[0.185, 0.185, 0.4], [0.17, 0.17, 0.37], [0.19, 0.19, 0.29]] }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/downtown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'downtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  look: { skyline: SKYLINE, skylineHeight: [110, 80], exposure: 1.0, sun: { color: '#fff3e0', intensity: 2.2 }, ambient: 0.7, env: 0.9, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 1.8, radius: 0.4 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
