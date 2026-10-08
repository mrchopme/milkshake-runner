export default {
  kind: 'obstacle', id: 'pigeons', avoid: 'slide', box: { w: 2.4, h: 0.6, d: 1.0, y: 1.1 },
  createView(gfx) { return { object: gfx.group(...[-0.9, -0.4, 0.1, 0.5, 0.95].map((x) => gfx.sphere(0.18, gfx.palette.pigeon, x, 1.3))) }; },
};
