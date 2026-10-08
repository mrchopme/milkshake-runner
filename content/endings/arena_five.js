const ease = (t) => t * t * (3 - 2 * t);
const NUMBERS = [7, 12, 23, 31, 44];                                   // made-up stand-ins, no real players
const SKIN = ['#8d5a3b', '#c68e62', '#5a3a24', '#e0b08a', '#a8714a'];

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t, now / 1000); engine.render(); if (t < 1) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
}

function player(gfx, x, z, i) {
  const P = gfx.palette, jersey = i % 2 ? P.jerseyB : P.jerseyA, skin = SKIN[i];
  const g = gfx.group(gfx.blobShadow(0.45));
  for (const dx of [-0.14, 0.14]) g.add(gfx.box(0.22, 0.7, 0.22, skin, dx, 0.35), gfx.box(0.28, 0.08, 0.3, P.dark, dx, 0.04));
  g.add(gfx.box(0.8, 0.35, 0.4, P.lane, 0, 0.87), gfx.roundedBox(0.8, 0.85, 0.4, 0.12, jersey, 0, 1.47));
  for (const dx of [-0.52, 0.52]) g.add(gfx.capsule(0.09, 0.5, skin, dx, 1.35));
  g.add(gfx.sphere(0.28, skin, 0, 2.15));
  const number = gfx.sprite(gfx.textTexture(String(NUMBERS[i]), { w: 256, h: 256, font: '900 170px "Lilita One", system-ui, sans-serif' }), 0.55, 0.55);
  number.position.set(0, 1.5, -0.3);
  g.add(number);
  g.position.set(x, 0, z);
  return g;
}

function confetti(gfx, center) {
  const T = gfx.three, n = 300, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const colors = [gfx.palette.jerseyA, gfx.palette.jerseyB, gfx.palette.lavender, '#ffffff', gfx.palette.x2].map((c) => new T.Color(c));
  for (let i = 0; i < n; i++) {
    pos.set([center.x + (Math.random() - 0.5) * 14, center.y + Math.random() * 10, center.z + (Math.random() - 0.5) * 10], i * 3);
    colors[i % colors.length].toArray(col, i * 3);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.18, vertexColors: true }));
  pts.fall = (dt) => { for (let i = 1; i < pos.length; i += 3) pos[i] = pos[i] < 0 ? center.y + 10 : pos[i] - dt * 3; geo.attributes.position.needsUpdate = true; };
  return pts;
}

export default {
  kind: 'ending', id: 'arena_five', streetAfter: 0,
  params: { text: { type: 'string', max: 60, default: 'Season tip-off. Brought to you by Milkshake.' } },
  async run({ engine, character, hud, params, gfx, level }) {
    const P = gfx.palette, T = gfx.three;
    const z0 = level.length_m;                 // the street ends here; the plaza starts here
    const c = new T.Vector3(0, 0, z0 + 16.5);  // plaza centre, where the five wait
    const g = gfx.group(
      gfx.box(40, 0.2, 50, P.plaza, 0, 0.1, z0 + 25),
      gfx.cyl(18, 18, 12, P.arena, 0, 6, c.z + 28.5, { side: T.DoubleSide }),
      gfx.cyl(18.05, 18.05, 0.3, P.lavender, 0, 8.3, c.z + 28.5), gfx.cyl(18.05, 18.05, 0.3, P.lavender, 0, 5.7, c.z + 28.5),
    );
    const ring = new T.Mesh(new T.RingGeometry(3.4, 3.55, 48), new T.MeshBasicMaterial({ color: P.jerseyA }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.21, c.z + 1.5); g.add(ring);
    const sign = gfx.sprite(gfx.textTexture('THE GARDEN', { w: 1024, h: 224 }), 10, 2.2);
    sign.position.set(0, 7, c.z + 10.3); g.add(sign);
    NUMBERS.forEach((_, i) => g.add(player(gfx, (i - 2) * 1.45, c.z + 1.5 - Math.abs(i - 2) * 0.25, i)));
    engine.scene.add(g);

    const start = character.object.position.clone();
    character.object.rotation.set(0, 0, 0);
    await animate(engine, 1800, (t, time) => {
      character.object.position.set(start.x * (1 - t), 0, start.z + ease(t) * (c.z - 1.5 - start.z));
      character.pose(time);
      engine.camera.position.set(0, 4.4, character.object.position.z - 7);
      engine.camera.lookAt(0, 1.5, c.z + 1.5);
    });
    const pts = confetti(gfx, new T.Vector3(0, 1.5, c.z));
    g.add(pts);
    const card = hud.card(params.text.split('. ')[0].toUpperCase(), 4000, params.text.split('. ').slice(1).join('. '));
    await animate(engine, 4000, (t) => {
      const a = -Math.PI / 2 + t * Math.PI * 2; // start behind Milkshake, circle once
      engine.camera.position.set(Math.cos(a) * 8.5, 4.4, c.z + Math.sin(a) * 8.5);
      engine.camera.lookAt(0, 1.5, c.z);
      pts.fall(1 / 60);
    });
    await card;
    engine.scene.remove(g);
    gfx.dispose(g);
    return {};
  },
};
