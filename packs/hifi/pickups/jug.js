// HiFi jug: the generated milk bottle in public/hifi/jug.glb, fitted to the shipped orb's sphere (lib/pickup.js); the milk glows from its own texels.
import { pickupOverlay } from '../lib/pickup.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — turns the model so its front (+x) looks at the player (-z); Task 22's lineup
const MILK_GLOW = 0.35;  // ponytail: calibration knob — how hard the milk's own texels glow (was 0.6; Caedon, board 29 pick 4: it bloomed white at dusk)

// The milky white texels of the base map: the body, not the lavender cap and base ring. Only they get the emissive map, so the bottle
// glows in its own shape (Caedon, 2026-10-09). Measured on public/hifi/jug.glb: the body's green is 232 and up, the lavender's 210 and below.
export const isMilk = (r, g, b) => r > 228 && g > 220 && b > 235;

export default { kind: 'pickup', id: 'jug', ...pickupOverlay('jug', { yaw: YAW, glow: { test: isMilk, intensity: MILK_GLOW } }) };
