// Scale and offset that fit a generated model into a shipped box: centred, on the ground (or at the box's y), its footprint
// filled. inside = true also fits the height (jump, slide and timing obstacles); a lane blocker may stand taller (the taxi ruling).
export function fitBox(T, model, { w, h, d, y = 0 }, inside) {
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const scale = Math.min(w / size.x, d / size.z, inside ? h / size.y : Infinity);
  return { scale, offset: new T.Vector3(-c.x * scale, y - b.min.y * scale, -c.z * scale) };
}
