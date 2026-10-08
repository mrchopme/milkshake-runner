export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  // A scaffold frame (board 14): tall grey uprights, a top rail, crossed braces, and the plank at head height in caution yellow and black. Daylight under it.
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(0.15, 2.2, 0.15, P.metal, -1.15, 1.1), gfx.box(0.15, 2.2, 0.15, P.metal, 1.15, 1.1), gfx.box(2.4, 0.08, 0.15, P.metal, 0, 2.16), gfx.box(2.4, 0.4, 0.6, P.taxi, 0, 1.4));
    for (const s of [-1, 1]) { const b = gfx.box(2.36, 0.06, 0.06, P.metal, 0, 1.86); b.rotation.z = s * 0.22; g.add(b); }
    for (const x of [-0.9, -0.3, 0.3, 0.9]) { const s = gfx.box(0.14, 0.34, 0.02, P.dark, x, 1.4, -0.31); s.rotation.z = 0.5; g.add(s); }
    return { object: g };
  },
};
