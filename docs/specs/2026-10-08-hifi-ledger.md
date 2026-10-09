---
provenance: agent-generated
last-verified: never
---

# HiFi test ledger (sub-project 1)

> Point-in-time log, started 2026-10-08 on `hi-fi-test`. Spec: `2026-10-08-hifi-test-design.md`; plan:
> `2026-10-08-hifi-test-plan.md`. One line per `src/` change and per credit spend, written as the work happens.

## Engine changes (the modularity measurement)

| Task | File | Change | Why | Generic hook or HiFi-only | Could a module have done it without this? |
|---|---|---|---|---|---|
| 2 | `src/engine.js` | `resize(w = innerWidth, h = innerHeight)` takes an explicit size and is on the returned object; the listener wraps it so the event is not read as the width | Stills render at 2160×3840 without resizing the window | Generic hook | No: the renderer and camera live inside `createEngine` |
| 2 | `src/game.js` | The dev hook adds `character` | `scripts/hifi-shot.js` poses the character for stills | Dev only (stripped from builds) | No: the hook is the only handle on a running level |
| 3 | `src/registry.js` | `applyPack`, `SKIN_FIELDS`, `loadPack`; `checkModule` validates an optional `assets` list for every kind | Packs re-skin registered modules with looks-only fields | Generic hook | No: before this a module could not re-skin another module (spec finding 6, look and gameplay fused per id) |
| 3 | `src/main.js` | Quality switch (`?hifi`, `?lofi`, else `pointer: fine`) and the lazy `hifi` pack load merged over the registry | HiFi on mouse and trackpad, low-fi on touch | Generic hook | No |
| 4 | `src/assets.js` (new) | `adopt`, `preload` (never rejects, dedupes, skips cached), `asset` (a clone sharing geometry and materials, every node flagged `userData.shared`) | Generated GLBs in synchronous views | Generic hook | No: obstacle, pickup and prop views are sync-only (spec finding 4) |
| 4 | `src/gfx.js` | Re-exports `asset`; `dispose` skips nodes flagged `userData.shared` | Dropping one copy must not free the next one's geometry | Generic hook | No: `dispose` freed any material with a map (spec finding 3) |
| 4 | `src/main.js` | Preloads every listed asset at boot; RUN reads LOADING… until it settles; `startLevel` awaits it | A view needs its files before the street is built | Generic hook | No |
| 5 | `src/look.js` (new) | `lookState` (pure) and `createLook`: RoomEnvironment reflections, a camera-centred gradient sky dome, PCF soft sun shadows (4096 map), an EffectComposer on a half-float 4× MSAA target with bloom and output passes | The HiFi look | HiFi-only file, loaded on demand | No: the look was hard-coded in `src/engine.js` (spec finding 1) |
| 5 | `src/engine.js` | `useLook`; `sun` and `hemi` on the returned object; `setSky` resets the low-fi light, then `look?.apply`; `render` and `resize` go through the look when active; the sun aims 25 m ahead along the same direction | One hook that a look plugs into; shadows cover the street ahead | Generic hook | No |
| 5 | `src/gfx.js` | `bend` marks opaque meshes as shadow casters and receivers | Every object the engine adds passes through it once | Generic hook | No |
| 5 | `src/world.js` | `skyAt` returns the section theme's id and `look` | The look follows a mid-level theme switch | Generic hook | No |
| 5 | `src/game.js` | The sky-change key includes the theme id | A theme switch under the same sky colour still re-applies the look | Generic hook | No |
| 5 | `src/registry.js` | `checkLook`; the theme check validates an optional `look` | A look is data, range-checked like the rest of a theme | Generic hook | No |
| 5 | `src/main.js` | In HiFi, `engine.useLook(createLook(engine))` from a lazy `import('./look.js')` | Low-fi never downloads the look code | Generic hook | No |
| Final | `src/assets.js` | `gate(ready)`: while the preload is pending, only the first caller waits | A second click on LOADING… started a second level (review, Important 1) | Generic hook | No |
| Final | `src/registry.js` | `safeLoad(label, load)`, the async twin of `safeCall`; `loadPack` loads each file through it and takes its file map as a parameter (for the test) | One pack chunk failing to import blanked the HiFi page (review, Minor 3 re-graded) | Generic hook | No |
| Final | `src/main.js` | `startLevel` waits through `gate`; the look loads through `safeLoad` and falls back to low-fi | Same two findings | Generic hook | No |

## Credits

Budget for sub-project 1: 40. Balance at the start: 3,000 (Ultra, 2026-10-08).

| Task | Job id | Model | What | Credits |
|---|---|---|---|---|
| 1 | db0e7dc4-31d6-4389-84ce-4fe6365707a9, cd75593a-36a1-4537-9145-4d2694791e4b, 6263aa35-5102-4af4-a2c2-041571bdf43f, 0d4f4acc-f345-4290-81fb-b7e9af1ed764 | gpt_image_2_5 (1024², quality low) | 4 taxi concept variants | 1 (balance 3,000 → 2,999) |
| 6 | 9c73c650-3f05-4f0c-b6cf-17b24adff2aa (discarded: drifted to a rear view), 91e501a8-0e07-4250-9e0f-7f7e0fecb097 (left), 83f26e66-5282-4d67-9566-36dc5991e121 (rear), 2ee67aed-1339-47e2-8ec7-b51c0bb5a6b1 (right), b8a0bef5-24b2-4ba4-af30-d95d2aec8bae (front, regenerated) | gpt_image_2_5 | Views of concept 3 for the multi-view model | 1.25 |
| 6 | 99cb188a-9fa2-4d91-b4d5-3e53ea2cecec | tripo_h3_1_multiview_to_3d (detailed geometry and texture, PBR, face_limit 20000; views front, left, rear, right) | The taxi model; Caedon judged it in the 3D viewer and approved the download, so the retry was not used | 18 (balance 2,999 → 2,979.75 with the views) |

Sub-project 1 total so far: 20.25 of 40.

## Downloads and dependencies

| Task | What | Source | Size | Approved by Caedon |
|---|---|---|---|---|
| 6 | `taxi_raw.glb` into the session scratchpad, not committed (SHA-256 31d749053aaa978a32390faea96906d1c07efc34d8199225197947027452fd07): one mesh, 19,307 triangles, 4096² colour, ORM and normal textures, long axis along x | d8j0ntlcm91z4.cloudfront.net (Higgsfield CDN, job 99cb188a) | 8,057,164 bytes | Yes, in chat, 2026-10-09 |
| 6 | `@gltf-transform/cli` 4.5.1 (MIT), devDependency; brings sharp 0.35.5, meshoptimizer and gltf-validator | npm registry | 440 KB unpacked (the package alone) | Yes, in chat, 2026-10-09 |

## Stills and measurements

| Task | Still or probe | Query | Result | SHA-256 |
|---|---|---|---|---|
| 2 | `baseline-lofi.png`, 2160×3840 | `?fixtures` (before the quality switch, so low-fi) | 466,912 bytes. `SHOT` tuned by eye against board 01's 9:16 keyframe (Paper F-0): taxi at 68–92% of the height (reference 69–92%), vanishing point near 23% (reference 22%). Milkshake reads about half the reference's size, a stylisation of the teaser art. **Superseded in Task 5:** this hash depended on the run's speed at the pause | aa94a1946d1738ec4f94713187dcac7ec0166f28e668d01e20bd199fa615abcf |
| 5 | `baseline-lofi.png`, 2160×3840, re-shot | `?fixtures` on the Task 2 code (d3301fa, served from a temporary worktree, since removed), with the speed-pinned script | 467,324 bytes | c97c809eeb061cf5c1e6f49316c79183aa99d11789c67c678a13dd086d0c19fc |
| 5 | `lofi-task5.png`, 2160×3840 | `?fixtures&lofi` on the Task 5 tree, fresh page load | 467,324 bytes, byte-identical to the re-shot baseline: low-fi unchanged | c97c809eeb061cf5c1e6f49316c79183aa99d11789c67c678a13dd086d0c19fc |
| 8 | `hifi-taxi.png`, 2160×3840 | `?fixtures&hifi` | 1,582,642 bytes | d61b5469569c59b0185c08c12561fef62c9d0d51d114f6163f78fb8b2d6ea50e |
| 8 | `lofi-final.png`, 2160×3840 | `?fixtures&lofi` | 467,324 bytes, byte-identical to the baseline: low-fi unchanged at the end of the sub-project | c97c809eeb061cf5c1e6f49316c79183aa99d11789c67c678a13dd086d0c19fc |
| 8 | `hifiProbe()`, HiFi | `?fixtures&hifi`, 300 back-to-back frames at 3024×1964 (1512×982 at dpr 2), `gl.finish()` each, in the desktop app's browser pane | mean 6.73 ms, p95 10.9 ms (bar 16.7 ms); 442 draw calls, 181,820 triangles across all passes, shadow map included | — |
| 8 | `hifiProbe()`, low-fi | `?fixtures&lofi`, same | mean 1.66 ms, p95 4.4 ms; 287 draw calls, 75,798 triangles | — |
| 6 | `public/hifi/taxi.glb` | `npm run assets:optimize` then `gltf-transform inspect` | 523,352 bytes (raw 8.06 MB); EXT_meshopt_compression, EXT_texture_webp, KHR_mesh_quantization; 19,157 triangles; three 2048² WebP textures (206, 90 and 84 KB) | 7c12f1272c8e400f0ea94d65f4a70123eda7ffcc8dd0153f6bb54e4f48d53efb |

## Rulings

- Ruling (plan): packs/hifi/themes/ carries a look for all four shipped themes, not only downtown (spec §4 named downtown), because levels 1 and 2 switch to `bridge` mid-run and HiFi must not drop to the low-fi renderer there.
- Ruling (plan): only opaque meshes cast and receive shadows (spec §4 said everything the engine adds), so glows, blob shadows and sprites never cast hard shadows.
- Task 1: Ruling: this file also carries the executor's pre-flight and per-task completion lines (Progress, below), mirrored from executing-plans' scratch `progress.md` — Caedon asked for one ledger, and the scratch copy is deleted at the end — cost if wrong: one section to delete.
- Reference: 16:9 keyframe is job ed480a6e-19ce-48ff-8cf1-df1f86e16abd (2752×1536), 9:16 is job 854c98cf-81b2-40f4-8022-ac87b5a89a06 (1536×2752); both nano_banana_2 with the Milkshake-3D element. Higgsfield preference `auto_create_project: false`, so generations carry no folder_id.
- Task 1: Ruling: the live `get_cost` quote (Step 6) was blocked by Claude Code's auto-mode classifier as a real-world transaction; Caedon approved the spend against the spec's 2026-10-08 quote (0.25 each) and the charge was read back from the balance (1 credit) — cost if wrong: none here; later quotes may need Caedon to allow `get_cost` or approve from the spec's prices.
- Task 1: Caedon's concept pick (in chat, 2026-10-08): **3**, job 6263aa35-5102-4af4-a2c2-041571bdf43f. Task 6 builds from it.
- Before Task 2: Ruling: merged `origin/feat/v1` (4a145c7, the merge of PR #3) into `hi-fi-test` as a7d951e, bringing camera fix 4ecd1a7 (`streakOpacity`, `resize()` derived like `follow()`, the end and menu snaps). Flagged by the planning session, verified with git (feat/v3-feedback = e3742bc + 4ecd1a7, same tree as origin/feat/v1), approved by Caedon in chat because his brief said never merge. Consequences: the plan's full-file `src/engine.js`, `src/game.js` and `src/main.js` blocks are applied as edits on top of the merged files, keeping the fix; the suite baseline is 86, so the plan's counts shift by one (106 → 107); the Task 8 draft PR would target `feat/v1` (asked then) — cost if wrong: `git reset --hard 6d0b4e2` before anything is built on it.
- Task 2: Ruling: Step 5's `resize` body sets `camera.fov` from `live.fov`; the merged file sets it from `cameraFor(…, live, live.speed).fov` (4ecd1a7). Kept the fix's line and applied only the size parameters, the comment, the wrapped listener and `resize` on the returned object — the plan predates the fix — cost if wrong: none; the line is the fix's.
- Task 2, Step 11 (as planned, not a deviation): the plan's first-guess `SHOT` (camUp 5.4, camBack 10.5, lookAhead 16) cropped the taxi at the bottom and put the vanishing point at 35%; retuned to `{ runZ: 62.5, runY: 1.8, camUp: 7.8, camBack: 14, lookAhead: 9 }` after two low-resolution passes with a throwaway in-page helper.
- Task 5: Ruling: Step 5's full-file `src/engine.js` applied as edits on the merged file; a diff against the plan's block shows exactly 4ecd1a7's lines (the `streakOpacity` export, the `cameraFor`-derived `resize` fov, the snap comment, `streakOpacity` in `follow`) — the plan predates the fix — cost if wrong: none; those lines are the fix's.
- Task 5: Ruling: tuned the look knobs (Step 12 allows it): downtown and bridge sun 3 → 2.4 and ambient 0.5 → 2.0; midtown sun 2.6 → 2.1, ambient 0.45 → 1.8; uptown sun 2.2 → 1.8, ambient 0.55 → 2.2. Every shipped material is `MeshToonMaterial`, which ignores `scene.environment`, so in the buildings' shadow (which covers most of the road) only the hemisphere light reaches it; at 0.5 the road went near-black, about 7× darker than low-fi. Downtown checked by eye at 1280×720, bridge after the mid-run switch, midtown and uptown spot-checked with their level skies. `env` changes nothing visible until a standard or physical material arrives (the Task 7 taxi) — cost if wrong: knob values only.
- Task 5: Ruling: `scripts/hifi-shot.js` now pins `run.speed` (`SHOT.speed = 12`), a plan defect Step 13 exposed. Milkshake leans forward with speed, and a run paused a few ms later is a little faster, so stills differed between page loads (31 pixels on the character, found by a pixel diff; varying only the speed reproduced it, and the old sun formula and the shadow flags were ruled out). The Task 2 hash could not be reproduced, so the baseline was re-shot from d3301fa with the pinned script: byte-identical to Task 5's low-fi — cost if wrong: none; stills are dev artefacts.
- Task 7: the HiFi taxi needed **no `src/` change** beyond Tasks 3 to 5: one pack file, `packs/hifi/obstacles/taxi.js`, plus the GLB (the modularity measurement for an asset).
- Task 7, calibrated knobs: `YAW = −π/2` (the generated model's long axis runs along x; at −90° its rear faces −z, checked by close-ups at ±90°); `SIGN` as planned `{ w: 0.46, h: 0.14, d: 0.2, y: 0.02, z: 0 }`; `TAIL` removed for `LAMP_GLOW = 5` (ruling below). Measured in game: 2.00 m wide, 3.16 m long, 2.08 m tall, wheels at y = 0, centred on its lane.
- Task 7: Ruling: the tail-light box plates (plan Step 3) are gone. Caedon saw the calibration crops and said the red box around the lamp looked unnatural (2026-10-09, in chat). The paint now carries an emissive map built from the model's own red lamp texels (`lampMask`, covered by a new test; it is made in the browser from the colour map, at 1024²), so the lamps glow in their own rounded shape. Glow 5 rather than 7 keeps them red instead of white-hot. Spec §5 asked for "small emissive meshes" for the tail lights; they are now emissive texels of the model itself — cost if wrong: restore the plates (about 8 lines).
- Task 7: Ruling: kept the plan's footprint-only fit, so the chunky toy taxi stands 2.08 m tall against the 1.5 m box (the shipped visual reaches 1.66 m with its sign), against the spec's "detail goes inside the box, never above it". The taxi can't be jumped (apex 1.35 m < 1.5 m), so extra height can't mislead the action. Fitting the height too would shrink it to about 1.45 × 2.29 m inside the 2 × 4 m collision box: about 0.85 m of invisible collision at its rear, against 0.42 m now — cost if wrong: add the box height to the `Math.min` (one line), and the test's "fills the footprint" becomes "fits the box".
- Task 7: Ruling: retuned the look knobs a second time, for the physical paint: `env` 0.7 → 0.4 (midtown and uptown 0.6 → 0.35); bloom threshold 0.85 → 0.9 (midtown and uptown 0.8 → 0.9); strength 0.5 → 0.4, 0.6 → 0.45, 0.7 → 0.5. At 0.85 with `env` 0.7, the clearcoat under the raised ambient bloomed the whole taxi into a pale blur; three variants compared by eye at the shot framing. Midtown and uptown were scaled the same way and not checked by eye with a taxi — cost if wrong: knob values only.
- Task 7, Steps 6–7: `?hifi` level 1 played for 20 s (z 0 → 261), then teleported to 650, 400 and 600: 3, then 8 HiFi taxis in the scene, 0 pink fallback blocks, no console errors; the later taxis render textured and bend with the street after earlier chunks dropped (Review Focus 5).
- Task 5, Step 14: `?hifi` at the mobile preset (375×812 CSS, 750×1624 buffer) fills the portrait canvas, not stretched; after resetting to desktop and a resize event the frame follows the 1024×768 canvas.

## Progress

- Executor: Opus 5.5, max effort, inline (superpowers:executing-plans), worktree `infallible-tesla-6ebfa2`.
- Pre-flight T3 ← `src/registry.js`: `buildRegistry`, `checkModule`, `KIND_DIR` are exported at f5a1025 (lines 2, 80, 112). Clean.
- Pre-flight T4 ← T3: the merged registry and the `assets` field (lowercase `.glb` paths, every kind). Clean.
- Pre-flight T5 ← T3 `applyPack`, `discover(root, prefix)`; ← T2 `engine.resize(w, h)`. Names and signatures match. Clean.
- Pre-flight T6 ← T1: the concept pick (a Higgsfield job id). Clean.
- Pre-flight T7 ← T4 `gfx.asset`, `adopt`; T3 `applyPack`; T6 `public/hifi/taxi.glb`. `assets: ['hifi/taxi.glb']` passes T3's check. Clean.
- Task 1, Step 1: baseline at f5a1025: `npm test` 85 pass, 0 fail; `npm run build` succeeds.
- Task 1: complete (commits f5a1025..6d0b4e2, tests: npm test → 85 pass)
- Merge a7d951e: `npm test` 86 pass, 0 fail.
- Task 2: complete (commits a7d951e..d3301fa, tests: npm test → 87 pass)
- Task 3: complete (commits d3301fa..907179d, tests: npm test → 94 pass)
- Task 4: complete (commits 907179d..847c4e5, tests: npm test → 98 pass)
- Task 5: complete (commits 847c4e5..1d2ff4f, tests: npm test → 106 pass)
- Task 6: complete (commits 1d2ff4f..1613a43, tests: npm test → 106 pass)
- Task 7: complete (commits 1613a43..63be053, tests: npm test → 108 pass)

## Final review

- Final review: one whole-branch review by a fresh reviewer subagent on Fable 5.1 (`superpowers:requesting-code-review`), range 4a145c7..f6d83bc. Verdict: ready to merge with fixes; no Critical issues, 2 Important, 6 Minor, 10 lines set aside.
- Final: Ruling: the review range starts at 4a145c7 (`origin/feat/v1`, merged at a7d951e), not the plan's e3742bc, so the camera fix (already reviewed and merged upstream) was not reviewed again as new work; the two ranges differ only by 4ecd1a7 — cost if wrong: none.
- Final: fixed Important 1, a double start: a second click on RUN (or a level or ENDLESS button) while it read LOADING… parked at `await ready` and started a second level when the GLB landed — test "while the files load, a second start is dropped, so a double click on LOADING… starts one level" RED→GREEN, suite 109/109.
- Final: Ruling: re-graded Minor 3 to Important. If a pack chunk or the look chunk failed to import (a transient network error at boot), the whole HiFi page stayed blank; the spec's principle is that a broken overlay disables only itself — cost if wrong: about 10 lines of hardening.
- Final: fixed Minor 3 (re-graded): `loadPack` loads each file through `safeLoad`, so a failed file becomes an `applyPack` problem and the rest of the pack applies; the look loads through `safeLoad` too and low-fi draws if it fails — test "a pack file that fails to load disables only itself, like a broken one" RED (first `import.meta.glob` missing in Node; then, with the file map injectable, the 404 rejecting the whole pack) → GREEN, suite 110/110. The `main.js` line for the look is wiring that Node cannot run; HiFi still loads its look in the browser (stills unchanged).
- Final: Ruling: re-graded Minor 4 to Important, a security issue in dev tooling. Any web page open in Safari or Firefox could make the drop server write a file into its folder (`.` by default, so the repo while run from it), and an empty name crashed it — cost if wrong: a few lines of hardening.
- Final: fixed Minor 4 (re-graded): the folder argument is required; writes are accepted only from `http(s)://localhost` or `127.0.0.1` origins (403 otherwise, including no origin); an empty, `.` or `..` name saves as `drop.bin`; a failed write answers 500 instead of crashing — tests "the drop server saves only what a localhost page sends, and a bad name never crashes it" and "the drop server wants its folder spelled out" RED→GREEN, suite 112/112.
- Final: Ruling: Important 2, the taxi at 2.08 m against the 1.5 m box, stands: Caedon chose "keep it lane-wide" in chat (2026-10-09). Carry-forward: sub-project 4's spec should relax "detail goes inside the box, never above it" for obstacles that cannot be jumped — cost if wrong: one line in the taxi module.
- Final: minor (deferred): the taxi's paint copies a fixed subset of the generated material (`color`, `normalScale`, `aoMapIntensity`, `side`, alpha and vertex colours are dropped); harmless for this taxi, a rule for sub-project 4's models.
- Final: minor (deferred): `composer.setPixelRatio` reallocates the render targets a second time on every resize.
- Final: minor (deferred): the composer's ping-pong target inherits 4× MSAA (about 190 MB each at 3024×1964); memory only, for sub-project 2's performance section.
- Final: minor (deferred): `RoomEnvironment` is not disposed after the PMREM bake.
- Final: Ruling (set aside by the reviewer): community or fixture themes without a `look` render low-fi inside a HiFi session — spec §4 prescribes it — cost if wrong: such a section looks flat in HiFi.
- Final: Ruling (set aside): HiFi is the default on every `pointer: fine` device whatever its GPU — Caedon's quality decision; `?lofi` is the escape — cost if wrong: a slow HiFi on weak laptops.
- Final: Ruling (set aside): Milkshake and pickups show a blob shadow and a cast shadow in HiFi — their looks belong to sub-projects 3 and 4 — cost if wrong: doubled shadows until then.
- Final: Ruling (set aside): the shadow box ends about 77 m ahead, where shade turns to light under the fog — the spec sized the box; cascades are sub-project 2's — cost if wrong: a visible seam far ahead.
- Final: Ruling (set aside): `existsSync` is case-insensitive on macOS — the `ASSET` pattern forces lowercase and CI runs on Linux — cost if wrong: none.
- Final: Ruling (set aside): the merged camera fix 4ecd1a7 — reviewed upstream; the diff confirms only its lines differ from the plan's blocks — cost if wrong: none.
- Final: Ruling (set aside): `scene.background` is still cleared under the HiFi sky dome — one wasted clear — cost if wrong: negligible.
- Final: Ruling (set aside): `content/characters/milkshake.js` keeps its own `GLTFLoader` import beside `assets.js` — pre-existing, and Vite shares the chunk — cost if wrong: none.
- Final: Ruling (set aside): Task 8 Step 7 (stills, memory note, the push and PR gate) is not in the diff — done after the review — cost if wrong: none.
- Final: Ruling (set aside): forced `?hifi` on phones — out of scope per the spec — cost if wrong: none for this slice.
- Final, after the fixes: `hifi-taxi.png` and `lofi-final.png` re-shot through the hardened drop server, byte-identical to the close-out stills (d61b5469…, c97c809e…); no console errors.
- After the PR (2026-10-09, Auto-fix): PR #4 (v4) merged into `feat/v1` at 0a954c3, so PR #5 conflicted. Merged `origin/feat/v1` into `hi-fi-test`. One conflict, in `src/gfx.js`: kept this branch's `bend` (shadow flags) and v4's anchored `setBend` and `bendOffset`. `dispose`, the `asset` re-export and `skyAt` auto-merged with both sides intact. v4 raised the shipped taxi's box to 2.0 m, so the HiFi taxi (2.08 m) now sits 8 cm above it, not 58 cm; the footprint (2 × 4 m) is unchanged. `npm test` 118 pass (v4 brought 6), build succeeds. A `?hifi` run shows the look, 3 HiFi taxis, v4's skinned Milkshake, no pink blocks, and 24 compiled shader programs with no errors. Low-fi byte equality against the new `feat/v1` was not re-shot: this branch's low-fi-relevant lines are unchanged and inert.

## Gap to the reference (board 01's 9:16 keyframe against `hifi-taxi.png`)

Already reads like the teaser:
- The taxi: a glossy toy cab with chunky proportions, the TAXI roof sign lit, round red tail lamps glowing in their own shape, a white bumper, clearcoat highlights.
- The light: tone-mapped colours that keep the palette, soft sun shadows from buildings and railings, a sky that deepens overhead, bloom on lamps and lane lines.
- The framing: the taxi in the lower third of the middle lane, jug columns either side, the street running to a vanishing point near the top.

Still to come:
- The city (sub-project 2): the street is a canyon of plain blocks with no windows, storefronts or billboards. Their shadows keep most of the road in shade, where the teaser has a sunlit avenue. No skyline or horizon layer.
- Milkshake (sub-project 3): the low-fi grey model, about half the teaser's size and not glossy; no mid-jump pose.
- The other assets (sub-project 4): low-fi jugs (lavender bubbles, not glowing milk bottles), the other obstacles, pickups and props, the shield bubble.
- Endings and finish (sub-project 5): sparkle trails, steam, LED screens.

## Close-out (sub-project 1)

`git diff --stat e3742bc..HEAD -- src/` (as planned; it includes the merged camera fix 4ecd1a7, about 11 lines in `engine.js`, `game.js` and `main.js`):

```
 src/assets.js   |  42 +++++++++++++++++++++++
 src/engine.js   |  42 ++++++++++++++---------
 src/game.js     |   6 ++--
 src/gfx.js      |  16 +++++++--
 src/look.js     | 102 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/main.js     |  23 +++++++++++--
 src/registry.js |  68 ++++++++++++++++++++++++++++++++++++-
 src/world.js    |   2 +-
 8 files changed, 276 insertions(+), 25 deletions(-)
```

(Updated after the final review's fixes; before them it was 260 insertions.) HiFi work alone (`a7d951e..HEAD -- src/`, after the merge): 8 files, 267 insertions, 19 deletions; `src/look.js` (102 lines) and `src/assets.js` (42 lines) are new.

- Engine changes: 17 ledger rows. 15 are generic hooks (packs and the quality switch, the asset loader, the preload gate and the shared-safe dispose, `resize(w, h)`, the look hook, `skyAt`'s id and look, the sky key, shadow flags in `bend`, `checkLook`, `safeLoad`), 1 is HiFi-only (`src/look.js`, loaded on demand), and 1 is dev-only (the hook's `character`).
- The asset itself, the taxi, needed **no** `src/` change: one pack file and one GLB.
- Credits: 20.25 of the 40 budget (concepts 1, views 1.25, model 18; no retry). Balance 3,000 → 2,979.75.
- Tests: 112 (85 at the start, plus 1 from the merged fix, plus 26 new, 4 of them from the final review's fixes). Build: the look, the loader, the meshopt decoder and each pack file are separate on-demand chunks, so low-fi downloads none of them.

The modularity read: once the hooks existed, a single pack file could re-skin a shipped obstacle with a generated, PBR-painted, glowing model, and re-light every theme, without touching the engine or changing how anything plays. Low-fi stayed byte-identical throughout. What a module still cannot do: draw instanced geometry under the bend (`gfx.bend` drops `instanceMatrix`), live at the horizon (chunks scroll and drop), give a power-up a worn look, load assets per level, or restyle the camera and HUD. And the shipped toon materials ignore the environment map, so a HiFi look leans on a high ambient until the content itself moves to PBR (sub-projects 2 to 4).
