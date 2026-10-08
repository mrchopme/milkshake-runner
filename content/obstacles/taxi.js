export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 1.5, d: 4.0 },
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(
      gfx.box(2.0, 0.9, 4.0, P.taxi),
      gfx.box(1.7, 0.45, 2.0, P.glass, 0, 1.125, -0.2),
      gfx.box(1.7, 0.15, 2.0, P.taxi, 0, 1.425, -0.2),
      gfx.box(0.6, 0.15, 0.3, P.lane, 0, 1.58, -0.2),
    );
    for (const x of [-0.7, 0.7]) g.add(gfx.box(0.3, 0.12, 0.05, P.rider, x, 0.65, -2.0));
    for (const [x, z] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) { const w = gfx.cyl(0.33, 0.33, 0.25, P.dark, x, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
