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
| 6 | `src/gfx.js` | `BEND` applies the batching and instance matrices before the model matrix, then the street's offset | Instanced lamp posts, trees and lane dashes rendered every copy at the mesh's origin under the bend | Generic hook | No: the bend owns the vertex projection |
| 6 | `src/gfx.js` | `bendable` keys on a WeakSet of patched materials, not `userData.bent` | A cloned material copies `userData` but not the hook, so it rendered straight | Generic hook | No |
| 6 | `src/gfx.js` | `dispose` frees instanced and batched meshes' buffers and spares geometry, materials and maps flagged `userData.shared` | A module's InstancedMesh over a preloaded model's geometry freed the shared model on drop | Generic hook | No |
| 6 | `src/assets.js` | `adopt` flags every node's geometry, materials and material textures as shared, not only the nodes | So `dispose` can tell shared parts reused in a module's own meshes | Generic hook | No |
| Task 2 | `src/game.js` | the dev hook also carries `gfx` and `assets` (the page's own module instances) | the lineup preloads and copies models through the page's own cache | Dev only (stripped from builds) | No: the hook is the only handle on a running level. |
| 7 | `src/registry.js` | `assets` may list `.webp` and `.png` images as well as `.glb` models | The city's facade tiles and skylines are listed and preloaded like the models | Generic hook | No: the loader and the asset rule live in the engine |
| 7 | `src/assets.js` | `preload` loads images as sRGB textures through `adopt` (flagged shared); `texture(path)` hands out the shared texture; `release(keep)` frees every cached file not kept | Images preload like models, and a level's files can be freed later (Task 16 wires `release`) | Generic hook | No: the loader and the asset rule live in the engine |
| 7 | `src/gfx.js` | re-exports `texture` beside `asset` | Modules reach preloaded images through `gfx`, never importing `src/` | Generic hook | No: the loader and the asset rule live in the engine |
| 8 | `src/registry.js` | `loadPack` skips files under `packs/<pack>/lib/` | A pack's helpers (the city generator) are imported by modules, never loaded as overlays | Generic hook | No |
| 8 | `src/gfx.js`, `src/world.js` | `gfx.time = { value }`, set to `run.time` first thing in `world.update` | Shaders animate LED faces, marquees and traffic from the run clock; pause freezes it and stills pin it | Generic hook | No: no module has a per-frame hook for a chunk |
| 13 | `src/registry.js` | `checkLook` accepts `look.skyline` (one or two `.webp`/`.png` paths) and `look.sun.dir` (`[x, y, z]`, y < 0) | A theme names its horizon image and turns its sun | Generic hook (the ring is HiFi-only code in the HiFi-only file) | No: nothing could live at the horizon |
| 13 | `src/look.js` | `lookState` carries `skyline` and `sun.dir`; two camera-centred open cylinders (radius 360 and 330 m) wear the skyline beyond the streamed city, unfogged, unbent; `apply` turns `engine.sunDir` | The far field past the city's last chunk, and a per-theme sun | Generic hook (the ring is HiFi-only code in the HiFi-only file) | No: nothing could live at the horizon |
| 13 | `src/engine.js` | `sunDir`, a per-engine copy of `SUN_DIR` that `follow` aims along, reset by `setSky` and exposed for the look | A look may turn the sun; low-fi never changes it, so its frames are unchanged | Generic hook (the ring is HiFi-only code in the HiFi-only file) | No: nothing could live at the horizon |
| 16 | `src/assets.js` | `levelAssets(level, registry)` lists every file a level names (section themes, obstacles, power-ups and the default jug, props, placements, its character and ending); `gateLoads(load)` drops a second start while a load runs; `gate` removed | A HiFi level's decoded textures run to about 200 MB, so each level loads only its own files | Generic hooks | No: the loader and the asset rule live in the engine |
| 16 | `src/main.js` | No boot-time preload: the menu and every level start `prepare` their level's files behind LOADING…; `startLevel` calls `release(levelAssets(…))` after the backdrop or previous world is disposed, before the level's sky | GPU memory follows the level; the campaign chain keeps the shared files | Generic hooks | No |

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
- Task 3: Ruling: where the asset table says "none" for words, the concept prompt reads "no readable text at all" instead of "no readable text except none" — the literal fill contradicts itself and can prime the model to print "none" — cost if wrong: none, one clause per prompt.
- Task 3: Ruling: the delivery bike's concept and views end "no people other than the toy rider", and "NYC" is dropped from the cobra-head lamp's subject — the table asks for a toy rider that the template's "no people" forbids, and a model may print the letters on the pole — cost if wrong: a regenerated concept at 0.25 credits.
- Task 3: Ruling: four palette tokens are added beyond `src/palette.js` and the themes (street green #2f5a45, leaf green #5fae4e, signal green #3fbf6a, teal #2bb3a7), flagged in the prompt book — the subject list needs dark green furniture, trees, a green signal lens and a teal sedan — cost if wrong: the colours are re-picked on board 16 and the affected concepts rerun.
- Task 3: Ruling: facades, storefronts, party walls, trims and skylines are 2k at quality medium, the other image sets 1k at quality low; party walls and trims are 1:1 — the brief gives sizes only for facades and storefronts and names the probe "2k medium" — cost if wrong: the probe's price re-quotes wave 2.
- Task 3: fix round 1: the prompt book's review minors, all text only — Milkshake's views say "the same cow mascot"; the skyline prompts drop the landmark names (clause now "nothing that resembles any real landmark") and the theme sky hexes; the bridge style frames lose the shop-sign sentence; the facade template reads "of {style}" with the article and "facade" inside each filled style (midtown 05 no longer mentions a sky); the storefront tally is DELI 2, CAFE 3, PIZZA 2, HOTEL 2, no words 3; the barrier and overpass concepts lose their angle phrases; poster 11 has one dark border; the model-id note says Nano Banana Pro and 2.1 are unconfirmed; the poster references no longer claim the keyframes show billboard stacks — cost if wrong: a regenerated image set at 0.25 credits an image.
- Task 13: Ruling: `apply` hides both rings before its no-look early return, and the ring loop reads `s.skyline` (not `s?.skyline`) after it — the brief's loop sat after `if (!s) return`, so a switch to a theme with no look would have left the last skyline showing — cost if wrong: none, the rings are hidden either way when there is no look.
- Task 13: Ruling: two sub-project 1 tests in `test/look.test.js` now expect the new shape (`lookState(...).sun` gains `dir: null`; the unknown-sun-key message reads "color, intensity and dir") — the brief changes both and the old expectations pinned the old shape — cost if wrong: none.
- Task 13: Ruling: the ring's foot is tinted to the level sky (`lookState(...).skyBottom`, the colour the fog and the dome's horizon fade to) with an `onBeforeCompile` patch, a smoothstep over the lowest 8% of the ring (`RING.fade`), not vertex colours — vertex colours multiply the image and cannot blend it toward a colour; no Node test, since `createLook` needs a WebGL renderer (PMREM, composer) — cost if wrong: the 8% knob is re-tuned from the main session's frames.

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
- Task 6: complete (commits 8a7b33a..15a52b7, merged as b01785a, review clean; npm test 121; `?lofi` still 3d77a939…, unchanged)
- Task 6: minor (deferred): `adopt`'s shared flag survives a clone (`BufferGeometry.copy` shares `userData` by reference, `Material.copy` copies it), so a module that clones a shared part to modify it keeps it flagged and `dispose` never frees it; latent, nothing clones a shared part for itself today (Task 11's traffic clones are cached and shared on purpose).
- Task 6: minor (deferred): `userData.bent` is now write-only in `src/` (tests still read it), and the header of `src/assets.js` still says only nodes are flagged.
- Task 2: minor (deferred): `hifiLineup` (plan code) restores the scene, pixel ratio and size only on success (no try/finally), centres its row about 2 m off, and always uses the default shot level.
- Task 2: minor (deferred): the fixture test checks each shot level validates, not that its file name, id, title and theme agree.
- Task 2: Step 5 (main session): `t2-16x9` (3840×2160, 677f151c…), `t2-midtown` (2160×3840, c793d904…) and `t2-lineup` (the taxi on the road) render; `?lofi` re-shot after merging Tasks 2 and 6: 3d77a939…, unchanged. Found: switching shot levels in one page left the previous level's world in the scene (two cities z-fighting at the facade line) → fix round 1.
- Task 2: fix round 1/5 (1 addressed, 0 open — shotLevel started a level on top of a running one; commits cb0d741..b10710c)
- Task 2: complete (commits 8a7b33a..b10710c, merged as fe47ba2 and the fix after it; review clean)
- Task 2: fix round 1 checked in the browser: midtown then downtown in one page, downtown clean (no second city), 5bcc4045… at 540×960.
- Task 7: complete (commits fe47ba2..b8696ba, review clean; npm test 124)
- Task 7: minor (deferred, carry to Task 16): a path still loading when `release` runs is adopted afterwards and stays cached outside `keep`; run `release` only after the level's `preload` has settled.
- Task 7: minor (deferred, carry to Task 16): a `gfx.texture` image put on a material cloned from a cached `.glb` would be disposed when that `.glb` is released, even if another level keeps the image.
- Task 7: minor (deferred): the `release` test empties the module cache for every later test in `test/assets.test.js`; it passes only because it runs last.
- Task 3: review approved (commits 8a7b33a..95b32d4, merged); minors below.
- Task 3: Ruling: the review's prompt-text minors (Milkshake's four view prompts garbled, the landmark names inside the skyline negations, the bridge style frames' shop-sign line, sky hex values in transparent-sky skyline prompts, midtown-05's "reflecting a warm orange sky" against "no sky", the storefront sign tally, the barrier and overpass angle phrases against the template's three-quarter view, poster 11's repeated border, the facade template grammar, the model-id source note) are fixed before any spend, in one follow-up commit by the Task 3 implementer with a scoped re-review — they are minors, but a wrong prompt costs credits — cost if wrong: one more Sonnet round.
- Task 3: Ruling: the skyline prompts drop the two landmark names and keep "generic towers and stepped spires … nothing that resembles any real landmark": naming a landmark inside a negation primes an image model to draw it (the plan's prompt text named them) — cost if wrong: a skyline regenerated at 0.25–2 credits.
- Task 8: complete (commits fbcea06..348134d, review clean; npm test 126)
- Task 8: minor (deferred): no test covers "pause freezes `gfx.time`" (it holds because `game.js` skips `world.update` while paused); `gfx.time` is module-global and keeps the last run's value until the menu's `update(idle, 0)`; `discover`'s `lib/` skip is covered only through "the HiFi pack applies cleanly".
- Task 3: fix round 1/5 (10 addressed, 0 open — the ruled prompt-text minors; commits 95b32d4..32fd220)
- Task 3: complete (commits 8a7b33a..32fd220, review clean after the fix round)
- Task 3: minor (deferred): the bridge style frames still end "soft bloom on lit windows and signs"; one downtown facade palette names "clear sky blue #9fd3f5" beside "no sky"; midtown-01's skyline text says orange-grey without an orange token.
- Task 4: Board 15 "City layout" drawn on Paper (file 01M46QWM611CXK4WQSBTH6FJK3, beside board 14): cross-section to scale, one 120 m chunk with the furniture rhythm, shell types per theme with the bridge, the horizon rings and the placeholder palette. Caedon: "Approve as drawn" (2026-10-13, AskUserQuestion).
- Task 4: Ruling: the board follows Task 4's prose for the rare pieces (one bench and one newsstand a chunk on average, at most one bus shelter or subway entrance a chunk, on one side), not Task 11's sample `RHYTHM` (a bench every 60 m on each side, a newsstand and both shelters rolled per side); Task 11 implements the board — cost if wrong: knob values in `packs/hifi/lib/furniture.js`.
- Task 5: Caedon approved wave 1 at about 46 credits (2026-10-13, AskUserQuestion). Model ids confirmed with `models_explore`: `gpt_image_2_5` (quality low…max, resolution 1k/2k/4k, `background` transparent), `nano_banana_pro` (1k/2k/4k, default 2k), `nano_banana_2_1` (8:1 aspect available).
- Task 9: no `src/` change (the street lives in `packs/hifi/lib/{shapes,materials,street,city}.js`, called from the downtown, midtown and uptown overlays' `createChunk`; their `look` objects untouched per the pre-flight ruling); npm test 129; the Step 6 browser probe is the main session's.
- Task 9: complete (commits cab3c2d..387a07a, review clean; npm test 129; no `src/` change)
- Task 9: minor (deferred): the crosswalk stripes sit off-centre (0.4 m of plain road on one side, 0.8 m on the other); "another seed builds a different chunk" compares only the first 32 instance floats; three identical road/walk/paint materials (one per theme id).
- Task 9: Ruling (carried into Task 10): board 15 shows the side street cutting through both sidewalks, but Task 9's sidewalks run unbroken through the cross street; Task 10 splits the two sidewalk boxes at the cross street in `street.js` — cost if wrong: two more meshes a chunk.
- Task 13: fix round 1/5 (1 addressed, 0 open — the ring's foot fades to the level sky; hidden rings unbind their image; commits 20aa396..ee5b976)
- Task 13: complete (commits eefa9f7..ee5b976, review clean after the fix round). Merge with Task 9 conflicted in the three city theme overlays as expected; resolved by keeping both sides (Task 13's `assets` and `look.skyline`, Task 9's `createChunk`); npm test 131.
- Task 13: minor (deferred): the first HiFi title screen after boot shows no skyline (`menu()` applies the look before the preload lands; runs and later menus are fine; Task 16's per-level preload changes this flow); the ring's 8% fade is about 39 m tall on the 360 m ring and the tallest placeholder towers sit about 38° up: calibration, checked in the probe frames.
- Before Task 16: Ruling: the engine lane runs Tasks 16, 17 and 19 ahead of Task 15 (which waits for the probe and Caedon's two picks); none of them touches `src/gfx.js`, `src/look.js` or `src/engine.js`, which Task 15 edits; Task 18 (also `src/look.js`) still follows Task 15 — cost if wrong: a rebase-style merge of Task 15 over the others.
