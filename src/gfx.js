import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';
export { asset } from './assets.js'; // a preloaded GLB as a synchronous copy (src/assets.js)

// Toon primitives for content modules. Materials are cached and shared; dispose() never touches them.
export const palette = PALETTE;
export const three = THREE; // escape hatch for endings that need Vector3, Points and the like

// World bend (spec v3 §1). Every material the helpers hand out bends its vertices in the vertex shader by one shared uniform:
// uBend = (kx, ky, originZ, deadZone). For a vertex at world z, d = max(0, z - originZ - deadZone); x += kx·d², y += ky·d².
// Collision never sees this: the street is straight for everything that plays.
export const TURN_K = 0.005, HILL_K = 0.003, DEAD = 20; // calibration knobs: metres of offset per m² beyond the dead zone, and the dead zone
export const bendUniform = { value: new THREE.Vector4(0, 0, 0, DEAD) };
const BEND = `
  vec4 bentWorld = modelMatrix * vec4( transformed, 1.0 );
  float bendD = max( 0.0, bentWorld.z - uBend.z - uBend.w );
  bentWorld.x += uBend.x * bendD * bendD;
  bentWorld.y += uBend.y * bendD * bendD;
  vec4 mvPosition = viewMatrix * bentWorld;
  gl_Position = projectionMatrix * mvPosition;
`;
const BEND_SPRITE = `
  vec4 bentWorld = modelMatrix[ 3 ];
  float bendD = max( 0.0, bentWorld.z - uBend.z - uBend.w );
  bentWorld.x += uBend.x * bendD * bendD;
  bentWorld.y += uBend.y * bendD * bendD;
  vec4 mvPosition = viewMatrix * bentWorld;
`;
function patch(shader) {
  shader.uniforms.uBend = bendUniform;
  shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform vec4 uBend;\nvoid main() {').replace('#include <project_vertex>', BEND);
}
function patchSprite(shader) { // a sprite places its centre from the model-view matrix; bend that centre in world space instead
  shader.uniforms.uBend = bendUniform;
  shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform vec4 uBend;\nvoid main() {').replace('vec4 mvPosition = modelViewMatrix[ 3 ];', BEND_SPRITE);
}
// Marks a material bendable, once. Materials a module builds itself get this when the engine adds the object (gfx.bend).
// A hook the module set itself keeps running, first; the bend is patched in after it.
export function bendable(material) {
  if (!material || material.userData.bent) return material;
  material.userData.bent = true;
  const own = material.onBeforeCompile, bend = material.isSpriteMaterial ? patchSprite : patch;
  material.onBeforeCompile = (shader, renderer) => { own.call(material, shader, renderer); bend(shader); };
  material.customProgramCacheKey = () => own.toString() + bend.name; // three keys its program cache by onBeforeCompile.toString(), which is now the same wrapper for every material
  material.needsUpdate = true;
  return material;
}
export function bend(object) { object.traverse((n) => { for (const m of [].concat(n.material ?? [])) bendable(m); }); return object; } // a mesh may carry a material array
export function setBend({ turn = 0, hill = 0, origin = 0 } = {}) { bendUniform.value.set(0 - turn * TURN_K, hill * HILL_K, origin, DEAD); } // 0 - …: a straight road is +0, never -0

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

// Frees geometry and per-object textures. Shared toon materials from mat() stay alive on purpose, and so does anything
// flagged userData.shared: a preloaded asset's meshes, which every copy of it uses.
export function dispose(object) {
  object.traverse((n) => {
    if (n.userData.shared) return;
    n.geometry?.dispose();
    if (n.isSprite || n.isPoints || n.material?.map) { n.material.map?.dispose(); n.material.dispose(); }
  });
}
