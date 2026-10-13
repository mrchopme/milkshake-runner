import { cityChunk } from '../lib/city.js';
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs.
const STYLE = { id: 'midtown', road: '#5a5c72', walk: '#a3a0ab', paint: '#f2f2f2', parts: [] }; // the generated city (round 2), board 15
export default {
  kind: 'theme', id: 'midtown',
  assets: ['hifi/city/sky/placeholder.png'],
  look: { skyline: 'hifi/city/sky/placeholder.png', exposure: 0.95, sun: { color: '#ffd2a1', intensity: 2.1 }, ambient: 1.8, env: 0.35, skyTop: '#e07b5a', bloom: { strength: 0.45, threshold: 0.9, radius: 0.45 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
