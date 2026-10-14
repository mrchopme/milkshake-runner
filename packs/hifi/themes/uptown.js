import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs; `lit` is the windows' glow (dusk: on).
const STYLE = { id: 'uptown', road: '#5a5c72', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0.8, facades: cityFiles('facades', 'uptown', 5), shops: cityFiles('shops', 'uptown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = cityFiles('sky', 'uptown', 2); // the far ring's strip, then the near one's
export default {
  kind: 'theme', id: 'uptown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE, ...KIT_FILES],
  look: { skyline: SKYLINE, exposure: 0.9, sun: { color: '#f3d4ff', intensity: 1.6 }, ambient: 0.8, env: 0.8, skyTop: '#6d4fa8', bloom: { strength: 0.55, threshold: 1.6, radius: 0.5 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
