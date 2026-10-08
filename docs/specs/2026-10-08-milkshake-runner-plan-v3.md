---
provenance: human-approved
last-verified: 2026-10-08
---

# Milkshake Runner v3 (playtest response) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Point-in-time snapshot. Written 2026-10-08 by Fable from the approved v3 spec and Paper boards 08–12, against the
> v1 code on branch `feat/v3-feedback` (commit 2babdcf, 56 passing tests). Every number here is a starting value for
> the manual pass. Patterns may have moved on since: read the current `src/` before treating a line as how it is.

**Goal:** Answer the five playtest items (running, felt speed, turns/dips/props/camera, power-up help and the magnet, the seam flicker) as engine capabilities that level data and content modules select, without any `content/`, `levels/` or `test/fixtures/` file ever needing a `src/` edit.

**Architecture:** The street stays a straight +z line for everything that plays (collision, lanes, generator); the picture bends in a vertex-shader patch that every engine-issued material carries, driven by one shared uniform that `world.js` eases toward the active section's `curve`. Camera, props, speed carry, the reaction floor and pickup metadata are data on levels, sections and modules, validated by the same `validate.js`/`registry.js` code the browser and CI run. A new content kind `prop` streams like an obstacle without collision.

**Tech Stack:** plain JavaScript ES modules, three.js ^0.186.1, Vite ^8, `node --test`. No new dependencies.

**Spec:** `docs/specs/2026-10-08-milkshake-runner-design-v3.md` (approved 2026-10-08). Boards: Paper file `01M46QWM611CXK4WQSBTH6FJK3`, boards 08–12.

**Execution:** Caedon chose inline execution: superpowers:executing-plans with test-driven development, one ledger (`docs/specs/2026-10-08-v3-ledger.md`, created in Task 1), deviations recorded there as `Ruling:` lines.

## Global Constraints

- Branch `feat/v3-feedback` (local). Never `git push`, open a PR, spend Higgsfield credits or download an asset without asking Caedon in chat first. Never merge.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- `test/fixtures.test.js` is the acceptance test: the fixtures pack must register and validate with no edit under `src/`, and `src/` never names a content id other than `jug`, `milkshake` and `finish`. Every new shipped id joins that test's list.
- Unknown keys anywhere in a level file are errors. Every validator rule has a failing test.
- Content modules import in Node: no DOM and no `three` import at module scope; rendering only inside `createView`/`run` via `gfx`.
- Community strings reach the DOM through `textContent` only.
- Calibration knobs (bend strengths, dead zone, ease distances, speed numbers, pull speeds) are named constants with a comment; tuned in Task 12, never buried.
- `npm test` green and `npm run build` green before every commit.

## Review Focus

1. A community theme's `createChunk` that builds a road longer than about 6 m from raw `gfx.three.BoxGeometry` (not `gfx.box`) renders as a straight chord between its two end vertices while the dashes and blocks around it bend. Expected: documented in CONTRIBUTING with the fix (`gfx.box`, or subdivide along z). Test added to Task 8: `gfx.box` subdivides by depth.
2. Level 2 is validated at the speed its own file ramps to, but with carry it is played faster, so a placed row pair that passes validation can sit under the reaction floor at the carried speed. Expected: generated rows still respect the floor at the carried speed (Task 3 test with `speedFrom`), placed rows are the author's call; CONTRIBUTING says so (Task 11).
3. A `prop` placement near a finite level's end must not run into the plaza. Expected: `at_m + length` past `length_m` is rejected. Test in Task 10.
4. `curve: "random"` on a finite level must still straighten for the ending. Expected: the finish fade applies to random targets too. Test in Task 8.
5. A toast fired just before the finish must not hide the ending's card. Expected: `hud.show(false)` clears the toast timer. Test is manual (Task 12, item 7); the code path is one line in Task 7.

---

### Task 1: FB-5, buildings never cross a chunk seam

**Files:**
- Create: `docs/specs/2026-10-08-v3-ledger.md`
- Modify: `src/world.js:17-22` (`defaultChunk` building loop)
- Test: `test/world.test.js`

**Interfaces:**
- Consumes: `defaultChunk(g, { z0, length, lanes, rng, theme })` (exported already).
- Produces: nothing new; the chunk's building boxes stay inside `[z0, z0 + length]`.

- [ ] **Step 1: Capture the "before" screenshot.** Start Vite in the background (`npm run dev -- --port 5173 --strictPort`), open the pane with `preview_start({ url: "http://localhost:5173/milkshake-runner/" })`, inject the timer shim via `javascript_tool`:

```js
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout;
```

Click RUN (`document.getElementById('play').click()`), wait two seconds, pause with `Escape`, then teleport to just before the first seam and re-render:

```js
const m = window.__milkshake; m.run.z = 112; m.world.update(m.run, 0); m.engine.follow(m.run); m.engine.render();
```

Take a `computer` screenshot, then set `m.run.z = 112.3`, re-run the three calls and screenshot again. Save both to the scratchpad as `fb5-before-1.png`, `fb5-before-2.png`. If the still frames do not show the flicker, note it in the ledger; the test below is the proof.

- [ ] **Step 2: Create the ledger**

```markdown
---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner v3 build ledger (started 2026-10-08)

Point-in-time log of the v3 build from `2026-10-08-milkshake-runner-plan-v3.md`: one line per task as it lands,
deviations from the plan as `Ruling:` lines. Patterns may have moved on since; the code is the truth.

| Task | State | Commit | Notes |
|---|---|---|---|
| 1 FB-5 seam clamp | in progress | | before screenshots: scratchpad `fb5-before-*.png` |

## Rulings
```

- [ ] **Step 3: Write the failing test** (append to `test/world.test.js`)

```js
import * as gfx from '../src/gfx.js';
import { defaultChunk } from '../src/world.js';
import { rng } from '../src/generator.js';

test('no building in a default chunk crosses the chunk seam', () => {
  const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
  const buildings = { colors: ['#a3714f', '#8a8f9c'], minH: 18, maxH: 70 };
  for (let seed = 1; seed <= 50; seed++) {
    const r = rng(seed);
    for (const z0 of [0, 120, 240]) {
      const g = defaultChunk(gfx, { z0, length: 120, lanes, rng: r, theme: { buildings } });
      for (const m of g.children) {
        const { height, depth } = m.geometry.parameters;
        if (height < 1) continue; // road, sidewalks and lane dashes
        assert.ok(m.position.z - depth / 2 >= z0 - 1e-9 && m.position.z + depth / 2 <= z0 + 120 + 1e-9, `seed ${seed}: building at ${m.position.z} ± ${depth / 2} leaves chunk ${z0}`);
      }
    }
  }
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `node --test test/world.test.js`
Expected: FAIL, "building at … leaves chunk …" (95% of seams overlap).

- [ ] **Step 5: Clamp the last building** (`src/world.js`, the building loop in `defaultChunk`)

```js
  const b = theme.buildings;
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    // The last block stops at the chunk end: a block running past the seam overlapped the next chunk's first block and the
    // shared faces z-fought as the camera moved (the "brown band" flicker). A remainder under 3 m is left empty.
    const depth = Math.min(8 + r() * 6, z0 + length - z), h = b.minH + r() * (b.maxH - b.minH);
    if (depth < 3) break;
    grp.add(g.box(10, h, depth - 0.5, b.colors[Math.floor(r() * b.colors.length)], side * (ROAD_HALF + 8), h / 2, z + depth / 2));
    z += depth;
  }
```

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: 57 pass.

- [ ] **Step 7: "After" screenshots.** Reload the pane (the dev server hot-reloads), repeat Step 1's teleport and screenshots as `fb5-after-1.png`, `fb5-after-2.png`. Send all four with `SendUserFile` (caption: "FB-5 seam, before and after the clamp"). Update the ledger row to `done`.

- [ ] **Step 8: Commit**

```bash
git add src/world.js test/world.test.js docs/specs/2026-10-08-v3-ledger.md
git commit -m "fix: buildings stop at the chunk seam, ending the brown-band z-fight (FB-5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Speed as a rule you can read, carried across levels

**Files:**
- Modify: `src/rules.js:6-13` (defaults and ranges), `src/rules.js:23-34` (`speedAt`, `createRun`), `src/rules.js:45-49` (`step`)
- Modify: `src/game.js:6-15` (carry in), `src/game.js:27` (speedAt with `run.speedFrom`)
- Modify: `src/main.js:85-112` (`startLevel` carry object)
- Test: `test/logic.test.js`, `test/validate.test.js`

**Interfaces:**
- Produces: `DEFAULT_RULES.speed = { start: 12, end: 24, cap: 30, ramp: 0.006 }`, `DEFAULT_RULES.reaction = 0.6`, `RULE_RANGES.reaction = [0.2, 1.5]`; `speedAt(level, z, rules, from = rules.speed.start) → m/s`; `createRun(rules, character, jugs = 0, speedFrom = rules.speed.start) → run` with `run.speed` and `run.speedFrom`; `step(run, rawDt, speed)` sets `run.speed = speed`; `playLevel({ …, carryJugs = 0, carrySpeed })`; `startLevel(id, carry = {})` where `carry = { jugs, speed }`.

- [ ] **Step 1: Write the failing tests.** In `test/logic.test.js`, replace the test `speed rises across a level and caps in endless` with, and add `RULE_RANGES` to the import from `../src/rules.js`:

```js
test('speed rises across a level, carries on from a previous level and caps', () => {
  assert.equal(speedAt({ length_m: 1000 }, 0, R), 12);
  assert.equal(speedAt({ length_m: 1000 }, 1000, R), 24);
  assert.equal(speedAt({ length_m: null }, 1e6, R), 30);
  assert.equal(speedAt({ length_m: 1000 }, 500, resolveRules({ speed: { start: 10, end: 30 } })), 20);
  assert.equal(speedAt({ length_m: 1000 }, 0, R, 24), 24, 'a carried speed is the new start');
  assert.equal(speedAt({ length_m: 1000 }, 1000, R, 24), 30, 'the ramp continues by the same amount, capped');
});

test('a run remembers its speed and where it started', () => {
  const run = createRun(R, COW, 0, 24);
  assert.equal(run.speedFrom, 24);
  assert.equal(run.speed, 24, 'before the first step the speed is the start speed');
  step(run, 1 / 60, 25);
  assert.equal(run.speed, 25);
  assert.equal(createRun(R, COW).speedFrom, 12);
});

test('reaction is a rule with a range', () => {
  assert.equal(R.reaction, 0.6);
  assert.deepEqual(RULE_RANGES.reaction, [0.2, 1.5]);
});
```

In `test/validate.test.js`, add to the test `rules are known and in range`:

```js
  assert.match(errs({ rules: { reaction: 2 } }), /reaction must be 0.2 to 1.5/);
  assert.equal(errs({ rules: { reaction: 0.4 } }), '');
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/logic.test.js test/validate.test.js`
Expected: FAIL (speedAt returns 20, `speedFrom` undefined, `R.reaction` undefined, no reaction range).

- [ ] **Step 3: Implement in `src/rules.js`**

```js
export const DEFAULT_RULES = {
  laneWidth: 2.5, laneTime: 0.15, gravity: -30, jumpSpeed: 9, fastFall: -15, slideTime: 0.6, slideHeight: 0.8, grace: 1,
  reaction: 0.6,                                  // seconds: a row never comes closer than speed × reaction behind the previous one
  speed: { start: 12, end: 24, cap: 30, ramp: 0.006 },
};
export const RULE_RANGES = {
  laneWidth: [1.5, 4], laneTime: [0.05, 0.5], gravity: [-60, -10], jumpSpeed: [5, 15], fastFall: [-40, -5], slideTime: [0.3, 2], slideHeight: [0.4, 1.5], grace: [0, 3],
  reaction: [0.2, 1.5],
  speed: { start: [4, 40], end: [4, 40], cap: [4, 60], ramp: [0, 0.05] },
};

// `from` is the speed carried in from the previous level (default: the start speed): a finite level ramps on from there by
// the same amount its file asks for, so level 2 starts where level 1 finished. Everything is capped at speed.cap.
export function speedAt(level, z, rules, from = rules.speed.start) {
  const s = rules.speed;
  if (level.length_m === null) return Math.min(s.cap, from + z * s.ramp);
  return Math.min(s.cap, from + (s.end - s.start) * Math.min(1, z / level.length_m));
}

export function createRun(rules, character, jugs = 0, speedFrom = rules.speed.start) {
  return {
    rules, dims: { height: character.height, width: character.width },
    lane: 1, x: 0, y: 0, vy: 0, slideT: 0, z: 0, time: 0, jugs, effects: {}, graceT: 0, over: false,
    speed: speedFrom, speedFrom, // speed is what step() was last given; content reads it (stride, dust, streaks)
  };
}
```

and in `step()` add `run.speed = speed;` right after `run.time += dt;`.

- [ ] **Step 4: Wire the carry.** `src/game.js`:

```js
export function playLevel({ engine, level, registry, hud, character, carryJugs = 0, carrySpeed }) {
  return new Promise((resolve) => {
    const rules = resolveRules(level.rules ?? {});
    const charDef = registry.character[level.character?.id ?? 'milkshake'];
    const run = createRun(rules, charDef, carryJugs, carrySpeed);
```

and in `tick`: `const dt = step(run, rawDt, speedAt(level, run.z, rules, run.speedFrom));`

`src/main.js`, `startLevel`:

```js
  async function startLevel(id, carry = {}) {
    show(null);
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    const level = levels[id];
    const view = await character(level);
    let result;
    try {
      result = await playLevel({ engine, level, registry, hud, character: view, carryJugs: carry.jugs ?? 0, carrySpeed: carry.speed });
    } catch (error) {
      console.error(error);
      result = { outcome: 'error', run: { jugs: carry.jugs ?? 0 }, world: null, error };
    }
```

and the chain line: `if (flow.next && levels[flow.next] && valid(flow.next)) return startLevel(flow.next, flow.carry ? { jugs: run.jugs, speed: run.speed } : {});`

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: 59 pass (two new logic tests, one replaced; the validate test grew).

- [ ] **Step 6: Commit**

```bash
git add src/rules.js src/game.js src/main.js test/logic.test.js test/validate.test.js docs/specs/2026-10-08-v3-ledger.md
git commit -m "feat: steeper speed defaults, run.speed, speed carried through the transition, reaction rule (FB-2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Reaction floor in the generator and the validator

**Files:**
- Modify: `src/generator.js:1` (import), `src/generator.js:82-111` (`generate` signature and row loop)
- Modify: `src/world.js:26-41` (generator state), `src/game.js:12-15` (pass `speedFrom`)
- Modify: `src/validate.js:1-2` (import `speedAt`), `src/validate.js:73-113` (`checkSections`)
- Test: `test/logic.test.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: `speedAt(level, z, rules, from)` from Task 2.
- Produces: `generate(norm, r, fromZ, toZ, registry, rules, state = { lastRow: -Infinity, speedFrom: rules.speed.start })` where `state` persists across chunks; `createWorld(scene, level, { registry, rules, seed, end, speedFrom })`.

- [ ] **Step 1: Write the failing generator tests** (append to the generator part of `test/logic.test.js`)

```js
test('at speed, generated rows keep a reaction gap, after generated and placed rows alike', () => {
  const fast = resolveRules({ speed: { start: 30, end: 30 } }); // floor 18 m on a 12 m grid: never two rows in a row
  for (const s of seeds.slice(0, 50)) {
    const zs = [...rowsOf(all(lvl({ density: { start: 1, end: 1 } }), s, fast).obstacles).keys()].sort((a, b) => a - b);
    for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= 18, `seed ${s}: rows at ${zs[i - 1]} and ${zs[i]}`);
  }
  const slow = resolveRules({ speed: { start: 12, end: 12 } }); // floor 7.2 m: every grid row is allowed
  const zs = [...rowsOf(all(lvl({ density: { start: 1, end: 1 } }), 3, slow).obstacles).keys()].sort((a, b) => a - b);
  assert.ok(zs.some((z, i) => i && z - zs[i - 1] === ROW_GAP), 'at 12 m/s consecutive rows still happen');
  const placed = lvl({ density: { start: 1, end: 1 }, sections: [{ from_m: 100, to_m: 400, placements: [{ at_m: 200, lane: 0, kind: 'obstacle', id: 'taxi' }] }] });
  for (const s of seeds.slice(0, 20)) for (const o of all(placed, s, fast).obstacles.filter((o) => !o.placed)) assert.ok(o.z <= 200 || o.z - 200 >= 18, `seed ${s}: generated row at ${o.z} right after the placement at 200`);
});

test('the floor remembers the last row across chunks and rises with a carried speed', () => {
  const fast = resolveRules({ speed: { start: 30, end: 30 } });
  const norm = normalizeLevel(lvl({ length_m: null, density: { start: 1, end: 1 } }));
  const r = rng(5), state = { lastRow: -Infinity, speedFrom: 30 };
  const zs = [...generate(norm, r, 0, 120, registry, fast, state).obstacles, ...generate(norm, r, 120, 240, registry, fast, state).obstacles].map((o) => o.z);
  const rows = [...new Set(zs)].sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i] - rows[i - 1] >= 18, `rows at ${rows[i - 1]} and ${rows[i]} straddle the chunk seam`);
  const carried = { lastRow: -Infinity, speedFrom: 24 }; // default rules ramp 12→24 but the run arrived at 24: floor 14.4 m from the first metre
  const c = [...new Set(generate(normalizeLevel(lvl({ density: { start: 1, end: 1 } })), rng(5), 0, 1500, registry, R, carried).obstacles.map((o) => o.z))].sort((a, b) => a - b);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 24, `carried speed: rows at ${c[i - 1]} and ${c[i]}`);
});
```

- [ ] **Step 2: Write the failing validator test** (append to `test/validate.test.js`)

```js
test('placed obstacle rows closer than the reaction floor are rejected', () => {
  const two = (gap, rules = { speed: { start: 30, end: 30 } }) => errs({ rules, sections: [{ from_m: 0, to_m: 600, placements: [
    { at_m: 100, lane: 0, kind: 'obstacle', id: 'taxi' }, { at_m: 100 + gap, lane: 1, kind: 'obstacle', id: 'taxi' }] }] });
  assert.match(two(12), /reaction floor/);
  assert.equal(two(24), '');
  assert.equal(two(3), '', 'placements within half a row are one row, checked by the wall rule instead');
  assert.equal(two(12, { speed: { start: 30, end: 30 }, reaction: 0.3 }), '', 'a lower reaction rule allows it');
});
```

- [ ] **Step 3: Run to see them fail**

Run: `node --test test/logic.test.js test/validate.test.js`
Expected: FAIL (rows 12 m apart at 30 m/s; no "reaction floor" message).

- [ ] **Step 4: Implement the generator floor** (`src/generator.js`)

Change the import to `import { jumpHeight, speedAt } from './rules.js';` and the top of `generate` to:

```js
// Obstacles, pickups (and later props) for z in [fromZ, toZ). Call with consecutive ranges on one rng and one `state`:
// state.lastRow remembers the previous generated row across chunks, state.speedFrom is the speed carried into the level.
export function generate(norm, r, fromZ, toZ, registry, rules, state = { lastRow: -Infinity, speedFrom: rules.speed.start }) {
  const obstacles = [], pickups = [];
  const lastRow = norm.length == null ? Infinity : norm.length - END_CLEAR;
  const firstRow = Math.ceil(Math.max(fromZ, START_CLEAR) / ROW_GAP) * ROW_GAP;
  const level = { length_m: norm.length ?? null };
  const placedRows = norm.sections.flatMap((s) => s.placements.filter((p) => p.kind === 'obstacle').map((p) => p.at_m));

  for (let z = firstRow; z < Math.min(toZ, lastRow); z += ROW_GAP) {
    const s = sectionAt(norm, z);
    if (!s.generation || s.placements.some((p) => p.kind === 'obstacle' && Math.abs(p.at_m - z) < ROW_GAP)) continue; // placements own their row
    // Reaction floor: at speed v a row never comes closer than v × reaction metres after the previous row, generated or placed.
    const prev = Math.max(state.lastRow, ...placedRows.filter((a) => a < z));
    if (z - prev < speedAt(level, z, rules, state.speedFrom) * rules.reaction) continue;
    if (r() >= densityAt(s, z)) continue;
```

and at the end of the row's `lanes.forEach(...)` block add `state.lastRow = z;` (after the forEach, inside the for loop).

- [ ] **Step 5: Thread the state through the world** (`src/world.js`)

```js
export function createWorld(scene, level, { registry, rules, seed, end, speedFrom = rules.speed.start }) {
  const norm = normalizeLevel(level);
  const r = rng(seed), rs = rng(seed ^ 0x9e3779b9); // scenery has its own rng so it never shifts the street
  const gen = { lastRow: -Infinity, speedFrom };     // the generator's memory across chunks
```

and in `build()`: `const { obstacles, pickups } = generate(norm, r, builtTo, builtTo + length, registry, rules, gen);`

`src/game.js`: `createWorld(engine.scene, level, { registry, rules, seed: …, end: …, speedFrom: run.speedFrom })`.

- [ ] **Step 6: Implement the validator rule** (`src/validate.js`)

Import: `import { RULE_RANGES, resolveRules, speedAt } from './rules.js';`. In `checkSections`, declare `const allRows = [];` before `sections.forEach`, push inside the placement loop where obstacles are collected:

```js
      if (p.kind === 'obstacle') { placed.push({ at: p.at_m, lane: p.lane, def }); allRows.push(p.at_m); }
```

and after the `sections.forEach(...)` call, still inside `checkSections`:

```js
  // Placed obstacle rows closer than the reaction floor at that point of the level fail: the author lowers rules.reaction or
  // spreads them out. Validation uses the level's own ramp; a speed carried in from a previous level is not known here.
  const rows = [...new Set(allRows)].sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i] - rows[i - 1];
    if (gap <= ROW_GAP / 2) continue; // one row, the wall rule covers it
    const floor = speedAt(level, rows[i], rules) * rules.reaction;
    if (gap < floor) e.push(`placements at ${rows[i - 1]} m and ${rows[i]} m are ${gap} m apart, under the reaction floor of ${floor.toFixed(1)} m at that speed`);
  }
```

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: 62 pass.

- [ ] **Step 8: Commit**

```bash
git add src/generator.js src/world.js src/game.js src/validate.js test/logic.test.js test/validate.test.js
git commit -m "feat: reaction floor keeps rows fair at speed, in the generator and the validator (FB-2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Engine cues, a pure camera, eased overrides, streaks

**Files:**
- Modify: `src/engine.js` (whole file)
- Modify: `src/game.js:37-41` (follow with dt), `src/game.js:54-62` (`end` resets the camera)
- Test: `test/logic.test.js`

**Interfaces:**
- Produces: `cameraFor(run, cam = {}, speed = 0) → { x, y, z, lookX, lookY, lookZ, fov }`; `CAMERA = { height: 3.6, distance: 6.5, fov: 60 }`; `engine.follow(run, cam = {}, dt = 1 / 60)`; `FOV_PER_MS = 0.6`, `SPEED_BASE = 12`.
- Task 9 passes a section's `cam`; until then callers pass nothing.

- [ ] **Step 1: Write the failing test** (append to `test/logic.test.js`; add `import { cameraFor } from '../src/engine.js';` at the top)

```js
test('the chase camera sits where it always did, takes a section override and widens with speed', () => {
  const run = { x: 0, y: 0, z: 100 };
  const c = cameraFor(run);
  assert.deepEqual([c.x, c.y, c.z, c.lookX, c.lookY, c.lookZ, c.fov], [0, 3.6, 93.5, 0, 1.2, 112, 60]);
  assert.equal(cameraFor(run, {}, 12).fov, 60, 'no widening up to the base speed');
  assert.ok(Math.abs(cameraFor(run, {}, 24).fov - 67.2) < 1e-9, '0.6° per m/s over 12');
  const low = cameraFor(run, { height: 2.2, distance: 5, fov: 65 }, 0);
  assert.deepEqual([low.y, low.z, low.fov], [2.2, 95, 65]);
  const lane0 = cameraFor({ x: 2.5, y: 1, z: 0 });
  assert.deepEqual([lane0.x, lane0.y, lane0.lookX], [1.5, 3.9, 2]);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/logic.test.js`
Expected: FAIL, "cameraFor is not exported".

- [ ] **Step 3: Rewrite `src/engine.js`**

```js
import * as THREE from 'three';

export const CAMERA = { height: 3.6, distance: 6.5, fov: 60 }; // the chase camera; a section may override within the validator's ranges
export const SPEED_BASE = 12;    // m/s below which the view does not widen
export const FOV_PER_MS = 0.6;   // degrees of extra field of view per m/s over SPEED_BASE
const CAMERA_EASE = 0.2;         // seconds; overrides are 92% of the way in half a second
const STREAKS = 14, STREAK_FROM = 16, STREAK_FULL = 30; // streaks fade in between these speeds (m/s)

// Where the chase camera sits for a run. Pure, so it is testable: `cam` is a section's override, `speed` widens the view.
export function cameraFor(run, cam = {}, speed = 0) {
  const height = cam.height ?? CAMERA.height, distance = cam.distance ?? CAMERA.distance;
  return {
    x: run.x * 0.6, y: height + run.y * 0.3, z: run.z - distance,
    lookX: run.x * 0.8, lookY: 1.2, lookZ: run.z + 12,
    fov: (cam.fov ?? CAMERA.fov) + Math.max(0, speed - SPEED_BASE) * FOV_PER_MS,
  };
}

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  // Sun from above, behind the camera and a little to the right, so faces toward the camera are lit
  // and side faces take the one shade tone the style sheet shows.
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#55556a', 1.2));

  // Speed streaks: thin bars parented to the camera, above and beside the lanes, fading in with speed.
  const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const streaks = new THREE.Group();
  for (let i = 0; i < STREAKS; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.5 + Math.random() * 2), streakMat);
    const side = i % 2 ? 1 : -1, x = side * (1.5 + Math.random() * 2.5), y = i % 3 ? 0.5 + Math.random() * 2 : 2 + Math.random() * 1.5;
    m.position.set(x, y, -4 - Math.random() * 14);
    streaks.add(m);
  }
  camera.add(streaks);
  scene.add(camera);

  const live = { ...CAMERA }; // the eased camera values
  let portrait = false;
  const render = () => renderer.render(scene, camera);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    portrait = w < h; // portrait needs a wider view to see all 3 lanes
    camera.fov = live.fov + (portrait ? 15 : 0);
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer, render,
    setSky(theme) {
      const sky = new THREE.Color(theme.sky);
      scene.background = sky;
      const far = 260 - theme.fog * 160;
      scene.fog = new THREE.Fog(sky, far * 0.3, far);
    },
    // `cam` is the active section's override ({ height?, distance?, fov? }); dt eases toward it. Pass dt = Infinity to snap.
    follow(run, cam = {}, dt = 1 / 60) {
      const a = 1 - Math.exp(-dt / CAMERA_EASE);
      for (const k of ['height', 'distance', 'fov']) live[k] += ((cam[k] ?? CAMERA[k]) - live[k]) * a;
      const speed = run.speed ?? 0;
      const c = cameraFor(run, live, speed);
      camera.position.set(c.x, c.y, c.z);
      camera.lookAt(c.lookX, c.lookY, c.lookZ);
      const fov = c.fov + (portrait ? 15 : 0);
      if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      sun.position.set(run.x - 6, 16, run.z - 12);
      sun.target.position.set(run.x, 0, run.z);
      streakMat.opacity = Math.max(0, Math.min(0.6, ((speed - STREAK_FROM) / (STREAK_FULL - STREAK_FROM)) * 0.6));
      if (streakMat.opacity > 0 && Number.isFinite(dt)) for (const s of streaks.children) { s.position.z += speed * dt * 2; if (s.position.z > -2) s.position.z = -18 - Math.random() * 4; }
    },
  };
}
```

- [ ] **Step 4: Pass dt and reset at the end** (`src/game.js`)

In `tick`: `engine.follow(run, {}, dt);` (Task 9 replaces `{}` with the section's camera). In `end(outcome, error)`, before `hud.show(false)`:

```js
      engine.follow({ ...run, speed: 0 }, {}, Infinity); // defaults and no streaks before an ending runs
```

- [ ] **Step 5: Run the suite and build**

Run: `npm test && npm run build`
Expected: 63 pass, build green.

- [ ] **Step 6: Look at it.** Dev server + pane (Task 1's shim). Play level 1 for ten seconds with the pane open, or teleport with `__milkshake.run.z = 1400` and step a few frames (`m.run.speed` is set by the loop). Expect: wider view and faint white streaks at the edges near the end of the level. Screenshot `speed-streaks.png` for the manual pass folder.

- [ ] **Step 7: Commit**

```bash
git add src/engine.js src/game.js test/logic.test.js
git commit -m "feat: pure chase camera with eased overrides, field of view and streaks that follow speed (FB-2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Milkshake runs: stride, lean and dust from `run.speed`

**Files:**
- Modify: `content/characters/milkshake.js:25-44` (`pose`, `update`, `dispose`)
- Create: `test/content.test.js`

**Interfaces:**
- Consumes: `run.speed` (Task 2), `gfx` helpers, `gfx.three`.
- Produces: `pose(time, { sliding, over, lean, airborne, speed })` returns the stride value; `update(run)` spawns dust. The contract for community characters is unchanged (`speed` is a new optional field in the pose bag).

- [ ] **Step 1: Write the failing test** (`test/content.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import milkshake from '../content/characters/milkshake.js';
import { createRun, resolveRules, step } from '../src/rules.js';

// In Node there is no GLB loader, so createView falls back to the shape-built cow; the motion code is the same for both.
test('Milkshake leans and strides harder with speed, and kicks up dust on the ground', async () => {
  const view = await milkshake.createView(gfx);
  const body = view.object.children[1];
  const run = createRun(resolveRules(), milkshake);
  run.time = 0.3;
  view.update(run);
  assert.equal(body.rotation.x, 0, 'no lean at the base pace');
  run.speed = 24;
  view.update(run);
  assert.ok(body.rotation.x > 0.05, 'leans forward at double pace');
  const puffs = view.object.children.find((c) => c.children.length === 6);
  assert.ok(puffs, 'six dust puffs are pooled');
  let frames = 0;
  for (let i = 0; i < 60; i++) { step(run, 1 / 60, 24); view.update(run); frames += puffs.children.some((p) => p.visible); }
  assert.ok(frames > 0, 'puffs show while running on the ground');
  run.y = 1; // airborne: no new puffs, the old ones fade within 0.35 s
  for (let i = 0; i < 40; i++) { run.time += 1 / 60; view.update(run); }
  assert.ok(puffs.children.every((p) => !p.visible));
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/content.test.js`
Expected: FAIL (`body.rotation.x` is 0 at 24 m/s; no puff group).

- [ ] **Step 3: Implement** (`content/characters/milkshake.js`, replace from `body.add(model);` to the end of `createView`)

```js
    body.add(model);

    // Dust: six puffs pooled under the hooves, one per footfall while on the ground. They stay on the road as Milkshake runs on.
    const puffs = gfx.group();
    root.add(puffs);
    const pool = Array.from({ length: 6 }, () => {
      const m = new gfx.three.Mesh(new gfx.three.SphereGeometry(0.18, 8, 6), new gfx.three.MeshBasicMaterial({ color: P.spot, transparent: true, opacity: 0.5, depthWrite: false }));
      m.visible = false; puffs.add(m); return m;
    });
    let lastStride = 0, nextPuff = 0;

    const BASE = 12; // m/s the v1 stride was tuned at
    const pose = (time, { sliding = false, over = false, lean = 0, airborne = false, speed = BASE } = {}) => {
      const k = speed / BASE;                                       // 1 at the old pace, 2 at 24 m/s
      const stride = airborne || sliding || over ? 0 : Math.sin(time * 14 * k);
      body.position.y = Math.abs(stride) * Math.min(0.14, 0.08 * k);
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.z = lean + stride * 0.03 * Math.max(0, k - 1);  // a little roll per stride once it is running hard
      body.rotation.x = over ? 0.9 : sliding ? -0.3 : Math.max(0, 0.1 * (k - 1)); // forward lean grows with speed
      legs.forEach((l, i) => (l.rotation.x = stride * 0.7 * (i ? 1 : -1)));
      arms.forEach((a, i) => (a.rotation.x = stride * 0.7 * (i ? -1 : 1)));
      return stride;
    };
    return {
      object: root,
      pose,
      update(run) {
        root.position.set(run.x, run.y, run.z);
        shadow.position.y = -run.y + 0.01; // the shadow stays on the road while Milkshake jumps
        const stride = pose(run.time, { sliding: run.slideT > 0, over: run.over, lean: ((1 - run.lane) * run.rules.laneWidth - run.x) * 0.12, airborne: run.y > 0, speed: run.speed ?? BASE });
        if (run.y === 0 && run.slideT === 0 && !run.over && stride !== 0 && Math.sign(stride) !== Math.sign(lastStride)) {
          const p = pool[nextPuff++ % pool.length];
          p.visible = true; p.userData.born = run.time; p.userData.z = run.z - 0.4;
          p.position.set(nextPuff % 2 ? 0.18 : -0.18, 0.1, 0);
        }
        lastStride = stride;
        for (const p of pool) if (p.visible) {
          const age = run.time - p.userData.born;
          if (age > 0.35) { p.visible = false; continue; }
          p.position.z = p.userData.z - run.z;
          p.scale.setScalar(0.6 + age * 3);
          p.material.opacity = 0.5 * (1 - age / 0.35);
        }
      },
      dispose() { pool.forEach((p) => p.material.dispose()); gfx.dispose(root); },
    };
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: 64 pass.

- [ ] **Step 5: Look at it.** Dev server, pane, play level 1 with the pane visible for a few seconds at the start and after a teleport to `run.z = 1300`. Expect: faster bob, a forward lean and grey puffs at the hooves late in the level. Screenshot `running-dust.png`.

- [ ] **Step 6: Commit**

```bash
git add content/characters/milkshake.js test/content.test.js
git commit -m "feat: Milkshake's stride, lean and dust follow run.speed (FB-1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The magnet pulls, then collects

**Files:**
- Modify: `src/rules.js:93-97` (`inReach`, new `pulled`, `pull`), `src/rules.js:2-4` (constants)
- Modify: `src/world.js:4` (import), `src/world.js:79-84` (pickup update)
- Test: `test/logic.test.js`, `test/world.test.js`

**Interfaces:**
- Produces: `pulled(run, p) → boolean` (inside reach, ahead), `pull(run, p, dt)` (moves `p.x`, `p.z` toward Milkshake), `inReach(run, p)` (collect within 0.8 m along and 1 m across, using `p.x` when set); `PULL_ACROSS = 12`, `PULL_ALONG = 2`.

- [ ] **Step 1: Write the failing tests.** In `test/logic.test.js`, add `pulled, pull` to the import from `../src/rules.js`, change in the test `effects: reach, multiplier, timers and expiry` the line `assert.equal(inReach(run, { z: 10, lane: 0 }), true);` to `assert.equal(pulled(run, { z: 10, lane: 0 }), true);`, and append:

```js
test('a magnet pulls a jug in over a few frames instead of collecting it 15 m out', () => {
  const run = createRun(R, COW);
  collect(run, MAGNET);
  const p = { id: 'jug', lane: 0, z: 10 };
  assert.equal(pulled(run, p), true);
  assert.equal(inReach(run, p), false, 'not collected the tick the pull starts');
  let frames = 0;
  while (!inReach(run, p) && frames < 120) { step(run, 1 / 60, 12); pull(run, p, 1 / 60); frames++; }
  assert.ok(frames > 2 && frames < 60, `pulled in over ${frames} frames`);
  assert.ok(Math.abs(p.x - run.x) < 1 && Math.abs(p.z - run.z) < 0.8);
  const far = { id: 'jug', lane: 2, z: run.z + 20 };
  assert.equal(pulled(run, far), false, 'beyond reach nothing moves');
  pull(run, far, 1 / 60);
  assert.equal(far.x, undefined);
  const none = createRun(R, COW);
  assert.equal(pulled(none, { lane: 1, z: 3 }), false, 'without a magnet nothing is pulled');
  assert.equal(inReach(none, { lane: 1, z: 0.5 }), true, 'but a jug in your lane is still picked up');
});
```

In `test/world.test.js` append:

```js
test('a pulled pickup moves its view toward Milkshake', () => {
  const jug = { kind: 'pickup', id: 'jug', color: '#ffffff', value: 1 };
  const registry = { obstacle: {}, pickup: { jug }, theme: { t: theme }, character: {}, ending: {} };
  const lvl = { ...level, obstacles: {}, density: { start: 0, end: 0 }, jugs: { per_100m: 20, powerups: [] } };
  const world = createWorld(new THREE.Scene(), lvl, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.effects.magnet = { t: 8, reach: 15 };
  world.update(run, 0);
  const p = world.live.pickups.find((p) => p.lane !== 1 && p.z - run.z > 2 && p.z - run.z < 15);
  const before = Math.abs(p.view.object.position.x);
  for (let i = 0; i < 5; i++) world.update(run, 1 / 60);
  assert.ok(Math.abs(p.view.object.position.x) < before, 'slides toward the centre lane');
  assert.equal(p.view.object.position.z, p.z, 'the view sits at the logical position');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/logic.test.js test/world.test.js`
Expected: FAIL (`pulled` not exported; the world test's pickup does not move).

- [ ] **Step 3: Implement in `src/rules.js`.** Constants after `BIKE_SPEED`:

```js
export const PULL_ACROSS = 12;       // m/s a pulled pickup slides sideways
export const PULL_ALONG = 2;         // times the run speed a pulled pickup comes back along the street
```

Replace `inReach` with:

```js
// A pickup inside the magnet's reach is pulled, not collected: it slides toward Milkshake over a few frames and inReach
// picks it up at arm's length. p.x is the pickup's logical x once a pull has moved it (lane centre until then).
export function pulled(run, p) { const dz = p.z - run.z, r = reach(run); return r > 0 && dz > -1 && dz < r; }
export function pull(run, p, dt) {
  if (!pulled(run, p)) return;
  const x = p.x ?? laneX(p.lane, run.rules), sx = PULL_ACROSS * dt, sz = PULL_ALONG * run.speed * dt;
  p.x = x + Math.max(-sx, Math.min(sx, run.x - x));
  p.z -= Math.min(sz, Math.max(0, p.z - run.z - 0.3));
}
export function inReach(run, p) {
  const dz = p.z - run.z, x = p.x ?? laneX(p.lane, run.rules);
  return Math.abs(dz) < 0.8 && Math.abs(x - run.x) < 1;
}
```

- [ ] **Step 4: Move the view with the pickup** (`src/world.js`). Import `pull` instead of `reach`: `import { laneX, obstacleBox, updateObstacle, pull } from './rules.js';` and replace the pickup loop in `update`:

```js
    for (const p of live.pickups) {
      p.view.object.rotation.y = run.time * 3;
      pull(run, p, dt);
      if (p.x !== undefined) p.view.object.position.set(p.x, 0, p.z);
      if (p.view.update) safeCall(`pickup ${p.id} update`, () => p.view.update(p, run, dt));
    }
```

(the old `const pull = reach(run);` line and the `position.x +=` line go.)

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: 66 pass.

- [ ] **Step 6: Commit**

```bash
git add src/rules.js src/world.js test/logic.test.js test/world.test.js
git commit -m "fix: the magnet pulls jugs in and collects them at arm's length (FB-4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Pickups explain themselves: name, blurb, toast, HOW TO PLAY

**Files:**
- Modify: `src/registry.js:22-42` (pickup checks), `src/hud.js` (`pickupName`, `toast`, `show`), `src/game.js:34` (toast on collect), `src/main.js` (help screen, first run), `src/save.js` (`helpSeen`), `src/style.css`, `index.html`
- Modify: `content/pickups/magnet.js`, `content/pickups/shield.js`, `content/pickups/x2.js`, `test/fixtures/content/pickups/demo/triple.js`
- Test: `test/registry.test.js`, `test/content.test.js`, `test/logic.test.js` (save shape)

**Interfaces:**
- Produces: pickup module fields `name?` (1–24 chars) and `blurb?` (1–80 chars); `pickupName(def)` in `hud.js`; `hud.toast(def)`; `save.helpSeen` boolean.

- [ ] **Step 1: Write the failing tests.** `test/registry.test.js`, add to `metadata is checked per kind`:

```js
  assert.match(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff', value: 1, name: 'x'.repeat(25) }).join(), /name must be 1-24/);
  assert.match(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff', value: 1, blurb: 'x'.repeat(81) }).join(), /blurb must be 1-80/);
  assert.equal(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff', value: 1, name: 'GEM', blurb: 'Worth five jugs' }).length, 0);
```

`test/content.test.js`, append (add `import { pickupName } from '../src/hud.js';` and `import magnet from '../content/pickups/magnet.js';`):

```js
test('a pickup is named by its module, or by its id in capitals', () => {
  assert.equal(pickupName({ id: 'ari/gem' }), 'GEM');
  assert.equal(pickupName(magnet), 'MAGNET');
  assert.ok(magnet.blurb.length <= 80);
});
```

`test/logic.test.js`: in the save tests, every expected `{ best: {}, completed: [] }` becomes `{ best: {}, completed: [], helpSeen: false }` (four places in `blocked storage never breaks the game`, one in `a storage getter that throws…`), and the round-trip expectation becomes `{ best: { a: 10 }, completed: ['a'], helpSeen: false }`. Add to the round-trip test before `writeSave`: `s.helpSeen = true;` and change the expectation to `helpSeen: true`.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/registry.test.js test/content.test.js test/logic.test.js`
Expected: FAIL (no name/blurb checks, `pickupName` missing, save shape).

- [ ] **Step 3: Registry checks** (`src/registry.js`, inside `pickup(m)` before `return e;`)

```js
    if (m.name !== undefined && !(typeof m.name === 'string' && m.name.length >= 1 && m.name.length <= 24)) e.push('name must be 1-24 characters');
    if (m.blurb !== undefined && !(typeof m.blurb === 'string' && m.blurb.length >= 1 && m.blurb.length <= 80)) e.push('blurb must be 1-80 characters');
```

- [ ] **Step 4: Shipped metadata**

```js
// content/pickups/magnet.js
export default {
  kind: 'pickup', id: 'magnet', name: 'MAGNET', blurb: 'Pulls in every jug ahead for 8 s', color: '#ff4fa3', duration: 8, effect: { reach: 15 },
  glyph: 'M9.2,8 V14.6 a4.8,4.8 0 0 0 9.6,0 V8', stroke: true,
};
// content/pickups/shield.js
export default {
  kind: 'pickup', id: 'shield', name: 'SHIELD', blurb: 'Takes one hit for you', color: '#4dc3ff', duration: 'untilHit', effect: { shield: true },
  glyph: 'M14,6.5 L20.5,8.9 V14.2 C20.5,18.2 18,21.2 14,22.8 C10,21.2 7.5,18.2 7.5,14.2 V8.9 Z',
};
// content/pickups/x2.js
export default {
  kind: 'pickup', id: 'x2', name: '2× JUGS', blurb: 'Every jug counts double for 10 s', color: '#8b5cf6', duration: 10, effect: { multiplier: 2 }, label: '2×',
};
// test/fixtures/content/pickups/demo/triple.js
export default { kind: 'pickup', id: 'demo/triple', name: '3× JUGS', blurb: 'Every jug counts triple for 6 s', color: '#2fd67b', duration: 6, effect: { multiplier: 3 }, label: '3×' };
```

- [ ] **Step 5: HUD** (`src/hud.js`). Add after `pickupIcon`:

```js
// A pickup's display name: the module's `name`, or the last part of its id in capitals.
export const pickupName = (def) => def.name ?? def.id.replace(/^.*\//, '').toUpperCase();
```

In `createHud()`, add `let toastT = 0;` next to `let paused = false;`, change `show` and add `toast`:

```js
    show(on) {
      $('hud').hidden = !on;
      if (!on) { chips.replaceChildren(); chips.dataset.key = ''; clearTimeout(toastT); $('card').hidden = true; $('card').replaceChildren(); }
    },
    // Two seconds of icon, name and blurb at the bottom of the screen; a new pickup replaces it. Community strings: textContent only.
    toast(def) {
      const c = $('card'), t = document.createElement('div'), words = document.createElement('div');
      t.className = 'toast';
      words.append(Object.assign(document.createElement('b'), { textContent: pickupName(def) }));
      if (def.blurb) words.append(Object.assign(document.createElement('small'), { textContent: def.blurb }));
      t.append(pickupIcon(def), words);
      c.replaceChildren(t); c.hidden = false;
      clearTimeout(toastT);
      toastT = setTimeout(() => { c.hidden = true; c.replaceChildren(); }, 2000);
    },
```

`src/game.js` collect line: `for (const p of [...world.live.pickups]) if (inReach(run, p)) { collect(run, p.def); if (p.def.effect) hud.toast(p.def); world.removePickup(p); }`

- [ ] **Step 6: Save flag** (`src/save.js`)

```js
const fresh = () => ({ best: {}, completed: [], helpSeen: false });
```

and in `loadSave`, after the `best` check: `if (typeof save.helpSeen !== 'boolean') save.helpSeen = false;`

- [ ] **Step 7: Screen** (`index.html`). In the menu, after the `.row` div: `<button id="how">HOW TO PLAY</button>`. Before the closing `</body>` script tag, after the error section:

```html
  <section id="help" class="screen panel" hidden>
    <h2>How to play</h2>
    <p class="copy">Swipe, or use the arrow keys. Left and right change lane, up jumps, down slides. Esc pauses.</p>
    <div id="powerup-list"></div>
    <button id="help-ok" class="primary">GOT IT</button>
  </section>
```

`src/style.css`, append:

```css
.toast { display: flex; align-items: center; gap: 12px; padding: 12px 18px 12px 12px; border-radius: 26px; background: var(--accent); color: var(--ink); text-shadow: none; text-align: left; box-shadow: 0 5px 0 var(--ink); font: 22px/24px var(--display); }
.toast svg { width: 40px; height: 40px; flex-shrink: 0; }
.toast small { display: block; font: 500 14px/18px system-ui, sans-serif; }
.copy { max-width: 420px; margin: 0; font: 500 17px/24px system-ui, sans-serif; }
#powerup-list { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 420px; text-align: left; }
.power { display: flex; align-items: center; gap: 12px; }
.power svg { width: 36px; height: 36px; flex-shrink: 0; }
.power b { display: block; font: 20px/22px var(--display); }
.power small { font: 500 14px/18px system-ui, sans-serif; opacity: 0.85; }
```

`src/main.js`: `const SCREENS = ['menu', 'select', 'results', 'error', 'help'];`, import `pickupIcon, pickupName` from `./hud.js` (`import { createHud, pickupIcon, pickupName } from './hud.js';`), and inside `main()` after `levelSelect`:

```js
  // Every registered power-up explains itself here from its own name and blurb, community ones included.
  function help(back) {
    const list = $('powerup-list');
    list.replaceChildren();
    for (const def of Object.values(registry.pickup).filter((d) => d.effect)) {
      const row = document.createElement('div'), words = document.createElement('div');
      row.className = 'power';
      text(words, 'b', pickupName(def));
      if (def.blurb) text(words, 'small', def.blurb);
      row.append(pickupIcon(def), words);
      list.append(row);
    }
    $('help-ok').onclick = back;
    show('help');
  }
```

and the button wiring:

```js
  $('play').onclick = () => {
    if (save.helpSeen) return startLevel(campaign.start);
    save.helpSeen = true; writeSave(save);           // once per browser, before the first run
    help(() => startLevel(campaign.start));
  };
  $('how').onclick = () => help(menu);
```

- [ ] **Step 8: Run the suite and build**

Run: `npm test && npm run build`
Expected: 67 pass, build green.

- [ ] **Step 9: Look at it.** Pane: fresh profile (`localStorage.clear()` via javascript_tool, reload), press RUN → HOW TO PLAY shows the three power-ups → GOT IT starts level 1. Collect a magnet (teleport near one: `m.world.live.pickups.find(p => p.id === 'magnet')` gives its z; set `m.run.z` 2 m before it, same lane, step a few frames with the shim) → the toast. Screenshots `help-screen.png`, `toast.png`.

- [ ] **Step 10: Commit**

```bash
git add src/registry.js src/hud.js src/game.js src/main.js src/save.js src/style.css index.html content/pickups test/fixtures/content/pickups/demo/triple.js test/registry.test.js test/content.test.js test/logic.test.js
git commit -m "feat: pickup name and blurb, toast on collect, HOW TO PLAY from the registry (FB-4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The world bends per section

**Files:**
- Modify: `src/gfx.js` (bend uniform, material patch, `bend`, `setBend`, `box` subdivision)
- Modify: `src/generator.js` (`normalizeLevel` carries `curve`; new `curveAt`)
- Modify: `src/validate.js` (`curve` on level and section)
- Modify: `src/world.js` (patch everything added to the root; ease the bend; reset on dispose)
- Modify: `src/main.js` (`gfx.bend` on the character)
- Test: `test/logic.test.js`, `test/validate.test.js`, `test/world.test.js`

**Interfaces:**
- Produces: `gfx.bendUniform` (THREE.Vector4 value: kx, ky, originZ, deadZone), `gfx.bendable(material)`, `gfx.bend(object)`, `gfx.setBend({ turn, hill, origin })`, `gfx.TURN_K = 0.005`, `gfx.HILL_K = 0.003`, `gfx.DEAD = 20`; `curveAt(norm, z, seed = 0) → { turn, hill }`; `RANDOM_CURVE_M = 240`, `FINISH_FADE_M = 120`; level/section key `curve` (`{ turn?, hill? }` in −1..1, or `"random"`); `norm.sections[i].curve`.

- [ ] **Step 1: Write the failing tests.** `test/logic.test.js` (import `curveAt` from `../src/generator.js`, and `import * as gfx from '../src/gfx.js';`):

```js
test('curveAt follows sections, inherits the level, fades at the finish and is reproducible when random', () => {
  const level = lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 300, to_m: 600, curve: { hill: -1 } }, { from_m: 600, to_m: 900, curve: 'random' }] });
  const norm = normalizeLevel(level);
  assert.deepEqual(curveAt(norm, 100), { turn: 1, hill: 0 }, 'the level curve applies outside sections');
  assert.deepEqual(curveAt(norm, 400), { turn: 0, hill: -1 }, 'a section curve replaces it');
  const r = curveAt(norm, 700, 7);
  assert.deepEqual(r, curveAt(norm, 700, 7));
  assert.ok(Math.abs(r.turn) <= 1 && Math.abs(r.hill) <= 1);
  assert.deepEqual(curveAt(norm, 1500), { turn: 0, hill: 0 }, 'straight at the finish');
  assert.deepEqual(curveAt(norm, 1440), { turn: 0.5, hill: 0 }, 'half way through the fade');
  assert.deepEqual(curveAt(normalizeLevel(lvl()), 500), { turn: 0, hill: 0 }, 'no curve means straight');
  const E = normalizeLevel(lvl({ length_m: null, curve: 'random' }));
  const segs = Array.from({ length: 10 }, (_, i) => i * 240);
  const a = segs.map((z) => curveAt(E, z, 7)), b = segs.map((z) => curveAt(E, z, 8));
  assert.deepEqual(a, segs.map((z) => curveAt(E, z, 7)), 'random targets come from the seed');
  assert.notDeepEqual(a, b);
  assert.ok(a.some((c, i) => i && (c.turn !== a[i - 1].turn || c.hill !== a[i - 1].hill)), 'and change from segment to segment');
  const F = normalizeLevel(lvl({ length_m: 480, curve: 'random' }));
  assert.deepEqual(curveAt(F, 480, 7), { turn: 0, hill: 0 }, 'random still fades out at a finite finish');
});

test('gfx.box subdivides along z so long road pieces bend', () => {
  assert.equal(gfx.box(1, 1, 120, '#ffffff').geometry.parameters.depthSegments, 30);
  assert.equal(gfx.box(1, 1, 3, '#ffffff').geometry.parameters.depthSegments, 1);
  assert.ok(gfx.box(1, 1, 1, '#ffffff').material.userData.bent, 'materials from the helpers are bendable');
  gfx.setBend({ turn: 1, hill: -0.5, origin: 100 });
  assert.deepEqual(gfx.bendUniform.value.toArray(), [-gfx.TURN_K, -0.5 * gfx.HILL_K, 100, gfx.DEAD], 'positive turn bends to screen-right (-x)');
  gfx.setBend();
  assert.deepEqual(gfx.bendUniform.value.toArray(), [0, 0, 0, gfx.DEAD]);
});
```

`test/validate.test.js`:

```js
test('curve is turn and hill in -1..1, or "random"', () => {
  assert.equal(errs({ curve: { turn: 0.5, hill: -1 } }), '');
  assert.equal(errs({ curve: 'random' }), '');
  assert.match(errs({ curve: { turn: 2 } }), /turn must be -1 to 1/);
  assert.match(errs({ curve: { bend: 1 } }), /curve: unknown key "bend"/);
  assert.match(errs({ curve: 'wobbly' }), /turn and hill/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, curve: { hill: -0.5 } }] }), '');
  assert.match(errs({ sections: [{ from_m: 0, to_m: 100, curve: { hill: 3 } }] }), /sections\[0\]\.curve\.hill/);
});
```

`test/world.test.js`:

```js
test('the world eases the bend toward the section curve, carries the origin with Milkshake and resets on dispose', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, curve: { turn: 1 } }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.speed = 20;
  world.update(run, 0);
  assert.equal(gfx.bendUniform.value.x, 0, 'starts straight');
  for (let i = 0; i < 120; i++) { run.z += 20 / 60; world.update(run, 1 / 60); } // 40 m at 20 m/s
  assert.ok(gfx.bendUniform.value.x < -0.9 * gfx.TURN_K, 'most of the way into a right turn after 40 m');
  assert.equal(gfx.bendUniform.value.z, run.z, 'the origin rides with Milkshake');
  assert.ok(world.live.obstacles.every((o) => o.view.object.material.userData.bent), 'everything the world adds is bendable');
  world.dispose();
  assert.equal(gfx.bendUniform.value.x, 0);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/logic.test.js test/validate.test.js test/world.test.js`
Expected: FAIL (`curveAt`, `bendUniform`, `setBend` missing; `curve` is an unknown key).

- [ ] **Step 3: gfx** (`src/gfx.js`). After `export const three = THREE;`:

```js
// World bend (spec v3 §1). Every material the helpers hand out bends its vertices in the vertex shader by one shared uniform:
// uBend = (kx, ky, originZ, deadZone). For a vertex at world z, d = max(0, z - originZ - deadZone); x += kx·d², y += ky·d².
// Collision never sees this: the street is straight for everything that plays.
export const TURN_K = 0.005, HILL_K = 0.003, DEAD = 20; // calibration knobs: metres of offset per m² beyond the dead zone, and the dead zone
export const bendUniform = { value: new THREE.Vector4(0, 0, 0, DEAD) };
const BEND = `
  vec4 bentWorld = modelMatrix * vec4( transformed, 1.0 );
  float bendD = max( 0.0, bentWorld.z - uBend.z - uBend.w );
  bentWorld.x += uBend.x * bendD * bendD;
  bentWorld.y += uBend.y * bendD * bendD;
  vec4 mvPosition = viewMatrix * bentWorld;
  gl_Position = projectionMatrix * mvPosition;
`;
const BEND_SPRITE = `
  vec4 bentWorld = modelMatrix[ 3 ];
  float bendD = max( 0.0, bentWorld.z - uBend.z - uBend.w );
  bentWorld.x += uBend.x * bendD * bendD;
  bentWorld.y += uBend.y * bendD * bendD;
  vec4 mvPosition = viewMatrix * bentWorld;
`;
function patch(shader) {
  shader.uniforms.uBend = bendUniform;
  shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform vec4 uBend;\nvoid main() {').replace('#include <project_vertex>', BEND);
}
function patchSprite(shader) { // a sprite places its centre from the model-view matrix; bend that centre in world space instead
  shader.uniforms.uBend = bendUniform;
  shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform vec4 uBend;\nvoid main() {').replace('vec4 mvPosition = modelViewMatrix[ 3 ];', BEND_SPRITE);
}
// Marks a material bendable, once. Materials a module builds itself get this when the engine adds the object (gfx.bend).
export function bendable(material) {
  if (!material || material.userData.bent) return material;
  material.userData.bent = true;
  material.onBeforeCompile = material.isSpriteMaterial ? patchSprite : patch;
  material.needsUpdate = true;
  return material;
}
export function bend(object) { object.traverse((n) => { if (n.material) bendable(n.material); }); return object; }
export function setBend({ turn = 0, hill = 0, origin = 0 } = {}) { bendUniform.value.set(-turn * TURN_K, hill * HILL_K, origin, DEAD); }
```

Then make every helper bendable: in `mat()` wrap the creation `mats.set(key, bendable(new THREE.MeshToonMaterial({ color, ...opts })))`; `box` becomes

```js
// Boxes subdivide along z (one segment per 4 m) so a long road piece curves with the bend instead of staying a straight chord.
export const box = (w, h, d, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / 4))), mat(color, opts)), x, y, z);
```

`blobShadow`: `new THREE.Mesh(new THREE.CircleGeometry(r, 24), bendable(new THREE.MeshBasicMaterial({ … })))`; `glow`: wrap its material in `bendable(...)`; `sprite`: `new THREE.Sprite(bendable(new THREE.SpriteMaterial({ … })))`.

- [ ] **Step 4: generator** (`src/generator.js`). In `normalizeLevel`, `base` gains `curve: level.curve ?? null,` and the section object gains `curve: s.curve ?? level.curve ?? null,`. Add after `densityAt`:

```js
export const RANDOM_CURVE_M = 240; // "random" curves pick a new target every this many metres
export const FINISH_FADE_M = 120;  // a finite level straightens over its last metres so endings play on a straight street

// The bend target at z: the section's curve (inherited from the level), a seeded pick per segment for "random", faded to 0 at a finite finish.
export function curveAt(norm, z, seed = 0) {
  let c = sectionAt(norm, z).curve;
  if (c === 'random') {
    const pick = rng((seed + 0x9e3779b9 * (Math.floor(z / RANDOM_CURVE_M) + 1)) >>> 0);
    c = { turn: [-1, -0.5, 0, 0.5, 1][Math.floor(pick() * 5)], hill: [-0.6, 0, 0.6][Math.floor(pick() * 3)] };
  }
  let turn = c?.turn ?? 0, hill = c?.hill ?? 0;
  if (norm.length != null) { const fade = Math.max(0, Math.min(1, (norm.length - z) / FINISH_FADE_M)); turn *= fade; hill *= fade; }
  return { turn, hill };
}
```

- [ ] **Step 5: validator** (`src/validate.js`). `LEVEL_KEYS` and `SECTION_KEYS` gain `'curve'`. Add:

```js
function checkCurve(c, path, e) {
  if (c === 'random') return;
  if (!isObj(c)) return e.push(`${path} must be an object with turn and hill (-1 to 1), or "random"`);
  keys(c, ['turn', 'hill'], path, e);
  for (const k of ['turn', 'hill']) if (c[k] !== undefined && !inRange(c[k], -1, 1)) e.push(`${path}.${k} must be -1 to 1`);
}
```

Call it in `validateLevel` (`if (level.curve !== undefined) checkCurve(level.curve, 'curve', e);`) and in `checkSections` (`if (s.curve !== undefined) checkCurve(s.curve, `${path}.curve`, e);`).

- [ ] **Step 6: world** (`src/world.js`). Import `curveAt` from `./generator.js`. Wrap every add: `root.add(gfx.bend(o.view.object))`, `root.add(gfx.bend(p.view.object))`, `root.add(gfx.bend(g))` for the chunk. Add state and easing:

```js
  const bend = { turn: 0, hill: 0 }; // eased toward curveAt; the uniform is shared by every bendable material
  const BEND_EASE_M = 40;            // metres of travel to get 95% of the way to a new curve
```

at the end of `update(run, dt)`:

```js
    const target = curveAt(norm, run.z, seed);
    const a = 1 - Math.exp((-3 * (run.speed ?? 0) * dt) / BEND_EASE_M);
    bend.turn += (target.turn - bend.turn) * a;
    bend.hill += (target.hill - bend.hill) * a;
    gfx.setBend({ turn: bend.turn, hill: bend.hill, origin: run.z });
```

and in `dispose()` first line: `gfx.setBend();`.

`src/main.js`: `import * as gfx from './gfx.js';` and in `character()` before adding to the scene: `gfx.bend(view.object);` (the GLB's toon swap and the dust materials are the module's own).

- [ ] **Step 7: Run the suite and build**

Run: `npm test && npm run build`
Expected: 71 pass, build green.

- [ ] **Step 8: Look at it.** Temporarily add `"curve": { "turn": 1 }` to `levels/01-broadway.json` (do not commit), play with the pane visible, expect the road to curve to screen-right beyond 20 m and the near rows to stay straight; try `{ "hill": -1 }` for the crest. Screenshots `bend-turn.png`, `bend-dip.png`. Revert the level file. If any material renders black or vanishes, read `read_console_messages` for a shader compile error and fix the replacement string before committing.

- [ ] **Step 9: Commit**

```bash
git add src/gfx.js src/generator.js src/validate.js src/world.js src/main.js test/logic.test.js test/validate.test.js test/world.test.js
git commit -m "feat: the world bends per section in the vertex shader; curve on levels and sections (FB-3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Camera per section

**Files:**
- Modify: `src/generator.js` (`normalizeLevel` carries `camera`; `cameraAt`), `src/validate.js` (`camera` key), `src/world.js` (`cameraAt(z)`), `src/game.js:38` (pass it to follow)
- Test: `test/logic.test.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: `engine.follow(run, cam, dt)` from Task 4.
- Produces: level/section key `camera` (`{ height?: 1.5–8, distance?: 3–12, fov?: 45–100 }`); `cameraAt(norm, z) → cam object`; `world.cameraAt(z)`.

- [ ] **Step 1: Write the failing tests.** `test/logic.test.js` (import `cameraAt`):

```js
test('a section camera merges over the level camera', () => {
  const norm = normalizeLevel(lvl({ camera: { height: 5 }, sections: [{ from_m: 100, to_m: 200, camera: { fov: 70 } }] }));
  assert.deepEqual(cameraAt(norm, 50), { height: 5 });
  assert.deepEqual(cameraAt(norm, 150), { height: 5, fov: 70 });
  assert.deepEqual(cameraAt(normalizeLevel(lvl()), 50), {}, 'no camera means the defaults');
});
```

`test/validate.test.js`:

```js
test('camera overrides are known and in range', () => {
  assert.equal(errs({ camera: { height: 5, distance: 8, fov: 70 } }), '');
  assert.match(errs({ camera: { height: 9 } }), /camera\.height must be 1.5 to 8/);
  assert.match(errs({ camera: { distance: 2 } }), /distance must be 3 to 12/);
  assert.match(errs({ camera: { fov: 120 } }), /fov must be 45 to 100/);
  assert.match(errs({ camera: { tilt: 1 } }), /unknown key "tilt"/);
  assert.match(errs({ camera: 'low' }), /camera must be an object/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, camera: { fov: 65 } }] }), '');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/logic.test.js test/validate.test.js`
Expected: FAIL (`cameraAt` missing, `camera` unknown key).

- [ ] **Step 3: Implement.** `src/generator.js`: `base` gains `camera: level.camera ?? null,`; the section object gains `camera: s.camera ? { ...(level.camera ?? {}), ...s.camera } : level.camera ?? null,`; add `export const cameraAt = (norm, z) => sectionAt(norm, z).camera ?? {};`.

`src/validate.js`: keys lists gain `'camera'`; add

```js
const CAMERA_RANGES = { height: [1.5, 8], distance: [3, 12], fov: [45, 100] };
function checkCamera(c, path, e) {
  if (!isObj(c)) return e.push(`${path} must be an object with height, distance and fov`);
  keys(c, Object.keys(CAMERA_RANGES), path, e);
  for (const [k, [lo, hi]] of Object.entries(CAMERA_RANGES)) if (c[k] !== undefined && !inRange(c[k], lo, hi)) e.push(`${path}.${k} must be ${lo} to ${hi}`);
}
```

and call it for `level.camera` (`'camera'`) and `s.camera` (`${path}.camera`).

`src/world.js`: import `cameraAt`, return `cameraAt: (z) => cameraAt(norm, z)` in the world object. `src/game.js`: `engine.follow(run, world.cameraAt(run.z), dt);`.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: 73 pass.

- [ ] **Step 5: Commit**

```bash
git add src/generator.js src/validate.js src/world.js src/game.js test/logic.test.js test/validate.test.js
git commit -m "feat: camera height, distance and field of view per section (FB-3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Props, a content kind without collision

**Files:**
- Modify: `src/registry.js:2` (`KIND_DIR`), `src/registry.js:9-69` (`prop` checks)
- Modify: `src/validate.js` (`props` key, prop placements), `src/generator.js` (`normalizeLevel` carries `props`; generation; placements; return `props`)
- Modify: `src/world.js` (`live.props`, build, drop, update, dispose)
- Create: `content/props/overpass.js`, `content/props/tunnel.js`, `content/props/billboard.js`, `content/props/railings.js`, `content/themes/bridge.js`, `test/fixtures/content/props/demo/arch.js`
- Modify: `test/fixtures/levels/demo-canal-street-dash.json`
- Test: `test/registry.test.js`, `test/validate.test.js`, `test/logic.test.js`, `test/world.test.js`, `test/fixtures.test.js`

**Interfaces:**
- Produces: content kind `prop` (`{ kind: 'prop', id, length: 1–100, createView(gfx, { z, length, lanes }) → { object, update?(p, run, dt), dispose?() } }`), folder `content/props/`; level/section key `props: { per_100m: 0–5, ids: { id: weight } }`; placement `{ at_m, kind: 'prop', id }` (no lane); `generate(...)` returns `{ obstacles, pickups, props }` with `state.propEnd`; `world.live.props`.
- Ruling to record in the ledger: a `bridge` theme ships alongside the `railings` prop. A prop cannot remove a theme's buildings, and board 09 shows water and a low city under the elevated stretch; a section selects it with `theme: { id: "bridge" }`. Themes own scenery in v2, so this is the modular shape, not a new mechanism.

- [ ] **Step 1: Write the failing tests.** `test/registry.test.js`: in `every shipped content module registers` add `assert.deepEqual(Object.keys(reg.prop).sort(), ['billboard', 'overpass', 'railings', 'tunnel']);` and change the themes line to `['bridge', 'downtown', 'midtown', 'uptown']`. In `metadata is checked per kind` add:

```js
  assert.match(checkModule({ kind: 'prop', id: 'ari/arch', createView() {} }).join(), /length in metres/);
  assert.match(checkModule({ kind: 'prop', id: 'ari/arch', length: 500, createView() {} }).join(), /length in metres/);
  assert.match(checkModule({ kind: 'prop', id: 'ari/arch', length: 4 }).join(), /createView/);
  assert.equal(checkModule({ kind: 'prop', id: 'ari/arch', length: 4, createView() {} }).length, 0);
  assert.throws(() => buildRegistry(at('content/obstacles/ari/arch.js', { kind: 'prop', id: 'ari/arch', length: 4, createView() {} })), /wrong folder, expected content\/props\//);
```

`test/validate.test.js`:

```js
test('props: weights, grid and placements', () => {
  assert.equal(errs({ props: { per_100m: 1, ids: { overpass: 1, billboard: 2 } } }), '');
  assert.match(errs({ props: { per_100m: 6, ids: {} } }), /per_100m must be 0 to 5/);
  assert.match(errs({ props: { per_100m: 1, ids: { tree: 1 } } }), /unknown prop "tree"/);
  assert.match(errs({ props: { per_100m: 1, ids: { overpass: 0 } } }), /above 0/);
  assert.match(errs({ props: { per_100m: 1 } }), /ids must be an object/);
  assert.match(errs({ props: { per_100m: 1, ids: {}, every: 3 } }), /unknown key "every"/);
  const s = (placements) => errs({ sections: [{ from_m: 0, to_m: 600, placements }] });
  assert.equal(s([{ at_m: 100, kind: 'prop', id: 'tunnel' }]), '');
  assert.match(s([{ at_m: 100, lane: 1, kind: 'prop', id: 'tunnel' }]), /no lane/);
  assert.match(s([{ at_m: 580, kind: 'prop', id: 'tunnel' }]), /past the end/);
  assert.match(s([{ at_m: 100, kind: 'prop', id: 'gate' }]), /unknown prop "gate"/);
  assert.match(s([{ at_m: 100, kind: 'obstacle', id: 'taxi' }]), /lane must be 0, 1 or 2/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, props: { per_100m: 2, ids: { billboard: 1 } } }] }), '');
});
```

`test/logic.test.js` (generator part):

```js
test('props land on their grid by weight, never overlap, never run past the end and keep out of placed ones', () => {
  const arch = { kind: 'prop', id: 'arch', length: 2, createView() {} }, tube = { kind: 'prop', id: 'tube', length: 60, createView() {} };
  const reg = { ...registry, prop: { arch, tube } };
  const { props } = generate(normalizeLevel(lvl({ length_m: 600, props: { per_100m: 5, ids: { tube: 1 } } })), rng(1), 0, 600, reg, R);
  assert.ok(props.length >= 2 && props.every((p) => p.id === 'tube' && p.length === 60));
  for (let i = 1; i < props.length; i++) assert.ok(props[i].z >= props[i - 1].z + 60, 'no overlap');
  assert.ok(props.every((p) => p.z + 60 <= 600 && p.z >= START_CLEAR));
  const placed = lvl({ length_m: 600, props: { per_100m: 5, ids: { arch: 1 } }, sections: [{ from_m: 100, to_m: 300, placements: [{ at_m: 200, kind: 'prop', id: 'tube' }] }] });
  const out = generate(normalizeLevel(placed), rng(1), 0, 600, reg, R).props;
  assert.ok(out.some((p) => p.id === 'tube' && p.placed && p.z === 200));
  assert.ok(out.filter((p) => p.id === 'arch').every((p) => p.z + 2 <= 200 || p.z >= 260), 'generated props keep out of the placed tunnel');
  const state = { lastRow: -Infinity, speedFrom: 12, propEnd: -Infinity };
  const norm = normalizeLevel(lvl({ length_m: null, props: { per_100m: 5, ids: { tube: 1 } } }));
  const two = [...generate(norm, rng(2), 0, 120, reg, R, state).props, ...generate(norm, rng(3), 120, 240, reg, R, state).props];
  for (let i = 1; i < two.length; i++) assert.ok(two[i].z >= two[i - 1].z + 60, 'the overlap guard remembers across chunks');
  assert.deepEqual(generate(normalizeLevel(lvl()), rng(1), 0, 600, reg, R).props, [], 'no props key, no props');
});
```

`test/world.test.js`:

```js
test('props are built, streamed, dropped and bent like obstacles', () => {
  let disposed = 0;
  const arch = { kind: 'prop', id: 'arch', length: 2, createView(gfx, { lanes }) { return { object: gfx.box(lanes.roadHalf * 2, 1, 1, '#ffffff'), dispose() { disposed++; } }; } };
  const registry = { obstacle: {}, pickup: {}, prop: { arch }, theme: { t: theme }, character: {}, ending: {} };
  const lvl = { ...level, obstacles: {}, density: { start: 0, end: 0 }, props: { per_100m: 5, ids: { arch: 1 } } };
  const world = createWorld(new THREE.Scene(), lvl, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0);
  assert.ok(world.live.props.length > 0);
  assert.ok(world.live.props.every((p) => p.view.object.position.z === p.z && p.view.object.material.userData.bent));
  run.z = 300;
  world.update(run, 0);
  assert.ok(world.live.props.every((p) => p.z + p.length >= 300 - 15), 'props are dropped once their far end is behind');
  assert.ok(disposed > 0);
});
```

`test/fixtures.test.js`: in the first test add `assert.ok(reg.prop['demo/arch']);`; in the second test append

```js
  const props = generate(normalizeLevel(level), rng(level.seed), 0, 900, reg, resolveRules(level.rules)).props;
  assert.ok(props.some((p) => p.id === 'demo/arch' && p.placed && p.z === 270), 'the placed arch lands');
  assert.ok(props.some((p) => p.id === 'demo/arch' && !p.placed), 'and arches are generated by weight');
```

and extend the "never names content" list with `'overpass', 'tunnel', 'billboard', 'railings', 'bridge'`.

- [ ] **Step 2: Run to see them fail**

Run: `npm test`
Expected: FAIL across the five files (no `prop` kind, unknown `props` key, no `props` in generate output).

- [ ] **Step 3: Registry** (`src/registry.js`)

```js
export const KIND_DIR = { obstacle: 'obstacles', pickup: 'pickups', prop: 'props', theme: 'themes', character: 'characters', ending: 'endings' };
```

and in `CHECKS`, after `pickup`:

```js
  // Scenery without collision: the engine places it at the road's centre and drops it once its far end is behind.
  prop(m) {
    const e = [];
    if (!num(m.length, 1, 100)) e.push('length in metres (1-100) is required');
    if (!fn(m.createView)) e.push('createView(gfx, { z, length, lanes }) is required');
    return e;
  },
```

- [ ] **Step 4: Validator** (`src/validate.js`). Keys lists gain `'props'`. Add:

```js
function checkProps(p, path, registry, e) {
  if (!isObj(p)) return e.push(`${path} must be an object with per_100m and ids`);
  keys(p, ['per_100m', 'ids'], path, e);
  if (!inRange(p.per_100m, 0, 5)) e.push(`${path}.per_100m must be 0 to 5`);
  if (!isObj(p.ids)) return e.push(`${path}.ids must be an object of {id: weight}`);
  for (const [id, w] of Object.entries(p.ids)) {
    if (!registry.prop[id]) e.push(`${path}.ids: unknown prop "${id}" (known: ${Object.keys(registry.prop).join(', ')})`);
    else if (!inRange(w, Number.MIN_VALUE, 1e6)) e.push(`${path}.ids: weight for "${id}" must be a number above 0`);
  }
}
```

Call it for `level.props` (`'props'`) and `s.props` (`${path}.props`). In the placement loop, replace the lane and kind checks with:

```js
      if (!['obstacle', 'pickup', 'prop'].includes(p.kind)) return e.push(`${pp}.kind must be obstacle, pickup or prop`);
      if (p.kind === 'prop') { if (p.lane !== undefined) e.push(`${pp}: a prop spans the street and has no lane`); }
      else if (![0, 1, 2].includes(p.lane)) e.push(`${pp}.lane must be 0, 1 or 2`);
      const def = registry[p.kind][p.id];
      if (!def) return e.push(`${pp}: unknown ${p.kind} "${p.id}"`);
      if (p.kind === 'prop' && level.length_m !== null && p.at_m + def.length > level.length_m) e.push(`${pp}: the prop runs past the end of the level (${p.at_m} + ${def.length} m)`);
```

(keep the existing `at_m` range check before these lines and the obstacle `placed.push` after them.)

- [ ] **Step 5: Generator** (`src/generator.js`). `base` gains `props: level.props ?? null,`; the section object gains `props: s.props ?? level.props ?? null,`. Default `state` becomes `{ lastRow: -Infinity, speedFrom: rules.speed.start, propEnd: -Infinity }`. Declare `const props = [];` with the other lists. In the placements loop:

```js
    if (p.kind === 'obstacle') { if (registry.obstacle[p.id].moves) item.moveTo = null; obstacles.push(item); }
    else if (p.kind === 'prop') props.push({ id: p.id, z: p.at_m, length: registry.prop[p.id].length, placed: true });
    else pickups.push(item);
```

After the pickups loop, before `return`:

```js
  // Props: on a grid like jugs, by weight, never overlapping another prop (generated or placed), never past the level's end.
  const placedProps = norm.sections.flatMap((s) => s.placements.filter((p) => p.kind === 'prop').map((p) => ({ z: p.at_m, end: p.at_m + registry.prop[p.id].length })));
  let propEnd = state.propEnd ?? -Infinity;
  for (const s of norm.sections) {
    if (!s.props?.per_100m || !Object.keys(s.props.ids).length) continue;
    const gap = 100 / s.props.per_100m;
    const z0 = Math.max(fromZ, s.from, START_CLEAR), z1 = Math.min(toZ, s.to);
    for (let k = Math.ceil(z0 / gap); k * gap < z1; k++) {
      const z = k * gap, id = pick(s.props.ids, r), len = registry.prop[id].length;
      if (z < propEnd || (norm.length != null && z + len > norm.length)) continue;
      if (placedProps.some((pp) => z < pp.end && z + len > pp.z)) continue;
      props.push({ id, z, length: len });
      propEnd = z + len;
    }
  }
  state.propEnd = propEnd;
  return { obstacles, pickups, props };
```

- [ ] **Step 6: World** (`src/world.js`). `const live = { obstacles: [], pickups: [], props: [] };`, `gen` gains `propEnd: -Infinity`, `build()` destructures `{ obstacles, pickups, props }` and adds:

```js
    for (const p of props) {
      p.def = registry.prop[p.id];
      p.view = safeCall(`prop ${p.id} createView`, () => p.def.createView(gfx, { z: p.z, length: p.length, lanes }), null) ?? fallbackView();
      p.view.object.position.set(0, 0, p.z);
      root.add(gfx.bend(p.view.object));
      live.props.push(p);
    }
```

The drop loop covers props, keeping a prop until its far end is behind:

```js
    for (const list of [live.obstacles, live.pickups, live.props]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].z + (list[i].length ?? 0) < behind) { dropView(list[i], list === live.obstacles ? 'obstacle' : list === live.pickups ? 'pickup' : 'prop'); list.splice(i, 1); }
    }
```

After the pickup loop: `for (const p of live.props) if (p.view.update) safeCall(`prop ${p.id} update`, () => p.view.update(p, run, dt));`. In `dispose()`: `for (const p of live.props) if (p.view.dispose) safeCall(`prop ${p.id} dispose`, () => p.view.dispose());`.

- [ ] **Step 7: Shipped props and the bridge theme**

```js
// content/props/overpass.js
export default {
  kind: 'prop', id: 'overpass', length: 8,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, w = lanes.roadHalf * 2 + 6, clear = 5; // deck clears the street by 5 m; pillars stand on the sidewalks
    const g = gfx.group(gfx.box(w, 1.2, length, P.sidewalk, 0, clear + 0.6, length / 2),
      gfx.box(w, 0.9, 0.15, P.lane, 0, clear + 1.65, 0.1), gfx.box(w, 0.9, 0.15, P.lane, 0, clear + 1.65, length - 0.1));
    for (const x of [-(lanes.roadHalf + 1), lanes.roadHalf + 1]) for (const z of [0.6, length - 0.6]) g.add(gfx.box(0.6, clear, 0.6, P.metal, x, clear / 2, z));
    return { object: g };
  },
};

// content/props/tunnel.js
export default {
  kind: 'prop', id: 'tunnel', length: 60,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, x = lanes.roadHalf + 1, h = 6;
    const g = gfx.group(gfx.box(x * 2 + 1, 1, length, P.dark, 0, h - 0.5, length / 2),
      gfx.box(0.5, h, length, P.dark, -x, h / 2, length / 2), gfx.box(0.5, h, length, P.dark, x, h / 2, length / 2));
    for (const z of [0, length]) g.add(gfx.box(x * 2 + 2, 0.8, 0.6, P.metal, 0, h + 0.1, z), // the lit mouth and exit frames
      gfx.box(0.8, h + 0.5, 0.6, P.metal, -x - 0.6, (h + 0.5) / 2, z), gfx.box(0.8, h + 0.5, 0.6, P.metal, x + 0.6, (h + 0.5) / 2, z));
    return { object: g };
  },
};

// content/props/billboard.js
export default {
  kind: 'prop', id: 'billboard', length: 4,
  createView(gfx, { z, lanes }) {
    const P = gfx.palette, side = Math.floor(z / 40) % 2 ? -1 : 1, x = side * (lanes.roadHalf + 2.5); // alternates sides along the street
    const g = gfx.group(gfx.box(5, 4, 0.3, P.lavender, x, 5, 2), gfx.box(5.3, 4.3, 0.2, P.dark, x, 5, 2.2));
    for (const dz of [0.8, 3.2]) g.add(gfx.box(0.25, 3, 0.25, P.metal, x, 1.5, dz));
    const face = gfx.sprite(gfx.glyphTexture('M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z'), 2.6, 2.6);
    face.position.set(x, 5, 1.8);
    g.add(face);
    return { object: g };
  },
};

// content/props/railings.js
export default {
  kind: 'prop', id: 'railings', length: 40,
  createView(gfx, { length, lanes }) {
    const P = gfx.palette, g = gfx.group();
    for (const x of [-(lanes.roadHalf + 0.5), lanes.roadHalf + 0.5]) {
      g.add(gfx.box(0.1, 0.1, length, P.lane, x, 1.05, length / 2), gfx.box(0.08, 0.08, length, P.lane, x, 0.55, length / 2));
      for (let z = 0.5; z < length; z += 4) g.add(gfx.box(0.12, 1.1, 0.12, P.metal, x, 0.55, z));
    }
    return { object: g };
  },
};

// content/themes/bridge.js
// An elevated stretch: the road deck over water and a low city, no sidewalks or blocks. A section picks it with theme: { id: "bridge" }
// and pairs it with hill +1 and the railings prop (board 09).
export default {
  kind: 'theme', id: 'bridge', sky: '#9fd3f5', fog: 0.3,
  buildings: { colors: ['#a6c1d8', '#81a2bd', '#8eadc6'], minH: 2, maxH: 8 },
  createChunk(gfx, { z0, length, lanes, rng }) {
    const P = gfx.palette, b = this.buildings;
    const g = gfx.group(gfx.box(lanes.roadHalf * 2 + 1, 1, length, P.road, 0, -0.5, z0 + length / 2), gfx.box(400, 0.1, length, P.glass, 0, -6, z0 + length / 2));
    for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) g.add(gfx.box(0.12, 0.02, 3, P.lane, x, 0.01, z + 1.5));
    for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
      const depth = Math.min(6 + rng() * 8, z0 + length - z), h = b.minH + rng() * (b.maxH - b.minH);
      if (depth < 3) break;
      g.add(gfx.box(8, h, depth - 1, b.colors[Math.floor(rng() * b.colors.length)], side * (lanes.roadHalf + 26 + rng() * 20), -6 + h / 2, z + depth / 2));
      z += depth;
    }
    return g;
  },
};

// test/fixtures/content/props/demo/arch.js
export default {
  kind: 'prop', id: 'demo/arch', length: 2,
  createView(gfx, { lanes }) {
    const x = lanes.roadHalf + 0.5;
    return { object: gfx.group(gfx.box(0.6, 6, 0.6, '#3f8a4c', -x, 3, 1), gfx.box(0.6, 6, 0.6, '#3f8a4c', x, 3, 1), gfx.box(x * 2 + 0.6, 0.8, 0.6, '#2f6b3a', 0, 6.4, 1)) };
  },
};
```

`test/fixtures/levels/demo-canal-street-dash.json` gains, at the level: `"props": { "per_100m": 1, "ids": { "demo/arch": 1 } }`, `"curve": { "turn": 0.5 }`, `"camera": { "height": 4.5 }`, `"rules": { "gravity": -24, "speed": { "start": 10, "end": 18 }, "reaction": 0.5 }`; and in the second section's placements: `{ "at_m": 270, "kind": "prop", "id": "demo/arch" }`.

- [ ] **Step 8: Run the suite and build**

Run: `npm test && npm run build`
Expected: 76 pass, build green.

- [ ] **Step 9: Look at it.** Pane with `?fixtures`, play Canal Street Dash: an arch at 270 m and more by weight, the road curving right, the camera a touch higher. Then temporarily place `{ "at_m": 300, "kind": "prop", "id": "tunnel" }` and an overpass in `levels/01-broadway.json` (not committed; Task 11 authors the real ones) to see the shipped props. Screenshots `props-fixture.png`, `props-tunnel.png`. Record the bridge-theme ruling in the ledger.

- [ ] **Step 10: Commit**

```bash
git add src/registry.js src/validate.js src/generator.js src/world.js content/props content/themes/bridge.js test/fixtures test/registry.test.js test/validate.test.js test/logic.test.js test/world.test.js test/fixtures.test.js docs/specs/2026-10-08-v3-ledger.md
git commit -m "feat: prop content kind (overpass, tunnel, billboard, railings), bridge theme, props in levels and placements (FB-3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Author the levels; CONTRIBUTING and README

**Files:**
- Modify: `levels/01-broadway.json`, `levels/02-garden.json`, `levels/endless.json`, `CONTRIBUTING.md`, `README.md`
- Test: `test/validate.test.js` (the existing shipped-levels test covers the JSON)

**Interfaces:**
- Consumes: everything above. Sections may set `curve`, `camera`, `props`, `theme` and prop placements.

- [ ] **Step 1: Level 1**

```json
{
  "id": "01-broadway",
  "title": "Up Broadway",
  "author": "PulsePoint",
  "length_m": 1500,
  "theme": { "id": "downtown", "sky": "#9fd3f5", "fog": 0.3 },
  "obstacles": { "taxi": 3, "barrier_low": 3, "scaffold_beam": 2, "hot_dog_cart": 2, "manhole_steam": 1 },
  "density": { "start": 0.25, "end": 0.55 },
  "jugs": { "per_100m": 14, "powerups": ["magnet", "shield"] },
  "props": { "per_100m": 0.8, "ids": { "billboard": 3, "overpass": 1 } },
  "sections": [
    { "from_m": 150, "to_m": 400, "curve": { "turn": 0.7 } },
    { "from_m": 400, "to_m": 600, "curve": { "hill": -0.8 }, "placements": [{ "at_m": 470, "kind": "prop", "id": "overpass" }] },
    { "from_m": 600, "to_m": 900, "curve": { "turn": -0.7 } },
    { "from_m": 900, "to_m": 1050, "camera": { "height": 2.4, "distance": 5, "fov": 65 }, "placements": [{ "at_m": 905, "kind": "prop", "id": "tunnel" }] },
    { "from_m": 1050, "to_m": 1300, "curve": { "hill": 0.6 }, "camera": { "height": 5.5, "distance": 8.5 }, "theme": { "id": "bridge" }, "placements": [
      { "at_m": 1060, "kind": "prop", "id": "railings" }, { "at_m": 1100, "kind": "prop", "id": "railings" }, { "at_m": 1140, "kind": "prop", "id": "railings" },
      { "at_m": 1180, "kind": "prop", "id": "railings" }, { "at_m": 1220, "kind": "prop", "id": "railings" } ] }
  ],
  "ending": { "id": "transition", "params": { "next": "02-garden" } }
}
```

- [ ] **Step 2: Level 2**

```json
{
  "id": "02-garden",
  "title": "Road to the Garden",
  "author": "PulsePoint",
  "length_m": 1800,
  "theme": { "id": "midtown", "sky": "#f4b26a", "fog": 0.4 },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1, "manhole_steam": 1, "pigeons": 1, "delivery_bike": 1 },
  "density": { "start": 0.3, "end": 0.7 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] },
  "props": { "per_100m": 0.8, "ids": { "billboard": 2, "overpass": 2 } },
  "sections": [
    { "from_m": 100, "to_m": 350, "curve": { "turn": -0.8 } },
    { "from_m": 350, "to_m": 500, "camera": { "height": 2.4, "distance": 5, "fov": 65 }, "placements": [{ "at_m": 360, "kind": "prop", "id": "tunnel" }] },
    { "from_m": 500, "to_m": 800, "curve": { "turn": 0.6, "hill": -0.5 } },
    { "from_m": 800, "to_m": 1100, "curve": { "hill": 0.7 }, "camera": { "height": 5.5, "distance": 8.5 }, "theme": { "id": "bridge" }, "placements": [
      { "at_m": 810, "kind": "prop", "id": "railings" }, { "at_m": 850, "kind": "prop", "id": "railings" }, { "at_m": 890, "kind": "prop", "id": "railings" },
      { "at_m": 930, "kind": "prop", "id": "railings" }, { "at_m": 970, "kind": "prop", "id": "railings" }, { "at_m": 1010, "kind": "prop", "id": "railings" } ] },
    { "from_m": 1100, "to_m": 1400, "curve": { "hill": -0.9 }, "placements": [{ "at_m": 1250, "kind": "prop", "id": "overpass" }] },
    { "from_m": 1400, "to_m": 1650, "curve": { "turn": 0.8 } }
  ],
  "ending": { "id": "arena_five" }
}
```

- [ ] **Step 3: Endless**

```json
{
  "id": "endless",
  "title": "Endless Manhattan",
  "author": "PulsePoint",
  "length_m": null,
  "theme": { "id": "uptown", "sky": "#c98bd8", "fog": 0.35 },
  "rules": { "speed": { "cap": 34, "ramp": 0.008 } },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1, "manhole_steam": 1, "pigeons": 1, "delivery_bike": 2 },
  "density": { "start": 0.4, "end": 0.8 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] },
  "props": { "per_100m": 1, "ids": { "billboard": 3, "overpass": 1, "tunnel": 0.3 } },
  "curve": "random"
}
```

- [ ] **Step 4: Run the suite** (the shipped-levels test validates all three)

Run: `npm test`
Expected: 76 pass.

- [ ] **Step 5: CONTRIBUTING.md.** In the field table add rows:

```markdown
| `curve` | optional, level or section: `{ "turn": -1..1, "hill": -1..1 }` (positive turn bends to the right, negative hill is a dip) or `"random"`; nothing bends inside 20 m, and a finite level straightens over its last 120 m |
| `camera` | optional, level or section: `height` 1.5–8 m, `distance` 3–12 m, `fov` 45–100; sections inherit the level's values and ease over half a second |
| `props` | optional, level or section: `{ "per_100m": 0–5, "ids": { "overpass": 1 } }` from registered props, placed on a grid and never overlapping |
```

update the `sections` row to list `curve`, `camera`, `props` among the overrides and the `placements` row to `{ at_m, lane (0-2), kind (obstacle, pickup or prop), id }` and a note that a prop has no lane and must fit inside the level. In the rules line add `reaction` 0.2–1.5 (0.6) with: `Rows are generated at least speed × reaction metres apart and two placed rows closer than that fail validation at the speed the file ramps to (a speed carried in from a previous level can be higher: leave room).` Add a "### Prop" subsection after Pickup:

````markdown
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
````

In the Pickup example add `name: 'TRIPLE', blurb: 'Every jug counts triple for 6 s', // shown when collected and on HOW TO PLAY (name 1-24, blurb 1-80 characters)`. In the `gfx` paragraph add: `The world bends in the distance (a level's curve); build long pieces with gfx.box, which subdivides along z, because raw geometry longer than about 6 m stays a straight chord.` In the Character example's `pose` comment, mention `speed`.

- [ ] **Step 6: README.md.** Extend the first bullet: `…new obstacles, pickups, props, themes, characters and endings are one-file modules.`

- [ ] **Step 7: Commit**

```bash
git add levels CONTRIBUTING.md README.md
git commit -m "feat: levels 1 and 2 get turns, dips, a tunnel, a bridge and camera moves; endless cycles at random; docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Manual pass, tuning, screenshots, ledger, PR question

**Files:**
- Modify: `docs/specs/2026-10-08-v3-ledger.md`; any constant that tuning changes (`src/gfx.js` knobs, `src/engine.js` knobs, `src/rules.js` speeds, `levels/*.json` numbers)

- [ ] **Step 1: Baseline.** `npm test && npm run build` green. Dev server + pane, shim injected, `?fixtures` off.

- [ ] **Step 2: Play level 1 with the pane visible** from the menu (HOW TO PLAY appears once). Watch for: the right turn at 150 m, the crest at 400 m with the overpass, the left turn, the low camera into the tunnel at 905 m, the rise onto the bridge with the high camera, the straightening before the Broadway turn ending, speed carried into level 2 (the HUD jug count and the pace both carry). Note anything off in the ledger.

- [ ] **Step 3: Tune.** Knobs, in the order they are most likely to need it: `TURN_K`/`HILL_K`/`DEAD` (`src/gfx.js`), `BEND_EASE_M` (`src/world.js`), `FOV_PER_MS`, `STREAK_FROM` (`src/engine.js`), `PULL_ACROSS`/`PULL_ALONG` (`src/rules.js`), section numbers in the level files. Each change: play, `npm test`, note the value in the ledger. Do not change contracts.

- [ ] **Step 4: Screenshots** (teleport with the hook where needed, pane visible): `turn.png` (level 1 at ~300 m), `dip.png` (~480 m, overpass in view), `tunnel-low-camera.png` (~930 m), `bridge-high-camera.png` (~1150 m), `magnet-pull.png` (a frame mid-pull), `toast.png`, `help-screen.png`, `speed-streaks.png` (level 2 near the end), `fb5-after-*.png` from Task 1. Send them with `SendUserFile`, one message, captions naming the board each one answers.

- [ ] **Step 5: Phone check.** `resize_window` to the mobile preset, play 20 s: the lanes stay legible under the bend, the toast and HOW TO PLAY fit, the streaks stay out of the lanes. Screenshot `phone.png`. Reset to desktop.

- [ ] **Step 6: Fixtures pack.** `?fixtures`: Canal Street Dash plays with the arch, the curve and the camera; break `test/fixtures/content/props/demo/arch.js` (`length: 500`) and confirm only it is disabled on the LEVELS screen, then restore it.

- [ ] **Step 7: Review Focus check.** Items 1–5 above: confirm each pinned test exists and passes; for item 5 collect a power-up within two seconds of the finish line of level 1 (teleport to 1380 m next to a magnet) and confirm the Broadway turn's ring and level 2 start cleanly with no toast lingering.

- [ ] **Step 8: Close the ledger.** Every task row `done` with its commit hash, rulings listed, tuned values recorded. `npm test && npm run build`. Commit:

```bash
git add -A
git commit -m "chore: manual pass tuning and the v3 ledger

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 9: Ask Caedon** in chat, with the screenshots sent: whether to push `feat/v3-feedback` and open a PR, and against which base (PR #1 may still be open: if `feat/v1` is unmerged the PR targets `feat/v1`, otherwise `main`). Do nothing until he answers.

---

### Task 13 (gated): A rigged, animated Milkshake

Only after Task 12 and only when Caedon says yes to the credits and the download.

**Files:**
- Modify: `content/characters/milkshake.js` (play a clip when the GLB has one), `public/milkshake.glb` (replaced by the rigged file), `docs/specs/2026-10-08-v3-ledger.md`

- [ ] **Step 1: Ask.** Cost is unknown (the preflight was blocked on 2026-10-08; balance 16). Ask Caedon for a yes on spending credits on Higgsfield's `3d_rigging` model with the public GLB URL `https://raw.githubusercontent.com/mrchopme/milkshake-runner/feat/v1/public/milkshake.glb`, `enable_animation: true`, `animation_action_id: 16` (RunFast), `height_meters: 1.9`, and a yes on downloading the result. Stop until he answers.

- [ ] **Step 2: Generate and fetch.** `generate_3d` with those params; `jobs_wait`; download the GLB through the context-mode `ctx_execute` shell (the Bash hook redirects `curl`) to the scratchpad; inspect it in Node (the Task 0 one-liner from this session: `skins`, `animations` counts must be ≥ 1). If the rig is wrong (limbs fused, upside down), stop and report; the procedural motion stays.

- [ ] **Step 3: Clip branch** (`content/characters/milkshake.js`, inside the `try` after `model = gltf.scene;`):

```js
      if (gltf.animations.length) {           // a rigged export: play its run clip at a rate tied to speed
        mixer = new gfx.three.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
      }
```

with `let mixer = null;` declared next to `let model, arms = [], legs = [];`, and in `update(run)` after `pose(...)`: `if (mixer) { mixer.timeScale = run.y > 0 || run.slideT > 0 ? 0 : (run.speed ?? BASE) / BASE; mixer.update(run.time - lastTime); }` with `let lastTime = 0;` updated to `run.time` each frame. Keep the bob, lean and dust; set the procedural `stride` bob to 0 when a mixer exists (`body.position.y = mixer ? 0 : …`).

- [ ] **Step 4: Replace the model, test, look, commit.** Copy the GLB over `public/milkshake.glb`, check its size is under 8 MB, `npm test && npm run build`, play with the pane visible, screenshot `rigged-run.png`, send it, record the credit spend in the ledger, commit:

```bash
git add public/milkshake.glb content/characters/milkshake.js docs/specs/2026-10-08-v3-ledger.md
git commit -m "feat: rigged Milkshake plays its run clip at the run's pace (FB-1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review (done 2026-10-08 while writing)

- **Spec coverage:** §1 bend → Task 8; §2 camera → Tasks 4, 9; §3 speed, carry, reaction floor, cues → Tasks 2, 3, 4, 5; §4 pull, metadata, toast, HOW TO PLAY → Tasks 6, 7; §5 running → Task 5 (rig → Task 13, gated); §6 props → Task 10; §7 seam clamp → Task 1; schema v3 → Tasks 3, 8, 9, 10; shipped content → Tasks 5, 7, 10, 11; fixtures → Task 10; CONTRIBUTING/README → Task 11; testing list → each task; manual pass → Task 12.
- **Deviation recorded as a Ruling (Task 10):** the `bridge` theme is not in the spec; it supplies board 09's water and low city because a prop cannot remove a theme's blocks.
- **Type consistency:** `generate(norm, r, fromZ, toZ, registry, rules, state)` with `state = { lastRow, speedFrom, propEnd }` across Tasks 3 and 10; `engine.follow(run, cam, dt)` across Tasks 4 and 9; `createRun(rules, character, jugs, speedFrom)` across Tasks 2, 5, 6; `curveAt(norm, z, seed)` and `cameraAt(norm, z)` in generator.js, world wraps `cameraAt(z)`; `gfx.bend(object)` used by world (Tasks 8, 10) and main (Task 8).
- **Test counts** are expectations, not contracts: 56 at the start, +1 (T1) +2 (T2) +3 (T3) +1 (T4) +1 (T5) +2 (T6) +1 (T7) +4 (T8) +2 (T9) +3 (T10) = 76.
