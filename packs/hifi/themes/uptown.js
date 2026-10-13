import { cityChunk } from '../lib/city.js';
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs.
const STYLE = { id: 'uptown', road: '#5a5c72', walk: '#a3a0ab', paint: '#f2f2f2', parts: [] }; // the generated city (round 2), board 15
export default {
  kind: 'theme', id: 'uptown',
  assets: ['hifi/city/sky/placeholder.png'],
  look: { skyline: 'hifi/city/sky/placeholder.png', exposure: 0.9, sun: { color: '#f3d4ff', intensity: 1.8 }, ambient: 2.2, env: 0.35, skyTop: '#6d4fa8', bloom: { strength: 0.5, threshold: 0.9, radius: 0.5 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
