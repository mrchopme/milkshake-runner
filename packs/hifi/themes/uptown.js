import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs; `lit` is the windows' glow (dusk: on); `road` the teaser's warm grey (Caedon, 2026-10-14, board 18).
const STYLE = { id: 'uptown', road: '#6b675a', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0.8, facades: cityFiles('facades', 'uptown', 5), shops: cityFiles('shops', 'uptown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/uptown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'uptown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  // The rig (Caedon, board 22, 2026-10-15): no sun to speak of (a faint violet key, high, for soft contact shadows), a violet
  // fill, a violet sky to pink-magenta and no disc, deep plum haze deepening low down, the skyline dimmed lavender with its lit
  // windows kept; bloom low so they halo. ponytail: calibration knobs, tuned by eye.
  look: { skyline: SKYLINE, skylineHeight: [100, 70], exposure: 0.75, sun: { color: '#b9a3ff', intensity: 0.45, dir: [0, -0.87, -0.5] }, ambient: 3.2, env: 0.45, hemi: { sky: '#9a7fd4', ground: '#4a3044' },
    skyTop: '#8f68c6', skyBottom: '#d892d6', fog: { color: '#6a4e74', near: 120, pale: 0, shade: '#4f3a5e', y: [0, 35] }, skylineHaze: { mul: '#9a86a0', mix: [0.3, 0.05], flatten: 0, foot: 0 },
    bloom: { strength: 0.55, threshold: 0.95, radius: 0.5 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
