export default {
  kind: 'prop', id: 'tunnel', length: 60,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, x = lanes.roadHalf + 1, h = 6;
    const g = gfx.group(gfx.box(x * 2 + 1, 1, length, P.dark, 0, h - 0.5, length / 2),
      gfx.box(0.5, h, length, P.dark, -x, h / 2, length / 2), gfx.box(0.5, h, length, P.dark, x, h / 2, length / 2));
    for (const z of [0, length]) g.add(gfx.box(x * 2 + 2, 0.8, 0.6, P.metal, 0, h + 0.1, z), // the lit mouth and exit frames
      gfx.box(0.8, h + 0.5, 0.6, P.metal, -x - 0.6, (h + 0.5) / 2, z), gfx.box(0.8, h + 0.5, 0.6, P.metal, x + 0.6, (h + 0.5) / 2, z));
    return { object: g };
  },
};
