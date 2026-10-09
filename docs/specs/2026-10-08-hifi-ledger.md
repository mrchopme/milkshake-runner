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
