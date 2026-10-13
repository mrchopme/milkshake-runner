// HiFi shield: the generated badge in public/hifi/shield.glb, fitted to the shipped orb's sphere (lib/pickup.js), and the bubble Milkshake
// wears while the shield holds (board 04), a code shader, 0 credits. ponytail: knobs.
import { pickupOverlay } from '../lib/pickup.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — turns the badge so its face (+x) looks at the player (-z); Task 22's lineup
const BUBBLE = { r: 1.25, y: 1.0, opacity: 0.22, rim: 2.2, rimAlpha: 1.5, pulse: 0.03 }; // rimAlpha: how far the edge opaques up so the rim's light survives the blend (ponytail: eyeballed, tune in the still)
export default {
  kind: 'pickup', id: 'shield', ...pickupOverlay('shield', { yaw: YAW }),
  createWorn(gfx) {
    const T = gfx.three;
    const m = new T.MeshPhysicalMaterial({ color: '#4dc3ff', transparent: true, opacity: BUBBLE.opacity, roughness: 0.05, clearcoat: 1, iridescence: 1, depthWrite: false });
    m.onBeforeCompile = (s) => { // a fresnel rim that glows past the bloom threshold: the bubble's own edge, not a ring laid over it
      s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `float rim = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 3.0 );\n  outgoingLight += vec3( 0.3, 0.76, 1.0 ) * rim * ${BUBBLE.rim.toFixed(2)};\n  diffuseColor.a = min( 1.0, diffuseColor.a + rim * ${BUBBLE.rimAlpha.toFixed(2)} );\n  #include <opaque_fragment>`);
    };
    const object = new T.Mesh(new T.SphereGeometry(BUBBLE.r, 32, 24), m);
    object.position.y = BUBBLE.y;
    return { object, update: (run) => object.scale.setScalar(1 + Math.sin(run.time * 3) * BUBBLE.pulse), dispose: () => m.dispose() };
  },
};
