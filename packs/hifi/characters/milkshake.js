// HiFi Milkshake: the generated cow in public/hifi/milkshake.glb on the shipped character's view (cowView: v4's skinning,
// stride, lean and dust), with knobs measured on this mesh, a glossy toy paint and no blob shadow (the look casts real ones).
import { cowView } from '../../../content/characters/milkshake.js';
import { gloss } from '../lib/paint.js';

// Knobs in the mesh's geometry frame, the one skinWeights reads: the optimised GLB stores positions quantised to y -1..1
// (the node's 0.4897 scale, which the skinning drops, brings them to 0.98 units), +x the muzzle, z left-right. Measured
// 2026-10-14 on the v2 model (arms down) with gltf-transform per height slice (y_m = (y + 1) * 0.95); regenerated, measure again.
export const SKIN = {
  crotch: -0.66, crotchBand: 0.1,     // the legs (z ±0.07..0.40) are two pieces up to y -0.66 and one body from -0.65
  // The arms hang fused to the flank (|z| ≤ 0.32 around them) out to |z| 0.477, x -0.10..0.10, hands down to y -0.44. A crisp
  // arm (armZ 0.33, band 0.03) swung from the shoulder cap tore that seam: a Node run-cycle sweep at the stride's peak left 450
  // arm edges stretched past 3x (p99 8x). ponytail: calibration knobs — the soft band and a swing from about the elbow leave none.
  armZ: 0.29, armBand: 0.12,
  armFloor: -0.4, armBack: -0.1,      // little arm weight in the belly under the hands (|z| to 0.359 at y < -0.44) or the tail, which
                                      // hangs at the hands' height out to z -0.596 but behind x -0.2. Both fade over armBand (the
                                      // content module reuses it), so a wider armBand reaches further into the belly and the tail's root
                                      // on the rump (x -0.26, pinned in the test)
  shoulder: -0.15, shoulderBand: 0.12, // the swing fades out by y -0.03, below the shoulder cap (y 0.12) and the neck band
  neck: 0.1, neckBand: 0.08,          // the head (muzzle from y 0.115, ears 0.57..0.78, horns 0.90..1.0) sits on the torso, no neck
};
export const BONES = {
  hips: [0.01, -0.55, 0],                                // the pelvis; the torso's x centre is 0.01 at every height
  head: [0.01, 0.14, 0],                                 // the middle of the neck band
  armL: [0, SKIN.shoulder, 0.4], armR: [0, SKIN.shoulder, -0.4], // over the arm's centre line (x 0, |z| 0.40), where its swing starts
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
