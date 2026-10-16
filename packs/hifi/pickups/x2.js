// HiFi x2: the generated "2×" token in public/hifi/x2.glb, fitted to the shipped orb's sphere (lib/pickup.js). The world spins every pickup
// at 3 rad/s (src/world.js), so the token's mirrored back shows half the time; the shipped orb's sprite label is a billboard and never did.
import { pickupOverlay } from '../lib/pickup.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — turns the token so its face (+x) looks at the player (-z); it reads "2×" there (Task 22's lineup)

export default { kind: 'pickup', id: 'x2', ...pickupOverlay('x2', { yaw: YAW }) };
