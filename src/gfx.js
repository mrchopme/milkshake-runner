import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';
export { asset, texture } from './assets.js'; // a preloaded GLB as a synchronous copy, a preloaded image as a shared texture

// Toon primitives for content modules. Materials are cached and shared; dispose() never touches them.
export const palette = PALETTE;
export const three = THREE; // escape hatch for endings that need Vector3, Points and the like

// World bend (spec v4 §1). Every material the helpers hand out bends its vertices in the vertex shader by shared uniforms:
// uBendStart (run.z + DEAD: nothing bends closer than this) and uSeg[BEND_SEGMENTS], one (from, to, kx, ky) per bending
// stretch of street in view. For a vertex at world z and each stretch: s = max(uBendStart, from - BEND_LEAD), L = max(0, to - s),
// u = clamp(z - s, 0, L); x += kx·(u² + 2·L·max(0, z - to)) (a turn keeps its heading past its end line), y += ky·u² (a hill
// plateaus at its new height). The bend is anchored to the street: straight up to BEND_LEAD before a start line (a parabola is flat
// where it starts, so the lead-in is what lets a corner read from far off), straight again at an end line.
// Collision never sees this: the street is straight for everything that plays.
export const TURN_K = 0.005, HILL_K = 0.003, DEAD = 20, BEND_SEGMENTS = 4; // calibration knobs: offset per m² of bend, the dead zone, stretches drawn at once
export const BEND_LEAD = 40; // metres before a stretch's start line where its bend begins; Caedon, 2026-10-09: "the turn still reads late, bend it earlier"
export const bendStart = { value: DEAD };
export const bendSegments = { value: Array.from({ length: BEND_SEGMENTS }, () => new THREE.Vector4()) };
const BEND_FN = `
uniform float uBendStart;
uniform vec4 uSeg[${BEND_SEGMENTS}];
vec3 bendOffset( float z ) {
  vec3 o = vec3( 0.0 );
  for ( int i = 0; i < ${BEND_SEGMENTS}; i ++ ) {
    float s = max( uBendStart, uSeg[ i ].x - ${BEND_LEAD.toFixed(1)} );
    float L = max( 0.0, uSeg[ i ].y - s );
    float u = clamp( z - s, 0.0, L );
    o.x += uSeg[ i ].z * ( u * u + 2.0 * L * max( 0.0, z - uSeg[ i ].y ) );
    o.y += uSeg[ i ].w * u * u;
  }
  return o;
}
`;
// three's own order (project_vertex): a batched copy's matrix, then an instance's, then the mesh's; the street's offset last.
const BEND = `
  vec4 bentWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    bentWorld = batchingMatrix * bentWorld;
  #endif
  #ifdef USE_INSTANCING
    bentWorld = instanceMatrix * bentWorld;
  #endif
  bentWorld = modelMatrix * bentWorld;
  bentWorld.xyz += bendOffset( bentWorld.z );
  vec4 mvPosition = viewMatrix * bentWorld;
  gl_Position = projectionMatrix * mvPosition;
`;
const BEND_SPRITE = `
  vec4 bentWorld = modelMatrix[ 3 ];
  bentWorld.xyz += bendOffset( bentWorld.z );
  vec4 mvPosition = viewMatrix * bentWorld;
`;
// The HiFi fog cut: compiled in only when the look sets hook.cutFog; then with fogCut.value 1 (a theme with a look) a bent
// fragment the fog has fully hidden is dropped, so the skyline ring shows through instead of a fog-coloured block.
export const fogCut = { value: 0 };
// The HiFi height fog, compiled in with the cut: a bent mesh's fog colour is mix(fogShade, the fog's, smoothstep(fogHeight.x,
// fogHeight.y, its bent world y)), so the slot between the buildings fogs deeper low down than at the rooftops (Task 32, Caedon,
// board 22). The look sets both per theme; a shade equal to the fog colour is no height fog. A sprite (no project_vertex) keeps
// the plain fog. fogHeight.x < fogHeight.y always (checkLook): smoothstep is undefined otherwise.
// Task 34 L-I (Caedon, board 29 pick 5): by the BENT height (it was the height before the bend, so a far building a hill lifted
// over the crest kept its street's dark shade against the bright dome), then, as far as the fog is thick (fogFactor FOG_SKY[0]
// to FOG_SKY[1]), toward the dome's own colour along the sight line (fogSky): far off, a fragment melts into the sky behind it.
// The dome shares fogSkyTop / fogSkyBottom (src/look.js sets them; without a look, both the fog colour).
export const fogShade = { value: new THREE.Color() };
export const fogHeight = { value: new THREE.Vector2(0, 1) };
export const fogSkyTop = { value: new THREE.Color() }, fogSkyBottom = { value: new THREE.Color() };
export const SKY_EDGE = 0.3; // the dome reaches its top colour at this dir.y (0.45 before Task 32, Caedon, board 22: a narrower pale band over the horizon). ponytail: calibration knob
export const FOG_SKY = [0.6, 0.95]; // ponytail: calibration knob, the fogFactor over which the fog gives way to the sky: all sky before the cut (0.999), so the cut shows no edge
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The GLSL fogSky over plain numbers (linear rgb arrays, dirY the sight line's unit y): what the tests exercise; the GLSL is checked by eye.
export function fogSky(fog, top, bottom, dirY, fogFactor) {
  const s = smooth(0, SKY_EDGE, dirY), k = smooth(FOG_SKY[0], FOG_SKY[1], fogFactor);
  return fog.map((f, i) => f + (bottom[i] + (top[i] - bottom[i]) * s - f) * k);
}
const FOG_SKY_FN = `uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
vec3 fogSky( vec3 fog, float dirY, float fogFactor ) {
  vec3 sky = mix( uSkyBottom, uSkyTop, smoothstep( 0.0, ${SKY_EDGE.toFixed(3)}, dirY ) );
  return mix( fog, sky, smoothstep( ${FOG_SKY[0].toFixed(3)}, ${FOG_SKY[1].toFixed(3)}, fogFactor ) );
}`;
const HFOG_VERT = '#include <project_vertex>\n  vFogWorld = bentWorld.xyz;'; // after the bend (patched over the include next): a hill's street fogs like the sky it rises into
// three computes fogFactor inside fog_fragment, after this: the same linear one (engine.js builds a THREE.Fog) is taken here
const HFOG_FRAG = '#ifdef USE_FOG\n  vec3 hFogColor = mix( uFogShade, fogColor, smoothstep( uFogHeight.x, uFogHeight.y, vFogWorld.y ) );\n  hFogColor = fogSky( hFogColor, normalize( vFogWorld - cameraPosition ).y, smoothstep( fogNear, fogFar, vFogDepth ) );\n  #define fogColor hFogColor\n#endif\n#include <fog_fragment>';
function cutFog(shader) {
  if (!hook.cutFog) return; // low-fi compiles three's fragment shaders as they are: no uniform, no discard
  const high = shader.vertexShader.includes('#include <project_vertex>');
  shader.uniforms.uFogCut = fogCut;
  if (high) {
    Object.assign(shader.uniforms, { uFogShade: fogShade, uFogHeight: fogHeight, uSkyTop: fogSkyTop, uSkyBottom: fogSkyBottom });
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'varying vec3 vFogWorld;\nvoid main() {').replace('#include <project_vertex>', HFOG_VERT);
  }
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', `uniform float uFogCut;${high ? `\nuniform vec3 uFogShade;\nuniform vec2 uFogHeight;\nvarying vec3 vFogWorld;\n${FOG_SKY_FN}` : ''}\nvoid main() {`)
    .replace('#include <fog_fragment>', `${high ? HFOG_FRAG : '#include <fog_fragment>'}\n#ifdef USE_FOG\n  if ( uFogCut > 0.5 && fogFactor > 0.999 ) discard; // HiFi: what the fog has fully hidden lets the skyline through\n#endif`);
}
function patch(shader) {
  cutFog(shader);
  shader.uniforms.uBendStart = bendStart; shader.uniforms.uSeg = bendSegments;
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${BEND_FN}\nvoid main() {`).replace('#include <project_vertex>', BEND);
}
function patchSprite(shader) { // a sprite places its centre from the model-view matrix; bend that centre in world space instead
  cutFog(shader);
  shader.uniforms.uBendStart = bendStart; shader.uniforms.uSeg = bendSegments;
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${BEND_FN}\nvoid main() {`).replace('vec4 mvPosition = modelViewMatrix[ 3 ];', BEND_SPRITE);
}
// Marks a material bendable, once. Materials a module builds itself get this when the engine adds the object (gfx.bend).
// A hook the module set itself keeps running, first; then the look's (hook.beforeBend, HiFi only: the cascaded shadows'
// setupMaterial); the bend is patched in last.
// The HiFi look sets both fields once, before anything compiles. ?lofi and ?hifi never share a page, so neither needs a
// program-cache key; low-fi leaves both off.
export const hook = { beforeBend: null, cutFog: false };
const patched = new WeakSet(); // by material, not userData: a clone copies userData but not the hook, and must be patched again
export function bendable(material) {
  if (!material || patched.has(material)) return material;
  patched.add(material);
  material.userData.bent = true;
  const own = material.onBeforeCompile, bend = material.isSpriteMaterial ? patchSprite : patch;
  hook.beforeBend?.(material); // CSM's setupMaterial replaces onBeforeCompile instead of chaining, so it runs before the wrap
  const look = material.onBeforeCompile === own ? null : material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => { own.call(material, shader, renderer); look?.call(material, shader, renderer); bend(shader); };
  material.customProgramCacheKey = () => own.toString() + bend.name; // three keys its program cache by onBeforeCompile.toString(), which is now the same wrapper for every material
  material.needsUpdate = true;
  return material;
}
// Every object the engine adds goes through here once, so it also marks opaque meshes as shadow casters and receivers.
// The flags do nothing while the shadow map is off (low-fi). Transparent glows, blob shadows and sprites stay out of it.
export function bend(object) {
  object.traverse((n) => {
    const mats = [].concat(n.material ?? []); // a mesh may carry a material array
    for (const m of mats) bendable(m);
    if (n.isMesh) n.castShadow = n.receiveShadow = mats.every((m) => !m.transparent);
    // HiFi (Task 34 L-I): three culls on the unbent bounds, which a strong turn plus a hill can swing off screen while the bent
    // mesh is on it; low-fi keeps the culling. ponytail: off outright; a bounding sphere padded by the bend at its depth would
    // keep the off-screen savings, if those draw calls ever show.
    if (hook.cutFog && mats.length) n.frustumCulled = false;
  });
  return object;
}
// The street's heading at the bend start: how far its turns have swung the view, as a yaw about +y (three's rotation.y, so
// positive is a right turn, as `turn` is): TURN_K radians a metre of a full turn, about the angle the drawn street leaves a
// 240 m turn at. setBend sets it from `turned` (generator.turnedBy at the bend start); the HiFi skyline turns its rings by it,
// and nothing low-fi reads it. ponytail: calibration knob, the rate.
export const heading = { value: 0 };
// The stretches in view, nearest first, as { from, to, turn, hill } (metres, -1..1), and the turn·m behind the bend start.
// No stretches straightens the street.
export function setBend({ origin = 0, segments = [], turned = 0 } = {}) {
  heading.value = turned * TURN_K;
  bendStart.value = origin + DEAD;
  bendSegments.value.forEach((v, i) => { const s = segments[i]; if (s) v.set(s.from, s.to, 0 - s.turn * TURN_K, s.hill * HILL_K); else v.set(0, 0, 0, 0); }); // 0 - …: a straight road is +0, never -0
}
// The shader's formula in JavaScript over the same uniforms: what the tests exercise; the GLSL is checked by eye.
export function bendOffset(z) {
  let x = 0, y = 0;
  for (const v of bendSegments.value) {
    const s = Math.max(bendStart.value, v.x - BEND_LEAD), L = Math.max(0, v.y - s), u = Math.min(L, Math.max(0, z - s));
    x += v.z * (u * u + 2 * L * Math.max(0, z - v.y));
    y += v.w * u * u;
  }
  return { x, y };
}
// Seconds of run time for shader animation (LED faces, marquees, blinking signs, traffic): world.update sets it, so pause
// freezes it and a still (run.time = 0) pins it.
export const time = { value: 0 };

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, bendable(new THREE.MeshToonMaterial({ color, ...opts })));
  return mats.get(key);
}
const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
// Boxes subdivide along z (one segment per 4 m) so a long road piece curves with the bend instead of staying a straight chord.
export const box = (w, h, d, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / 4))), mat(color, opts)), x, y, z);
export const roundedBox = (w, h, d, radius, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), mat(color)), x, y, z);
export const cyl = (rTop, rBottom, h, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 20), mat(color, opts)), x, y, z);
export const sphere = (r, color, x = 0, y = r, z = 0, opts) => at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts)), x, y, z);
export const capsule = (r, len, color, x = 0, y = len / 2 + r, z = 0, opts) => at(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color, opts)), x, y, z);
export const cone = (r, h, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat(color)), x, y, z);
export function group(...children) { const g = new THREE.Group(); if (children.length) g.add(...children); return g; }

// A soft round shadow on the ground: the cheapest way to show where something floating or jumping is.
export function blobShadow(r = 0.6, opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), bendable(new THREE.MeshBasicMaterial({ color: PALETTE.eye, transparent: true, opacity })));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.renderOrder = -1;
  return m;
}
export function glow(r, color, y = 0.9) {
  return at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), bendable(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }))), 0, y, 0);
}

export function textTexture(text, { w = 1024, h = 192, color = '#ffffff', font = '900 120px "Lilita One", system-ui, sans-serif' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  Object.assign(x, { fillStyle: color, font, textAlign: 'center', textBaseline: 'middle' });
  x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A pickup glyph (28x28 path data) as a texture.
export function glyphTexture(path, { stroke = false, color = '#ffffff' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const x = c.getContext('2d');
  x.scale(128 / 28, 128 / 28);
  const p = new Path2D(path);
  if (stroke) { x.strokeStyle = color; x.lineWidth = 3.6; x.stroke(p); } else { x.fillStyle = color; x.fill(p); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const labelTexture = (label) => textTexture(label, { w: 128, h: 128, font: '900 72px "Lilita One", system-ui, sans-serif' });
export function sprite(texture, w, h) {
  const s = new THREE.Sprite(bendable(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })));
  s.scale.set(w, h, 1); return s;
}

// The default power-up view: a glowing orb in the pickup's colour with its glyph or label on the front.
export function orb(def) {
  const g = group(blobShadow(0.3), glow(0.6, def.color), sphere(0.4, def.color, 0, 0.9, 0, { emissive: def.color, emissiveIntensity: 0.5 }));
  const tex = def.glyph ? glyphTexture(def.glyph, { stroke: def.stroke }) : def.label ? labelTexture(def.label) : null;
  if (tex) g.add(at(sprite(tex, 0.5, 0.5), 0, 0.9, -0.45));
  return g;
}

// Frees geometry, per-object textures and instance buffers. Shared toon materials from mat() stay alive on purpose, and so
// does anything flagged userData.shared: a preloaded asset's nodes, geometry, materials and textures, which every copy uses.
export function dispose(object) {
  object.traverse((n) => {
    if (n.userData.shared) return;
    if (!n.geometry?.userData.shared) n.geometry?.dispose();
    if (n.isInstancedMesh || n.isBatchedMesh) n.dispose(); // the instance matrices and colours (and a batched mesh's textures)
    for (const m of [].concat(n.material ?? [])) {
      if (m.userData.shared || !(n.isSprite || n.isPoints || m.map)) continue;
      if (!m.map?.userData.shared) m.map?.dispose();
      m.dispose();
    }
  });
}
