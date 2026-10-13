// HiFi magnet: the generated horseshoe in public/hifi/magnet.glb, fitted to the shipped orb's sphere (lib/pickup.js).
import { pickupOverlay } from '../lib/pickup.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — turns the model so its face (+x) looks at the player (-z); Task 22's lineup

export default { kind: 'pickup', id: 'magnet', ...pickupOverlay('magnet', { yaw: YAW }) };
