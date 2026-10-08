export default {
  kind: 'prop', id: 'billboard', length: 4,
  createView(gfx, { z, lanes }) {
    const P = gfx.palette, side = Math.floor(z / 40) % 2 ? -1 : 1, x = side * (lanes.roadHalf + 2.5); // alternates sides along the street
    const g = gfx.group(gfx.box(5, 4, 0.3, P.lavender, x, 5, 2), gfx.box(5.3, 4.3, 0.2, P.dark, x, 5, 2.2));
    for (const dz of [0.8, 3.2]) g.add(gfx.box(0.25, 3, 0.25, P.metal, x, 1.5, dz));
    const face = gfx.sprite(gfx.glyphTexture('M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z'), 2.6, 2.6);
    face.position.set(x, 5, 1.8);
    g.add(face);
    return { object: g };
  },
};
