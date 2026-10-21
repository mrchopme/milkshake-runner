// The window relief (Task 33 pick 4, Caedon's board 28, 2026-10-19: "GRID, image faces, no generated pieces, 0 credits"; lane L-E):
// one stamp for every facade wall in buildings.js. The tile's plane stays on the wall line as the glass; RELIEF.jamb in front of it
// the tile's own texels, cut round each window opening (piers the zone's height, spandrels its width: where they cross, the same
// texels), stand as the frame; reveals in the body colour close each opening, AO-darkened toward the glass; proud heads and sills in
// the trim (a curtain wall: one transom a floor instead); caps close the frame's edges. Above RELIEF.cap the wall stays a plane.
// Built in the wall's own frame, facing +z, centred on x = 0 (w wide), y in metres: the caller turns and places it as wall() is.
import { plane } from './shapes.js';
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
// than `minH` stays solid.
export const RELIEF = { jamb: 0.1, head: { h: 0.14, out: 0.08 }, sill: { h: 0.08, out: 0.08 }, over: 0.06, transom: { h: 0.1, out: 0.06 }, ao: 0.6, cap: 30, minH: 1 };
const CW = TILE.w / 2, CH = TILE.h / 2, SEG = 4; // a window cell; SEG: along x (z on the street walls) every 4 m, so it bends

// o: { w, y0, y1, base (where the tile's v is 0: its cells stand on base + 3.5 n), top (a cornice's underside: openings clip there),
// open (OPENINGS' rect or null), glass (a curtain wall), color, trim (THREE.Color) } -> { face: tile-material geometries, body: one
// vertex-coloured geometry for the body mesh, or null when the wall stays flat }
export function relief(T, { w, y0, y1, base = y0, top = y1, open, glass, color, trim }) {
  const R = RELIEF, J = R.jamb, face = [], pos = [], nor = [], col = [];
  const tile = (x0, x1, ya, yb, z) => { if (x1 - x0 > 1e-3 && yb - ya > 1e-3) face.push(plane(T, x1 - x0, yb - ya, TILE.w, TILE.h, (ya - base) / TILE.h, x0 / TILE.w).translate((x0 + x1) / 2 - w / 2, (ya + yb) / 2, z)); };
  const yc = !open ? y0 : y1 <= R.cap ? y1 : Math.max(y0, base + CH * Math.floor((R.cap - base) / CH)); // the relief's top
  const cols = [], rows = [];
  if (open) for (let s = 0; s + open.u[1] * CW <= w - 0.05; s += CW) cols.push([s + open.u[0] * CW, s + open.u[1] * CW]); // whole windows only
  if (open) for (let yb = base + CH * Math.ceil((y0 - base) / CH - 1e-6); yb + CH <= yc + 1e-6; yb += CH) {
    const a = yb + (1 - open.v[1]) * CH, b = Math.min(yb + (1 - open.v[0]) * CH, top);
    if (b - a >= R.minH) rows.push([a, b]);
  }
  if (!cols.length || !rows.length) { tile(0, w, y0, y1, 0); return { face, body: null }; }
  // an axis-aligned rectangle facing axis n (0 x, 1 y, 2 z) on side s at c, over a on axis n + 1 and b on n + 2 (mod 3), in `tint`
  // darkened to R.ao where `dark(vertex)`; cut every SEG along x
  const rect = (n, s, c, [a0, a1], [b0, b1], tint, dark = () => false) => {
    const e1 = (n + 1) % 3, e2 = (n + 2) % 3, cut = (lo, hi, e) => { const k = e === 0 ? Math.max(1, Math.ceil((hi - lo) / SEG)) : 1; return Array.from({ length: k }, (_, i) => [lo + (hi - lo) * i / k, lo + (hi - lo) * (i + 1) / k]); };
    for (const [p0, p1] of cut(a0, a1, e1)) for (const [q0, q1] of cut(b0, b1, e2)) {
      const at = (p, q) => { const v = [0, 0, 0]; v[n] = c; v[e1] = p; v[e2] = q; return v; }, quad = [at(p0, q0), at(p1, q0), at(p1, q1), at(p0, q0), at(p1, q1), at(p0, q1)];
      if (s < 0) quad.reverse();
      for (const v of quad) { const k = dark(v) ? R.ao : 1; pos.push(v[0] - w / 2, v[1], v[2]); nor.push(n === 0 ? s : 0, n === 1 ? s : 0, n === 2 ? s : 0); col.push(tint.r * k, tint.g * k, tint.b * k); }
    }
  };
  const proud = (x0, x1, ya, yb, out) => { // a trim bar on the frame: its front, top and shaded underside (its 8 cm ends left out)
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
  const body = new T.BufferGeometry();
  body.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  body.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  body.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); // the body mesh's boxes carry uvs
  body.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return { face, body };
}
