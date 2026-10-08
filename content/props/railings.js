export default {
  kind: 'prop', id: 'railings', length: 40,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, g = gfx.group();
    for (const x of [-(lanes.roadHalf + 0.5), lanes.roadHalf + 0.5]) {
      g.add(gfx.box(0.1, 0.1, length, P.lane, x, 1.05, length / 2), gfx.box(0.08, 0.08, length, P.lane, x, 0.55, length / 2));
      for (let z = 0.5; z < length; z += 4) g.add(gfx.box(0.12, 1.1, 0.12, P.metal, x, 0.55, z));
    }
    return { object: g };
  },
};
