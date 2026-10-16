import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs; `bladeRate` the blade signs' rate (lib/signs.js; board 23: downtown 1, midtown none, uptown about one a chunk); `lit` marks dusk (signs read it; the windows glow from `glow`); `ground` the cool grey road per scene over asphalt (Caedon, 2026-10-15, replacing board 18's warm grey) and the walk, each the mean colour it renders at over its tile, its roughness, the paving's flag size in metres (board 24; hexes tuned by eye in the Task 32 stack).
// The walls (Task 32, Caedon's board 23 pick, "as prototyped"; buildings.js reads them). ponytail: calibration knobs. heights: a random
// walk of 0/3.5/7 m steps in 14-28 m on the floor grid, 10% outliers 31.5-35 m, never the same tile twice in a row; saturation down
// (the main session's tint); 70% of window cells lit amber at 1.2 from their own panes, never uptown-02's (its fire escape reads as
// panes); shop interiors at 1.5.
const STYLE = { id: 'uptown', ground: { road: '#594a6e', roadRough: 0.5, walk: '#a896a2', walkRough: 0.55, flag: 1.2 }, paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], bladeRate: 0.5, lit: 0.8, facades: cityFiles('facades', 'uptown', 5), shops: cityFiles('shops', 'uptown', 4), ...SIGN_FILES,
  heights: { kind: 'walk', range: [14, 28], steps: [0, 3.5, 7], outlier: { share: 0.1, h: [31.5, 35] }, tiles: [0, 1, 2, 3, 4] }, tileClass: ['m', 'm', 'm', 'm', 'm'], bodies: ['#915e45', '#705245', '#a48167', '#ccaa92', '#9e6d47'], trim: '#cec0be', facadeTint: { mul: [0.78, 0.78, 0.88] }, shopBands: [[0.195, 0.195, 0.4], [0.205, 0.205, 0.42], [0.21, 0.21, 0.4], [0.055, 0.055, 0.27]], glow: { share: 0.7, color: '#ffb46a', intensity: 1.2, skip: [1] }, shopGlow: { color: '#ffc46e', intensity: 1.5 } }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/uptown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'uptown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  // The rig (Caedon, board 22, 2026-10-15): no sun to speak of (a faint violet key, high, for soft contact shadows), a violet
  // fill, a violet sky to pink-magenta and no disc, deep plum haze deepening low down, the skyline dimmed lavender with its lit
  // windows kept; bloom low so they halo. ponytail: calibration knobs, tuned by eye.
  // ponytail: calibration knob — skylineHeight's near 110 (was 70; Task 32 C7, the redrawn strips, 2048 x 878 with sky over the towers):
  // two laps of 111 m stand its tower mass at 29 m, as the old strips' 32 m, its spires taller (68 m against 53); at 70, three laps of 74 m stood it about half as tall.
  look: { skyline: SKYLINE, skylineHeight: [100, 110], exposure: 0.75, sun: { color: '#b9a3ff', intensity: 0.45, dir: [0, -0.87, -0.5] }, ambient: 3.2, env: 0.45, hemi: { sky: '#9a7fd4', ground: '#4a3044' },
    skyTop: '#8f68c6', skyBottom: '#d892d6', fog: { color: '#6a4e74', near: 120, pale: 0, shade: '#4f3a5e', y: [0, 35] }, skylineHaze: { mul: '#9a86a0', mix: [0.3, 0.05], flatten: 0, foot: 0 },
    bloom: { strength: 0.55, threshold: 0.95, radius: 0.5 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
