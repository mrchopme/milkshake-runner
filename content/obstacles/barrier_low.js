export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  // A jersey barrier (board 14): solid to the ground, stepped, orange, with two white stripes leaning across the face Milkshake sees (-z).
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(2.2, 0.5, 0.4, P.hazard, 0, 0.25), gfx.box(1.7, 0.4, 0.4, P.hazard, 0, 0.7));
    for (const x of [-0.35, 0.35]) { const s = gfx.box(0.16, 0.8, 0.02, P.lane, x, 0.45, -0.21); s.rotation.z = 0.5; g.add(s); }
    return { object: g };
  },
};
