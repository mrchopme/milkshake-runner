// HiFi Milkshake: the generated cow in public/hifi/milkshake.glb on the shipped character's view (cowView: v4's skinning,
// stride, lean and dust), with knobs measured on this mesh, a glossy toy paint and no blob shadow (the look casts real ones).
import { cowView } from '../../../content/characters/milkshake.js';
import { gloss } from '../lib/paint.js';

// Knobs in the mesh's geometry frame, the one skinWeights reads: the optimised GLB stores positions quantised to y -1..1
// (the node's 0.489 scale, which the skinning drops, brings them to 0.98 units), +x the muzzle, z left-right. Measured
// 2026-10-13 with gltf-transform per 0.04 slice of height (y_m = (y + 1) * 0.95); if the GLB is regenerated, measure again.
export const SKIN = {
  crotch: -0.69, crotchBand: 0.1,    // the legs (z ±0.05..0.40) are two pieces up to y -0.69 and one body from -0.68; the band
                                     // from a Node sweep at the stride's peak: 0.03 left 144 edges stretched past 3x, 0.1 none
  armZ: 1, armBand: 0.03,            // ponytail: calibration knob — past the mesh (|z| ≤ 0.69), so the arms ride the torso. Measured
                                     // 0.37 (the arms leave the flank at 0.335, the belly reaches 0.363), but skinWeights has no
                                     // floor for arm weight and the tail curls out to z -0.56 below the arms (y -0.56..-0.29), so it
                                     // would swing with the right arm; and the arms point out along z, so the z swing only rolls them
  shoulder: 0.12, shoulderBand: 0.04, // the arms span y -0.10..0.11 (a cylinder from the flank to |z| 0.69)
  neck: 0.12, neckBand: 0.08,         // the head (muzzle from y 0.115, ears 0.55..0.77, horns 0.90..1.0) sits on the torso, no neck
};
export const BONES = {
  hips: [0.01, -0.6, 0],                                // the pelvis; the torso's x centre is 0.01 at every height
  head: [0.01, 0.16, 0],                                // the middle of the neck band
  armL: [0.05, 0, 0.35], armR: [0.05, 0, -0.35],        // the arms' centre where they leave the flank
  legL: [0.01, SKIN.crotch, 0.21], legR: [0.01, SKIN.crotch, -0.21], // the top of each leg
};
const YAW = -Math.PI / 2; // ponytail: calibration knob — the muzzle (+x in the GLB) turns to +z, the way Milkshake runs (the shipped yaw)

export default {
  kind: 'character', id: 'milkshake', assets: ['hifi/milkshake.glb'],
  createView(gfx) {
    return cowView(gfx, this, {
      load: async () => gfx.asset('hifi/milkshake.glb'),
      skin: SKIN, bones: BONES, yaw: YAW, blob: false,
      dress: (T, m) => gloss(T, m, { clearcoat: 1, clearcoatRoughness: 0.15, metalness: 0, metalnessMap: null }), // Tripo's random metal reads as dark paint
    });
  },
};
