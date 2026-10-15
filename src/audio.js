// Sound. One AudioContext, made on first use and unlocked inside the first tap or key (iOS insists; desktop browsers accept the
// menu's own click). Every voice is synthesised, so the game ships no sound files and Node, which has no AudioContext, hears
// nothing and never throws.
let ctx = null, noise = null;
function context() {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, context, { once: true });

// A quarter second of white noise, shared; every burst is a window into it.
function burst(c, seconds) {
  if (!noise) { noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.25), c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = noise; s.start(c.currentTime); s.stop(c.currentTime + seconds); return s;
}
const jitter = (v, r) => v * (1 + (Math.random() * 2 - 1) * r); // no two steps alike: a machine-gun step is what gives synthesis away
const envelope = (c, peak, attack, decay) => { const g = c.createGain(), t = c.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay); return g; };

// A hoof on asphalt, layered the way a recorded one is: a 10 ms impulse ringing two resonances (the hard clop and its body), a
// low thud (the weight landing), and a breath of grit (the sole across the surface). foot -1 or 1 pans it a little left or right;
// a faster stride lands harder. Calibration knobs: the resonances and the thud's pitch are the character's hooves, the grit is the surface.
export const FOOTSTEP = { clop: 1500, body: 520, thud: 140, grit: 1800, gain: 0.5 };
export function footstep(foot = 1, speed = 12) {
  const c = context();
  if (!c) return;
  const t = c.currentTime, K = FOOTSTEP, out = c.createGain();
  out.gain.value = K.gain * Math.min(1.3, 0.8 + speed / 40);
  let tail = out;
  if (c.createStereoPanner) { tail = c.createStereoPanner(); tail.pan.value = foot * 0.2; out.connect(tail); }
  tail.connect(c.destination);
  const impulse = envelope(c, 1, 0.001, 0.012);
  burst(c, 0.02).connect(impulse);
  for (const [f, q, g] of [[jitter(K.clop, 0.12), 9, 0.9], [jitter(K.body, 0.1), 6, 0.5]]) {
    const bp = c.createBiquadFilter(), gg = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; gg.gain.value = g;
    impulse.connect(bp); bp.connect(gg); gg.connect(out);
  }
  const thud = c.createOscillator(), thudGain = envelope(c, 0.55, 0.002, 0.09);
  thud.frequency.setValueAtTime(jitter(K.thud, 0.1), t); thud.frequency.exponentialRampToValueAtTime(K.thud * 0.4, t + 0.08);
  thud.connect(thudGain); thudGain.connect(out); thud.start(t); thud.stop(t + 0.12);
  const lp = c.createBiquadFilter(), gritGain = envelope(c, jitter(0.16, 0.3), 0.012, 0.1);
  lp.type = 'lowpass'; lp.frequency.value = jitter(K.grit, 0.2);
  burst(c, 0.13).connect(lp); lp.connect(gritGain); gritGain.connect(out);
}
