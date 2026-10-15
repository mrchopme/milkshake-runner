---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-15
---

# Level Learning Loop (inner loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Point-in-time plan written 2026-10-15 on `feat/level-learning-loop` (base `main` 56b6f0a). Patterns may have
> moved since; read the current `src/` before acting.

**Goal:** Close the fairness hole the probe found, and give a level author (Claude in-session, or anyone) a one-file lab that validates a level, plays it headlessly over many seeds, scores it against the shipped levels' band, and names the seed to ship.

**Architecture:** One line in `src/generator.js` makes a timing obstacle never count as a full row's escape; the generator's full-row fix and the validator's wall rule inherit it. Everything new lives in `scripts/level-lab.js`: a pure headless playtest built on `generate` and `src/rules.js` (no DOM, no three.js), a scorecard with hard gates and soft bands, a content sheet printed from the registry, and a small CLI over them. Tests run under the existing `node --test test/*.test.js`.

**Tech Stack:** Node 22+ ES modules, `node:test`, `node:util` `parseArgs`. No new dependencies.

**Spec:** `docs/specs/2026-10-15-level-learning-loop-model.md` (§2 holes, §3 fun model and reference band, §4 pipeline, §8 decisions).

## Global Constraints

- No new npm dependencies; stdlib only (`package.json` has `three` and `vite` only).
- `src/` changes limited to `passable` in `src/generator.js` and its comment; everything else new goes under `scripts/` and `test/`.
- The validator stays the single source of truth for "valid"; the lab never duplicates a validation rule, it calls `validateLevel`.
- Level ids `a-z0-9-`, file name equals id; generated levels are committed in `levels/` with a `seed`; `levels/index.json` and `levels/campaign.json` are not edited.
- Docs carry the provenance frontmatter (`provenance: agent-generated`, `last-verified: never`) and are point-in-time.
- Deliberate shortcuts carry a `// ponytail:` comment naming the ceiling and the upgrade path.
- Commit per task; no push and no PR without Caedon's word.

## Review Focus

1. An endless level (`length_m: null`) through `playtest` and `scorecard`: the street must stop at 3000 m, finite-only bands (finish time, speed ratio) must be skipped, not failed. Test in Task 3.
2. A level built from placements only (`generation: false`, like `test/fixtures/levels/demo-canal-street-dash.json`): placed rows sit off the 12 m grid and a placed mover has `moveTo: null`; the bot must group and pass them. Test in Task 2.
3. A level whose obstacles are only lane and timing types (`{ taxi, manhole_steam }`): after the fix no row may fill three lanes, the validator must still accept the file, the scorecard must run. Test in Task 1 (generator) and Task 3 (scorecard).
4. An invalid file handed to `play` (unknown obstacle id): the CLI must print the validator's errors and exit 1 instead of throwing inside the generator. Test in Task 4.
5. A seeded file whose own seed fails a gate while most seeds pass: the scorecard must report the file's seed separately from the sweep and propose a ship seed. Test in Task 3.

---

### Task 1: A timing obstacle is never a full row's escape

**Files:**
- Modify: `src/generator.js:22-29`
- Modify: `CONTRIBUTING.md:62` (the `placements` row)
- Test: `test/logic.test.js` (after line 201), `test/validate.test.js` (inside `sections and placements`, line 70)

**Interfaces:**
- Produces: `passable(def, rules)` returns `false` for `def.avoid === 'timing'`; unchanged for jump, slide, lane.

- [ ] **Step 1: Write the failing generator test** in `test/logic.test.js` after the test `with nothing to jump or slide, a row never fills all three lanes`:

```js
test('a timing obstacle is luck, never a full row\'s only escape', () => {
  assert.equal(passable(registry.obstacle.manhole_steam, R), false);
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 2, manhole_steam: 1 } }), s).obstacles).values()) assert.ok(row.length <= 2, `seed ${s}`);
  for (const s of seeds) for (const row of rowsOf(all(lvl(), s).obstacles).values()) if (row.length === 3) assert.ok(row.some((o) => ['jump', 'slide'].includes(registry.obstacle[o.id].avoid)), `seed ${s}`);
});
```

- [ ] **Step 2: Write the failing validator assertion** in `test/validate.test.js`, inside `sections and placements`, after the `block every lane` assertion:

```js
assert.match(s([{ from_m: 0, to_m: 100, placements: [0, 1, 2].map((lane) => ({ at_m: 50, lane, kind: 'obstacle', id: lane === 1 ? 'manhole_steam' : 'taxi' })) }]), /block every lane/);
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm test 2>&1 | grep -E "not ok|fail|pass"`
Expected: the two new tests FAIL (a 3-lane row with steam exists; the placed steam wall validates), everything else passes.

- [ ] **Step 4: Make `passable` return `false` for timing** in `src/generator.js:24`, and reword the comment on line 22 to say that dimensions decide for jump and slide, and that a timing obstacle is luck (no speed control, so arrival time cannot be chosen) and never an escape.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all pass (102 tests). `the Newark obstacles read as their moves` still passes: the stray is a jump obstacle.

- [ ] **Step 6: Update CONTRIBUTING's `placements` row** (`CONTRIBUTING.md:62`): after "a row may not block all three lanes with nothing to jump or slide" add "(a timing obstacle such as steam does not count: it is luck, not a move)".

- [ ] **Step 7: Commit**

```bash
git add src/generator.js test/logic.test.js test/validate.test.js CONTRIBUTING.md
git commit -m "fix: a timing obstacle never counts as a full row's escape; generated and placed walls always have a jump or a slide"
```

---

### Task 2: Headless playtest: `street` and `simulate`

**Files:**
- Create: `scripts/level-lab.js`
- Test: `test/level-lab.test.js`

**Interfaces:**
- Consumes: `generate`, `normalizeLevel`, `rng`, `passable` from `src/generator.js`; `resolveRules`, `speedAt`, `createRun`, `act`, `step`, `playerBox`, `obstacleBox`, `overlaps`, `hit`, `updateObstacle` from `src/rules.js`; `buildRegistry` from `src/registry.js`; `discover` from `test/helpers.js` (reuse, do not copy).
- Produces:
  - `export const NOTICE = 0.45, ENDLESS_M = 3000;`
  - `export async function loadRegistry()` → the registry built from `content/` (path resolved from `import.meta.url`).
  - `export function street(level, registry, { seed, from } = {})` → `{ rules, length, obstacles, pickups, props, rows }`. `length` is `level.length_m ?? ENDLESS_M`; `from` defaults to `rules.speed.start` and is passed to `generate` as `state.speedFrom` (as `src/world.js:32` does). Each obstacle gets `def`. `rows` groups obstacles by exact `z`, sorted, each `{ z, obs, halfD, kind }` with `halfD = max(def.box.d / 2)` and `kind` one of `'dodge1' | 'dodge2' | 'wall-jump' | 'wall-slide' | 'wall-jump+slide' | 'wall-luck'` (`wall-luck`: three lanes and no jump or slide escape; impossible after Task 1, kept as a guard).
  - `export function simulate(level, registry, { seed, notice = NOTICE, from } = {})` → `{ survived, death, time, z, actions: { left, right, jump, slide }, idle: { seconds, from_m, to_m }, windows }`. `death` is `null` or `{ id, avoid, kind, z, speed, window }`. `windows` is the list of effective windows in seconds between consecutive rows: `((row.z − row.halfD − 0.4) − (prev.z + prev.halfD + 0.4)) / speedAt(level, row.z, rules, from)`. `idle` is the longest stretch between two rows that needed an action (a lane change or a jump or slide), with its metre range.

- [ ] **Step 1: Write the failing tests** in `test/level-lab.test.js`:

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { street, simulate, loadRegistry, NOTICE } from '../scripts/level-lab.js';

let registry;
before(async () => { registry = await loadRegistry(); });
const broadway = JSON.parse(readFileSync(new URL('../levels/01-broadway.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/levels/demo-canal-street-dash.json', import.meta.url), 'utf8'));

test('street groups obstacles into rows and names what each row asks for', () => {
  const s = street(broadway, registry, { seed: 7 });
  assert.ok(s.rows.length > 20 && s.rows.every((r) => r.obs.length >= 1 && r.obs.length <= 3));
  for (const r of s.rows) assert.ok(['dodge1', 'dodge2', 'wall-jump', 'wall-slide', 'wall-jump+slide'].includes(r.kind), r.kind);
  assert.deepEqual(street(broadway, registry, { seed: 7 }).rows.map((r) => r.z), s.rows.map((r) => r.z), 'same seed, same street');
});

test('the bot clears Broadway at a 0.45 s notice and dies with a 0.2 s one', () => {
  for (let seed = 1; seed <= 20; seed++) assert.equal(simulate(broadway, registry, { seed }).survived, true, `seed ${seed}`);
  const dead = Array.from({ length: 20 }, (_, i) => simulate(broadway, registry, { seed: i + 1, notice: 0.2 })).filter((r) => !r.survived);
  assert.ok(dead.length >= 10);
  assert.ok(dead.every((r) => r.death && r.death.id && r.death.z > 0 && typeof r.death.window === 'number'));
});

test('a run is deterministic and reports actions, windows and the longest idle stretch', () => {
  const a = simulate(broadway, registry, { seed: 3 }), b = simulate(broadway, registry, { seed: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.actions.left + a.actions.right + a.actions.jump + a.actions.slide > 10);
  assert.ok(a.windows.length > 10 && Math.min(...a.windows) > 0.3);
  assert.ok(a.idle.seconds > 0 && a.idle.to_m > a.idle.from_m);
});

test('placed rows off the grid and a placed mover are played like generated ones', () => {
  const pack = { ...registry, obstacle: { ...registry.obstacle, 'demo/boulder': (await import('./fixtures/content/obstacles/demo/boulder.js')).default } };
  const s = street(fixture, pack, { seed: fixture.seed });
  assert.ok(s.rows.some((r) => r.z === 210 && r.obs.length === 2 && r.kind === 'dodge2'));
  assert.equal(simulate(fixture, pack, { seed: fixture.seed }).survived, true);
});
```

(The last test needs the fixture pack's boulder; `demo/forest` and `demo/robot` are not needed because `street` reads only `registry.obstacle` and `simulate` uses `registry.character.milkshake` for the player box. If the import inside a test body is awkward, build the pack once at the top with `discover` on `test/fixtures/content/`, the way `test/fixtures.test.js:16` does.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/level-lab.test.js`
Expected: FAIL, cannot find module `scripts/level-lab.js`.

- [ ] **Step 3: Implement `loadRegistry`, `street` and `simulate` in `scripts/level-lab.js`.** The bot policy is the part the signatures do not determine; implement it as follows (`dt = 1/60`; `eff(o) = o.moveTo ?? o.lane` is an obstacle's final lane):

```
loop while !run.over && run.z < length:
  speed = speedAt(level, run.z, rules, run.speedFrom)
  if no plan and the next unplanned row is within speed × notice metres:
    occ   = map eff(o) → o for that row
    blocked = lanes of the previous row's obstacles, if run.z has not passed its tail (prev.z + prev.halfD + 0.4)
    nextOcc = lanes of the row after, if it lies within speed × 1.0 m of this row
    cost(l) = 0 if free; 1 if occ.get(l) is jump or slide passable; Infinity otherwise (timing lanes are never chosen)
    reachable(l) = no lane strictly between run.lane and l, nor l itself, is in blocked
    candidates = lanes with finite cost that are reachable, sorted by cost, then not in nextOcc, then distance from run.lane
    if none, or the best cost > 0 while blocked is non-empty and the row is more than speed × 0.35 m away: wait (plan next tick)
    else plan = { target, action: 'jump' | 'slide' | null, obstacle }, advance the row index
  if plan: step one lane toward target per tick (act 'left'/'right'); once there, fire the action when
    the obstacle's leading edge (obstacle.z − box.d/2 − 0.4) is within speed × 0.2 m (jump) or speed × 0.1 m (slide);
    drop the plan when on target with no action pending
  step(run, dt, speed); for every obstacle within −12..+40 m: updateObstacle, then obstacleBox and overlaps(playerBox)
    → hit(run); on 'dead' record { id, avoid, kind of its row, z: round(run.z), speed, window of that row } and stop
```

Record `actions` as each `act` call is made, `windows` from the rows up front, and `idle` as the longest gap in `run.time` between two plans that moved a lane or fired an action (keep the z of both rows for `from_m`/`to_m`). The 0.2 s jump lead and 0.1 s slide lead follow from the physics: a 9 m/s jump against −30 m/s² is above 1.0 m from 0.147 s to 0.453 s.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/level-lab.test.js`
Expected: 4 passing. Then `npm test`: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/level-lab.js test/level-lab.test.js
git commit -m "feat: a headless playtest, street rows and a reaction-limited bot over the pure generator and rules"
```

---

### Task 3: `playtest` and `scorecard`: gates, bands, ship seed

**Files:**
- Modify: `scripts/level-lab.js`
- Test: `test/level-lab.test.js`

**Interfaces:**
- Consumes: `street`, `simulate` from Task 2; `validateLevel` from `src/validate.js`; `speedAt` from `src/rules.js`.
- Produces:
  - `export const GATES = { survival: 0.95, windowMin: 0.35 };`
  - `export const BANDS = { speedRatio: 1.8, densityRise: 0.25, actionsPerMin: [15, 40], idleMax: 16, finish: [45, 180], jugsPer100m: [10, 16], stagingEvery_m: 300 };`
  - `export function finishTime(level, rules, from)` → seconds, the integral of `1 / speedAt` over 0..`length_m` in 1 m steps; `NaN` for endless.
  - `export function playtest(level, registry, { seeds = 100, notice = NOTICE, from } = {})` → `{ seeds, survival, deaths, luckDeaths, windowMin, windowP10, actionsPerMin, idle, rowsPerMin, finish, jugsPer100m, powerupsPerRun, shipSeed, fileSeed }`. Seeds are `1..seeds`. `deaths` is `[{ seed, ...death }]`; `luckDeaths` counts deaths whose row kind is `wall-luck`. `actionsPerMin`, `idle` (the single longest across surviving runs) and `rowsPerMin` are means over surviving runs. `shipSeed` is the surviving seed with the largest minimum window, lowest seed on ties, `null` if nothing survived. `fileSeed` is `null` when the level has no `seed`, else `{ seed, survived, windowMin }` from one extra run with that seed.
  - `export function scorecard(level, registry, { seeds = 100, from } = {})` → `{ ok, gates, bands, stats, shipSeed, lines }`. `gates` and `bands` are lists of `{ id, ok, text }`; `ok` is true when every gate passes; `lines` is the human text: one line per failed gate and per band outside its range, naming positions where there are any (`"wall-luck at 622 m (seed 14)"`, `"13 s without a row to play at 300–420 m"`), then the ship seed line.

Gates: `G-survival` (`survival ≥ GATES.survival`), `G-luck` (`luckDeaths === 0`), `G-window` (`windowMin ≥ GATES.windowMin`), `G-seed` (skipped when `fileSeed` is null; fails when the file's own seed dies or has `windowMin < GATES.windowMin`).

Bands (warn only; finite-only ones are skipped for endless): `B-speed` (`rules.speed.end / rules.speed.start ≥ BANDS.speedRatio`; for endless `rules.speed.ramp > 0`), `B-density` (`density.end − density.start ≥ BANDS.densityRise`, read from the level's base density), `B-actions` (`actionsPerMin` inside the range), `B-idle` (`idle.seconds ≤ BANDS.idleMax`), `B-finish` (`finish` inside the range), `B-jugs` (`jugs.per_100m` inside the range and `jugs.powerups.length ≥ 1`), `B-staging` (at least `floor(length_m / BANDS.stagingEvery_m)` sections carrying any of `curve`, `camera`, `theme`, `props`, `placements`; endless passes with a level-wide `curve`), `B-theme-lines` (every section with a `theme` starts on a multiple of 120, as `test/validate.test.js:151` requires of shipped levels).

- [ ] **Step 1: Write the failing tests** (append to `test/level-lab.test.js`; import `playtest`, `scorecard`, `finishTime`, `GATES`):

```js
test('finish time is the integral of the speed curve', () => {
  const rules = { ...resolveRules(), speed: { start: 12, end: 24, cap: 30, ramp: 0.006 } };
  assert.ok(Math.abs(finishTime({ length_m: 1500 }, rules) - 1500 / 12 * Math.log(2)) < 1);
  assert.ok(Number.isNaN(finishTime({ length_m: null }, rules)));
});

test('the shipped levels pass every gate and sit inside the band', () => {
  const card = scorecard(broadway, registry, { seeds: 20 });
  assert.equal(card.ok, true, card.lines.join('\n'));
  assert.ok(card.bands.every((b) => b.ok), card.lines.join('\n'));
  assert.ok(Number.isInteger(card.shipSeed) && card.shipSeed >= 1);
});

test('a level that leaves no time to react fails the survival and window gates', () => {
  const tight = { ...broadway, rules: { reaction: 0.2, speed: { start: 30, end: 30 } }, density: { start: 1, end: 1 } };
  const card = scorecard(tight, registry, { seeds: 20 });
  assert.equal(card.ok, false);
  assert.ok(card.gates.find((g) => g.id === 'G-window').ok === false);
  assert.ok(card.lines.some((l) => /window/.test(l)));
});

test('a flat level passes the gates but gets pacing and staging warnings', () => {
  const flat = { ...broadway, rules: { speed: { start: 12, end: 12 } }, density: { start: 0.3, end: 0.3 }, sections: undefined };
  const card = scorecard(flat, registry, { seeds: 20 });
  assert.equal(card.ok, true);
  for (const id of ['B-speed', 'B-density', 'B-staging']) assert.equal(card.bands.find((b) => b.id === id).ok, false, id);
});

test('an endless level is played to 3000 m and finite-only bands are skipped', () => {
  const endless = JSON.parse(readFileSync(new URL('../levels/endless.json', import.meta.url), 'utf8'));
  const card = scorecard(endless, registry, { seeds: 10 });
  assert.equal(card.ok, true, card.lines.join('\n'));
  assert.ok(!card.bands.some((b) => b.id === 'B-finish'));
  assert.ok(Number.isNaN(card.stats.finish));
});

test('a file seed is judged on its own and a ship seed is proposed', () => {
  const seeded = { ...broadway, seed: 5 };
  const card = scorecard(seeded, registry, { seeds: 10 });
  assert.equal(card.stats.fileSeed.seed, 5);
  assert.equal(card.gates.find((g) => g.id === 'G-seed').ok, true);
  assert.ok(card.lines.at(-1).includes(`ship seed ${card.shipSeed}`));
});

test('a lane-and-timing-only obstacle set never builds a full row and still scores', () => {
  const card = scorecard({ ...broadway, obstacles: { taxi: 2, manhole_steam: 1 } }, registry, { seeds: 10 });
  assert.equal(card.stats.luckDeaths, 0);
  assert.equal(card.gates.find((g) => g.id === 'G-luck').ok, true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/level-lab.test.js`
Expected: the new tests FAIL (`playtest`, `scorecard`, `finishTime` not exported).

- [ ] **Step 3: Implement `finishTime`, `playtest`, `scorecard` in `scripts/level-lab.js`** with the thresholds above as the exported constants. `rowsPerMin` for a finite level is `rows / finish × 60`; for endless, `rows / time of the surviving run × 60`. `jugsPer100m` and `powerupsPerRun` come from `street(...).pickups` (ids `jug` versus any other).

- [ ] **Step 4: Run the tests**

Run: `node --test test/level-lab.test.js` then `npm test`
Expected: all pass. Note the suite's new wall time; if it exceeds 5 s, lower `seeds` in the tests, not in the defaults.

- [ ] **Step 5: Commit**

```bash
git add scripts/level-lab.js test/level-lab.test.js
git commit -m "feat: playtest over seeds and a scorecard with fairness gates, pacing bands and a ship seed"
```

---

### Task 4: Content sheet, `check`, and the CLI

**Files:**
- Modify: `scripts/level-lab.js`
- Modify: `package.json` (scripts)
- Test: `test/level-lab.test.js`

**Interfaces:**
- Consumes: `validateLevel` from `src/validate.js`; `scorecard`, `loadRegistry` from Tasks 2–3; `parseArgs` from `node:util`.
- Produces:
  - `export function contentSheet(registry)` → a markdown string: a table per kind. Obstacles: id, move (`avoid`), box h/y/d, `moves`, cycle. Pickups: id, name, value, effect, duration, blurb. Props: id, length. Themes: id, sky, fog, building heights. Characters: id, height, width. Endings: id, params with type, max and default, `streetAfter`. Then a "Rules" line with `RULE_RANGES` and the defaults, and a "Band" block printing `GATES` and `BANDS`. No prose beyond one line per table saying what the column means; CONTRIBUTING §1 is the prose.
  - `export function loadLevelFile(path)` → `{ id, level, allIds }`: `id` is the file name without `.json`; `allIds` is the ids of `levels/*.json` (minus index and campaign) plus `id`.
  - `export function check(path, registry)` → the `validateLevel` error list for that file.
  - CLI (`main` runs only when the file is the entry point): `node scripts/level-lab.js sheet` prints the sheet; `check <file>` prints errors one per line and exits 1 if any, prints `ok` and exits 0 otherwise; `play <file> [--seeds N] [--notice S] [--from V] [--json]` runs `check` first (errors → exit 1 without playing), then prints the scorecard `lines` (or the whole object with `--json`) and exits 1 when `ok` is false.
  - `package.json`: `"lab": "node scripts/level-lab.js"`.

- [ ] **Step 1: Write the failing tests** (append; import `contentSheet`, `check`, `loadLevelFile`; `spawnSync` from `node:child_process`):

```js
test('the content sheet names every registered id with the facts an author needs', () => {
  const sheet = contentSheet(registry);
  for (const id of Object.keys(registry.obstacle)) assert.ok(sheet.includes(`| ${id} |`), id);
  assert.match(sheet, /taxi \| lane \| 2(\.0)? /);
  assert.match(sheet, /manhole_steam \| timing/);
  for (const id of Object.keys(registry.ending)) assert.ok(sheet.includes(`| ${id} |`), id);
  assert.match(sheet, /transition .*next.*level/);
  assert.match(sheet, /reaction/);
  assert.match(sheet, /survival/);
});

test('check runs the validator on a file by its name', () => {
  const file = new URL('../levels/01-broadway.json', import.meta.url).pathname;
  assert.deepEqual(check(file, registry), []);
  assert.deepEqual(loadLevelFile(file).allIds.sort(), ['01-broadway', '02-garden', 'endless', 'last-train-newark']);
});

test('the CLI checks, refuses to play an invalid file, and plays a valid one', () => {
  const { spawnSync } = await import('node:child_process');
  const lab = new URL('../scripts/level-lab.js', import.meta.url).pathname;
  const run = (...args) => spawnSync(process.execPath, [lab, ...args], { encoding: 'utf8' });
  assert.equal(run('check', 'levels/01-broadway.json').status, 0);
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const dir = mkdtempSync(`${(await import('node:os')).tmpdir()}/lab-`);
  writeFileSync(`${dir}/bad-one.json`, JSON.stringify({ ...broadway, id: 'bad-one', obstacles: { tank: 1 } }));
  const bad = run('play', `${dir}/bad-one.json`);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout + bad.stderr, /unknown obstacle "tank"/);
  const good = run('play', 'levels/01-broadway.json', '--seeds', '5');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /ship seed/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/level-lab.test.js`
Expected: FAIL (`contentSheet`, `check`, `loadLevelFile` not exported; CLI prints nothing).

- [ ] **Step 3: Implement `contentSheet`, `loadLevelFile`, `check` and `main`** in `scripts/level-lab.js`; guard `main` with `process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`. Add `"lab": "node scripts/level-lab.js"` to `package.json` scripts.

- [ ] **Step 4: Run the tests and the CLI by hand**

Run: `npm test`; then `npm run lab -- sheet | head -40`; `npm run lab -- play levels/02-garden.json --seeds 50`
Expected: all tests pass; the sheet starts with the obstacle table; Garden's scorecard prints no failed gate and a ship seed.

- [ ] **Step 5: Commit**

```bash
git add scripts/level-lab.js test/level-lab.test.js package.json
git commit -m "feat: level lab CLI with a content sheet for authors, a check command and a play command that scores a level"
```

---

### Task 5: The loop, run once: the first generated level

**Files:**
- Create: `levels/<id>.json` (id from the prompt, `a-z0-9-`)
- Modify: `docs/specs/2026-10-15-level-learning-loop-model.md` (new §10 "How to run the loop")

**Interfaces:**
- Consumes: the CLI from Task 4; CONTRIBUTING §1; the shipped level files as examples.
- Produces: one valid, seeded, scorecard-passing level committed under `levels/`, and the recipe that produced it.

- [ ] **Step 1: Write §10 of the model doc, the recipe**, as six numbered lines: run `npm run lab -- sheet` and read CONTRIBUTING §1 plus two shipped files; write `levels/<id>.json` from the prompt, choosing obstacle weights for the move mix, a density rise of at least 0.25, a speed ratio of at least 1.8, and one set piece per 300 m (turn, dip with overpass, tunnel with a low camera, bridge theme with a high camera and railings, a fixed-density sprint); `npm run lab -- check`; `npm run lab -- play`; fix every failed gate and every band warning the prompt does not justify, re-run; write the proposed ship seed into the file and `play` once more; `npm test`; play it in the pane (Step 4); commit.

- [ ] **Step 2: Take the prompt.** Caedon's, given at execution. If none is given, use: "Uptown at dusk, 1200 m, a fast sprint: busy from the start, more slides than jumps, one tunnel with a low camera, a bridge finish with railings, x2 and shield power-ups, the finish banner says FIFTH AVENUE CLEARED."

- [ ] **Step 3: Write the level and iterate** per §10 until `npm run lab -- play levels/<id>.json` exits 0 with no band warning the prompt does not explain; record each iteration's failed gates and warnings in the commit message body, one line each.

- [ ] **Step 4: Play it in the pane** (verification, not design): start Vite in the background, `npm run dev -- --port 5178 --strictPort`, `preview_start({ url: "http://localhost:5178/milkshake-runner/" })`; shim `requestAnimationFrame` through `javascript_tool` (`window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout`); open Levels, click the new level; a few hundred ms after RUN set `__milkshake.run.graceT = 1e9`; teleport with `__milkshake.run.z = N` to each set piece and take two screenshots per place (the pane lags a frame); `#pause.click()` to hold a frame; the level takes about 90 s, so teleport or poll in two `javascript_tool` calls (45 s timeout each). Expected: every set piece is where the file puts it; the ending plays; no console errors.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: all pass, the new level validates with the shipped ones (`every shipped level and the campaign are valid`).

```bash
git add levels/<id>.json docs/specs/2026-10-15-level-learning-loop-model.md
git commit -m "feat: <title>, the first level written from a prompt through the level lab (seed <N>, <survival>% over 100 seeds)"
```

- [ ] **Step 6: Stop.** Push and PR are Caedon's word.

---

## Self-review notes (2026-10-15)

- Spec coverage: §2 hole 1 → Task 1; holes 2 and 4 → the window gate and the seed rule in Task 3; hole 3 → the `--from` option in Task 4 (no gate; placements after a transition are rare). §3 F1–F5 → gates and bands in Task 3; F6 → Task 5 Step 4, a human reads the file and plays it. §4 pieces 1–5 → Tasks 4, 4, 2, 3, 5. §5 inner loop → Task 5; middle loop → the pane step; outer loop → out of scope (Hatch D1–D3).
- Names used across tasks: `street`, `simulate`, `playtest`, `scorecard`, `finishTime`, `contentSheet`, `check`, `loadLevelFile`, `loadRegistry`, `NOTICE`, `ENDLESS_M`, `GATES`, `BANDS`; gate ids `G-survival`, `G-luck`, `G-window`, `G-seed`; band ids `B-speed`, `B-density`, `B-actions`, `B-idle`, `B-finish`, `B-jugs`, `B-staging`, `B-theme-lines`.
- Known ceilings, to be marked `// ponytail:` in the code: the bot plans one row at a time with a one-row look-ahead (a human reads further; upgrade: plan over a window of rows); the ship seed maximises the minimum window only (upgrade: also prefer seeds with a wider action mix); bands are fixed numbers from four hand-made levels (upgrade: recompute from the corpus when it has ten).
