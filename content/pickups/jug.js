export default {
  kind: 'pickup', id: 'jug', color: '#ffffff', value: 1,
  glyph: 'M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z',
  createView(gfx) { return { object: gfx.group(gfx.cyl(0.25, 0.28, 0.5, gfx.palette.jug, 0, 0.8), gfx.cyl(0.12, 0.12, 0.15, gfx.palette.lavender, 0, 1.12)) }; },
};
