import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs; `lit` is the windows' glow; `road` the teaser's warm grey (Caedon, 2026-10-14, board 18).
const STYLE = { id: 'midtown', road: '#6b675a', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0, facades: cityFiles('facades', 'midtown', 5), shops: cityFiles('shops', 'midtown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = cityFiles('sky', 'midtown', 2); // the far ring's strip, then the near one's
export default {
  kind: 'theme', id: 'midtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE, ...KIT_FILES],
  look: { skyline: SKYLINE, skylineHeight: [200, 150], exposure: 0.95, sun: { color: '#ffd2a1', intensity: 2.0 }, ambient: 0.65, env: 0.85, skyTop: '#e07b5a', bloom: { strength: 0.5, threshold: 1.8, radius: 0.45 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
