---
provenance: agent-generated
last-verified: never
---

# HiFi test ledger, round 2 (the city, Milkshake, the hero assets)

> Point-in-time log, started 2026-10-09 on `hi-fi-city`. Spec: `2026-10-09-hifi-round2-design.md`; plan:
> `2026-10-09-hifi-round2-plan.md`. One line per `src/` change, credit spend, download, still and ruling, written as the work happens.

## Engine changes (the modularity measurement)

| Task | File | Change | Why | Generic hook or HiFi-only | Could a module have done it without this? |
|---|---|---|---|---|---|

## Assets

| Asset | Wave | Job ids | Credits | File | Size | Caedon's approval |
|---|---|---|---|---|---|---|

## Credits

Budget for the round: about 750 (ask again above about 1,000). Balance at the start: 2,979.75 (Ultra, 2026-10-09).

| Task | Job ids | Model | What | Credits (balance before → after) |
|---|---|---|---|---|

## Downloads and dependencies

| Task | What | Source | Size | Approved by Caedon |
|---|---|---|---|---|

## Stills and measurements

| Task | Still or probe | Query | Result | SHA-256 |
|---|---|---|---|---|
| 1 | `baseline-lofi-r2.png`, 2160×3840 | `?fixtures&lofi` on fba8e25 (9132bae's code plus docs), `hifiShot` | 464,350 bytes. **The round's low-fi invariant** (v4's merge retired c97c809e… on purpose) | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 1 | `baseline-lofi-r2b.png`, 2160×3840 | same, after a page reload | 464,350 bytes, byte-identical to the first | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 1 | `hifi-r2-start.png`, 2160×3840 | `?fixtures&hifi` on fba8e25 | 1,580,843 bytes, the before picture for the round | fc6bd358523be6f79b9d725b131ad1af704b14b66f74d8d8083ccf281cd12aa2 |

## Rulings

- Executor: Opus 5.5 at xhigh effort (checked with the session tool on 2026-10-13), worktree `infallible-tesla-6ebfa2`, superpowers:subagent-driven-development with parallel lanes. Subagents: Opus at medium effort for engine, city and Milkshake tasks and their reviewers, Sonnet at high effort for tooling, prompts and per-asset modules and their reviewers (Caedon's sizing, 2026-10-09), Fable for the final review.
- Before Task 1: `git fetch origin`: `origin/hi-fi-test` still at 9132bae, nothing to merge.
- Pre-flight: Ruling: the lanes run in parallel, as the plan (approved by Caedon) lays out, although subagent-driven-development says never to run two implementers at once; each implementer works in its own worktree, each lane stays serial inside, and the main session merges one branch at a time with `npm test` after each — cost if wrong: merge conflicts that the main session resolves by hand.
- Pre-flight: Ruling: this ledger merges with git's `union` driver (a local, uncommitted line in `.git/info/attributes`), because parallel implementers append rows to the same tables and every merge would otherwise conflict at the table's end — cost if wrong: two rows in a different order; delete the attribute line to undo.
- Pre-flight: Ruling: Task 9 keeps each theme overlay's current `look` object exactly as it is and only adds the import, the style and `createChunk`; the plan's sample block shows look values that may differ from the file, and the retune belongs to Task 24 — cost if wrong: none; the HiFi look stays as sub-project 1 tuned it until Task 24.
- Pre-flight: Ruling: Task 10's test "buildings stand on the facade line" checks every vertex of each building mesh (|x| ≥ 7.1 m) instead of the merged mesh's bounding box: a merged mesh carries both sides of the street, so its box spans −17.5..17.5 m and the plan's check passes for anything — cost if wrong: a stricter test that a cornice could trip (fix the cornice, not the test).
- Pre-flight: Ruling: Task 18 Step 3's browser check (which composer target the scene renders into) is the main session's, since subagents cannot use the browser pane; the main session runs it before dispatching Task 18 and hands over the answer — cost if wrong: none.
- Pre-flight: Ruling: in Task 23 the fourteen kit entries (12 furniture, 2 vehicles) go to one agent, as one batch of the same kind of edit to `packs/hifi/lib/kit.js`, instead of fourteen agents editing one file; and every per-asset agent writes its test in its own file `test/hifi-<id>.test.js` (`npm test` runs `test/*.test.js`) instead of appending to `test/packs.test.js`, so parallel branches never conflict — cost if wrong: one more file per asset.
- Pre-flight: Ruling: when Task 13 (engine lane) and Tasks 9–12 (city lane) both edit `packs/hifi/themes/*.js`, the main session resolves the merge by keeping both sides (the city's `createChunk` and style, the look's `skyline` and `assets`) and runs `npm test` before the next dispatch — cost if wrong: a merge redone by hand.

## Progress

Pre-flight scan (2026-10-13), every pair of tasks that share a file or an interface:

| Tasks | Shared | Producer → consumer | Found |
|---|---|---|---|
| 1 ↔ all | this ledger | every task appends rows | parallel appends conflict → union merge (Ruling) |
| 2 ↔ 17 | `src/game.js` | 2 imports `gfx` and `assets` for the dev hook; 17 relies on that `gfx` import | serial (2 long before 17); clean |
| 2 ↔ 8 | stills, `gfx.time` | `pose` sets `run.time = 0` then `world.update`, which (after 8) sets `gfx.time` | stills pin `gfx.time` with no extra code; clean |
| 2 ↔ 22, 25 | `hifiLineup` | 2 produces; main session consumes | clean |
| 3 ↔ 5, 20, 21 | prompt book | 3 writes; main session pastes verbatim | 28 model rows = 12 furniture + 13 hero + 2 vehicles + Milkshake; clean |
| 6 ↔ 7 | `adopt` in `src/assets.js` | 7's `adopt` is 6's plus a texture branch | clean |
| 6 ↔ 11 | `gfx.dispose`, cloned materials | 11's 200-chunk test and traffic clones rely on 6 | clean |
| 7 ↔ 10, 13, 24 | `gfx.texture` | facade tiles and skyline rings | clean (`src/look.js` imports `texture` from `./assets.js`) |
| 7 ↔ 16 | `release` | 16 calls it after the world is disposed | clean |
| 8 ↔ 9–12 | `lib/` skip, `chunkRng`, `gfx.time` | 8 before any `lib/` file exists | clean |
| 9 ↔ 10 ↔ 11 ↔ 12 | `packs/hifi/lib/*`, `style` | 9's `parts` list; 10–12 add parts and style fields | clean |
| 9–12 ↔ 13 | `packs/hifi/themes/*.js` | city edits `createChunk`/style; 13 edits `look.skyline`/`assets` in parallel | textual conflicts expected → main session merges both sides (Ruling) |
| 9 ↔ current overlays | theme `look` | plan sample vs the file's tuned values | keep the file's look (Ruling) |
| 13 ↔ 15 ↔ 18 | `src/look.js` | engine lane, serial | clean |
| 14 ↔ 15 | probe picks | Caedon's two choices | clean |
| 17 ↔ 23 | `packs/hifi/pickups/shield.js` | 23 adds `createView`/`assets` to 17's file | serial; clean |
| 18 ↔ 23 | `fitBox`, `gloss`, `glowMap` | helpers every overlay uses | clean |
| 19 ↔ 23 | `cowView` | Milkshake overlay | clean |
| 11 ↔ 23 | `KIT` in `packs/hifi/lib/kit.js` | 14 entries edited in parallel | one batched agent (Ruling) |
| 23 agents ↔ each other | `test/packs.test.js` | parallel appends | one test file per asset (Ruling) |
| 13 ↔ 24 | placeholder skyline | 24 removes it once no look names it | clean |

Every task against itself:

| Task | Self-consistent? |
|---|---|
| 2 | Yes: four fixture ids in the test match Step 1; `hifiShot(name, { level, frame })` matches the interface line |
| 3 | Yes: the asset table has the 28 rows wave 1 prices |
| 6 | Yes: three new tests, 121 expected; the dispose test's expectation follows from the code (the shared map is spared, the own material freed) |
| 7 | Yes: 124 expected; `preload(paths, loader)` is what the image test injects |
| 8 | Yes: 126 expected |
| 9 | Yes: `createChunk` reads `args.theme.buildings`, which the shipped themes carry (`{ colors, minH, maxH }`) |
| 10 | Mostly: the facade-line test is weak on merged meshes (Ruling); the 4 m tower clamp is in the prose, not the code block (the implementer adds it) |
| 11 | Yes: every rhythm x lies in the 4.8–7.3 m band; wide kinds clamp inside the chunk (prose) |
| 12 | Yes: the test's z0 = 1080 builds no tower (1080 mod 240 ≠ 0) |
| 13 | Yes: the pack test needs every overlay's skyline in its `assets`, which Step 6 adds |
| 16 | Yes: the field names match `src/validate.js` (`character.id`, `ending.id`, `jugs.powerups`, `props.ids`, placement `kind` in obstacle, pickup, prop) |
| 17 | Mostly: the test's stand-in pickup may need the shipped pickup's required fields (name, blurb, glyph) to pass `checkModule`; the implementer adapts the stand-in, not the check |
| 18 | Mostly: Step 3's browser check is the main session's (Ruling) |
| 19 | Yes |

- Task 1, Step 1: baseline at fba8e25: `npm test` 118 pass, 0 fail; `npm run build` succeeds.

## Final review

## Gap to the reference

## Close-out (round 2)
- Task 1: complete (commit below; npm test 118 pass; low-fi invariant 3d77a939…)
