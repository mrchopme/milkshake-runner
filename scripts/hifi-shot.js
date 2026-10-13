// Dev-only stills and frame-cost probe for the HiFi test. Paste this whole file into the page with the browser pane's
// javascript tool, on the dev server with ?fixtures (plus &hifi or &lofi once the quality switch exists), then:
//   await hifiShot('baseline-lofi')  -> saves baseline-lofi.png through scripts/drop-server.mjs; returns its size and SHA-256
//                                       options: { level: 'hifi-shot' | 'hifi-shot-midtown' | '-uptown' | '-bridge', frame: '9:16' | '16:9', w, h }
//   await hifiProbe()                -> mean and p95 frame cost at 3024x1964, draw calls, triangles (options: frames, w, h, dpr, level)
//   await hifiLineup('lineup', { paths: ['hifi/taxi.glb'] }) -> the models in `paths` side by side, saved as a still
// Nothing imports this file; it never ships.
(() => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // The desktop app's browser pane freezes requestAnimationFrame while hidden; a timer keeps the game loop running.
  if (!window.__rafShim) { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout; window.__rafShim = true; }

  // ponytail: calibration knobs — the teaser's framings (Paper board 01), tuned by eye; metres and degrees
  // speed is pinned too: the character leans with it, and a run paused a few ms later is a little faster
  const SHOTS = {
    '9:16': { runZ: 62.5, runY: 1.8, speed: 12, camUp: 7.8, camBack: 14, lookAhead: 9, lookY: 0.8, fov: 52, w: 2160, h: 3840 },
    '16:9': { runZ: 62.5, runY: 1.8, speed: 12, camUp: 4.2, camBack: 9, lookAhead: 40, lookY: 6, fov: 50, w: 3840, h: 2160 }, // keyframe 9-0: the skyline at the end of the avenue
  };

  async function shotLevel(id = 'hifi-shot') {
    let m = window.__milkshake;
    if (m?.level.id === id && !m.run.over) return m;
    if (m && !m.run.over) { // a different level is alive: the game never starts one over another, so end it as the game does or both worlds stay in the scene and their facades z-fight
      if (!$('overlay').hidden) $('overlay').click(); // paused (hud overlay up): unpause so the loop ticks
      m.run.over = true;                              // the next tick ends the run ('dead'); main.js renders, holds ~900 ms, disposes the world, then shows #results
      for (let i = 0; i < 200 && $('results').hidden; i++) await wait(50); // results are hidden for the whole run (show(null)), so shown means the world is gone
      if ($('results').hidden) throw new Error('the running level did not end');
    }
    const title = `HiFi shot${id.slice('hifi-shot'.length).replace('-', ' ')} (dev)`; // 'hifi-shot-midtown' -> 'HiFi shot midtown (dev)'
    $('levels').click();
    const button = [...document.querySelectorAll('#level-list button')].find((b) => b.querySelector('span')?.textContent === title);
    if (!button) throw new Error(`no "${title}" level: open the page with ?fixtures`);
    button.click();
    for (let i = 0; i < 200; i++) {
      if (!$('help').hidden) $('help-ok').click(); // HOW TO PLAY shows once per browser before the first run
      m = window.__milkshake;
      if (m?.level.id === id && !m.run.over) {
        m.run.graceT = 1e9;  // a fresh run would die on its first row
        $('pause').click();  // freeze the run; engine.render() still draws
        return m;
      }
      await wait(50);
    }
    throw new Error('the HiFi shot level did not start');
  }

  function pose({ run, world, engine, character }, S) {
    Object.assign(run, { x: 0, lane: 1, z: S.runZ, y: S.runY, speed: S.speed, time: 0 });
    world.update(run, 0);             // streams the street to the spot; pickups spin with run.time, held at 0
    character.update(run);
    engine.follow(run, {}, Infinity); // snaps the sun to the spot
    const cam = engine.camera;
    cam.position.set(0, S.camUp, S.runZ - S.camBack);
    cam.lookAt(0, S.lookY, S.runZ + S.lookAhead);
    cam.fov = S.fov;
    cam.updateProjectionMatrix();
  }

  const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');

  window.hifiShot = async (name, { level, frame = '9:16', ...size } = {}) => {
    const S = SHOTS[frame], { w, h } = { w: S.w, h: S.h, ...size };
    const m = await shotLevel(level), r = m.engine.renderer, dpr = r.getPixelRatio();
    r.setPixelRatio(1);
    m.engine.resize(w, h); // resize resets the field of view, so pose after it
    pose(m, S);
    m.engine.render();
    const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png')); // the snapshot is taken at this call
    r.setPixelRatio(dpr);
    m.engine.resize();
    await fetch(`http://127.0.0.1:5174/?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
    return { name, w, h, bytes: blob.size, hash: await sha256(blob) };
  };

  // Every model of a wave, side by side on the road in front of the camera, for the main session's visual check.
  // paths must be loaded: await __milkshake.assets.preload(paths) first if no level lists them yet.
  window.hifiLineup = async (name, { paths, w = 3840, h = 2160, gap = 1.5 } = {}) => {
    const m = await shotLevel(), row = new m.gfx.three.Group();
    let x = 0;
    for (const p of paths) { const o = m.gfx.asset(p); o.position.set(x, 0, SHOTS['9:16'].runZ + 12); row.add(o); x += gap + 2.5; }
    row.position.x = -x / 2;
    m.engine.scene.add(row);
    const r = m.engine.renderer, dpr = r.getPixelRatio();
    r.setPixelRatio(1); m.engine.resize(w, h); pose(m, SHOTS['16:9']); m.engine.render();
    const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png'));
    m.engine.scene.remove(row); r.setPixelRatio(dpr); m.engine.resize();
    await fetch(`http://127.0.0.1:5174/?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
    return { name, bytes: blob.size };
  };

  // Frame cost without requestAnimationFrame (the pane throttles it): back-to-back renders, each waiting for the GPU.
  window.hifiProbe = async ({ frames = 300, w = 1512, h = 982, dpr = 2, level } = {}) => {
    const m = await shotLevel(level), r = m.engine.renderer, gl = r.getContext(), was = r.getPixelRatio();
    r.setPixelRatio(dpr);
    m.engine.resize(w, h);
    pose(m, SHOTS['9:16']);
    const t = [];
    for (let i = 0; i < frames; i++) { const a = performance.now(); m.engine.render(); gl.finish(); t.push(performance.now() - a); }
    r.info.autoReset = false; r.info.reset(); m.engine.render(); // one frame's totals across every pass
    const { calls, triangles } = r.info.render;
    r.info.autoReset = true;
    r.setPixelRatio(was);
    m.engine.resize();
    t.sort((a, b) => a - b);
    return { size: `${w * dpr}x${h * dpr}`, meanMs: +(t.reduce((s, x) => s + x, 0) / frames).toFixed(2), p95Ms: +t[Math.floor(frames * 0.95)].toFixed(2), calls, triangles };
  };
})();
