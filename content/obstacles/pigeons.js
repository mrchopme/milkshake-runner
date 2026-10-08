export default {
  kind: 'obstacle', id: 'pigeons', avoid: 'slide', box: { w: 2.4, h: 0.6, d: 1.0, y: 1.1 },
  createView(gfx) {
    const P = gfx.palette;
    const wings = [];
    const g = gfx.group(gfx.blobShadow(1.1, 0.18));
    [-0.95, -0.45, 0.05, 0.5, 0.95].forEach((x, i) => {
      const y = i % 2 ? 1.48 : 1.25;
      const body = gfx.sphere(0.14, P.pigeon, x, y); body.scale.set(1.5, 1, 1);
      const beak = gfx.cone(0.04, 0.12, P.hazard, x + 0.26, y + 0.07); beak.rotation.z = -Math.PI / 2;
      const wing = gfx.box(0.5, 0.03, 0.18, P.pigeon, x, y + 0.05); wing.position.y = y + 0.05; wings.push(wing);
      g.add(body, gfx.sphere(0.08, P.pigeon, x + 0.17, y + 0.08), beak, wing);
    });
    return { object: g, update(o, run) { wings.forEach((w, i) => (w.rotation.z = Math.sin(run.time * 12 + i) * 0.6)); } };
  },
};
