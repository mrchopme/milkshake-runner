import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs; `lit` is the windows' glow; `road` the teaser's warm grey (Caedon, 2026-10-14, board 18).
const STYLE = { id: 'midtown', road: '#6b675a', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0, facades: cityFiles('facades', 'midtown', 5), shops: cityFiles('shops', 'midtown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = [[1, 2, 3, 4].map((n) => `hifi/city/sky/midtown-near-${n}.webp`)]; // the near ring alone, four images in order round it, the first facing the avenue (Caedon, 2026-10-15: board 20's images; board 21, the far ring dropped: its hazy strip drew ghost towers and, turned, its mirror seam)
export default {
  kind: 'theme', id: 'midtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  // The rig (Caedon, board 22, 2026-10-15): a low sun dead ahead 8 degrees up at 3.5 under a bloom threshold of 2.4 (sun 6
  // and bloom 1.8 blew the glass out white), a mauve fill, a peach sky to a gold horizon with a wide gold halo, rose-tan haze
  // from 70 m deepening low down, the skyline darkened rose. ponytail: calibration knobs, tuned by eye.
  look: { skyline: SKYLINE, skylineHeight: [110, 80], exposure: 1.05, sun: { color: '#ffd2a1', intensity: 3.5, dir: [0, -0.14, -0.99] }, ambient: 3.0, env: 0.45, hemi: { sky: '#9d86c4', ground: '#7a5a5a' },
    skyTop: '#f2b08a', skyBottom: '#fdd27a', fog: { color: '#b98270', near: 70, pale: 0, shade: '#8f5f5c', y: [0, 45] }, skylineHaze: { color: '#b98270', mul: '#8a6f6a', mix: [0.3, 0.05], flatten: 0.2, foot: 0 },
    disc: { size: 2, core: 5, halo: 0.7, spread: 18, color: '#fdd27a' }, bloom: { strength: 0.5, threshold: 2.4, radius: 0.45 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
