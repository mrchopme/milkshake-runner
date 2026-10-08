import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';

// Toon primitives for content modules. Materials are cached and shared; dispose() never touches them.
export const palette = PALETTE;
export const three = THREE; // escape hatch for endings that need Vector3, Points and the like

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color, ...opts }));
  return mats.get(key);
}
const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
export const box = (w, h, d, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts)), x, y, z);
export const roundedBox = (w, h, d, radius, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), mat(color)), x, y, z);
export const cyl = (rTop, rBottom, h, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 20), mat(color, opts)), x, y, z);
export const sphere = (r, color, x = 0, y = r, z = 0, opts) => at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts)), x, y, z);
export const capsule = (r, len, color, x = 0, y = len / 2 + r, z = 0, opts) => at(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color, opts)), x, y, z);
export const cone = (r, h, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat(color)), x, y, z);
export function group(...children) { const g = new THREE.Group(); if (children.length) g.add(...children); return g; }

// A soft round shadow on the ground: the cheapest way to show where something floating or jumping is.
export function blobShadow(r = 0.6, opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: PALETTE.eye, transparent: true, opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.renderOrder = -1;
  return m;
}
export function glow(r, color, y = 0.9) {
  return at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })), 0, y, 0);
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  s.scale.set(w, h, 1); return s;
}

// The default power-up view: a glowing orb in the pickup's colour with its glyph or label on the front.
export function orb(def) {
  const g = group(blobShadow(0.3), glow(0.6, def.color), sphere(0.4, def.color, 0, 0.9, 0, { emissive: def.color, emissiveIntensity: 0.5 }));
  const tex = def.glyph ? glyphTexture(def.glyph, { stroke: def.stroke }) : def.label ? labelTexture(def.label) : null;
  if (tex) g.add(at(sprite(tex, 0.5, 0.5), 0, 0.9, -0.45));
  return g;
}

// Frees geometry and per-object textures. Shared toon materials from mat() stay alive on purpose.
export function dispose(object) {
  object.traverse((n) => {
    n.geometry?.dispose();
    if (n.isSprite || n.isPoints || n.material?.map) { n.material.map?.dispose(); n.material.dispose(); }
  });
}
