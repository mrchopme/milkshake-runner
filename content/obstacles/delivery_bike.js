export default {
  kind: 'obstacle', id: 'delivery_bike', avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true,
  createView(gfx) { return { object: gfx.group(gfx.box(0.3, 0.7, 1.8, gfx.palette.dark, 0, 0.35), gfx.capsule(0.28, 0.5, gfx.palette.rider, 0, 1.05)) }; },
};
