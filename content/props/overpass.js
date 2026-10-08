export default {
  kind: 'prop', id: 'overpass', length: 8,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, w = lanes.roadHalf * 2 + 6, clear = 5; // deck clears the street by 5 m; pillars stand on the sidewalks
    const g = gfx.group(gfx.box(w, 1.2, length, P.sidewalk, 0, clear + 0.6, length / 2),
      gfx.box(w, 0.9, 0.15, P.lane, 0, clear + 1.65, 0.1), gfx.box(w, 0.9, 0.15, P.lane, 0, clear + 1.65, length - 0.1));
    for (const x of [-(lanes.roadHalf + 1), lanes.roadHalf + 1]) for (const z of [0.6, length - 0.6]) g.add(gfx.box(0.6, clear, 0.6, P.metal, x, clear / 2, z));
    return { object: g };
  },
};
