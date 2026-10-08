export default {
  kind: 'obstacle', id: 'hot_dog_cart', avoid: 'jump', box: { w: 1.8, h: 1.0, d: 1.6 },
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(1.8, 0.85, 1.6, P.lane, 0, 0.425), gfx.box(1.8, 0.15, 1.6, P.hazard, 0, 0.925),
      gfx.box(1.82, 0.11, 1.62, P.rider, 0, 0.55), gfx.box(1.82, 0.11, 1.62, P.taxi, 0, 0.38));
    for (const x of [-0.95, 0.95]) { const w = gfx.cyl(0.22, 0.22, 0.1, P.dark, x, 0.22, 0.3); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
