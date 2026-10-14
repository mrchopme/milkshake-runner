import { plaque } from '../../themes/newark/brick_city.js';

// The green highway sign at the city line, cantilevered over the kerb screen-right so it clears the block faces at ±7.5 m and
// fits the frame from the start line, with the city's promise under it.
export default {
  kind: 'prop', id: 'newark/welcome_sign', length: 4,
  createView(gfx, { lanes }) {
    const P = gfx.palette, post = -(lanes.roadHalf + 1.8), x = post + 1.3;
    const g = gfx.group(gfx.box(4.8, 2.2, 0.15, '#1f6b3a', x, 4.7, 2), gfx.box(5.0, 2.4, 0.1, P.lane, x, 4.7, 2.12));
    for (const dz of [0.8, 3.2]) g.add(gfx.box(0.22, 3.6, 0.22, P.metal, post, 1.8, dz), gfx.box(1.5, 0.12, 0.12, P.metal, post + 0.7, 3.55, dz));
    const line = (text, w, h, y, size) => { const m = plaque(gfx, text, w, h, { w: 1024, h: 192, size }); if (m) { m.position.set(x, y, 1.9); g.add(m); } };
    line('WELCOME TO NEWARK', 4.5, 0.84, 5.15, 120);
    line('PLEASE KEEP MOVING', 3.4, 0.64, 4.25, 100);
    return { object: g };
  },
};
