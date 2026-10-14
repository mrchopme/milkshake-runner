// An elevated stretch: the road deck over water and a low city, no sidewalks or blocks. A section picks it with theme: { id: "bridge" }
// and pairs it with hill +1 and the railings prop (board 09).
export default {
  kind: 'theme', id: 'bridge', sky: '#9fd3f5', fog: 0.3,
  buildings: { colors: ['#a6c1d8', '#81a2bd', '#8eadc6'], minH: 2, maxH: 8 },
  createChunk(gfx, { z0, length, lanes, rng }) {
    const P = gfx.palette, b = this.buildings;
    const g = gfx.group(gfx.box(lanes.roadHalf * 2 + 1, 1, length, P.road, 0, -0.5, z0 + length / 2), gfx.box(400, 0.1, length, P.glass, 0, -6, z0 + length / 2));
    for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) g.add(gfx.box(0.12, 0.02, 3, P.lane, x, 0.01, z + 1.5));
    for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
      const depth = Math.min(6 + rng() * 8, z0 + length - z), h = b.minH + rng() * (b.maxH - b.minH);
      if (depth < 3) break;
      g.add(gfx.box(8, h, depth - 1, b.colors[Math.floor(rng() * b.colors.length)], side * (lanes.roadHalf + 26 + rng() * 20), -6 + h / 2, z + depth / 2));
      z += depth;
    }
    return g;
  },
};
