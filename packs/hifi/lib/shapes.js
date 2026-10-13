// Geometry helpers for the HiFi city. Everything is subdivided along z every 4 m so it bends with the street.
const SEG = 4;
export function box(T, w, h, d, material, x = 0, y = h / 2, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / SEG))), material);
  m.position.set(x, y, z);
  return m;
}
// A wall plane facing ±x, `d` long along z and `h` tall, its UVs in units of one tile (tw by th metres), so a repeating
// facade texture keeps its scale on any wall. side = +1 faces +x (a building on the -x side of the road faces +x).
export function wall(T, d, h, side, tw, th, v0 = 0) {
  const g = new T.PlaneGeometry(d, h, Math.max(1, Math.ceil(d / SEG)), 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * d / tw, v0 + uv.getY(i) * h / th);
  g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  return g;
}
// One InstancedMesh for many copies; matrices are world matrices (the chunk group stays at the origin).
export function instanced(T, geometry, material, matrices) {
  const m = new T.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = matrices.length;
  m.computeBoundingSphere();
  return m;
}
