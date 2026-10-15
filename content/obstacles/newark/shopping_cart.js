// A liberated shopping cart heaped past head height with bags, cans, a flat screen and a rolled rug: 2.3 m to the rug's tip,
// well above a jump's apex, so it never reads as jumpable. Change lane.
export default {
  kind: 'obstacle', id: 'newark/shopping_cart', avoid: 'lane', box: { w: 1.1, h: 2.1, d: 2.0 },
  createView(gfx) {
    const P = gfx.palette, BAG = '#1e1f26';
    const g = gfx.group(
      gfx.box(0.9, 0.75, 1.0, P.metal, 0, 0.9, 0, { transparent: true, opacity: 0.7 }), gfx.box(0.9, 0.06, 1.0, P.metal, 0, 0.53),
      gfx.box(1.0, 0.08, 0.08, P.rider, 0, 1.3, -0.55), gfx.box(0.06, 0.8, 0.06, P.metal, -0.45, 0.9, -0.5), gfx.box(0.06, 0.8, 0.06, P.metal, 0.45, 0.9, -0.5),
    );
    for (const [x, z] of [[-0.35, -0.4], [0.35, -0.4], [-0.35, 0.4], [0.35, 0.4]]) { const w = gfx.cyl(0.1, 0.1, 0.06, P.dark, x, 0.1, z); w.rotation.z = Math.PI / 2; g.add(w); }
    for (const [x, y, z, s] of [[-0.2, 1.45, 0.1, 0.42], [0.25, 1.5, -0.2, 0.38], [0, 1.85, 0.15, 0.4], [0.15, 1.3, 0.35, 0.3]]) { const b = gfx.sphere(s, BAG, x, y, z); b.scale.y = 0.75; g.add(b); }
    for (const [x, z] of [[-0.3, -0.3], [0.1, -0.35], [0.38, 0.3]]) { const c = gfx.cyl(0.06, 0.06, 0.18, '#c9ced6', x, 1.32, z); c.rotation.x = 0.4; g.add(c); }
    const rug = gfx.cyl(0.13, 0.13, 1.7, '#8a3b4a', 0.3, 1.45, 0); rug.rotation.z = -0.2; g.add(rug);
    const tv = gfx.box(0.06, 0.6, 0.95, P.dark, -0.5, 1.2, 0); tv.rotation.z = 0.15; g.add(tv);
    return { object: g };
  },
};
