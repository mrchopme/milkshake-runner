export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.box(0.15, 0.9, 0.4, P.lane, -0.9), gfx.box(0.15, 0.9, 0.4, P.lane, 0.9), gfx.box(2.2, 0.3, 0.15, P.hazard, 0, 0.7)) };
  },
};
