import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { texture } from './assets.js';
import { fogCut, fogShade, fogHeight, fogSkyTop, fogSkyBottom, fogSky, smooth, SKY_EDGE, heading, hook, bendOffset, bendStart } from './gfx.js';

// The HiFi look (spec §4): tone mapping, sun shadows, studio reflections, a gradient sky and bloom, from a theme's `look`.
// main.js loads this file only in HiFi sessions; without a look the engine renders exactly as before.
//
// The sun's vector (look.sun.dir, the engine's sunDir) is the way its light travels, from the sun toward the scene: the engine
// puts the light at target - sunDir * SUN_BACK. The run goes +z and the view's right is -x, so a sun ahead of the runner has
// dir.z < 0 and a sun on the right dir.x > 0; the dome draws its disc at -sunDir. The engine's own SUN_DIR (6, -16, 12) stands
// behind the camera on the right, about 50 degrees up; every shipped look turns it ahead (Task 32, Caedon, board 22).

// Each skyline ring's target height in metres (far, near), unless the look sets its own `skylineHeight`: its image wraps round
// a whole number of times, the repeat count rounded from that target (ringWrap). 90 and 80 stand the tallest spires about as
// tall as the Task 14 probe's placeholder did (towers up to 60% of its 145 m and 133 m rings); the generated strips' aspects
// put the rings at 76–108 m. ponytail: calibration knob.
const SKYLINE_HEIGHT = [90, 80];
// Task 32 (Caedon's board 22 pick, "Sun B + sky fill + height fog", 2026-10-15). ponytail: calibration knobs.
const SHADOW_RADIUS = 2.5; // PCF blur in shadow-map texels: three 0.186 dropped PCFSoft (it fell back to plain PCF, hard edged)
// The env strength glossy materials keep when a look's env drops to 0.4; userData.reflect overrides it. 0.4 (was 0.85; Caedon,
// board 29 pick 4, 2026-10-20): with every sun ahead of the runner, 0.85 mirrored it off the head, the jug and the taxi's roof.
export const REFLECT = 0.4;
// A theme switch crossfades the rig over FADE_MS; a camera move over JUMP m between two frames (a new run, a still) snaps it.
const FADE_MS = 1000, JUMP = 5;

// A look with its defaults filled in, or null for "no look". Pure, so it is tested in Node.
export function lookState(theme) {
  const l = theme.look;
  if (!l) return null;
  const h = l.skylineHaze, d = l.disc;
  return {
    exposure: l.exposure ?? 1,
    sun: { color: l.sun?.color ?? '#ffffff', intensity: l.sun?.intensity ?? 3, dir: l.sun?.dir ?? null },
    ambient: l.ambient ?? 0.5,
    env: l.env ?? 0.7,
    skyTop: l.skyTop ?? theme.sky,
    skyBottom: l.skyBottom ?? theme.sky, // what the fog pales when the look names no fog colour
    horizon: l.skyBottom ?? null, // the dome's horizon; null: the fog's colour, as before Task 32
    hemi: { sky: l.hemi?.sky ?? null, ground: l.hemi?.ground ?? null }, // null: the engine's own
    fog: { color: l.fog?.color ?? null, near: l.fog?.near ?? FOG.near, pale: l.fog?.pale ?? FOG.pale, shade: l.fog?.shade ?? null, y: l.fog?.y ?? [0, 40] },
    skylineHaze: h ? { color: h.color ?? null, mul: h.mul ?? '#ffffff', mix: h.mix ?? [0, 0], flatten: h.flatten ?? 0, foot: h.foot ?? 0 } : null,
    disc: d ? { size: d.size ?? 1.2, core: d.core ?? 4, halo: d.halo ?? 0.3, spread: d.spread ?? 6, color: d.color ?? '#ffffff' } : null,
    skyline: [].concat(l.skyline ?? []),
    skylineHeight: l.skylineHeight ?? SKYLINE_HEIGHT,
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

// Under a look the fog starts at `near` m, not the engine's 0.3 × far, and fades to the level sky `pale` of the way to white:
// faded into the full sky colour from about 62 m, midtown's and uptown's far avenue misted over in orange and purple (Caedon,
// board 19, 2026-10-15). These are the defaults now: each shipped look sets its own `fog` (Caedon, 2026-10-15, "follow the
// frames per scene"). ponytail: calibration knobs.
const FOG = { near: 120, pale: 0.45 };
const WHITE = new THREE.Color('#ffffff');

// The look's fog, made from the low-fi one engine.setSky just built: its near pushed out to the look's (its far, the streaming
// edge, stays; a fog too thick to start there keeps its own) and its colour (look.fog.color, else skyBottom) paled. No look
// leaves it as it is. Tested in Node.
export function lookFog(fog, s) {
  if (!s) return fog;
  if (s.fog.near < fog.far) fog.near = s.fog.near;
  fog.color.set(s.fog.color ?? s.skyBottom).lerp(WHITE, s.fog.pale);
  return fog;
}

// Everything a look sets per frame, as plain numbers: colours linear (three's working space), the sun's direction unit, the
// disc in radians. apply() builds it from the look, the fog lookFog made and the engine's own fill colours and sun direction,
// and writes it out; a theme switch blends the old one into it (blendRig). Pure, so it is tested in Node.
const rgb = (c) => new THREE.Color(c).toArray(), luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export function rigOf(s, { fog, hemi, dir }) {
  const f = fog.color.toArray(), h = s.skylineHaze, d = s.disc, haze = h ? rgb(h.color ?? fog.color) : f, deg = THREE.MathUtils.degToRad;
  return {
    exposure: s.exposure, sun: s.sun.intensity, sunColor: rgb(s.sun.color), dir: (s.sun.dir ? new THREE.Vector3(...s.sun.dir) : dir.clone()).normalize().toArray(),
    ambient: s.ambient, env: s.env, hemiSky: rgb(s.hemi.sky ?? hemi[0]), hemiGround: rgb(s.hemi.ground ?? hemi[1]),
    fog: f, near: fog.near, shade: s.fog.shade ? rgb(s.fog.shade) : f, fogY: [...s.fog.y], // no shade: the fog at every height
    top: rgb(s.skyTop), bottom: s.horizon ? rgb(s.horizon) : f,
    core: rgb(s.sun.color).map((c) => c * (d?.core ?? 0)), halo: rgb(d?.color ?? '#000000').map((c) => c * (d?.halo ?? 0)), disc: [deg(d?.size ?? 1), deg(d?.spread ?? 1)],
    bloom: [s.bloom.strength, s.bloom.threshold, s.bloom.radius],
    haze: { on: h ? 1 : 0, color: haze, mul: rgb(h?.mul ?? '#ffffff'), mix: [...(h?.mix ?? [0, 0])], flatten: h?.flatten ?? 0, luma: luma(haze), foot: h?.foot ?? 0 },
  };
}
// The rig a fraction t of the way from a to b, number by number (a * (1 - t) + b * t, so t = 0 is a and t = 1 is b exactly).
export const blendRig = (a, b, t) => typeof b === 'number' ? a * (1 - t) + b * t : Array.isArray(b) ? b.map((v, i) => blendRig(a[i], v, t)) : Object.fromEntries(Object.entries(b).map(([k, v]) => [k, blendRig(a[k], v, t)]));

// The skyline ring's texel, as its shader computes it (RING_FRAG) over the same rig: what the tests exercise; the GLSL is checked
// by eye. rgba is the image's texel, v its height up the ring (0 foot, 1 top), up its height in metres over the camera as if the
// ring were unmoved (the shader takes off how far ringShift lifted it, vRingShift), dirY the sight line's unit y as drawn.
// With a skylineHaze: the texel times `mul`, its luma pulled `flatten` of the way to the haze colour's (the window grids go, the
// hue stays), mixed toward the haze colour by mix[0] at the foot to mix[1] at the top; under `foot` m about eye level it turns
// opaque. Without one, the foot fades over its lowest RING.fade, as before Task 32. Either way the foot takes the dome's colour
// along its sight line, which is what the fogged street turns to by the fog cut (gfx.fogSky at full fog, Task 34 L-I), so the
// two meet with no band at any height fog.
export function ringTexel([r, g, b, a], { v, up, dirY }, { haze: h, fog, top, bottom }) {
  let c = [r, g, b].map((x, i) => x * h.mul[i]);
  const k = 1 + (h.luma / Math.max(luma(c), 0.02) - 1) * h.flatten, m = h.mix[0] + (h.mix[1] - h.mix[0]) * v;
  c = c.map((x, i) => { x = Math.min(x * k, 1); return x + (h.color[i] - x) * m; });
  const foot = fogSky(fog, top, bottom, dirY, 1);
  const on = h.on > 0.5, w = on ? 1 - smooth(h.foot, h.foot + RING.band, up) : 1 - smooth(0, RING.fade, v);
  return [...c.map((x, i) => x + (foot[i] - x) * w), on ? Math.max(a, w) : a];
}

// How a skyline image wraps its ring: a whole number of times round, the repeat count that would stand it `target` metres tall
// rounded, so each copy keeps the image's own aspect (the generated strips are cropped to their towers) and stands near the
// target, not always the nearest height a whole count allows. `turn` is how far to turn the ring so the middle of a half
// strip, not a mirror seam, faces the avenue's end (+z, where three's cylinder starts its u): the strips are tiled
// A|mirror(A), so with no turn a seam stood dead ahead and the skyline's centre was one tower mirrored into a twin. One image
// spans 2π / repeats; a quarter of that puts every seam a quarter image off the avenue and mirror(A)'s middle ahead, which
// reads the right way round from inside the ring (u runs right to left there). Pure, so it is tested in Node.
export function ringWrap(radius, width, height, target) {
  const lap = 2 * Math.PI * radius, aspect = height / width, repeats = Math.max(1, Math.round((lap * aspect) / target));
  return { repeats, height: (lap / repeats) * aspect, turn: Math.PI / (2 * repeats) };
}

// How a list of skyline images goes round its ring: in order, each once and unmirrored (its own edges meet its neighbours), the
// sequence repeated the whole number of times ringWrap would give one image as wide as all of them, at the one height that
// closes the ring. `sizes` are the images' [width, height] in px. Each arc is { image, start, length }: three's cylinder angle
// (0 at the avenue's end, +z, growing toward +x, the view's left), laid left to right from inside with the first image's
// middle at 0. Pure, so it is tested in Node.
export function ringArcs(radius, sizes, target) {
  const aspects = sizes.map(([w, h]) => w / h), { repeats, height } = ringWrap(radius, aspects.reduce((a, b) => a + b), 1, target);
  const arcs = [];
  let left = (height * aspects[0]) / radius / 2; // the first image's left edge
  for (let r = 0; r < repeats; r++) aspects.forEach((a, image) => { const length = (height * a) / radius; arcs.push({ image, start: left - length, length }); left -= length; });
  return { height, arcs };
}

// One image's arc of the ring, from angle 0 to `length`, a unit tall from its foot: three's cylinder runs u toward +x, right to
// left from inside, so u is flipped to read the image the right way round.
export function ringArc(radius, length) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, Math.ceil((96 * length) / (2 * Math.PI)), 1, true, 0, length).translate(0, 0.5, 0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  return geo;
}

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz - cameraPosition );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;
// The dome: bottom to top over the lowest SKY_EDGE of the sky, plus the sun's disc toward `sun` (toward the light, unit): a core
// `disc.x` radians wide in the sun's colour times look.disc.core (linear HDR, past the bloom threshold, so it blooms a little)
// and a gaussian halo `disc.y` radians wide. A look without a disc has both colours black (uptown).
const SKY_FRAG = /* glsl */`
  uniform vec3 top;
  uniform vec3 bottom;
  uniform vec3 sun;
  uniform vec3 coreColor;
  uniform vec3 haloColor;
  uniform vec2 disc;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize( vDir );
    float a = acos( clamp( dot( d, sun ), -1.0, 1.0 ) );
    vec3 c = mix( bottom, top, smoothstep( 0.0, ${SKY_EDGE.toFixed(3)}, d.y ) );
    c += coreColor * ( 1.0 - smoothstep( disc.x * 0.7, disc.x, a ) ) + haloColor * exp( - a * a / ( disc.y * disc.y ) );
    gl_FragColor = vec4( c, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// The skyline rings: radii (far, near), foot below the camera, yaw, the old foot fade (a fraction of the ring's height) and the
// haze's band (metres over which the opaque foot lets go). ponytail: calibration knobs.
const RING = { radius: [360, 330], base: -14, yaw: 0, fade: 0.08, band: 4 };
// The rings follow the bent street (Task 33 pick 5, Caedon, board 28: "follow the road, the sky holds"): each slides by the
// street's offset o at BG_DEPTH m past the bend start times R / d (d: that depth from the camera), so it keeps the angle the
// street has there (K 1; about d / R = 0.46 would stand it at its own depth on the street). On a turn the far city slides with
// the road, on a hill it sinks or rises with it; the dome, its horizon and the sun disc stay camera-centred, and heading still
// turns the rings. ponytail: calibration knob. 140 = world's AHEAD 200 - BEND_LEAD 40 - DEAD 20, the deepest z whose every
// stretch is already in the uniforms (deeper, an entering stretch pops the skyline 14-20 degrees in a metre); 180 once
// main's f483688 (the uniforms list builtTo + BEND_LEAD) is on this branch.
export const BG_DEPTH = 140;
export function ringShift(camZ, radius) {
  const zq = bendStart.value + BG_DEPTH, o = bendOffset(zq), k = radius / Math.max(1, zq - camZ);
  return { x: o.x * k, y: o.y * k };
}
// ringTexel in GLSL, after three's map_fragment (uv.y runs 0 at the ring's foot to 1 at its top). Its up is measured as for an
// unmoved ring: vRingShift (what ringShift slid it) comes off, so the hazed foot stays at its foot on a hill. The foot's colour
// is the dome's along the sight line as drawn, as gfx.fogSky turns the street there.
const RING_FRAG = /* glsl */`#include <map_fragment>
  vec3 rc = diffuseColor.rgb * hazeMul;
  rc = min( rc * mix( 1.0, hazeLuma / max( dot( rc, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.02 ), hazeFlatten ), vec3( 1.0 ) );
  rc = mix( rc, hazeColor, mix( hazeMix.x, hazeMix.y, vRingY ) );
  float ringUp = vRingWorld.y - cameraPosition.y - vRingShift;
  vec3 footColor = mix( uSkyBottom, uSkyTop, smoothstep( 0.0, ${SKY_EDGE.toFixed(3)}, normalize( vRingWorld - cameraPosition ).y ) );
  float ringFoot = hazeOn > 0.5 ? 1.0 - smoothstep( hazeFoot, hazeFoot + ${RING.band.toFixed(1)}, ringUp ) : 1.0 - smoothstep( 0.0, ${RING.fade.toFixed(3)}, vRingY );
  diffuseColor = vec4( mix( rc, footColor, ringFoot ), hazeOn > 0.5 ? max( diffuseColor.a, ringFoot ) : diffuseColor.a );`;

export function createLook({ renderer, scene, camera, sun, hemi, sunDir }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose(); // final review, minor: the bake's scene is not needed afterwards
  pmrem.dispose();
  const hemiBase = [hemi.color.clone(), hemi.groundColor.clone()]; // the engine's own fill, for a look without hemi and for no look

  // A camera-centred dome, drawn first and outside the fog; its horizon is the look's skyBottom, else the fog's colour.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: fogSkyTop, bottom: fogSkyBottom, sun: { value: new THREE.Vector3(0, 1, 0) }, // top/bottom shared with the bent shaders' fogSky and the rings' foot
      coreColor: { value: new THREE.Color(0) }, haloColor: { value: new THREE.Color(0) }, disc: { value: new THREE.Vector2(1, 1) } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  dome.visible = false;
  scene.add(dome);

  // The skyline (round 2): up to two camera-centred open cylinders wearing look.skyline, far side first, between the dome and
  // the far plane; unbent, unfogged, no shadows. A missing image hides its ring. ponytail: calibration knobs.
  // Its foot meets the fogged street and buildings without a band, hazed per scene (ringTexel, RING_FRAG); apply() re-tints it
  // on every theme switch. Each ring stands its look's skylineHeight (SKYLINE_HEIGHT above). Each ring is a group: one whole
  // cylinder for a single image, or, for a list (the near ring only, checkLook), one arc mesh per image per lap of the sequence
  // (ringArcs), each wearing its own preloaded texture: no composed texture to build or hold, at a draw call an arc (eight for
  // four strips twice round).
  // ponytail: merge each image's arcs into one geometry if those draw calls ever show.
  const ringU = { hazeOn: { value: 0 }, hazeColor: { value: new THREE.Color() }, hazeMul: { value: new THREE.Color() }, hazeMix: { value: new THREE.Vector2() }, hazeFlatten: { value: 0 },
    hazeLuma: { value: 0 }, hazeFoot: { value: 0 }, uSkyTop: fogSkyTop, uSkyBottom: fogSkyBottom };
  const ringMaterial = (map = null) => {
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, ringU);
      sh.vertexShader = sh.vertexShader.replace('void main() {', `varying float vRingY, vRingShift;\nvarying vec3 vRingWorld;\nvoid main() {\n  vRingY = uv.y;\n  vRingShift = modelMatrix[ 3 ].y - cameraPosition.y - ${RING.base.toFixed(1)};\n  vRingWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;`); // a ring's meshes sit at its group's origin
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 hazeColor, hazeMul, uSkyTop, uSkyBottom;\nuniform vec2 hazeMix;\nuniform float hazeOn, hazeFlatten, hazeLuma, hazeFoot;\nvarying float vRingY, vRingShift;\nvarying vec3 vRingWorld;\nvoid main() {')
        .replace('#include <map_fragment>', RING_FRAG);
    };
    return mat;
  };
  const rings = RING.radius.map((r, i) => {
    const ring = new THREE.Group(), full = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 96, 1, true).translate(0, 0.5, 0), ringMaterial());
    full.renderOrder = -0.9 + i * 0.1; full.frustumCulled = false;
    ring.add(full); ring.visible = false; ring.userData = { full, yaw: RING.yaw };
    scene.add(ring);
    return ring;
  });

  // ponytail: calibration knobs — two shadow cascades out to 220 m (the Task 14 probe: they reach the far canyon, where one
  // box around the run did not). While a look is on they light the scene in the sun's place, with its colour and intensity,
  // and the sun hides. They aim along the engine's sunDir itself, so a look that turns the sun turns them. Every lit material
  // bendable() wraps from now on gets CSM's setupMaterial (gfx.hook), after the module's own hook and before the bend.
  // Never csm.dispose(): it deletes each material's onBeforeCompile, which after bendable() is the bend itself.
  // Task 32: PCF with a radius, the cascades fading into each other (CSM's constructor ignores a `fade` option: set after).
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const csm = new CSM({ maxFar: 220, cascades: 2, shadowMapSize: 4096, lightDirection: sunDir, camera, parent: scene, shadowBias: -0.0004 });
  csm.fade = true;
  for (const l of csm.lights) { l.shadow.normalBias = 0.03; l.shadow.radius = SHADOW_RADIUS; l.visible = false; }
  // L-C: glossy materials (a clearcoat, or roughness 0.15 and under: Milkshake, the taxi and painted obstacles, the bridge's
  // water) wear the env as their own at REFLECT (or userData.reflect), so their reflections survive the looks' env cut; three
  // gives a material without its own envMap the scene's environmentIntensity instead. Facade glass shares its material with the
  // masonry (a roughness map) and follows the scene's env.
  let active = false, lastRatio = 0;
  const glossy = new Set(), lit = cascadeHook(csm);
  hook.beforeBend = (m) => {
    lit(m);
    if (!(m.isMeshStandardMaterial && (m.clearcoat > 0 || m.roughness <= 0.15))) return;
    glossy.add(m); m.envMap = active ? env : null; m.envMapIntensity = m.userData.reflect ?? REFLECT;
    m.addEventListener('dispose', () => glossy.delete(m));
  };
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

  // The rig apply() aims at, the one last written, and a theme switch's crossfade from it ({ from, at }), blended in render().
  let rig = null, shown = null, fade = null;
  const lastCam = new THREE.Vector3();
  const put = (r) => {
    shown = r;
    renderer.toneMappingExposure = r.exposure;
    sun.color.setRGB(...r.sunColor); sun.intensity = r.sun;
    for (const l of csm.lights) { l.color.copy(sun.color); l.intensity = r.sun; }
    sunDir.set(...r.dir).normalize(); // a blend of two unit vectors is shorter; the cascades and the disc want a unit
    hemi.intensity = r.ambient; hemi.color.setRGB(...r.hemiSky); hemi.groundColor.setRGB(...r.hemiGround);
    scene.environmentIntensity = r.env;
    scene.fog.color.setRGB(...r.fog); scene.fog.near = r.near;
    fogShade.value.setRGB(...r.shade); fogHeight.value.set(...r.fogY);
    const u = dome.material.uniforms, h = r.haze;
    u.top.value.setRGB(...r.top); u.bottom.value.setRGB(...r.bottom); u.sun.value.copy(sunDir).negate(); // the disc toward the light
    u.coreColor.value.setRGB(...r.core); u.haloColor.value.setRGB(...r.halo); u.disc.value.set(...r.disc);
    [bloom.strength, bloom.threshold, bloom.radius] = r.bloom;
    ringU.hazeOn.value = h.on; ringU.hazeColor.value.setRGB(...h.color); ringU.hazeMul.value.setRGB(...h.mul); ringU.hazeMix.value.set(...h.mix);
    ringU.hazeFlatten.value = h.flatten; ringU.hazeLuma.value = h.luma; ringU.hazeFoot.value = h.foot;
  };
  return {
    get active() { return active; },
    // engine.setSky calls this after setting the low-fi sky, fog and light: a look overrides them, no look switches itself off.
    apply(theme) {
      const s = lookState(theme), was = active;
      active = !!s;
      fogCut.value = s ? 1 : 0;
      lookFog(scene.fog, s);
      renderer.toneMapping = s ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = s?.exposure ?? 1;
      renderer.shadowMap.enabled = !!s;
      sun.visible = !s; // the cascades light a look's scene; no look keeps the low-fi sun, which never casts
      for (const l of csm.lights) l.visible = !!s; // toggled with the shadow map, so the light state changes and materials recompile once
      scene.environment = s ? env : null;
      for (const m of glossy) m.envMap = scene.environment; // no look: null, as before
      dome.visible = !!s;
      for (const r of rings) { // shown below when the look names loaded images; unbound, so a later release() of an old image leaves nothing disposed bound
        r.visible = false; r.userData.full.material.map = null;
        for (const arc of r.children.slice(1)) { r.remove(arc); arc.geometry.dispose(); arc.material.dispose(); } // an image's arcs share one geometry and material: disposing twice is harmless
      }
      if (!s) { hemi.color.copy(hemiBase[0]); hemi.groundColor.copy(hemiBase[1]); for (const u of [fogShade, fogSkyTop, fogSkyBottom]) u.value.copy(scene.fog.color); fade = null; return; } // no height fog, no fog to the sky
      rig = rigOf(s, { fog: scene.fog, hemi: hemiBase, dir: sunDir }); // setSky has just put the engine's sunDir back
      // A switch from one look to another fades over FADE_MS in render() (the bridge's sun 57 degrees up ahead-left to
      // downtown's 28 degrees on the axis must not pop); the dome's colours fade with it, the ring images swap here. A first
      // look, or one after none, lands at once. ponytail: a run that dies within JUMP m of the menu's camera fades the menu.
      fade = was && shown ? { from: shown, at: performance.now() } : null;
      put(fade ? fade.from : rig);
      rings.forEach((ring, i) => {
        const list = s.skyline, entry = list.length === 2 ? list[i] : i === 1 ? list[0] : undefined; // two entries: far, near; one: the near ring
        let maps = null;
        try { if (entry) maps = [].concat(entry).map((p) => texture(p)); } catch { /* not loaded: no ring */ }
        ring.visible = !!maps;
        if (!maps) return;
        const { full } = ring.userData, r = RING.radius[i];
        full.visible = !Array.isArray(entry);
        if (Array.isArray(entry)) { // a list: each image once, unmirrored, round in order, the first one's middle at the avenue's end
          for (const m of maps) if (m.wrapS !== THREE.ClampToEdgeWrapping || m.repeat.x !== 1) { m.wrapS = THREE.ClampToEdgeWrapping; m.repeat.x = 1; m.needsUpdate = true; } // a single ring may have wrapped this shared texture
          const { height, arcs } = ringArcs(r, maps.map((m) => [m.image.width, m.image.height]), s.skylineHeight[i]);
          const parts = maps.map((map, k) => [ringArc(r, arcs[k].length), ringMaterial(map)]); // the first lap holds each image once, in order
          for (const a of arcs) {
            const arc = new THREE.Mesh(...parts[a.image]);
            arc.rotation.y = a.start; arc.renderOrder = full.renderOrder; arc.frustumCulled = false;
            ring.add(arc);
          }
          ring.scale.y = height;
          ring.userData.yaw = RING.yaw;
          return;
        }
        // ponytail: wrap and repeat are set on the shared preloaded texture; fine while only the ring uses skyline images, and
        // while no image is both a single ring's and in a list (a list's arcs leave each texture's own clamp and repeat of 1)
        const map = maps[0], wrap = ringWrap(r, map.image.width, map.image.height, s.skylineHeight[i]);
        map.wrapS = THREE.RepeatWrapping; map.repeat.x = wrap.repeats; // the strips come mirrored, so they loop seamlessly
        full.material.map = map; full.material.needsUpdate = true;
        ring.scale.y = wrap.height;
        ring.userData.yaw = RING.yaw + wrap.turn; // an image's middle, not its mirror seam, at the avenue's end
      });
    },
    render() {
      if (fade) {
        const k = camera.position.distanceTo(lastCam) > JUMP ? 1 : Math.min(1, (performance.now() - fade.at) / FADE_MS);
        put(k < 1 ? blendRig(fade.from, rig, k) : rig);
        if (k === 1) fade = null;
      }
      lastCam.copy(camera.position);
      dome.position.copy(camera.position);
      rings.forEach((r, i) => {
        const p = camera.position, o = ringShift(p.z, RING.radius[i]); // slid with the bent street
        r.position.set(p.x + o.x, p.y + RING.base + o.y, p.z);
        r.rotation.y = r.userData.yaw + heading.value; // turned with the street: after a turn, what lay at its far end faces the avenue
      });
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
