// A rabid stray: 0.9 m of mange, red eyes and foam. Jump it; it lunges a lane toward Milkshake as she closes in (moves, like the
// delivery bike). buildDog and animateDog are shared with the mob prop, whose dogs are the same animal running.
const FUR = ['#6b5a4a', '#7d7a72', '#4a3f38'];

// Built nose to +z, the way the mob runs; the obstacle turns it round to face Milkshake.
export function buildDog(gfx, fur = 0) {
  const P = gfx.palette, c = FUR[fur % FUR.length];
  const g = gfx.group(gfx.blobShadow(0.45));
  const body = gfx.capsule(0.21, 0.55, c, 0, 0.55, 0); body.rotation.x = Math.PI / 2;
  const head = gfx.group(gfx.sphere(0.19, c, 0, 0, 0), gfx.box(0.17, 0.13, 0.26, c, 0, -0.04, 0.22), gfx.sphere(0.05, P.eye, 0, -0.01, 0.36));
  head.position.set(0, 0.72, 0.42);
  for (const s of [-1, 1]) head.add(gfx.sphere(0.035, '#ff2a2a', s * 0.09, 0.07, 0.15, { emissive: '#ff2a2a', emissiveIntensity: 0.8 }), gfx.cone(0.06, 0.16, c, s * 0.12, 0.2, -0.04));
  const jaw = gfx.group(gfx.box(0.15, 0.05, 0.22, c, 0, -0.03, 0.11), gfx.box(0.03, 0.05, 0.03, P.lane, -0.05, 0, 0.2), gfx.box(0.03, 0.05, 0.03, P.lane, 0.05, 0, 0.2));
  jaw.position.set(0, -0.1, 0.1); head.add(jaw);
  const foam = gfx.sphere(0.06, P.lane, 0, -0.06, 0.26); jaw.add(foam);
  const legs = [[-0.13, 0.26], [0.13, 0.26], [-0.13, -0.22], [0.13, -0.22]].map(([x, z]) => {
    const p = gfx.group(gfx.capsule(0.05, 0.22, c, 0, -0.16), gfx.sphere(0.06, P.eye, 0, -0.32)); p.position.set(x, 0.42, z); g.add(p); return p;
  });
  const tail = gfx.capsule(0.03, 0.28, c, 0, 0.62, -0.42); tail.rotation.x = -0.9;
  g.add(body, head, tail);
  return { object: g, body, head, jaw, foam, legs, kind: 'dog' };
}

// gait 1 gallops, 0 stands and snarls; seed staggers a pack so it does not move as one.
export function animateDog(d, time, gait = 1, seed = 0) {
  const t = time * 15 + seed, snap = (Math.sin(time * 9 + seed) + 1) / 2;
  d.legs.forEach((l, i) => (l.rotation.x = Math.sin(t + (i < 2 ? 0 : Math.PI)) * 0.75 * gait + Math.sin(t * 0.3 + i) * 0.06 * (1 - gait)));
  d.body.position.y = 0.55 + Math.abs(Math.sin(t)) * 0.06 * gait;
  d.head.rotation.x = -0.15 + Math.sin(t * 0.5) * 0.08 * gait;
  d.jaw.rotation.x = snap * 0.55;
  d.foam.visible = snap > 0.45;
}

export default {
  kind: 'obstacle', id: 'newark/stray_dog', avoid: 'jump', box: { w: 1.0, h: 0.9, d: 1.6 }, moves: true,
  createView(gfx) {
    const d = buildDog(gfx);
    d.object.rotation.y = Math.PI; // faces Milkshake
    return { object: d.object, update(o, run) { animateDog(d, run.time, 0, o.z); } };
  },
};
