// Geometry helpers for the HiFi city. Everything is subdivided along z every 4 m so it bends with the street.
const SEG = 4;
export function box(T, w, h, d, material, x = 0, y = h / 2, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / SEG))), material);
  m.position.set(x, y, z);
  return m;
}
// A wall plane facing ±x, `d` long along z and `h` tall, its UVs in units of one tile (tw by th metres), so a repeating
// facade texture keeps its scale on any wall. side = +1 faces +x (a building on the -x side of the road faces +x).
// axis 'z': a block's end wall facing -z (the camera looks +z), `d` wide along x, u left to right as the camera sees it; side unused.
export function wall(T, d, h, side, tw, th, v0 = 0, axis = 'x') {
  const g = new T.PlaneGeometry(d, h, Math.max(1, Math.ceil(d / SEG)), 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * d / tw, v0 + uv.getY(i) * h / th);
  g.rotateY(axis === 'z' ? Math.PI : side > 0 ? Math.PI / 2 : -Math.PI / 2);
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
// UVs in metres, per face, from the vertex's world place (the chunk group stays at the origin; the mesh's own position is added):
// a face looking along x maps (z, y), along y (x, z), along z (x, y); `face(x, y, z, n)` returns [u, v] to override any face.
// Nothing stretches along z or round the bend; the texture's repeat carries its period.
export function metreUV(mesh, face) {
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, o = mesh.position, n = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + o.x, y = pos.getY(i) + o.y, z = pos.getZ(i) + o.z;
    Object.assign(n, { x: nor.getX(i), y: nor.getY(i), z: nor.getZ(i) });
    uv.setXY(i, ...(face?.(x, y, z, n) ?? (Math.abs(n.x) > 0.5 ? [z, y] : Math.abs(n.y) > 0.5 ? [x, z] : [x, y])));
  }
  uv.needsUpdate = true;
  return mesh;
}
