import { instanced } from './shapes.js';
import { material } from './materials.js';
// LED and billboard stacks on the facades (board 01): flat colour panels in dark bezels, instanced. Task 24 swaps generated
// posters in as an atlas.
const LED = { glow: 2.4, rate: 0.8 }; // ponytail: brightness past the bloom threshold, blinks per second
export function ledMaterial(gfx) {
  const T = gfx.three;
  return material('led', () => {
    const m = new T.MeshBasicMaterial({ color: new T.Color(LED.glow, LED.glow, LED.glow) });
    m.onBeforeCompile = (s) => { // each panel blinks on its own beat; the glow is the panel's own face, never a plate over it
      s.uniforms.uTime = gfx.time;
      s.vertexShader = 'varying float vBeat;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBeat = fract( float( gl_InstanceID ) * 0.618 );');
      s.fragmentShader = 'uniform float uTime;\nvarying float vBeat;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n  diffuseColor.rgb *= 0.65 + 0.35 * step( 0.5, fract( uTime * ${LED.rate.toFixed(2)} + vBeat ) );`);
    };
    return m;
  });
}
export function signs(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, panels = [], bezels = [], colors = [], g = gfx.group();
  // seam: a panel spans z .. z + w (w <= 6) and its bezel 4% more each side, so the stack starts no later than 6.24 m from the end
  for (const side of [-1, 1]) for (let z = z0 + 4; z + 6.24 <= z0 + length; z += 9 + r() * 14) {
    if (cross && z + 6.24 > cross.z && z < cross.z + 12) continue;
    const stack = 1 + Math.floor(r() * 3), x = side * 7.42, w = 3 + r() * 3;
    for (let k = 0; k < stack; k++) {
      const y = 6 + k * 3.4 + r(), h = 2.2 + r() * 0.8;
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z + w / 2), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -side * Math.PI / 2), new T.Vector3(w, h, 1));
      panels.push(m); bezels.push(m.clone().multiply(new T.Matrix4().makeScale(1.08, 1.1, 1)).setPosition(x + side * 0.03, y, z + w / 2));
      colors.push(new T.Color(style.signs[Math.floor(r() * style.signs.length)]));
    }
  }
  const led = instanced(T, new T.PlaneGeometry(1, 1), ledMaterial(gfx), panels);
  colors.forEach((c, i) => led.setColorAt(i, c));
  g.add(led, instanced(T, new T.PlaneGeometry(1, 1), material('bezel', () => new T.MeshStandardMaterial({ color: '#1b1d2a', roughness: 0.35 })), bezels));
  return g;
}
