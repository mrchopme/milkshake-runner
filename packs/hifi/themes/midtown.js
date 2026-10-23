import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs; `bladeRate` the blade signs' rate
// (lib/signs.js; board 23: downtown 1, midtown none, uptown about one a chunk); `lit` marks dusk (0: day); `ground` the cool grey
// road per scene over asphalt (Caedon, 2026-10-15, replacing board 18's warm grey) and the walk, each the mean colour it renders
// at over its tile, its roughness, the paving's flag size in metres (board 24; hexes tuned by eye in the Task 32 stack).
// The walls (Task 32, Caedon's board 23 pick, "as prototyped"; buildings.js reads them). ponytail: calibration knobs. heights: 55% mid-rises
// 22-36 m, 45% towers 60-110 m, blocks 14-26 m long; the cream warmed toward the sun; 35% of window cells lit cream at 0.55 (the main
// session's tuning: 2.0 blew the windows out white against bloom 1.8); shop interiors warm at 0.4 from their own glass.
const STYLE = { id: 'midtown', ground: { road: '#5f5c69', roadRough: 0.6, walk: '#b8a49c', walkRough: 0.55, flag: 1.5 }, paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], bladeRate: 0, lit: 0, facades: cityFiles('facades', 'midtown', 5), shops: cityFiles('shops', 'midtown', 4), ...SIGN_FILES,
  heights: { kind: 'runs', short: [22, 36], tall: [60, 110], tallShare: 0.45, shortTiles: [0, 2, 3], tallTiles: [1, 4], depth: [14, 26] }, tileClass: ['s', 'g', 'm', 'm', 'g'], bodies: ['#bfa78e', '#6f8296', '#b5a390', '#a9896d', '#8a8f9a'], trim: '#cfc2ae', facadeTint: { mul: [1, 0.95, 0.86], only: [0, 2, 3] }, shopBands: [[0.205, 0.205, 0.4], [0.22, null, 0.31], [0.05, 0.05, 0.27], [0.135, 0.135, 0.27]], glow: { share: 0.35, color: '#ffe7b8', intensity: 0.55 }, shopGlow: { color: '#ffc46e', intensity: 0.4 } }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/midtown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'midtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  // The rig (Caedon, board 22, 2026-10-15): a low sun dead ahead 8 degrees up at 3.5 under a bloom threshold of 2.4 (sun 6
  // and bloom 1.8 blew the glass out white), a mauve fill, a peach sky to a gold horizon with a wide gold halo, rose-tan haze
  // from 70 m deepening low down, the skyline darkened rose. ponytail: calibration knobs, tuned by eye.
  // ponytail: calibration knob — skylineHeight's near 110 (was 80; Task 32 C7, the redrawn strips, 2048 x 878 with sky over the towers):
  // two laps of 111 m stand its tower mass at 30 m, as the old strips' 31 m, its spires taller (66 m against 60); at 80, three laps of 74 m stood it about half as tall.
  // ponytail: calibration knob — stone, the overpass and tunnel's tint (Caedon, 2026-10-22, Task 34 L-K; ledger, Lanes L-E and L-I: the piers' cool grey read dark under this warm sky): the brownstone body's sandstone, tuned blind, to confirm on the Garden stills
  look: { stone: '#a9896d', skyline: SKYLINE, skylineHeight: [110, 110], exposure: 1.05, sun: { color: '#ffd2a1', intensity: 3.5, dir: [0, -0.14, -0.99] }, ambient: 3.0, env: 0.45, hemi: { sky: '#9d86c4', ground: '#7a5a5a' },
    skyTop: '#f2b08a', skyBottom: '#fdd27a', fog: { color: '#b98270', near: 70, pale: 0, shade: '#8f5f5c', y: [0, 45] }, skylineHaze: { color: '#b98270', mul: '#8a6f6a', mix: [0.3, 0.05], flatten: 0.2, foot: 0 },
    disc: { size: 2, core: 5, halo: 0.7, spread: 18, color: '#fdd27a' }, bloom: { strength: 0.5, threshold: 2.4, radius: 0.45 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
