// A hydrant someone opened: it blasts a column of water across the lane for 0.7 s of every 2. Time it, like the manhole steam.
export default {
  kind: 'obstacle', id: 'newark/busted_hydrant', avoid: 'timing', box: { w: 2.0, h: 2.5, d: 1.0 }, cycle: { period: 2.0, on: 0.7 },
  createView(gfx) {
    const P = gfx.palette, WATER = '#8ccfe0';
    const drops = [0, 1, 2, 3, 4].map((i) => gfx.sphere(0.12 + (i % 2) * 0.06, WATER, 0, 0, 0));
    const jet = gfx.group(gfx.cyl(0.18, 0.32, 2.2, WATER, 0, 1.5, 0, { transparent: true, opacity: 0.85 }), ...drops);
    const g = gfx.group(gfx.cyl(0.2, 0.22, 0.75, P.rider, 0, 0.375), gfx.cyl(0.24, 0.24, 0.12, P.rider, 0, 0.78), gfx.box(0.6, 0.12, 0.14, P.rider, 0, 0.45), jet);
    return {
      object: g,
      update(o, run, dt, active) {
        jet.visible = active;
        if (active) drops.forEach((d, i) => { const t = (run.time * 3 + i * 0.37) % 1; d.position.set(Math.sin(i * 2.1) * (0.3 + t * 0.6), 2.2 - t * 1.6, Math.cos(i * 2.1) * (0.3 + t * 0.6)); });
      },
    };
  },
};
