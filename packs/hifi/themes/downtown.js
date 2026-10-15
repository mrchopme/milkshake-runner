import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs, SIGN_FILES } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
import { KIT_FILES } from '../lib/kit.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for downtown (level 1, a clear blue day). ponytail: calibration knobs, tuned against board 01's keyframes; `lit` is the windows' glow; `road` the teaser's warm grey (Caedon, 2026-10-14, board 18).
const STYLE = { id: 'downtown', road: '#6b675a', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], lit: 0, facades: cityFiles('facades', 'downtown', 5), shops: cityFiles('shops', 'downtown', 4), ...SIGN_FILES }; // the generated city (round 2), board 15
const SKYLINE = [cityFiles('sky', 'downtown', 1)[0], [1, 2, 3, 4].map((n) => `hifi/city/sky/downtown-near-${n}.webp`)]; // the far ring's strip, then the near ring's four images in order round the ring, the first facing the avenue (Caedon, 2026-10-15, board 20)
export default {
  kind: 'theme', id: 'downtown',
  assets: [...STYLE.facades, ...STYLE.shops, ...Object.values(SIGN_FILES).flat(), ...SKYLINE.flat(), ...KIT_FILES],
  look: { skyline: SKYLINE, skylineHeight: [110, 80], exposure: 1.0, sun: { color: '#fff3e0', intensity: 2.2 }, ambient: 0.7, env: 0.9, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 1.8, radius: 0.4 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
