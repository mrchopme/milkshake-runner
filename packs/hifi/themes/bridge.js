import { bridgeChunk, WATERFRONT } from '../lib/bridge.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for the bridge stretch: the same day as downtown, so crossing it mid-run keeps the light. ponytail: calibration knobs.
const SKYLINE = cityFiles('sky', 'bridge', 2); // the far ring's strip, then the near one's
export default {
  kind: 'theme', id: 'bridge',
  assets: [...WATERFRONT.facades, ...SKYLINE],
  look: { skyline: SKYLINE, exposure: 1.0, sun: { color: '#fff3e0', intensity: 2.4 }, ambient: 2.0, env: 0.4, skyTop: '#5ea9ec', bloom: { strength: 0.4, threshold: 0.9, radius: 0.4 } },
  createChunk(gfx, args) { return bridgeChunk(gfx, args, { id: 'bridge' }); },
};
