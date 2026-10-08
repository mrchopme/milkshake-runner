export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  createView(gfx) { return { object: gfx.box(2.4, 0.4, 0.6, gfx.palette.hazard, 0, 1.4) }; },
};
