import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// The HiFi look (spec §4): tone mapping, sun shadows, studio reflections, a gradient sky and bloom, from a theme's `look`.
// main.js loads this file only in HiFi sessions; without a look the engine renders exactly as before.

// A look with its defaults filled in, or null for "no look". Pure, so it is tested in Node.
export function lookState(theme) {
  const l = theme.look;
  if (!l) return null;
  return {
    exposure: l.exposure ?? 1,
    sun: { color: l.sun?.color ?? '#ffffff', intensity: l.sun?.intensity ?? 3 },
    ambient: l.ambient ?? 0.5,
    env: l.env ?? 0.7,
    skyTop: l.skyTop ?? theme.sky,
    skyBottom: theme.sky,
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

export function createLook({ renderer, scene, camera, sun, hemi }) {
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
      if (!s) return;
      scene.environmentIntensity = s.env;
      sun.color.set(s.sun.color);
      sun.intensity = s.sun.intensity;
      hemi.intensity = s.ambient;
      dome.material.uniforms.top.value.set(s.skyTop);
      dome.material.uniforms.bottom.value.set(s.skyBottom);
      Object.assign(bloom, s.bloom);
    },
    render() {
      dome.position.copy(camera.position);
      composer.render();
    },
    resize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
