// Dev-only stills and frame-cost probe for the HiFi test. Paste this whole file into the page with the browser pane's
// javascript tool, on the dev server with ?fixtures (plus &hifi or &lofi once the quality switch exists), then:
//   await hifiShot('baseline-lofi')  -> saves baseline-lofi.png through scripts/drop-server.mjs; returns its size and SHA-256
//   await hifiProbe()                -> mean and p95 frame cost at 3024x1964, draw calls, triangles
// Nothing imports this file; it never ships.
(() => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // The desktop app's browser pane freezes requestAnimationFrame while hidden; a timer keeps the game loop running.
  if (!window.__rafShim) { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout; window.__rafShim = true; }

  // ponytail: calibration knob — the teaser's 9:16 framing (Paper board 01), tuned by eye; metres and degrees
  const SHOT = { runZ: 61.2, runY: 1.5, camUp: 5.4, camBack: 10.5, lookAhead: 16, lookY: 0.8, fov: 52 };

  async function shotLevel() {
    let m = window.__milkshake;
    if (m?.level.id === 'hifi-shot' && !m.run.over) return m;
    $('levels').click();
    const button = [...document.querySelectorAll('#level-list button')].find((b) => b.textContent.includes('HiFi shot'));
    if (!button) throw new Error('no "HiFi shot" level: open the page with ?fixtures');
    button.click();
    for (let i = 0; i < 200; i++) {
      if (!$('help').hidden) $('help-ok').click(); // HOW TO PLAY shows once per browser before the first run
      m = window.__milkshake;
      if (m?.level.id === 'hifi-shot' && !m.run.over) {
        m.run.graceT = 1e9;  // a fresh run would die on its first row
        $('pause').click();  // freeze the run; engine.render() still draws
        return m;
      }
      await wait(50);
    }
    throw new Error('the HiFi shot level did not start');
  }

  function pose({ run, world, engine, character }) {
    Object.assign(run, { x: 0, lane: 1, z: SHOT.runZ, y: SHOT.runY, time: 0 });
    world.update(run, 0);             // streams the street to the spot; pickups spin with run.time, held at 0
    character.update(run);
    engine.follow(run, {}, Infinity); // snaps the sun, and in HiFi its shadow box, to the spot
    const cam = engine.camera;
    cam.position.set(0, SHOT.camUp, SHOT.runZ - SHOT.camBack);
    cam.lookAt(0, SHOT.lookY, SHOT.runZ + SHOT.lookAhead);
    cam.fov = SHOT.fov;
    cam.updateProjectionMatrix();
  }

  const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');

  window.hifiShot = async (name, { w = 2160, h = 3840 } = {}) => {
    const m = await shotLevel(), r = m.engine.renderer, dpr = r.getPixelRatio();
    r.setPixelRatio(1);
    m.engine.resize(w, h); // resize resets the field of view, so pose after it
    pose(m);
    m.engine.render();
    const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png')); // the snapshot is taken at this call
    r.setPixelRatio(dpr);
    m.engine.resize();
    await fetch(`http://127.0.0.1:5174/?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
    return { name, w, h, bytes: blob.size, hash: await sha256(blob) };
  };

  // Frame cost without requestAnimationFrame (the pane throttles it): back-to-back renders, each waiting for the GPU.
  window.hifiProbe = async ({ frames = 300, w = 1512, h = 982, dpr = 2 } = {}) => {
    const m = await shotLevel(), r = m.engine.renderer, gl = r.getContext(), was = r.getPixelRatio();
    r.setPixelRatio(dpr);
    m.engine.resize(w, h);
    pose(m);
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
