export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  createView(gfx) { return { object: gfx.box(2.2, 0.9, 0.4, gfx.palette.hazard) }; },
};
