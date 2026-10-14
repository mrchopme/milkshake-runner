export default {
  kind: 'prop', id: 'demo/arch', length: 2,
  createView(gfx, { lanes }) {
    const x = lanes.roadHalf + 0.5;
    return { object: gfx.group(gfx.box(0.6, 6, 0.6, '#3f8a4c', -x, 3, 1), gfx.box(0.6, 6, 0.6, '#3f8a4c', x, 3, 1), gfx.box(x * 2 + 0.6, 0.8, 0.6, '#2f6b3a', 0, 6.4, 1)) };
  },
};
