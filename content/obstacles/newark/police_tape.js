import { plaque } from '../../themes/newark/brick_city.js';

// Crime-scene tape strung between two stands at 1.2 m: slide under it. Nothing happened. Nothing ever happened.
export default {
  kind: 'obstacle', id: 'newark/police_tape', avoid: 'slide', box: { w: 2.4, h: 0.35, d: 0.3, y: 1.2 },
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(2.5, 0.3, 0.03, '#ffde21', 0, 1.375));
    for (const x of [-1.2, 1.2]) g.add(gfx.box(0.1, 1.6, 0.1, P.metal, x, 0.8), gfx.box(0.5, 0.08, 0.5, P.dark, x, 0.04));
    const words = plaque(gfx, 'POLICE LINE · DO NOT CROSS · POLICE LINE', 2.5, 0.31, { color: '#1d1b26', w: 2048, h: 256, size: 150 });
    if (words) { words.position.set(0, 1.375, -0.02); g.add(words); }
    else for (const x of [-0.9, -0.3, 0.3, 0.9]) g.add(gfx.box(0.35, 0.14, 0.01, P.dark, x, 1.375, -0.02)); // no canvas: black blocks stand in for the lettering
    return { object: g };
  },
};
