// HiFi billboard: no model, a code panel (bezel, frame, two posts) wearing one of the generated posters in
// public/hifi/city/signs, picked by z. Same size, place and side rule as the shipped one (content/props/billboard.js); 0 credits.
import { material } from '../lib/materials.js';
import { pickBy } from '../lib/rand.js';

const POSTERS = 12; // poster-01 … poster-12 (the test checks the folder); the paths are the ones the city's signs use, so the cache loads each once
const path = (i) => `hifi/city/signs/poster-${String(i + 1).padStart(2, '0')}.webp`;
const PANEL = { w: 5, h: 4, d: 0.3, y: 5, z: 2 }; // ponytail: calibration knob — the shipped panel; h = 2.97 makes the frame hug the 16:9 poster instead of leaving bands above and below it
const MARGIN = 0.2;           // ponytail: calibration knob — frame showing left and right of the poster
const ASPECT = 1024 / 573;    // the generated posters; the poster keeps it (never stretched)
const GLOW = 0.6;             // ponytail: calibration knob — the poster's own texels as its emissive map, so it stays lit in shade; past ~1 the white parts bloom
const BEZEL = 0.3;            // the shipped bezel is the panel + 0.3 each way, 0.2 deep, 0.2 behind the panel's back
const POST = { w: 0.25, dx: 1.6, z: 2.2 }; // two posts under the panel, behind it

let geo; // shared by every billboard: { bezel, frame, poster, post }, flagged shared so gfx.dispose leaves them
const shared = (g) => { g.userData.shared = true; return g; };
const build = (T) => {
  const pw = PANEL.w - 2 * MARGIN;
  return {
    bezel: shared(new T.BoxGeometry(PANEL.w + BEZEL, PANEL.h + BEZEL, 0.2)),
    frame: shared(new T.BoxGeometry(PANEL.w, PANEL.h, PANEL.d)),
    poster: shared(new T.PlaneGeometry(pw, pw / ASPECT).rotateY(Math.PI)), // a plane faces +z; the player is at -z
    post: shared(new T.BoxGeometry(POST.w, PANEL.y - PANEL.h / 2, POST.w)),
  };
};
// The poster's paint; a poster not loaded yet gets a flat panel under its own key, so the real one still builds once it lands.
function posterMaterial(gfx, i) {
  const T = gfx.three;
  let map = null;
  try { map = gfx.texture(path(i)); } catch { /* not loaded */ }
  return material(`billboard/${map ? path(i) : 'blank'}`, () => new T.MeshStandardMaterial(map
    ? { map, emissive: '#ffffff', emissiveMap: map, roughness: 0.7, emissiveIntensity: GLOW }
    : { color: gfx.palette.x2, emissive: gfx.palette.x2, roughness: 0.7, emissiveIntensity: GLOW }));
}

export default {
  kind: 'prop', id: 'billboard', assets: Array.from({ length: POSTERS }, (_, i) => path(i)),
  createView(gfx, { z, lanes }) {
    const T = gfx.three, P = gfx.palette, g = geo ??= build(T);
    const x = (Math.floor(z / 40) % 2 ? -1 : 1) * (lanes.roadHalf + 2.5); // alternates sides along the street, as the shipped one does
    const at = (geometry, m, px, py, pz) => { const n = new T.Mesh(geometry, m); n.position.set(px, py, pz); return n; };
    const bezel = material('billboard/bezel', () => new T.MeshStandardMaterial({ color: P.dark, roughness: 0.4 }));
    const frame = material('billboard/frame', () => new T.MeshStandardMaterial({ color: P.lavender, roughness: 0.6 }));
    const post = material('billboard/post', () => new T.MeshStandardMaterial({ color: P.metal, roughness: 0.5, metalness: 0.3 }));
    const h = PANEL.y - PANEL.h / 2;
    return {
      object: gfx.group(
        at(g.bezel, bezel, x, PANEL.y, PANEL.z + 0.2),
        at(g.frame, frame, x, PANEL.y, PANEL.z),
        at(g.poster, posterMaterial(gfx, pickBy(z, POSTERS)), x, PANEL.y, PANEL.z - PANEL.d / 2 - 0.01), // just in front of the frame's face
        at(g.post, post, x - POST.dx, h / 2, POST.z), at(g.post, post, x + POST.dx, h / 2, POST.z),
      ),
    };
  },
};
