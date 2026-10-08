const ease = (t) => t * t * (3 - 2 * t);
const CAM_OFFSET = [-3, 3.5, 11]; // side shot of the turn; calibration knob, tune in the manual pass

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t, now / 1000); engine.render(); if (t < 1) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
}

export default {
  kind: 'ending', id: 'transition',
  params: { next: { type: 'level' } },
  async run({ engine, character, hud, params, gfx }) {
    const V = gfx.three.Vector3;
    const start = character.object.position.clone();
    const camFrom = engine.camera.position.clone();
    const camTo = start.clone().add(new V(...CAM_OFFSET));
    await animate(engine, 1500, (t, time) => {
      const e = ease(t);
      character.object.rotation.y = (e * Math.PI) / 2; // turn to face +x: a left turn up Broadway
      character.object.position.set(start.x + e * e * 8, start.y, start.z + e * 6);
      character.pose(time);
      engine.camera.position.lerpVectors(camFrom, camTo, e);
      engine.camera.lookAt(character.object.position.x, 1.2, character.object.position.z);
    });
    await hud.ring();
    character.object.rotation.y = 0;
    return { next: params.next, carry: true };
  },
};
