// HiFi scaffold_beam: the redrawn scaffold in public/hifi/scaffold_beam.glb (a plank on two posts, nothing between them), fitted to the
// shipped box (content/obstacles/scaffold_beam.js). The box (y 1.2 to 1.6) is only the plank's band, so the model is fitted to the column
// from the road up to the box top: the feet stand on the road, the plank's top is the box top and its underside (1.35 m) is inside the box.
// Between the posts is open: Milkshake slides through there. The generated posts stand 1.04 m apart (0.93 m between the feet) and her
// arms-down model is about 1.13 m across, so the two halves are spread apart (SPREAD) with the plank's middle stretched to bridge them.
import { fitBox } from '../lib/fit.js';
import { gloss, painter } from '../lib/paint.js';

const YAW = Math.PI / 2; // ponytail: calibration knob — the plank runs along z and the doorway between the posts faces +x; +π/2 turns the doorway to the player (-z) and the plank across the lane
const SPREAD = 0.2;      // ponytail: calibration knob — model units each half (post, feet, plank end) moves outward along the plank: the doorway opens from 0.93 to 1.58 m at the feet, the whole from 1.59 to 2.25 m wide (box 2.4)
const INNER = 0.28;      // the model's z of the nearest post or foot is 0.283: past it everything moves rigidly (posts and feet keep their shape); inside it only the plank, which stretches
// metalness 0: Tripo marks parts metallic at random, which reads as dark paint (Task 23 ruling); the roughness map stays
const paint = painter((T, m) => gloss(T, m, { clearcoat: 0.6, clearcoatRoughness: 0.2, metalness: 0, metalnessMap: null }));

let parts; // { scale, offset }, measured from the first copy
const spread = new WeakMap(); // the loaded geometry -> its widened clone, made once and shared by every copy

export default {
  kind: 'obstacle', id: 'scaffold_beam', assets: ['hifi/scaffold_beam.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/scaffold_beam.glb');
    model.rotation.y = YAW;
    model.traverse((n) => { if (n.isMesh) n.geometry = widen(T, model, n); });
    parts ??= fitBox(T, model, { ...this.box, y: 0, h: this.box.y + this.box.h }, this.avoid !== 'lane');
    model.traverse((n) => { if (n.isMesh) n.material = paint(gfx, n.material); });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};

// A clone of the mesh's geometry with its two halves moved apart along the model's z (the plank's axis): a vertex beyond INNER moves out by
// SPREAD, one inside it is scaled out to meet them. The loaded geometry stays untouched for any other user; the clone is flagged shared.
function widen(T, model, mesh) {
  let g = spread.get(mesh.geometry);
  if (g) return g;
  model.updateMatrixWorld(true);
  const toModel = new T.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld), back = toModel.clone().invert(), v = new T.Vector3();
  g = mesh.geometry.clone();
  const p = g.attributes.position, moved = new T.Float32BufferAttribute(p.count * 3, 3); // the loaded positions are quantised integers: the clone's are floats
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(toModel);
    const z = Math.abs(v.z);
    v.z = Math.sign(v.z) * (z < INNER ? z * (1 + SPREAD / INNER) : z + SPREAD);
    moved.setXYZ(i, ...v.applyMatrix4(back).toArray());
  }
  g.setAttribute('position', moved);
  g.computeBoundingBox(); g.computeBoundingSphere(); // clone() copied the loaded geometry's bounds
  g.userData.shared = true;
  spread.set(mesh.geometry, g);
  return g;
}
