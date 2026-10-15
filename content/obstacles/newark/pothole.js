// A pothole with a cone in it, 0.7 m to the cone's tip: jump it. The city will get to it.
export default {
  kind: 'obstacle', id: 'newark/pothole', avoid: 'jump', box: { w: 1.8, h: 0.7, d: 1.4 },
  createView(gfx) {
    const P = gfx.palette;
    const hole = gfx.cyl(0.95, 0.95, 0.03, '#15161c', 0, 0.015); hole.scale.z = 0.75;
    const water = gfx.cyl(0.75, 0.75, 0.03, '#2b3a4a', 0, 0.03); water.scale.z = 0.7;
    const cone = gfx.group(gfx.cone(0.22, 0.65, P.hazard, 0, 0.33), gfx.cyl(0.14, 0.17, 0.08, P.lane, 0, 0.42), gfx.box(0.45, 0.05, 0.45, P.hazard, 0, 0.025));
    cone.position.set(0.25, 0, 0.1); cone.rotation.z = 0.35;
    return { object: gfx.group(hole, water, cone) };
  },
};
