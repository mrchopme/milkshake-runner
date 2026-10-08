export default {
  kind: 'obstacle', id: 'hot_dog_cart', avoid: 'jump', box: { w: 1.8, h: 1.0, d: 1.6 },
  createView(gfx) { return { object: gfx.box(1.8, 1.0, 1.6, gfx.palette.lane) }; },
};
