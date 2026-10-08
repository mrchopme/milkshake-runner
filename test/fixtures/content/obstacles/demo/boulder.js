export default {
  kind: 'obstacle', id: 'demo/boulder', avoid: 'lane', box: { w: 1.8, h: 1.6, d: 1.8 },
  createView(gfx) { return { object: gfx.group(gfx.blobShadow(0.9, 0.15), gfx.sphere(0.9, '#7d7a72', 0, 0.8)) }; },
};
