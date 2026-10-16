import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs; `lit` marks dusk (0: day); `ground` the cool grey road per scene over asphalt (Caedon, 2026-10-15, replacing board 18's warm grey) and the walk, each the mean colour it renders at over its tile, its roughness, the paving's flag size in metres (board 24; hexes tuned by eye in the Task 32 stack).
// The walls (Task 32, Caedon's board 23 pick, "as prototyped"; buildings.js reads them). ponytail: calibration knobs. heights: 55% mid-rises
// 22-36 m, 45% towers 60-110 m, blocks 14-26 m long; the cream warmed toward the sun; 35% of window cells lit cream at 0.55 (the main
// session's tuning: 2.0 blew the windows out white against bloom 1.8); shop interiors warm at 0.4 from their own glass.
const STYLE = { id: 'midtown', ground: { road: '#5f5c69', roadRough: 0.6, walk: '#b8a49c', walkRough: 0.55, flag: 1.5 }, paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0, facades: cityFiles('facades', 'midtown', 5), shops: cityFiles('shops', 'midtown', 4), ...SIGN_FILES,
  heights: { kind: 'runs', short: [22, 36], tall: [60, 110], tallShare: 0.45, shortTiles: [0, 2, 3], tallTiles: [1, 4], depth: [14, 26] }, tileClass: ['s', 'g', 'm', 'm', 'g'], bodies: ['#bfa78e', '#6f8296', '#b5a390', '#a9896d', '#8a8f9a'], trim: '#cfc2ae', facadeTint: { mul: [1, 0.95, 0.86], only: [0, 2, 3] }, shopBands: [[0.205, 0.205, 0.4], [0.22, null, 0.31], [0.05, 0.05, 0.27], [0.135, 0.135, 0.27]], glow: { share: 0.35, color: '#ffe7b8', intensity: 0.55 }, shopGlow: { color: '#ffc46e', intensity: 0.4 } }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/midtown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'midtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  look: { skyline: SKYLINE, skylineHeight: [110, 80], exposure: 0.95, sun: { color: '#ffd2a1', intensity: 2.0 }, ambient: 0.65, env: 0.85, skyTop: '#e07b5a', bloom: { strength: 0.5, threshold: 1.8, radius: 0.45 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
