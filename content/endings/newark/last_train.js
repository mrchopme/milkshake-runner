import { plaque } from '../../themes/newark/brick_city.js';
import mob from '../../props/newark/mob.js';

// Newark Penn Station: the street ends at the plaza, Milkshake runs up the steps into the middle arch with the mob on her heels,
// the mob stops at the steps (the sign says why), she turns round in the doorway, and the departures board flips to the only
// word it knows.
const ease = (t) => t * t * (3 - 2 * t);
const STOP_SHORT = 2.5; // metres before the first step where the mob gives up

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = t0;
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t, now / 1000, (now - last) / 1000); last = now; engine.render(); if (t < 1) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
}

export default {
  kind: 'ending', id: 'newark/last_train', streetAfter: 0,
  params: { text: { type: 'string', max: 120, default: 'NEWARK PENN STATION. Next train to New York: delayed 47 min. You are safe. Probably.' } },
  async run({ engine, character, hud, params, gfx, level, run, rules }) {
    const P = gfx.palette, T = gfx.three, z0 = level.length_m, STONE = '#cbbfa6', TRIM = '#b3a68c', STEP = z0 + 7.5;
    const g = gfx.group(gfx.box(50, 0.2, 60, '#8d867d', 0, 0.1, z0 + 30), gfx.box(34, 14, 10, STONE, 0, 7.9, z0 + 14), gfx.box(35, 0.8, 11, TRIM, 0, 15.2, z0 + 14));
    for (let i = 0; i < 3; i++) g.add(gfx.box(22 - i * 1.2, 0.3, 2.6 - i * 0.6, TRIM, 0, 0.35 + i * 0.3, STEP + i * 0.3)); // the steps, up to the doors at 0.9 m
    for (const x of [-6, 0, 6]) { // three arches, the middle one Milkshake runs into
      const arch = gfx.cyl(1.8, 1.8, 0.4, '#15161c', x, 5.6, z0 + 8.85); arch.rotation.x = Math.PI / 2;
      g.add(gfx.box(3.6, 4.7, 0.4, '#15161c', x, 3.25, z0 + 8.85), arch);
      for (const dx of [-2.2, 2.2]) g.add(gfx.box(0.8, 12, 0.5, TRIM, x + dx, 6.9, z0 + 8.8));
    }
    for (const x of [-9, -6, -3, 0, 3, 6, 9]) g.add(gfx.box(1.6, 2.6, 0.3, '#5a6c7a', x, 9.6, z0 + 8.9)); // the tall windows
    const clock = gfx.cyl(1.1, 1.1, 0.2, P.lane, 0, 13.6, z0 + 8.85); clock.rotation.x = Math.PI / 2;
    const hour = gfx.box(0.12, 0.7, 0.06, P.eye, 0, 13.9, z0 + 8.7), minute = gfx.box(0.1, 0.95, 0.06, P.eye, 0.3, 13.7, z0 + 8.7); minute.rotation.z = -1.2;
    g.add(clock, hour, minute, gfx.box(7, 1.4, 0.3, P.eye, 0, 7.3, z0 + 8.6)); // and the departures board over the middle arch
    const label = (text, w, h, y, z, opts) => { const m = plaque(gfx, text, w, h, opts); if (m) { m.position.set(0, y, z); g.add(m); } return m; };
    label('NEWARK PENN STATION', 16, 2.0, 12.0, z0 + 8.3, { color: P.lane, outline: '#1d1b26', w: 2048, h: 256, size: 170 });
    label('NO DOGS · NO CARTS · NO EXCUSES', 5.2, 0.65, 6.3, z0 + 8.3, { color: P.lane, w: 1024, h: 128, size: 84 });
    const onTime = label('NEW YORK  ·  ON TIME', 6.4, 0.8, 7.3, z0 + 8.4, { color: '#ffb000', w: 1024, h: 128, size: 96 });
    const delayed = label('NEW YORK  ·  DELAYED 47 MIN', 6.4, 0.8, 7.3, z0 + 8.4, { color: '#ff3b3b', w: 1024, h: 128, size: 96 });
    if (delayed) delayed.visible = false;
    engine.scene.add(g);

    // The mob at her heels, as the street left it: a pack from the prop module, run from the line it would have crossed 20 m back.
    const lanes = { count: 3, width: rules.laneWidth, roadHalf: 4.5 }, pz = z0 - 20;
    const pack = mob.createView(gfx, { z: pz, length: 40, lanes }), packProp = { z: pz, length: 40 };
    const chaser = { x: run.x, z: run.z, time: run.time, speed: run.speed };
    pack.object.position.set(0, 0, pz);
    for (let i = 0; i < 6; i++) pack.update(packProp, chaser, 1); // settled behind her before the first frame
    engine.scene.add(gfx.bend(pack.object));

    const start = character.object.position.clone(), door = new T.Vector3(0, 0.9, z0 + 8.6);
    character.object.rotation.set(0, 0, 0);
    await animate(engine, 1800, (t, time, dt) => {
      const e = ease(t), z = start.z + e * (door.z - start.z);
      character.object.position.set(start.x * (1 - e), z > STEP ? Math.min(0.9, (z - STEP) * 0.6) : 0, z);
      character.pose(time, { speed: 18 });
      Object.assign(chaser, { x: start.x * (1 - e), z: Math.min(z, STEP - STOP_SHORT), time: chaser.time + dt, speed: 18 });
      pack.update(packProp, chaser, dt, chaser.z >= STEP - STOP_SHORT);
      engine.camera.position.set(3.5 - e * 2, 4.5, z - 10);
      engine.camera.lookAt(0, 5, z0 + 9);
    });
    character.object.rotation.y = Math.PI; // in the doorway, looking back at the street
    const [title, ...rest] = params.text.split('. ');
    const card = hud.card(title.toUpperCase(), 4200, rest.join('. '));
    const camFrom = engine.camera.position.clone(), camTo = new T.Vector3(-4, 4.2, z0 - 13);
    await animate(engine, 4200, (t, time, dt) => {
      engine.camera.position.lerpVectors(camFrom, camTo, ease(Math.min(1, t * 1.5)));
      engine.camera.lookAt(0, 4.5, z0 + 9);
      character.pose(time, { speed: 0 });
      chaser.time += dt;
      pack.update(packProp, chaser, dt, true);
      if (t > 0.4 && onTime && delayed) { onTime.visible = false; delayed.visible = true; }
    });
    await card;
    character.object.rotation.y = 0;
    engine.scene.remove(g, pack.object);
    gfx.dispose(g); gfx.dispose(pack.object);
    return {};
  },
};
