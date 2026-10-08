export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.box(0.15, 1.6, 0.15, P.metal, -1.15, 0.8), gfx.box(0.15, 1.6, 0.15, P.metal, 1.15, 0.8), gfx.box(2.4, 0.4, 0.6, P.hazard, 0, 1.4)) };
  },
};
