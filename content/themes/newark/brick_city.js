// Brick City: the grungy street of the satirical Newark level. It replaces the default street with cracked asphalt, stained
// sidewalks, low brick blocks whose windows are dark, boarded or lit, tags sprayed on the walls, chain-link lots with rubble and
// a dumped couch, dumpsters, trash bags, a burning barrel and streetlights that mostly died. All of it is gfx primitives, so Node
// can build a chunk; the tags are canvas textures, which paint() skips when there is no document.
const TAGS = ['BRICK CITY', 'NO SLEEP TIL PENN', 'WHO LET THE DOGS OUT', 'MOO', 'RUN COW RUN', 'WRONG TURN', 'GOT JUGS?', 'TURN BACK', 'DELAYED', 'NEWARK WAS HERE', 'TOLLS AHEAD', 'LAST TRAIN', 'NOT A SHORTCUT'];
const NEON = ['#ff4fa3', '#39ff14', '#00e5ff', '#ffde21', '#ff7a1a', '#b9a6e8', '#ff2a2a'];
const BRICK = ['#7a3b2e', '#8c4a3a', '#5e4034', '#6b5a52', '#9a5f45', '#4f3b35'];
const ASPHALT = '#3b3c45', CONCRETE = '#7d7a74', PLYWOOD = '#8b6a3f', DEAD_GLASS = '#1a1b22', LIT = '#dcb56c', BAG = '#1e1f26';

// Text as a canvas texture, or null in Node (the tests build the pack with no DOM). A tilt and an outline make a tag; neither makes a sign.
// Long text is squeezed to the canvas width rather than clipped.
export function paint(gfx, text, { color = '#ffffff', outline = null, w = 1024, h = 256, size = 150, tilt = 0 } = {}) {
  if (typeof document === 'undefined') return null;
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d');
  x.translate(w / 2, h / 2); x.rotate(tilt);
  Object.assign(x, { font: `900 ${size}px "Lilita One", system-ui, sans-serif`, textAlign: 'center', textBaseline: 'middle', lineJoin: 'round' });
  if (outline) { x.lineWidth = size * 0.16; x.strokeStyle = outline; x.strokeText(text, 0, 0, w * 0.94); }
  x.fillStyle = color; x.fillText(text, 0, 0, w * 0.94);
  const t = new gfx.three.CanvasTexture(c); t.colorSpace = gfx.three.SRGBColorSpace; return t;
}

// Text on a flat unlit plane, or null in Node. A plane, not a sprite: a sprite turns to face the camera, and one hung on a wall
// swings half of itself into the wall as soon as the camera looks at it from the side.
function plane(gfx, tex, w, h) {
  const T = gfx.three;
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}
// A plaque that faces Milkshake and the camera (-z): the back of a sign, the front of a station.
export function plaque(gfx, text, w, h, opts) {
  const tex = paint(gfx, text, opts);
  if (!tex) return null;
  const m = plane(gfx, tex, w, h); m.rotation.y = Math.PI;
  return m;
}
// A tag sprayed on the wall at x, facing the road, its text reading left to right from the road.
function tag(gfx, text, color, w, x, y, z, side, tilt) {
  const tex = paint(gfx, text, { color, outline: '#15161c', tilt, w: 1024, h: 320, size: 140 });
  if (!tex) return null;
  const m = plane(gfx, tex, w, w * 0.3125);
  m.position.set(x, y, z); m.rotation.y = side * -Math.PI / 2;
  return m;
}

export default {
  kind: 'theme', id: 'newark/brick_city', sky: '#9d8f80', fog: 0.5,
  buildings: { colors: BRICK, minH: 8, maxH: 20 },
  createChunk(gfx, { z0, length, lanes, rng: r }) {
    const P = gfx.palette, R = lanes.roadHalf, pick = (a) => a[Math.floor(r() * a.length)], zc = z0 + length / 2;
    const g = gfx.group(gfx.box(R * 2, 0.1, length, ASPHALT, 0, -0.05, zc));
    for (const side of [-1, 1]) g.add(gfx.box(3, 0.25, length, CONCRETE, side * (R + 1.5), 0.125, zc));
    for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) g.add(gfx.box(0.12, 0.02, 3, '#8e8d86', x, 0.01, z + 1.5)); // faded dashes
    for (let i = 0; i < 8; i++) g.add(gfx.box(1 + r() * 1.5, 0.008, 1.5 + r() * 2, r() < 0.5 ? '#45464f' : '#32333b', (r() - 0.5) * 7, 0.004, z0 + 2 + r() * (length - 4))); // patched asphalt, under the dashes
    for (let i = 0; i < 3; i++) { const p = gfx.cyl(0.8, 0.8, 0.02, '#2a3340', (r() - 0.5) * 7, 0.012, z0 + 2 + r() * (length - 4)); p.scale.x = 1.6; g.add(p); } // puddles

    // The blocks: low brick with a band of windows per floor, a parapet, now and then a water tank and a tag at eye height.
    // A lot now and then instead: chain-link, rubble, a dumped couch, and a block set further back so the sky does not show through.
    for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
      const depth = Math.min(8 + r() * 6, z0 + length - z), h = this.buildings.minH + r() * (this.buildings.maxH - this.buildings.minH);
      if (depth < 3) break; // the last block stops at the chunk seam, as the default street's does
      const zm = z + depth / 2, face = side * (R + 3);
      if (r() < 0.18) {
        g.add(gfx.box(0.03, 2.0, depth - 0.6, '#aab0b8', face, 1.25, zm, { transparent: true, opacity: 0.3 }), gfx.box(10, h * 0.7, depth - 0.5, pick(BRICK), side * (R + 18), h * 0.35, zm));
        for (let zz = z + 0.3; zz < z + depth - 0.2; zz += 3) g.add(gfx.box(0.1, 2.2, 0.1, P.metal, face, 1.35, zz));
        for (let i = 0; i < 3; i++) g.add(gfx.box(0.6 + r(), 0.4 + r() * 0.5, 0.6 + r(), '#6e6a66', side * (R + 4.5 + r() * 4), 0.45, z + 1.5 + r() * (depth - 3)));
        g.add(gfx.box(1.8, 0.6, 0.8, '#6d4c41', side * (R + 6), 0.55, zm), gfx.box(1.8, 0.7, 0.3, '#5d3f36', side * (R + 6), 1.0, zm + 0.3));
      } else {
        g.add(gfx.box(10, h, depth - 0.5, pick(BRICK), side * (R + 8), h / 2, zm), gfx.box(10.3, 0.5, depth - 0.3, '#3d2b26', side * (R + 8), h + 0.2, zm));
        for (let y = 3; y < h - 1.5; y += 3.2) { const roll = r(); g.add(gfx.box(0.1, 1.3, depth - 1.5, roll < 0.35 ? PLYWOOD : roll < 0.45 ? LIT : DEAD_GLASS, face - side * 0.06, y, zm)); }
        if (r() < 0.3) g.add(gfx.cyl(0.9, 0.9, 1.6, '#5a4a40', side * (R + 9 + r() * 4), h + 1.2, zm));
        if (depth >= 6 && r() < 0.6) { const t = tag(gfx, pick(TAGS), pick(NEON), Math.min(depth - 2.5, 6), face - side * 0.14, 1.9 + r() * 0.8, zm, side, (r() - 0.5) * 0.25); if (t) g.add(t); }
      }
      z += depth;
    }

    // Curb life: trash bags, two dumpsters, a burning barrel, and a streetlight every 30 m with one in three still lit.
    for (let i = 0; i < 7; i++) { const side = r() < 0.5 ? -1 : 1, b = gfx.sphere(0.32, BAG, side * (R + 0.7 + r() * 0.5), 0.47, z0 + 1 + r() * (length - 2)); b.scale.y = 0.7; g.add(b); }
    for (let i = 0; i < 2; i++) {
      const side = i ? -1 : 1, z = z0 + 10 + r() * (length - 20), x = side * (R + 2.2);
      g.add(gfx.box(1.1, 1.3, 2.0, '#2f6b3a', x, 0.9, z), gfx.box(1.2, 0.12, 2.1, '#255a2e', x, 1.61, z), gfx.sphere(0.3, BAG, x, 1.9, z - 0.4));
    }
    {
      const side = r() < 0.5 ? -1 : 1, z = z0 + 5 + r() * (length - 10), x = side * (R + 1.4), glow = gfx.glow(0.7, P.hazard, 1.5);
      glow.position.set(x, 1.5, z);
      g.add(gfx.cyl(0.32, 0.3, 0.9, '#3a3a40', x, 0.7, z), gfx.cone(0.22, 0.5, P.hazard, x, 1.35, z), gfx.cone(0.12, 0.35, '#ffc21a', x, 1.45, z), glow);
    }
    for (let z = z0 + 15; z < z0 + length; z += 30) {
      const k = Math.round((z - 15) / 30), side = k % 2 ? -1 : 1, lit = k % 3 === 0, x = side * (R + 0.9), lampX = x - side * 2.1;
      g.add(gfx.cyl(0.08, 0.1, 6, '#44454f', x, 3, z), gfx.box(2.2, 0.1, 0.1, '#44454f', x - side * 1.05, 6, z), gfx.box(0.5, 0.2, 0.3, lit ? '#ffd27a' : '#2a2a30', lampX, 5.95, z, lit ? { emissive: '#ffd27a', emissiveIntensity: 0.6 } : undefined));
      if (lit) { const glow = gfx.glow(0.9, '#ffb84d', 5.9); glow.position.set(lampX, 5.9, z); g.add(glow); }
    }
    return g;
  },
};
