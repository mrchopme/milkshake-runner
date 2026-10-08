export default {
  kind: 'theme', id: 'demo/forest', sky: '#bfe3c6', fog: 0.5,
  buildings: { colors: ['#2f6b3a', '#3f8a4c', '#275a30'], minH: 6, maxH: 14 },
  // A theme may replace the whole street: here a dirt road through toon pines instead of buildings.
  createChunk(gfx, { z0, length, lanes, rng }) {
    const g = gfx.group(gfx.box(lanes.roadHalf * 2, 0.1, length, '#6b5a3e', 0, -0.05, z0 + length / 2));
    for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) g.add(gfx.box(0.12, 0.02, 3, '#d8c9a3', x, 0.01, z + 1.5));
    const greens = this.buildings.colors;
    for (const side of [-1, 1]) for (let z = z0; z < z0 + length; z += 4 + rng() * 4) {
      const x = side * (lanes.roadHalf + 2 + rng() * 6), h = 3 + rng() * 5;
      g.add(gfx.cyl(0.2, 0.3, h * 0.4, '#5a3d22', x, h * 0.2, z), gfx.cone(1 + rng(), h * 0.7, greens[Math.floor(rng() * greens.length)], x, h * 0.75, z));
    }
    return g;
  },
};
