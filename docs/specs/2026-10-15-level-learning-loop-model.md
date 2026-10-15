---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-15
---

# Level learning loop: a model for discussion (2026-10-15)

> Point-in-time snapshot, written in the Chat 1 session (`feat/level-learning-loop`, cut from `main` 56b6f0a) before
> any plan. Not a spec and not a build order. Code pointers are to that commit; patterns may have moved since.
> Numbers come from a throwaway probe (scratchpad, 100 seeds per level, method in §7), not from the game's own tests.

## 1. How a level file becomes a street today

```
levels/<id>.json ──validateAll──▶ levels map ──normalizeLevel──▶ sections[] ──generate(120 m chunks)──▶ rows on a 12 m grid
      (src/levels.js)   (src/validate.js)          (src/generator.js:33)            (src/generator.js:115)
                                                                                             │
   outcome {complete|dead|error}, run.jugs ◀── tick: step, boxes, hit, collect ◀── world.js binds registry views
            (src/game.js:42-43, src/main.js:115)      (src/game.js:27-44)                (src/world.js:43-75)
```

- The file is data only: ids of registered content (`content/**`), weights, curves, ranges. The loader is a Vite glob
  (`src/levels.js:6`), so a level exists only if it is a file under `levels/` at build time; the file name is the id.
  `index.json` is display order, `campaign.json` is the lock chain. Unlisted levels appear after the shipped ones,
  unlocked (`src/campaign.js:6-10`).
- `normalizeLevel` turns the file into ordered sections covering the whole level; a section may override obstacles,
  density, jugs, theme, curve, camera, props, switch generation off, and list exact placements.
- `generate` walks a 12 m grid from 40 m to `length_m − 60`. At each slot: skip if closer than `speed × reaction`
  (0.6 s) to the previous row; roll density; roll 1 / 2 / 3 lanes (50 / 35 / 15 %); pick an obstacle per lane by
  weight; if a full row has nothing passable, swap one lane for a passable id. Jugs go on a `100 / per_100m` grid,
  3 m clear of obstacles in their lane; one in 40 is a power-up from the level's list. Props go on their own grid.
- The run is distance-driven: speed is linear in z from `speed.start` to `speed.end` (or `+ ramp × z` for endless),
  capped (`src/rules.js:29-33`). A level chained by `transition` starts at the previous level's final speed and ramps
  on by its own `end − start` (`rules.js:27-28`), so level 2 runs 24→30 after level 1 instead of 12→24.
- Collision is the content module's declared `box`, not the mesh (`rules.js:81-85`). One hit ends the run unless a
  shield is up; grace (1 s) exists only after a shield (`rules.js:90-96`). The only score is `run.jugs`.

**Fixed by the engine, not the file:** the 12 m grid, the 50/35/15 lane mix, the full-row fix, bike swerve targets,
the reaction floor, the jug and prop grids, the 1/40 power-up chance, 120 m chunks (a section theme switches on the
next chunk boundary), the 40 m bend lead-in, the straight last 120 m, the linear speed curve shape, jump height
(1.35 m, 0.6 s airtime), lane change (0.15 s), slide (0.6 s at 0.8 m).

**Decided by the file:** length, seed (absent in every shipped level, so every run is a fresh street,
`src/game.js:14`), rules (twelve knobs, each range-checked), obstacle weights (which fix the share of jump / slide /
dodge / timing moves), the density ramp, jugs and power-ups, props, theme and sky, curves and cameras per section,
exact placements, the ending and its text.

Obstacles that exist (box height, bottom, depth in metres; `passable` in `generator.js:23`):

| id | move | h | y | d | note |
|---|---|---|---|---|---|
| taxi | lane | 2.0 | 0 | 4.0 | never jumpable |
| delivery_bike | lane | 1.4 | 0 | 1.8 | swerves into a free lane 30 m out |
| barrier_low | jump | 0.9 | 0 | 0.4 | |
| hot_dog_cart | jump | 1.0 | 0 | 1.6 | |
| scaffold_beam | slide | 0.4 | 1.2 | 0.6 | |
| pigeons | slide | 0.6 | 1.1 | 1.0 | |
| manhole_steam | timing | 2.5 | 0 | 1.0 | hurts 0.5 s of every 1.5 s |
| newark/stray_dog | jump | 0.9 | 0 | 1.6 | moves |
| newark/shopping_cart | lane | 2.1 | 0 | 2.0 | |
| newark/police_tape | slide | 0.35 | 1.2 | 0.3 | |
| newark/pothole | jump | 0.7 | 0 | 1.4 | |
| newark/busted_hydrant | timing | 2.5 | 0 | 1.0 | hurts 0.7 s of every 2.0 s |

## 2. What makes a level valid (hard rules, `src/validate.js`, run by CI and by the browser)

Structural: an allow-list of keys at every depth (`validate.js:8-12`, a typo is an error); id `a-z0-9-` equal to the
file name; title and author 1–60 characters; `length_m` a whole number 100–10000 or `null` (endless, which cannot
have an ending); integer seed; registered character, theme, obstacle, pickup, prop and ending ids; hex sky, fog 0–1;
rules only from `RULE_RANGES`; curve `{turn, hill}` in −1..1 or `"random"`; camera height 1.5–8, distance 3–12,
fov 45–100; props `per_100m` 0–5; density 0–1 at both ends; jugs `per_100m` 0–30 and power-ups that have an effect;
sections ordered, non-overlapping, inside the level; placements inside their section, lane 0–2 (none for a prop),
a prop that fits; ending params per the ending's own schema, `next` a real other level; index and campaign name real
files. An empty obstacle map is allowed only where nothing would generate.

Fairness: a placed row that blocks all three lanes with nothing to jump or slide fails (`validate.js:133-139`); placed
rows closer than `speed × reaction` at that point of the level's own ramp fail (`validate.js:141-149`). Generated rows
get the same two guarantees from the generator itself (`generator.js:128-140`). The test suite adds one editorial rule
for shipped levels: section theme changes sit on 120 m boundaries (`test/validate.test.js:151`).

**Holes the probe found (valid today, unfair in play):**

1. **Timing obstacles count as passable, but the player cannot time anything.** There is no speed control, a jump
   does not clear a 2.5 m box, so a full row whose only escape is steam or a hydrant is a coin flip: the box hurts for
   33–35 % of its cycle plus the crossing time. About 1 % of generated rows are such walls. With a competent bot the
   *only* deaths in all four shipped levels are these: 7 % of Broadway runs, 20 % of Garden, 12 % of Newark, 38 % of
   3000 m of Endless. `passable` (`generator.js:24`) returns true for `timing` unconditionally and both the generator's
   full-row fix and the validator's wall rule inherit that.
2. **The reaction floor is measured row centre to row centre.** A 4 m taxi eats 2.4 m of the gap on each side, so the
   real window (tail of one row to nose of the next) bottoms out at 0.36 s where the floor promises 0.6 s; the 10th
   percentile is about 0.5 s. Survivable, but it is where "unfair" would first appear if speeds or depths rise.
3. **Carried speed is invisible to validation.** Generation adapts at runtime (`world.js:32`), placements do not;
   CONTRIBUTING says "leave room". Only matters for levels with obstacle placements that sit after a `transition`.
4. **No seed means no reproducibility.** Scoring one run of a seedless level is noise; every number in this note is
   an average over 100 seeds.

## 3. What makes a level fun (soft model)

Caedon's own words, from the playtests (`docs/specs/2026-10-08-playtest-feedback.md`, v4 spec §Feedback): a
perceptible speed-up that forces reaction time to adapt (FB-2); turns, dips, over and under, camera changes and
visual breaks that hide what comes next (FB-3); power-ups that explain themselves (FB-4); corners that read from far
off and obstacles whose silhouette says the move (FB-6..8). Everything below that turns those into numbers is my
guess, to be corrected.

| Layer | Claim | How to measure |
|---|---|---|
| F1 fair | A player with ~0.45 s reaction who reads every row can finish; no luck deaths | bot survival ≥ 95 % over seeds, zero timing-wall deaths, effective window ≥ 0.4 s |
| F2 paced | Speed and density both ramp, the end is busier than the start, the finish is a sprint or a set piece | speed.end/start ≥ 1.8; density.end − start ≥ 0.25; rows per minute rising |
| F3 varied | Jumps, slides and dodges all occur; no dead stretch longer than the player forgets they are playing | action mix has all three; longest idle stretch ≤ ~15 s |
| F4 staged | Something changes the picture every 150–300 m: a turn, a dip with an overpass, a tunnel with a low camera, a bridge with a high camera | sections carry curve / camera / theme / props at that cadence; theme switches on 120 m lines |
| F5 rewarding | Jugs are dense enough to feel like a trail, a power-up every few hundred metres, an ending with a payoff | jugs 12–15 / 100 m; power-ups ≈ 1 per 300 m; an ending id |
| F6 themed | Title, theme, props, obstacle set and ending text tell one story (Newark's satire) | not a number: Caedon, or an LLM judge, reads the file |

The shipped levels as the first reference band (bot with 0.45 s notice, 100 seeds each):

| level | length | rows / run | finish | actions / min | longest idle | survives | deaths, all timing walls |
|---|---|---|---|---|---|---|---|
| 01-broadway | 1500 m | 41 | 87 s | 19 (11 L / 11 R / 4 jump / 2 slide) | 13 s | 93 % | 7 % |
| 02-garden, standalone | 1800 m | 60 | 104 s | 23 | 12.5 s | 80 % | 20 % |
| 02-garden, after Broadway (24 m/s in) | 1800 m | 60 | 63 s | 30 | 7.7 s | 82 % | 18 % |
| last-train-newark | 1600 m | 49 | 87 s | 23 | 11.5 s | 88 % | 12 % |
| endless, first 3000 m | ∞ | 111 | – | 34 | 10 s | 62 % | 38 % |

Reading: the shipped levels are already "fair" in every way except the timing walls; what separates them is pace
(Endless is nearly twice as busy as Broadway) and staging (each has a turn, a dip with an overpass, a tunnel, a bridge
or a sprint, in that order, with Newark adding a fixed-density last 200 m).

## 4. What a prompt-to-level pipeline needs

Ponytail reading: three of the five pieces exist; one is small; one is new.

1. **Schema.** No JSON Schema file, and none is needed: `validateLevel` is the schema and rejects unknown keys. The
   LLM needs CONTRIBUTING §1 (the field table and the example), a *content sheet* printed from the registry (ids with
   avoid type, box, prop lengths, power-up effects, themes, endings with their params) and two shipped files as
   examples. The sheet is a few lines of Node over `buildRegistry(await discover('content'))` (`test/helpers.js`).
2. **Validator.** Reuse `validateLevel` in Node; a one-file `scripts/` entry or a `node -e` line. Nothing to write.
3. **Playability check.** New, small, pure: the probe's bot (`generate` + `rules.step/act/playerBox/obstacleBox`),
   N seeds in well under a second, reporting survival, deaths by cause and position, effective windows, actions per
   minute, longest idle stretch, finish time, jugs and power-ups available. It needs no DOM and no three.js.
4. **Scoring signal.** A scorecard: F1 as pass/fail gates, F2–F5 as bands against the reference table, F6 by a
   reader. The critique must be text the LLM can act on ("timing wall at 622 m", "13 s without a row at 300–420 m",
   "speed never ramps") rather than one number; a single score only helps when two candidates are compared.
5. **Loop driver.** v1: Claude in a session runs the check and the bot as tools, revises the JSON, repeats until the
   gates pass and the bands are inside the reference, then hands Caedon the file to play in the pane. No API key, no
   new dependency. v2: a script that calls the API unattended (a credits gate, Caedon's).

Delivery to the game: a generated level is `levels/<id>.json` on a branch; CI runs the same validator; Pages deploys
on merge; Hatch picks it by id (contract A3). Chat 2's `?level=` is written to accept ids from `index.json`; for
generated levels it should accept any loaded, valid id instead and leave `index.json` as display order. A level that
Hatch hands over as JSON at runtime would need a loader path the game does not have and a contract change; not now.

## 5. Where the loop closes

Three loops, nested, from fastest to slowest:

- **Inner, seconds, no human.** prompt → JSON → validator → bot → scorecard → critique → prompt. Closes entirely in
  the pipeline. This is the one that makes "generate by prompt" work at all, and the one to build first.
- **Middle, minutes, Caedon.** He plays the candidate in the pane (the dev hook makes a scripted pass possible too)
  and says what is off. What learns here is §3: the bands, the gates, the staging cadence, the content sheet's
  wording. His corrections are the ground truth the inner loop's numbers approximate.
- **Outer, days, Hatch.** Every run returns `{levelId, outcome, jugs, time}` (contract A5). Per level id that gives
  completion rate, time distribution and jugs taken versus jugs available (the bot knows the latter). A level with a
  poor completion rate is re-tuned (density, speed, weights) and re-shipped under a new id or a version suffix. Needs
  D1–D3 and storage on Hatch's side; the game keeps nothing (A14). One ask for D2: include the distance reached on a
  death, otherwise the outer loop knows *that* people die, not *where*.

"Learning" here means the level improves (inner), the fun model improves (middle, outer) and the prompt improves.
No model is trained.

## 6. Open decisions (asked in chat)

Timing walls: fix `passable` for the wall rule or leave and only score it · which loop first · generated levels as
committed files or a separate pack · seed every generated level or score across seeds only · the reference band as
the first fun model or Caedon's own targets · v1 driver in-session or an API script.

## 7. Probe method (so the numbers can be rebuilt)

A scratchpad script imported `test/helpers.js`, `src/registry.js`, `src/generator.js`, `src/rules.js` and
`src/validate.js` from the worktree, built the registry from `content/`, generated each level in one call from 0 to
`length_m` (3000 m for endless) for seeds 1–100, and drove a bot at 60 Hz through `step`, `act`, `playerBox`,
`obstacleBox`, `overlaps`, `hit` and `updateObstacle`, exactly as `src/game.js` does. The bot notices a row `notice`
seconds ahead, moves to the nearest free lane without crossing a lane still blocked by the row it is passing, prefers
a lane also free in the next row, else takes a jump or slide lane (a timing lane only as a last resort), jumps 0.2 s
and slides 0.1 s before the obstacle's leading edge, and waits behind a row rather than committing to a bad lane.
Results were identical for notice 0.45, 0.6 and 1.0 s and collapsed at 0.3 s. Whole run: about 3 s.

## 8. Decisions (Caedon, 2026-10-15, in chat)

| # | Topic | Decision |
|---|---|---|
| 1 | timing walls | Fix in the engine: a timing obstacle never counts as a full row's escape; generator and validator inherit it; one test |
| 2 | first loop | The inner offline loop first (content sheet, validator entry, headless bot, scorecard) |
| 3 | where levels live | Committed in `levels/`; CI validates; Hatch picks by id; `index.json` and `campaign.json` untouched |
| 4 | seeds | Score across seeds, ship one seed that passed with margin |
| 5 | fun targets | The shipped levels' band (§3) is the first target; pane feedback adjusts it |
| 6 | v1 driver | Claude in-session runs generate, check, revise; no API key, no new dependency |
| 7 | Chat 2 note | Sent as a cross-session message from this session (§9) |
| 8 | next stage | Plan |

## 9. Note for Chat 2, the Hatch harness (sent 2026-10-15)

- `?level=` should accept any loaded, valid level id (`levels[id]` exists and `valid(id)`), not only ids listed in
  `index.json`: generated levels are unlisted by design and reach Hatch by id.
- For D2: a death result should carry the distance reached (`run.z`, metres), so the outer loop learns where
  people die, not only that they do.

## 10. How to run the loop (as run once, 2026-10-15, for the first generated level)

A snapshot of the steps used for `levels/fifth-avenue-dusk.json`, not a fixed procedure; the lab and the bands may have moved on since.

1. Run `npm run lab -- sheet`, and read CONTRIBUTING §1 plus two shipped files (`levels/01-broadway.json`, `levels/endless.json`).
2. Write `levels/<id>.json` from the prompt: obstacle weights for the move mix, a density rise of at least 0.25, a speed ratio of at least 1.8, and one set piece per 300 m (turn, dip with an overpass, tunnel with a low camera, bridge theme with a high camera and railings on 120 m lines, a fixed-density sprint).
3. Run `npm run lab -- check levels/<id>.json`, then `npm run lab -- play levels/<id>.json`.
4. Fix every failed gate and every band warning the prompt does not justify, and re-run `play`, until it exits 0.
5. Write the proposed ship seed into the file as `seed`, `play` once more (`G-seed` judges that seed), and run `npm test`.
6. Play it in the pane (every set piece where the file puts it, the ending, no console errors), then commit.
