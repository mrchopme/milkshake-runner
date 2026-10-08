# Contributing to Milkshake Runner

Everything after level 2 comes from the community, and the game is built so you never have to touch
the engine. You can add two kinds of things:

- a **level**: one JSON file in `levels/`
- **content**: a one-file JavaScript module in `content/` (an obstacle, a pickup, a prop, a theme, a character or an ending)

Both go through a pull request. CI runs the same checks the game runs when it loads, so anything that
would break the game cannot merge. Everything under `src/` is the engine; you should not need to edit it.
If you find you do, open an issue: that is a bug in the engine's modularity, not in your contribution.

## 1. Add a level

1. Fork the repo. Add `levels/<your-level-id>.json`. The id is `a-z 0-9 -` and must equal the file name.
2. Do **not** edit `levels/index.json` or `levels/campaign.json`; your level is listed automatically after the shipped ones.
3. Check it: `npm ci && npm test`, then `npm run dev` and play it from **Levels**.
4. Open a pull request.

### A level that uses everything

```json
{
  "id": "canal-street-dash",
  "title": "Canal Street Dash",
  "author": "your-github-name",
  "length_m": 900,
  "seed": 42,
  "character": { "id": "milkshake" },
  "theme": { "id": "downtown", "sky": "#ffb38a", "fog": 0.5 },
  "rules": { "gravity": -24, "speed": { "start": 10, "end": 18 } },
  "obstacles": { "hot_dog_cart": 3, "delivery_bike": 2, "pigeons": 2, "taxi": 1 },
  "density": { "start": 0.3, "end": 0.6 },
  "jugs": { "per_100m": 15, "powerups": ["magnet", "x2"] },
  "sections": [
    { "from_m": 0, "to_m": 150, "density": { "start": 0, "end": 0 } },
    { "from_m": 150, "to_m": 300, "generation": false, "placements": [
      { "at_m": 180, "lane": 1, "kind": "obstacle", "id": "barrier_low" },
      { "at_m": 240, "lane": 0, "kind": "pickup", "id": "shield" }
    ] }
  ],
  "ending": { "id": "finish", "params": { "text": "CANAL STREET CLEARED" } }
}
```

| Field | Rule |
|---|---|
| `id`, `title`, `author` | id = file name; title and author 1 to 60 characters |
| `length_m` | whole number 100 to 10000 (300 to 5000 feels right); `null` = endless, which cannot have an ending |
| `seed` | optional whole number; the same seed always builds the same street |
| `character.id` | optional; a registered character (default `milkshake`) |
| `theme` | `id` of a registered theme; optional `sky` (hex) and `fog` (0 to 1) overrides |
| `rules` | optional; see the table below |
| `obstacles` | `{ id: weight }` from registered obstacles; weights above 0 |
| `density` | `start` and `end` from 0 to 1: how busy the street is at each end (0 is allowed) |
| `jugs` | `per_100m` 0 to 30; `powerups`: registered pickups that have an `effect` |
| `curve` | optional, level or section: `{ "turn": -1..1, "hill": -1..1 }` (positive turn bends to the right, negative hill is a dip) or `"random"` (a new pick every 240 m). A turn or hill is anchored to its section: the road runs straight to the section's start line, bends beyond it, and is straight again at its end line; nothing bends inside 20 m of Milkshake; a finite level's last 120 m are straight; at most four bending stretches are drawn inside 200 m. A section `curve` replaces the level's whole curve (write both fields to keep a level-wide turn through a section's hill), unlike `camera`, which merges field by field |
| `camera` | optional, level or section: `height` 1.5–8 m, `distance` 3–12 m, `fov` 45–100; sections inherit the level's values and ease over half a second |
| `props` | optional, level or section: `{ "per_100m": 0–5, "ids": { "overpass": 1 } }` from registered props, placed on a grid and never overlapping |
| `sections` | optional, ordered, non-overlapping; each may override `obstacles`, `density`, `jugs`, `theme`, `curve`, `camera`, `props`, turn `generation` off, and list `placements`. The street is built in 120 m chunks, so a section `theme` switches at the next multiple of 120 m: start and end theme changes on those boundaries |
| `placements` | `{ at_m, lane (0-2), kind (obstacle, pickup or prop), id }` inside the section; a prop has no lane and must fit inside the level; a row may not block all three lanes with nothing to jump or slide |
| `ending` | optional; `id` of a registered ending plus its `params` |

Unknown keys anywhere are rejected, so a typo fails loudly instead of silently doing nothing.

Rules you can set (defaults in brackets): `laneWidth` 1.5–4 (2.5) · `laneTime` 0.05–0.5 (0.15) · `gravity` -60 to -10 (-30) · `jumpSpeed` 5–15 (9) · `fastFall` -40 to -5 (-15) · `slideTime` 0.3–2 (0.6) · `slideHeight` 0.4–1.5 (0.8) · `grace` 0–3 (1) · `speed.start` / `speed.end` 4–40 (12 / 24) · `speed.cap` 4–60 (30) · `speed.ramp` 0–0.05 (0.006) · `reaction` 0.2–1.5 (0.6). Fairness is checked against **your** rules: if you weaken the jump, barriers stop counting as jumpable. Rows are generated at least speed × reaction metres apart and two placed rows closer than that fail validation at the speed the file ramps to (a speed carried in from a previous level can be higher: leave room).

## 2. Add content

Content is a one-file ES module with a default export. Pick a handle (your GitHub name is good) and save the file at
`content/<kind>s/<handle>/<name>.js` with `id: "<handle>/<name>"`. The registry rejects a wrong path, a duplicate id or missing fields, and tells you exactly what is wrong.

Modules receive `gfx` when they draw: `gfx.box(w, h, d, color, x, y, z)`, `gfx.cyl`, `gfx.sphere`, `gfx.capsule`, `gfx.cone`, `gfx.roundedBox`, `gfx.group(...)`, `gfx.blobShadow(r)`, `gfx.glow(r, color)`, `gfx.sprite`, `gfx.textTexture`, `gfx.palette` (the game's colours) and `gfx.three` if you need Three.js itself. Do not import `three` at the top of your file; tests import your module in Node. The world bends in the distance (a level's `curve`); build long pieces with `gfx.box`, which subdivides along z, because raw geometry longer than about 6 m stays a straight chord. Materials from these helpers bend by themselves, and the engine runs `gfx.bend(object)` over everything `createView` and `createChunk` return, so a material you build from `gfx.three` bends too. Anything you add later, in `update()`, is yours to pass through `gfx.bend`; it keeps a material's own `onBeforeCompile` and runs it before the bend.

Complete, working examples live in `test/fixtures/content/` (a boulder, a 3× pickup, an arch prop, a forest theme that replaces the street, a robot character, a banner ending) and `test/fixtures/levels/`. Run `npm run dev` and open `http://localhost:5173/milkshake-runner/?fixtures` to play them.

### Obstacle

```js
// content/obstacles/ari/boulder.js
export default {
  kind: 'obstacle', id: 'ari/boulder',
  avoid: 'lane',                        // lane | jump | slide | timing: how the player gets past it
  box: { w: 1.8, h: 1.6, d: 1.8 },      // collision box in metres; add y for something you slide under
  // cycle: { period: 1.5, on: 0.5 },   // timing obstacles only: hurts for `on` seconds every `period`
  // moves: true,                       // swerves one lane when the player gets close
  createView(gfx, o) {
    return { object: gfx.sphere(0.9, '#7d7a72', 0, 0.8) };   // optional: update(o, run, dt, active), dispose()
  },
};
```
Jumpable means `box.h` fits under the level's jump height (1.35 m by default); slidable means `box.y` is at or above the slide height (0.8 m).

### Pickup

```js
// content/pickups/ari/triple.js
export default {
  kind: 'pickup', id: 'ari/triple', color: '#2fd67b',
  name: 'TRIPLE', blurb: 'Every jug counts triple for 6 s', // shown when collected and on HOW TO PLAY (name 1-24, blurb 1-80 characters)
  duration: 6,                          // seconds, or 'untilHit', or leave out for an instant pickup
  effect: { multiplier: 3 },            // the engine knows reach (metres), multiplier and shield
  label: '3×',                          // or glyph: '<28x28 SVG path>' (+ stroke: true for an outline glyph)
  // value: 5,                          // instant pickups add jugs
};
```
Pickups without `createView` get the standard glowing orb with your glyph or label.

### Prop

```js
// content/props/ari/arch.js
export default {
  kind: 'prop', id: 'ari/arch', length: 2,   // metres of street it occupies (1-100); the engine places it at the road's centre
  createView(gfx, { z, length, lanes }) {    // lanes: { count, width, roadHalf }
    const x = lanes.roadHalf + 0.5;
    return { object: gfx.group(gfx.box(0.6, 6, 0.6, '#3f8a4c', -x, 3, 1), gfx.box(0.6, 6, 0.6, '#3f8a4c', x, 3, 1)) }; // optional update(p, run, dt), dispose()
  },
};
```
Props never collide. Levels place them by weight (`props`) or at an exact metre (`placements` with `kind: "prop"`).

### Theme

```js
// content/themes/ari/forest.js
export default {
  kind: 'theme', id: 'ari/forest', sky: '#bfe3c6', fog: 0.5,
  buildings: { colors: ['#2f6b3a', '#3f8a4c'], minH: 6, maxH: 14 },   // used by the default street
  // createChunk(gfx, { z0, length, lanes, rng, theme }) { ... return an Object3D }  // replace the street entirely
};
```

### Character

```js
// content/characters/ari/robot.js
export default {
  kind: 'character', id: 'ari/robot', height: 2.0, width: 0.9, model: null,   // or model: 'robot.glb' in public/
  async createView(gfx) {
    const object = gfx.group(gfx.box(0.7, 2.0, 0.5, '#9aa3ad', 0, 1.0));
    return {
      object,
      update(run) { object.position.set(run.x, run.y, run.z); },   // called every frame
      pose(time, { sliding, over, lean, airborne, speed }) {},      // called during endings; speed is the run's m/s
      dispose() { gfx.dispose(object); },
    };
  },
};
```

### Ending

```js
// content/endings/ari/banner.js
export default {
  kind: 'ending', id: 'ari/banner',
  params: { text: { type: 'string', max: 40, default: 'YOU MADE IT' } },   // types: string, number, level
  // streetAfter: 0,   // metres of street past the finish line (default 200)
  async run({ engine, character, hud, params, gfx, level }) {
    await hud.banner(params.text, 2000);
    return {};        // or { next: 'another-level-id', carry: true } to chain into another level
  },
};
```

## What you may change

- Your own files under `levels/` and `content/<kind>s/<your-handle>/`.
- Not `src/`, not the shipped modules, not `levels/index.json` or `levels/campaign.json`. If your idea needs an engine change, open an issue first.
- Level files are data; your text renders as text. Content modules are code and are reviewed as code before they merge.

Please keep it friendly: no real people, brands, team names or logos.
