import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { texture } from './assets.js';
import { fogCut, hook } from './gfx.js';

// The HiFi look (spec §4): tone mapping, sun shadows, studio reflections, a gradient sky and bloom, from a theme's `look`.
// main.js loads this file only in HiFi sessions; without a look the engine renders exactly as before.

// A look with its defaults filled in, or null for "no look". Pure, so it is tested in Node.
export function lookState(theme) {
  const l = theme.look;
  if (!l) return null;
  return {
    exposure: l.exposure ?? 1,
    sun: { color: l.sun?.color ?? '#ffffff', intensity: l.sun?.intensity ?? 3, dir: l.sun?.dir ?? null },
    ambient: l.ambient ?? 0.5,
    env: l.env ?? 0.7,
    skyTop: l.skyTop ?? theme.sky,
    skyBottom: theme.sky,
    skyline: [].concat(l.skyline ?? []),
    bloom: { strength: l.bloom?.strength ?? 0.5, threshold: l.bloom?.threshold ?? 0.85, radius: l.bloom?.radius ?? 0.4 },
  };
}

// What the look hands bendable() (gfx.hook.beforeBend): CSM's setupMaterial for lit materials only (an unlit blob, glow or
// sprite has no lights chunk to patch), and each one leaves CSM's material Map when disposed: the Map is strong, and pickups
// and the shield bubble build new materials on every spawn. Tested in Node with a stand-in CSM.
export const cascadeHook = (csm) => (m) => {
  if (!(m.isMeshStandardMaterial || m.isMeshToonMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return; // Physical is a Standard
  csm.setupMaterial(m);
  m.addEventListener('dispose', () => csm.shaders.delete(m)); // a material used again recompiles, and CSM records it again
};

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz - cameraPosition );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;
const SKY_FRAG = /* glsl */`
  uniform vec3 top;
  uniform vec3 bottom;
  varying vec3 vDir;
  void main() {
    gl_FragColor = vec4( mix( bottom, top, smoothstep( 0.0, 0.45, vDir.y ) ), 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createLook({ renderer, scene, camera, sun, hemi, sunDir }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose(); // final review, minor: the bake's scene is not needed afterwards
  pmrem.dispose();

  // A camera-centred dome, drawn first and outside the fog; the horizon colour is the level's sky, so the fog meets it.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  dome.visible = false;
  scene.add(dome);

  // The skyline (round 2): up to two camera-centred open cylinders wearing look.skyline, far side first, between the dome and
  // the far plane; unbent, unfogged, no shadows. A missing image hides its ring. ponytail: calibration knobs.
  // Its foot fades to the level sky over the lowest `fade` of the ring (the spec's "tinted to the level sky at its base"),
  // so it meets the fogged street and buildings without a band; apply() re-tints it on every theme switch.
  // `height` scales the image-aspect height: at 1 the 360 m ring stood about 485 m tall, and 0.3 (the Task 14 probe) sits
  // the skyline at the avenue's end.
  const RING = { radius: [360, 330], base: -14, yaw: 0, fade: 0.08, height: 0.3 };
  const tint = { value: new THREE.Color() };
  const rings = RING.radius.map((r, i) => {
    const geo = new THREE.CylinderGeometry(r, r, 1, 96, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
    mat.onBeforeCompile = (sh) => { // uv.y runs 0 at the ring's foot to 1 at its top
      sh.uniforms.tint = tint;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vRingY;\nvoid main() {\n  vRingY = uv.y;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec3 tint;\nvarying float vRingY;\nvoid main() {`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb = mix( tint, diffuseColor.rgb, smoothstep( 0.0, ${RING.fade.toFixed(3)}, vRingY ) );`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -0.9 + i * 0.1; m.frustumCulled = false; m.visible = false; m.rotation.y = RING.yaw;
    scene.add(m);
    return m;
  });

  // ponytail: calibration knobs — two shadow cascades out to 220 m (the Task 14 probe: they reach the far canyon, where one
  // box around the run did not). While a look is on they light the scene in the sun's place, with its colour and intensity,
  // and the sun hides. They aim along the engine's sunDir itself, so a look that turns the sun turns them. Every lit material
  // bendable() wraps from now on gets CSM's setupMaterial (gfx.hook), after the module's own hook and before the bend.
  // Never csm.dispose(): it deletes each material's onBeforeCompile, which after bendable() is the bend itself.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const csm = new CSM({ maxFar: 220, cascades: 2, shadowMapSize: 4096, lightDirection: sunDir, camera, parent: scene, shadowBias: -0.0004 });
  for (const l of csm.lights) { l.shadow.normalBias = 0.03; l.visible = false; }
  hook.beforeBend = cascadeHook(csm);
  hook.cutFog = true; // the fog cut compiles into bent shaders from here on; a theme's look switches it with fogCut
  let view = ''; // the camera's fov and aspect when the cascade splits were last fitted

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.85);
  composer.addPass(bloom);
  const output = new OutputPass();
  output.needsSwap = false; // the last pass draws to the screen: no swap after it, so the scene always lands in the same target
  // (a pass added before it that swaps must be added with needsSwap = false too, or the scene alternates into the unsampled target)
  composer.addPass(output);
  composer.renderTarget1.samples = 0; // only the target the scene renders into keeps 4x MSAA (about 190 MB saved at 3024x1964)

  let active = false, lastRatio = 0;
  return {
    get active() { return active; },
    // engine.setSky calls this after setting the low-fi sky, fog and light: a look overrides them, no look switches itself off.
    apply(theme) {
      const s = lookState(theme);
      active = !!s;
      fogCut.value = s ? 1 : 0;
      renderer.toneMapping = s ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = s?.exposure ?? 1;
      renderer.shadowMap.enabled = !!s;
      sun.visible = !s; // the cascades light a look's scene; no look keeps the low-fi sun, which never casts
      for (const l of csm.lights) l.visible = !!s; // toggled with the shadow map, so the light state changes and materials recompile once
      scene.environment = s ? env : null;
      dome.visible = !!s;
      for (const r of rings) { r.visible = false; r.material.map = null; } // shown below when the look names a loaded image; unbound, so a later release() of the old image leaves nothing disposed bound
      if (!s) return;
      scene.environmentIntensity = s.env;
      sun.color.set(s.sun.color);
      sun.intensity = s.sun.intensity;
      for (const l of csm.lights) { l.color.copy(sun.color); l.intensity = sun.intensity; }
      hemi.intensity = s.ambient;
      dome.material.uniforms.top.value.set(s.skyTop);
      dome.material.uniforms.bottom.value.set(s.skyBottom);
      Object.assign(bloom, s.bloom);
      tint.value.set(s.skyBottom); // the colour the fog and the dome's horizon fade to
      if (s.sun.dir) sunDir.set(...s.sun.dir).normalize();
      rings.forEach((ring, i) => {
        const list = s.skyline, path = list.length === 2 ? list[i] : i === 1 ? list[0] : undefined; // two images: far, near; one: the near ring
        let map = null;
        try { if (path) map = texture(path); } catch { /* not loaded: no ring */ }
        ring.visible = !!map;
        if (!map) return;
        // ponytail: wrap and repeat are set on the shared preloaded texture; fine while only the ring uses skyline images
        map.wrapS = THREE.MirroredRepeatWrapping; map.repeat.x = 2; // the image covers half the ring, mirrored round the back
        ring.material.map = map; ring.material.needsUpdate = true;
        ring.scale.y = ((Math.PI * RING.radius[i] * map.image.height) / map.image.width) * RING.height; // the image's aspect over half the ring, scaled
      });
    },
    render() {
      dome.position.copy(camera.position);
      for (const r of rings) r.position.set(camera.position.x, camera.position.y + RING.base, camera.position.z);
      const v = `${camera.fov} ${camera.aspect}`;
      if (v !== view) { view = v; csm.updateFrustums(); } // the speed-eased fov and resizes move the cascade splits
      camera.updateMatrixWorld(); // follow() moved the camera since the last render
      csm.update();
      composer.render();
    },
    resize(w, h) {
      const pr = renderer.getPixelRatio();
      if (pr !== lastRatio) { lastRatio = pr; composer.setPixelRatio(pr); } // setPixelRatio reallocates; only when it changed
      composer.setSize(w, h);
    },
  };
}
