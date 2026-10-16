import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs; `lit` is the windows' glow (dusk: on); `ground` the cool grey road per scene over asphalt (Caedon, 2026-10-15, replacing board 18's warm grey) and the walk, each the mean colour it renders at over its tile, its roughness, the paving's flag size in metres (board 24; hexes tuned by eye in the Task 32 stack).
const STYLE = { id: 'uptown', ground: { road: '#594a6e', roadRough: 0.5, walk: '#a896a2', walkRough: 0.55, flag: 1.2 }, paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0.8, facades: cityFiles('facades', 'uptown', 5), shops: cityFiles('shops', 'uptown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/uptown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'uptown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  look: { skyline: SKYLINE, skylineHeight: [100, 70], exposure: 0.9, sun: { color: '#f3d4ff', intensity: 1.6 }, ambient: 0.8, env: 0.8, skyTop: '#6d4fa8', bloom: { strength: 0.55, threshold: 1.6, radius: 0.5 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
