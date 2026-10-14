export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 2.0, d: 4.0 },
  // A boxy yellow van with a roof topper (board 14): 2.15 m to the top, 0.8 m above a jump's apex, so it never reads as jumpable.
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(
      gfx.box(2.0, 1.0, 4.0, P.taxi),                                                                   // lower body, 0 to 1.0 m
      gfx.box(1.9, 0.9, 3.0, P.taxi, 0, 1.45, -0.3),                                                     // cabin, 1.0 to 1.9 m
      gfx.box(1.6, 0.6, 0.05, P.glass, 0, 1.5, -1.82),                                                   // rear window, the face Milkshake sees
      gfx.box(0.05, 0.5, 2.4, P.glass, -0.96, 1.5, -0.3), gfx.box(0.05, 0.5, 2.4, P.glass, 0.96, 1.5, -0.3), // side windows
      gfx.box(0.7, 0.25, 0.3, P.lane, 0, 2.025, -0.3),                                                   // roof topper, 1.9 to 2.15 m
      gfx.box(0.72, 0.06, 0.32, P.rider, 0, 1.93, -0.3),                                                 // its red band
    );
    for (const x of [-0.7, 0.7]) g.add(gfx.box(0.3, 0.12, 0.05, P.rider, x, 0.75, -2.0));
    for (const [x, z] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) { const w = gfx.cyl(0.33, 0.33, 0.25, P.dark, x, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
