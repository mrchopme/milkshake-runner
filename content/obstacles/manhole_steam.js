export default {
  kind: 'obstacle', id: 'manhole_steam', avoid: 'timing', box: { w: 2.0, h: 2.5, d: 1.0 }, cycle: { period: 1.5, on: 0.5 },
  createView(gfx) {
    const P = gfx.palette;
    const plume = gfx.group(...[[0, 0.5, 0.4], [-0.25, 1.1, 0.5], [0.25, 1.65, 0.6], [-0.1, 2.3, 0.62], [0.35, 2.75, 0.42]].map(([x, y, r]) => gfx.sphere(r, '#ffffff', x, y)));
    const g = gfx.group(gfx.cyl(1.15, 1.15, 0.04, P.hazard, 0, 0.02), gfx.cyl(1, 1, 0.06, P.dark, 0, 0.04), plume);
    return { object: g, update(o, run, dt, active) { plume.visible = active; } };
  },
};
