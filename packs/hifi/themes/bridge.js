import { bridgeChunk, WATERFRONT } from '../lib/bridge.js';
import { cityFiles } from '../lib/facade.js';
// HiFi look for the bridge stretch: the same day as downtown, so crossing it mid-run keeps the light. ponytail: calibration knobs.
const SKYLINE = cityFiles('sky', 'bridge', 2); // the far ring's strip, then the near one's
export default {
  kind: 'theme', id: 'bridge',
  assets: [...WATERFRONT.facades, ...SKYLINE, 'hifi/railings.glb'], // railings.glb: the walkway railings (lib/bridge.js)
  // The rig (Caedon, board 22, 2026-10-15): a high sun ahead 57 degrees up and 15 left, a sky-blue fill over a dark blue
  // ground, a clear sky to a pale cyan horizon, light haze from 80 m, the skyline hazed toward pale blue; the switch to and
  // from downtown crossfades (src/look.js). ponytail: calibration knobs, tuned by eye.
  look: { skyline: SKYLINE, skylineHeight: [110, 60], exposure: 1.0, sun: { color: '#fff3e0', intensity: 5.0, dir: [-0.14, -0.84, -0.53] }, ambient: 2.4, env: 0.4, hemi: { sky: '#9cc9f0', ground: '#2e3550' },
    skyTop: '#6fd2fd', skyBottom: '#ceebf5', fog: { color: '#b4d3ec', near: 80, pale: 0, shade: '#a3c4e0', y: [0, 25] }, skylineHaze: { color: '#cfe6ff', mix: [0.4, 0.35], flatten: 0.3, foot: 0 },
    disc: { size: 1.2, core: 4, halo: 0.3, spread: 6, color: '#ffffff' }, bloom: { strength: 0.5, threshold: 2.3, radius: 0.4 } },
  createChunk(gfx, args) { return bridgeChunk(gfx, args, { id: 'bridge' }); },
};
