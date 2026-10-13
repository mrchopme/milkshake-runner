import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { texture } from './assets.js';

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
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
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
  const RING = { radius: [360, 330], base: -14, yaw: 0, fade: 0.08 };
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

  // ponytail: calibration knobs — the shadow box around the sun's target (engine.js aims it 25 m ahead of the run)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let active = false;
  return {
    get active() { return active; },
    // engine.setSky calls this after setting the low-fi sky, fog and light: a look overrides them, no look switches itself off.
    apply(theme) {
      const s = lookState(theme);
      active = !!s;
      renderer.toneMapping = s ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = s?.exposure ?? 1;
      renderer.shadowMap.enabled = !!s;
      sun.castShadow = !!s; // toggled with the shadow map, so the light state changes and materials recompile once
      scene.environment = s ? env : null;
      dome.visible = !!s;
      for (const r of rings) { r.visible = false; r.material.map = null; } // shown below when the look names a loaded image; unbound, so a later release() of the old image leaves nothing disposed bound
      if (!s) return;
      scene.environmentIntensity = s.env;
      sun.color.set(s.sun.color);
      sun.intensity = s.sun.intensity;
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
        ring.scale.y = (Math.PI * RING.radius[i] * map.image.height) / map.image.width; // the image keeps its aspect over half the ring
      });
    },
    render() {
      dome.position.copy(camera.position);
      for (const r of rings) r.position.set(camera.position.x, camera.position.y + RING.base, camera.position.z);
      composer.render();
    },
    resize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
