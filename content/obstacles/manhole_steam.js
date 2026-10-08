export default {
  kind: 'obstacle', id: 'manhole_steam', avoid: 'timing', box: { w: 2.0, h: 2.5, d: 1.0 }, cycle: { period: 1.5, on: 0.5 },
  createView(gfx) {
    const plume = gfx.cyl(0.8, 0.5, 2.5, '#ffffff', 0, 1.25);
    return { object: gfx.group(gfx.cyl(1, 1, 0.05, gfx.palette.dark, 0, 0.03), plume), update(o, run, dt, active) { plume.visible = active; } };
  },
};
