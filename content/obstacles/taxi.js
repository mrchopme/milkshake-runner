export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 1.5, d: 4.0 },
  createView(gfx) { return { object: gfx.box(2.0, 1.5, 4.0, gfx.palette.taxi) }; },
};
