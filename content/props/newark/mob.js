import { buildDog, animateDog } from '../../obstacles/newark/stray_dog.js';
import { plaque } from '../../themes/newark/brick_city.js';

// The chase. A mob waits at an alley mouth on the sidewalk; as Milkshake passes its line it sprints onto the road and runs at her
// heels, gives up before its 40 m are out, and the next mob (placed by weight every 40 m) takes over, so somebody is always
// behind her. Props never collide: the mob is theatre, the obstacles do the hurting.
export const SETTLE_M = 12, TIRE_M = 28; // metres past the mob's line: at the heels by SETTLE_M, tiring from TIRE_M to the end
const SIGNS = ['SPARE A JUG?', 'WILL CHASE 4 MILK', 'TRAIN FARE PLS', 'ANYTHING HELPS', 'NOT EVEN FROM HERE', 'ASK ME ABOUT JUGS', '1 JUG = 1 PRAYER'];
const HOODIES = ['#4a4d5c', '#7a2e2e', '#2f4f3a', '#5a4a7a'], SKINS = ['#8d5a3b', '#c68e62', '#e0b08a', '#5a3a24'];
// Who runs, and where each runs relative to Milkshake (x beside her, z behind her). Nobody tall runs dead centre: it would hide her from the camera.
const PACKS = [
  [['dog', 0, 1.8], ['dog', 1.3, 2.4], ['dog', -1.3, 2.4]],
  [['person', 1.1, 1.8], ['person', -1.1, 1.9], ['dog', 0, 2.6]],
  [['person', -1.2, 1.8], ['dog', 0.3, 1.7], ['dog', 1.5, 2.6]],
  [['dog', 0, 1.7], ['person', 1.3, 2.0], ['dog', -1.4, 2.5], ['person', -2.2, 2.3]],
];
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// Hoodie, beanie, sweatpants, and the cardboard sign worn on the back, because the back is what the camera sees.
function buildPerson(gfx, k, sign) {
  const P = gfx.palette, hood = HOODIES[k % HOODIES.length], skin = SKINS[k % SKINS.length];
  const g = gfx.group(gfx.blobShadow(0.4));
  const legs = [-0.14, 0.14].map((x) => { const p = gfx.group(gfx.box(0.2, 0.75, 0.2, '#2d2f3a', 0, -0.37), gfx.box(0.24, 0.1, 0.32, P.dark, 0, -0.8, 0.04)); p.position.set(x, 0.85, 0); g.add(p); return p; });
  const body = gfx.group(gfx.roundedBox(0.7, 0.85, 0.42, 0.1, hood, 0, 0.42), gfx.sphere(0.23, skin, 0, 1.05), gfx.sphere(0.25, P.eye, 0, 1.16), gfx.box(0.8, 0.46, 0.03, '#c69c6d', 0, 0.42, -0.23));
  body.children[2].scale.y = 0.55; // the beanie
  body.position.y = 0.85; // pivots at the hips, so a tired mob bends over
  const arms = [-0.46, 0.46].map((x) => { const a = gfx.group(gfx.capsule(0.08, 0.4, hood, 0, -0.25), gfx.sphere(0.08, skin, 0, -0.5)); a.position.set(x, 0.72, 0); body.add(a); return a; });
  const words = plaque(gfx, sign, 0.78, 0.39, { color: '#3b2a1a', w: 768, h: 384, size: 104 });
  if (words) { words.position.set(0, 0.42, -0.25); body.add(words); }
  g.add(body);
  return { object: g, legs, arms, body, kind: 'person' };
}

function animatePerson(m, stride, tired, sway) {
  m.legs.forEach((l, i) => (l.rotation.x = stride * 0.65 * (i ? 1 : -1)));
  m.arms.forEach((a, i) => (a.rotation.x = stride * 0.7 * (i ? -1 : 1)));
  m.body.position.y = 0.85 + Math.abs(stride) * 0.07;
  m.body.rotation.x = tired * 0.9; // hands on knees
  m.body.rotation.z = sway;
}

export default {
  kind: 'prop', id: 'newark/mob', length: 40,
  createView(gfx, { z, length, lanes }) {
    const k = Math.floor(z / length), side = k % 2 ? -1 : 1, alleyX = side * (lanes.roadHalf + 2.2);
    const members = PACKS[k % PACKS.length].map(([kind, ox, oz], i) => {
      const m = kind === 'dog' ? buildDog(gfx, k + i) : buildPerson(gfx, k + i, SIGNS[(k * 3 + i) % SIGNS.length]);
      Object.assign(m, { ox, oz, seed: i * 1.7, alley: { x: alleyX + side * (i % 2) * 0.9, z: i * 1.1 }, fx: alleyX });
      m.object.position.set(m.alley.x, 0, m.alley.z); m.object.rotation.y = side * -Math.PI / 2; // waits at the alley mouth, facing the road
      return m;
    });
    return {
      object: gfx.group(...members.map((m) => m.object)), members,
      // The engine passes (p, run, dt). The ending passes a fourth, halt: the mob stands where it is and snarls.
      update(p, run, dt, halt = false) {
        const d = run.z - p.z, fall = smooth(d / SETTLE_M), tired = smooth((d - TIRE_M) / (length - TIRE_M)), gait = halt ? 0 : fall * (1 - tired);
        const lag = 1 - Math.exp(-dt / 0.2), beat = run.time * 14 * ((run.speed ?? 12) / 12);
        for (const m of members) {
          const o = m.object;
          m.fx += (run.x + m.ox - m.fx) * lag; // follows a lane change a beat late
          o.position.x = m.alley.x + (m.fx - m.alley.x) * fall;
          o.position.z = m.alley.z + (run.z - m.oz - tired * tired * 24 - p.z - m.alley.z) * fall; // in the prop's frame; a tired mob drops out of the frame below
          o.rotation.y = 0 - side * (Math.PI / 2) * (1 - fall); // 0 - …: fallen in is +0, never -0
          if (m.kind === 'dog') animateDog(m, run.time, gait, m.seed);
          else animatePerson(m, Math.sin(beat + m.seed) * gait, tired, fall ? 0 : Math.sin(run.time * 3 + m.seed) * 0.05);
        }
      },
    };
  },
};
