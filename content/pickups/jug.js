export default {
  kind: 'pickup', id: 'jug', color: '#ffffff', value: 1,
  glyph: 'M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z',
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.blobShadow(0.3), gfx.glow(0.45, P.lavender, 0.85),
      gfx.cyl(0.25, 0.28, 0.45, P.jug, 0, 0.775), gfx.cyl(0.12, 0.25, 0.15, P.jug, 0, 1.075), gfx.cyl(0.12, 0.12, 0.14, P.lavender, 0, 1.22)) };
  },
};
