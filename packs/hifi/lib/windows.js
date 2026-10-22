// The window relief (Task 33 pick 4, Caedon's board 28, 2026-10-19: "GRID, image faces, no generated pieces, 0 credits"; lane L-E):
// one stamp for every facade wall in buildings.js. The tile's plane stays on the wall line as the glass; RELIEF.jamb in front of it
// the tile's own texels, cut round each window opening (piers the zone's height, spandrels its width: where they cross, the same
// texels), stand as the frame; reveals in the body colour close each opening, AO-darkened toward the glass; proud heads and sills in
// the trim (a curtain wall: one transom a floor instead); caps close the frame's edges. Above RELIEF.cap the wall stays a plane.
// Built in the wall's own frame, facing +z, centred on x = 0 (w wide), y in metres: the caller turns and places it as wall() is.
import { TILE } from './facade.js';

// The window opening in each tile's 2.5 x 3.5 m cell, data measured once per image by Task 33's P6 prototype (the glow's pane test,
// isPane, on the tile's 2 x 2 cells summed; task-33-p6-facades-report.md): { u: [left, right], v: [top, bottom] }, fractions of the
// cell, v from its top; null: no window reads (uptown-02's fire escape lattice), the wall stays flat. Keyed by image, so a tile keeps
// its table whichever theme lists it. ponytail: downtown-04 reads about 0.1 cell off centre (a 0.1 m strip of painted glass on a pier).
const G = { u: [0.04, 0.96], v: [0.04, 0.96] }, F = (u0, u1, v0, v1) => ({ u: [u0, u1], v: [v0, v1] }), f = (name) => `hifi/city/facades/${name}.webp`;
export const OPENINGS = {
  [f('downtown-01')]: G, [f('downtown-02')]: G, [f('downtown-03')]: F(0.23, 0.77, 0.15, 0.75), [f('downtown-04')]: F(0.11, 0.77, 0.07, 0.79), [f('downtown-05')]: F(0.09, 0.91, 0.06, 0.82),
  [f('midtown-01')]: F(0.13, 0.88, 0.04, 0.96), [f('midtown-02')]: G, [f('midtown-03')]: F(0.19, 0.81, 0.09, 0.78), [f('midtown-04')]: F(0.23, 0.76, 0.16, 0.79), [f('midtown-05')]: G,
  [f('uptown-01')]: F(0.24, 0.75, 0.16, 0.8), [f('uptown-02')]: null, [f('uptown-03')]: F(0.27, 0.73, 0.17, 0.72), [f('uptown-04')]: F(0.23, 0.77, 0.25, 0.77), [f('uptown-05')]: F(0.22, 0.78, 0.19, 0.8),
};
// ponytail: calibration knobs, metres (the Task 33 map's skeptic, board 28): jambs at most 0.1 (a 0.18 m one hides 42% of a pane
// 30 m down the canyon, and the dusk glow with it); heads and sills 0.08 proud, `over` past the opening each side; the AO bake's
// shade (0.55-0.65 x); the 30 m cap (frames pop there, above it the eye does not read them); a row clipped under a cornice to less
// than `minH` stays solid; no face looking up above `eye` (Task 34 L-E, a third of the stamp's triangles, inside the prototype's
// budget): the highest a camera can ride, a section's 8 m (src/validate.js CAMERA_RANGES) + 0.3 x the highest jump the rules' ranges
// allow (src/engine.js cameraFor; jumpSpeed 15, gravity -10: 11.25 m) = 11.375, rounded up to 11.5; the shipped cameras sit at 5.5 m and lower.
export const RELIEF = { jamb: 0.1, head: { h: 0.14, out: 0.08 }, sill: { h: 0.08, out: 0.08 }, over: 0.06, transom: { h: 0.1, out: 0.06 }, ao: 0.6, cap: 30, minH: 1, eye: 11.5 };
const CW = TILE.w / 2, CH = TILE.h / 2, SEG = 4; // a window cell; SEG: along x (z on the street walls) every 4 m, so it bends

// o: { w, y0, y1, base (where the tile's v is 0: its cells stand on base + 3.5 n), top (a cornice's underside: openings clip there),
// open (OPENINGS' rect or null), glass (a curtain wall), color, trim (THREE.Color) } -> { face: one tile-material geometry, body: one
// vertex-coloured geometry for the body mesh, or null when the wall stays flat }
export function relief(T, { w, y0, y1, base = y0, top = y1, open, glass, color, trim }) {
  const R = RELIEF, J = R.jamb, fo = { pos: [], nor: [], uv: [] }, bo = { pos: [], nor: [], uv: [], col: [] };
  const geo = (o) => { const g = new T.BufferGeometry(); for (const [k, a, n] of [['position', o.pos, 3], ['normal', o.nor, 3], ['uv', o.uv, 2], ['color', o.col, 3]]) if (a) g.setAttribute(k, new T.Float32BufferAttribute(a, n)); return g; };
  // an axis-aligned rectangle facing axis n (0 x, 1 y, 2 z) on side s at c, over a on axis n + 1 and b on n + 2 (mod 3), cut every
  // SEG along x: with a `tint` into the body (darkened to R.ao where `dark(vertex)`), without one into the face, uv on the tile's grid
  const v = [0, 0, 0]; // ponytail: rect writes straight into the arrays, no per-vertex objects (it was a fifth of a chunk's build)
  const rect = (n, s, c, [a0, a1], [b0, b1], tint, dark) => {
    if (n === 1 && s > 0 && c > R.eye) return; // a face looking up, above every camera: a back face from the street
    const o = tint ? bo : fo, e1 = (n + 1) % 3, e2 = (n + 2) % 3, ka = e1 ? 1 : Math.max(1, Math.ceil((a1 - a0) / SEG)), kb = e2 ? 1 : Math.max(1, Math.ceil((b1 - b0) / SEG));
    const at = (p, q) => {
      v[n] = c; v[e1] = p; v[e2] = q;
      o.pos.push(v[0] - w / 2, v[1], v[2]); o.nor.push(n === 0 ? s : 0, n === 1 ? s : 0, n === 2 ? s : 0);
      if (!tint) return o.uv.push(v[0] / TILE.w, (v[1] - base) / TILE.h);
      const k = dark?.(v) ? R.ao : 1; o.uv.push(0, 0); o.col.push(tint.r * k, tint.g * k, tint.b * k); // the body mesh's boxes carry uvs
    };
    for (let i = 0; i < ka; i++) for (let j = 0; j < kb; j++) {
      const p0 = a0 + (a1 - a0) * i / ka, p1 = a0 + (a1 - a0) * (i + 1) / ka, q0 = b0 + (b1 - b0) * j / kb, q1 = b0 + (b1 - b0) * (j + 1) / kb;
      if (s > 0) { at(p0, q0); at(p1, q0); at(p1, q1); at(p0, q0); at(p1, q1); at(p0, q1); } else { at(p0, q1); at(p1, q1); at(p0, q0); at(p1, q1); at(p1, q0); at(p0, q0); }
    }
  };
  const tile = (x0, x1, ya, yb, z) => { if (x1 - x0 > 1e-3 && yb - ya > 1e-3) rect(2, 1, z, [x0, x1], [ya, yb]); };
  const yc = !open ? y0 : y1 <= R.cap ? y1 : Math.max(y0, base + CH * Math.floor((R.cap - base) / CH)); // the relief's top
  const cols = [], rows = [];
  if (open) for (let s = 0; s + open.u[1] * CW <= w - 0.05; s += CW) cols.push([s + open.u[0] * CW, s + open.u[1] * CW]); // whole windows only
  if (open) for (let yb = base + CH * Math.ceil((y0 - base) / CH - 1e-6); yb + CH <= yc + 1e-6; yb += CH) {
    const a = yb + (1 - open.v[1]) * CH, b = Math.min(yb + (1 - open.v[0]) * CH, top);
    if (b - a >= R.minH) rows.push([a, b]);
  }
  if (!cols.length || !rows.length) { tile(0, w, y0, y1, 0); return { face: geo(fo), body: null }; }
  // a trim bar on the frame: its front, top and shaded underside. ponytail: its two ends (0.08 x 0.08-0.14 m, facing along the wall)
  // left open: through one a few pixels of the frame's own texels show at most, closing them is 8 more triangles a window (+50%)
  const proud = (x0, x1, ya, yb, out) => {
    rect(2, 1, J + out, [Math.max(0, x0), Math.min(w, x1)], [ya, yb], trim);
    rect(1, 1, yb, [J, J + out], [Math.max(0, x0), Math.min(w, x1)], trim);
    rect(1, -1, ya, [J, J + out], [Math.max(0, x0), Math.min(w, x1)], trim, () => true);
  };
  const deep = (v) => v[2] < J / 2; // the AO: the reveal's edge at the glass
  for (const [sa, sb] of cols) for (const [a, b] of rows) {
    rect(0, 1, sa, [a, b], [0, J], color, deep); rect(0, -1, sb, [a, b], [0, J], color, deep); // the jambs
    rect(1, -1, b, [0, J], [sa, sb], color, deep); rect(1, 1, a, [0, J], [sa, sb], color, deep); // the head's soffit, the sill's reveal
    if (glass) continue;
    proud(sa - R.over, sb + R.over, a - R.sill.h, a, R.sill.out);
    if (b + R.head.h <= top + 1e-6) proud(sa - R.over, sb + R.over, b, b + R.head.h, R.head.out);
  }
  if (glass) for (const [, b] of rows) if (b + R.transom.h <= top + 1e-6) proud(0, w, b, b + R.transom.h, R.transom.out);
  rect(1, 1, yc, [0, J], [0, w], color); rect(1, -1, y0, [0, J], [0, w], color); rect(0, -1, 0, [y0, yc], [0, J], color); rect(0, 1, w, [y0, yc], [0, J], color); // the caps
  const us = [0, ...cols.flat(), w], ys = [y0, ...rows.flat(), yc];
  for (let k = 0; k < us.length; k += 2) tile(us[k], us[k + 1], y0, yc, J); // the piers
  for (let k = 0; k < ys.length; k += 2) tile(0, w, ys[k], ys[k + 1], J); // the spandrels
  tile(0, w, y0, yc, 0); // the glass, after the frame (early z drops what the frame covers)
  tile(0, w, yc, y1, 0); // above the cap
  return { face: geo(fo), body: geo(bo) };
}
