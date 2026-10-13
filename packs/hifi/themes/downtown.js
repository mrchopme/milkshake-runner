import { cityChunk } from '../lib/city.js';
import { buildings } from '../lib/buildings.js';
import { signs } from '../lib/signs.js';
import { furniture } from '../lib/furniture.js';
import { traffic } from '../lib/traffic.js';
// HiFi look for downtown (level 1, a clear blue day). ponytail: calibration knobs, tuned against board 01's keyframes.
const STYLE = { id: 'downtown', road: '#5a5c72', walk: '#a3a0ab', paint: '#f2f2f2', parts: [buildings, signs, furniture, traffic], signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff'], facades: [], shops: [] }; // the generated city (round 2), board 15
export default {
  kind: 'theme', id: 'downtown',
  assets: ['hifi/city/sky/placeholder.png'],
  look: { skyline: 'hifi/city/sky/placeholder.png', exposure: 1.0, sun: { color: '#fff3e0', intensity: 2.4 }, ambient: 2.0, env: 0.4, skyTop: '#5ea9ec', bloom: { strength: 0.4, threshold: 0.9, radius: 0.4 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
