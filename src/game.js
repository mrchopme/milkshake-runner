import { createRun, act, step, speedAt, playerBox, obstacleBox, overlaps, hit, inReach, collect, resolveRules } from './rules.js';
import { createWorld } from './world.js';
import { bindInput } from './input.js';

// Runs one level to its end. A content hook that throws ends the run with outcome 'error' instead of freezing.
export function playLevel({ engine, level, registry, hud, character, carryJugs = 0, carrySpeed }) {
  return new Promise((resolve) => {
    const rules = resolveRules(level.rules ?? {});
    const charDef = registry.character[level.character?.id ?? 'milkshake'];
    const run = createRun(rules, charDef, carryJugs, carrySpeed);
    const streetAfter = level.ending ? (registry.ending[level.ending.id].streetAfter ?? 200) : 200;
    const world = createWorld(engine.scene, level, {
      registry, rules, seed: level.seed ?? ((Math.random() * 2 ** 32) >>> 0),
      end: level.length_m === null ? Infinity : level.length_m + streetAfter, speedFrom: run.speedFrom,
    });
    if (import.meta.env.DEV) window.__milkshake = { run, world, level, engine }; // dev-only hook for the manual pass; stripped from builds
    let paused = false, last = performance.now(), raf = 0, skyKey = '';

    const setPaused = (p) => { paused = p; hud.setPaused(p); last = performance.now(); };
    hud.onPause(() => setPaused(!paused));
    const unbind = bindInput(engine.renderer.domElement, (a) => { if (a === 'pause') setPaused(!paused); else if (!paused) act(run, a); });
    const onHide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onHide);
    hud.show(true);

    function tick(rawDt) {
      const dt = step(run, rawDt, speedAt(level, run.z, rules, run.speedFrom));
      world.update(run, dt);
      const me = playerBox(run);
      for (const o of world.live.obstacles) {
        const box = obstacleBox(o, o.def, run.time, rules);
        if (box && overlaps(me, box) && hit(run) === 'shield') hud.flash();
      }
      for (const p of [...world.live.pickups]) if (inReach(run, p)) { collect(run, p.def); if (p.def.effect) hud.toast(p.def); world.removePickup(p); }
      const sky = world.skyAt(run.z), key = `${sky.sky}/${sky.fog}`;
      if (key !== skyKey) { skyKey = key; engine.setSky(sky); }
      character.update(run);
      engine.follow(run, world.cameraAt(run.z), dt);
      hud.update(run, level, registry);
      if (run.over) end('dead');
      else if (level.length_m !== null && run.z >= level.length_m) end('complete');
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) {
        try { tick(dt); } catch (error) { console.error(error); end('error', error); return; }
      }
      engine.render();
    }

    function end(outcome, error) {
      cancelAnimationFrame(raf);
      unbind();
      document.removeEventListener('visibilitychange', onHide);
      hud.onPause(() => {});
      engine.follow({ ...run, speed: 0 }, {}, Infinity); // defaults and no streaks before an ending runs
      hud.show(false);
      hud.setPaused(false);
      resolve({ outcome, run, world, error }); // the caller disposes the world after any ending scene
    }

    raf = requestAnimationFrame(frame);
  });
}
