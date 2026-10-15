// A rabid stray: 0.9 m of mange, red eyes and foam. Jump it; it lunges a lane toward Milkshake as she closes in (moves, like the
// delivery bike). buildDog and animateDog are shared with the mob prop, whose dogs are the same animal running.
const FUR = ['#6b5a4a', '#7d7a72', '#4a3f38'];

// Sound, synthesised with the Web Audio API so the pack ships no files: a bark is a sawtooth sweep and a noise burst through a
// bandpass, a heartbeat is two low sine thumps. Nothing plays in Node (no AudioContext), and the context is unlocked inside the
// first tap or key, which iOS requires; desktop browsers allow it after any earlier click, so the menu's own click is enough.
let ctx = null, noise = null, nextBeat = 0, lastBark = 0;
function audio() {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, audio, { once: true });
function burst(c) {
  if (!noise) { noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = noise; return s;
}
// One bark; pitch 0.8-1.3 tells the dogs apart. Barks closer than 0.12 s apart merge into one, however many dogs want to.
export function bark(pitch = 1) {
  const c = audio();
  if (!c || c.currentTime < lastBark + 0.12) return;
  const t = lastBark = c.currentTime, osc = c.createOscillator(), n = burst(c), bp = c.createBiquadFilter(), g = c.createGain();
  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(480 * pitch, t); osc.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.13);
  bp.type = 'bandpass'; bp.frequency.value = 750 * pitch; bp.Q.value = 1.4;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  osc.connect(bp); n.connect(bp); bp.connect(g); g.connect(c.destination);
  osc.start(t); n.start(t); osc.stop(t + 0.18); n.stop(t + 0.18);
}
// Lub, dub.
export function thump(strength = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (const [dt, f, peak] of [[0, 85, 0.8], [0.15, 70, 0.5]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + dt + 0.14);
    g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(peak * strength, t + dt + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2);
    o.connect(g); g.connect(c.destination); o.start(t + dt); o.stop(t + dt + 0.22);
  }
}
// Call every frame while she is being chased; urgency 0-1 (how close the nearest dog is) sets the rate, 70 to 160 a minute. One
// shared clock, so two packs at once do not double the beat, and the beat stops when the calls stop (a pause, the end of the run).
export function heartbeat(urgency = 0) {
  const c = audio();
  if (!c || c.currentTime < nextBeat) return;
  nextBeat = c.currentTime + 60 / (70 + 90 * urgency);
  thump(0.55 + 0.45 * urgency);
}

// Built nose to +z, the way the mob runs; the obstacle turns it round to face Milkshake.
export function buildDog(gfx, fur = 0) {
  const P = gfx.palette, c = FUR[fur % FUR.length];
  const g = gfx.group(gfx.blobShadow(0.45));
  const body = gfx.capsule(0.21, 0.55, c, 0, 0.55, 0); body.rotation.x = Math.PI / 2;
  const head = gfx.group(gfx.sphere(0.19, c, 0, 0, 0), gfx.box(0.17, 0.13, 0.26, c, 0, -0.04, 0.22), gfx.sphere(0.05, P.eye, 0, -0.01, 0.36));
  head.position.set(0, 0.72, 0.42);
  for (const s of [-1, 1]) head.add(gfx.sphere(0.045, '#ff2a2a', s * 0.09, 0.07, 0.15, { emissive: '#ff2a2a', emissiveIntensity: 1.2 }), gfx.cone(0.06, 0.16, c, s * 0.12, 0.2, -0.04));
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

// gait 1 gallops flat out, 0 stands and snarls; seed staggers a pack so it does not move as one; lunge (0-1) throws the head up
// and the jaws wide.
export function animateDog(d, time, gait = 1, seed = 0, lunge = 0) {
  const t = time * (15 + 9 * gait) + seed, snap = (Math.sin(time * 11 + seed) + 1) / 2;
  d.legs.forEach((l, i) => (l.rotation.x = Math.sin(t + (i < 2 ? 0 : Math.PI)) * 0.9 * gait + Math.sin(t * 0.3 + i) * 0.06 * (1 - gait)));
  d.body.position.y = 0.55 + Math.abs(Math.sin(t)) * 0.07 * gait;
  d.body.rotation.x = Math.PI / 2 - lunge * 0.35; // nose up as it leaves the ground
  d.head.rotation.x = -0.15 + Math.sin(t * 0.5) * 0.08 * gait - lunge * 0.5;
  d.jaw.rotation.x = Math.max(snap * 0.55, lunge * 0.85);
  d.foam.visible = snap > 0.35 || lunge > 0.3;
}

export default {
  kind: 'obstacle', id: 'newark/stray_dog', avoid: 'jump', box: { w: 1.0, h: 0.9, d: 1.6 }, moves: true,
  createView(gfx) {
    const d = buildDog(gfx);
    let barked = false;
    d.object.rotation.y = Math.PI; // faces Milkshake
    return {
      object: d.object,
      // Snarls in place from afar, runs on the spot harder as she closes, and in the last 9 m leaps at her: up 0.5 m and 0.4 m
      // forward, which stays inside its 1.6 m hitbox, so the leap is a scare and not a cheat.
      update(o, run) {
        const gap = o.z - run.z, charge = Math.min(1, Math.max(0, (25 - gap) / 15)), leap = gap > 0 && gap < 9 ? Math.sin(Math.PI * (9 - gap) / 9) : 0;
        d.object.position.y = leap * 0.5;
        d.object.position.z = o.z - leap * 0.4;
        if (leap > 0.3 && !barked) { barked = true; bark(1.15); } // one bark as it leaves the ground
        animateDog(d, run.time, charge, o.z, leap);
      },
    };
  },
};
