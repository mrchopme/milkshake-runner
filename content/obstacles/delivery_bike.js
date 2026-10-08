export default {
  kind: 'obstacle', id: 'delivery_bike', avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true,
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(0.1, 0.1, 1.2, P.dark, 0, 0.45), gfx.box(0.5, 0.45, 0.45, P.hazard, 0, 0.85, -0.55),
      gfx.capsule(0.22, 0.4, P.rider, 0, 1.0), gfx.sphere(0.16, P.dark, 0, 1.42));
    for (const z of [-0.6, 0.6]) { const w = gfx.cyl(0.33, 0.33, 0.1, P.dark, 0, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
