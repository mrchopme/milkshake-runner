---
provenance: human-approved
last-verified: 2026-10-09
---

# Milkshake Runner: HiFi test, round 2 design (sub-projects 2 to 4: the city, Milkshake, the hero assets)

**Date:** 2026-10-09 · **Status:** approved by Caedon on 2026-10-09, in chat, section by section and then as this written spec · **Builds on:** [HiFi spec](2026-10-08-hifi-test-design.md) (sub-project 1, approved), [HiFi ledger](2026-10-08-hifi-ledger.md), the v4 round ([spec](2026-10-08-milkshake-runner-design-v4.md), PR #4, merged into `feat/v1` as 0a954c3 on 2026-10-09), the Paper style sheet (file `01M46QWM611CXK4WQSBTH6FJK3`) · **Branch:** `hi-fi-city`, local, cut from `origin/hi-fi-test` and fast-forwarded to 9132bae, where the sub-project 1 session had merged `feat/v1` (0a954c3, v4) into `hi-fi-test` (draft PR #5 onto `feat/v1`)

> Point-in-time snapshot. Written on 2026-10-09 against `hi-fi-city` at 9132bae (v4 merged in, 118 tests), from four
> research notes kept in the session scratchpad (street map, bend, board 01 inventory, asset list). The decisions table
> records what Caedon chose in chat that day; everything else is the agent's design and may have moved on since. Read
> the current `src/` before treating a detail here as how the game works today.

## Goal

Carry the HiFi test from one proven asset (the taxi) to every asset left except the endings: a generated city at the
street's edges with a skyline at the horizon (sub-project 2), Milkshake remodelled (sub-project 3), and the other
obstacles, pickups and props (sub-project 4). The asset pipeline the taxi proved runs for every discrete object at once,
one subagent per asset, with Caedon's decisions batched into waves. The modularity measurement continues: every `src/`
change is a ledger row.

**Success means**
- `?hifi` plays all three levels in the generated city: windows, storefronts, LED and billboard stacks, street furniture, a skyline at the horizon, a sunlit avenue, a glossy remodelled Milkshake and HiFi versions of all 14 other shipped obstacles, pickups and props.
- Gameplay is unchanged: every overlay keeps its shipped collision box, and the street stays where the rules say it is.
- `?lofi` stays byte-identical to a low-fi baseline shot at the start of the round on 9132bae (v4's merge changed low-fi on purpose, so the 2026-10-08 hash c97c809e… retires).
- HiFi frames cost at most 16.7 ms at 3024×1964 on Caedon's M4 Pro (the browser-pane probe is the proxy; his full-screen browser is the real check).
- `npm test` and `npm run build` pass.
- Stills (9:16 and a new 16:9 shot) per theme, low-fi and HiFi, are sent to Caedon beside board 01's keyframes.
- The round spends about 750 credits, at most about 1,000 without a new approval.

## Decisions (Caedon, 2026-10-09, in chat)

| Item | Decision |
|---|---|
| Model | This session runs on Opus 5.5 at max effort rather than Fable 5.1: "continue here and scope the subagents for each asset accordingly. I think a medium opus or high sonnet should do" |
| Pipeline | "we want to do all the assets that have been proven through our first run": the taxi pipeline for every asset, run concurrently by subagents that come back to the main session when Caedon has a decision to make or a final asset to approve |
| Scope | "Everything left": sub-projects 2 (city), 3 (Milkshake) and 4 (hero assets) together. Sub-project 5 (endings and finish) stays for later |
| Buildings | Code-built shells wearing generated facade, storefront and billboard images; every discrete object goes through the taxi pipeline |
| PR #4 order | Merge PR #4 first, then bring `feat/v1` into `hi-fi-city` before the engine and Milkshake work. PR #4 was still open; Caedon: "you're approved to merge it for me". Merged as 0a954c3. The sub-project 1 session then merged `feat/v1` into `hi-fi-test` (9132bae, one `gfx.bend` conflict kept both sides), and `hi-fi-city` fast-forwarded to it |
| Milkshake | A new generated model, rigged and animated with v4's skinning code |
| Gates | Waves on Paper: one board per wave for the picks, one credit quote per wave, downloads and final approvals grouped per wave |
| Design | Section 1 (tracks, agents, waves, gates) "looks good"; section 2 (engine) and section 3 (city, hero assets, Milkshake, proof) approved |

Carried from sub-project 1 (human-approved there): generated everything (Higgsfield); HiFi on `pointer: fine`, low-fi on touch, `?hifi`/`?lofi` force; looks-only packs; the taxi stays lane-wide at 2.08 m (obstacles you cannot jump may stand taller than their box).

## What the code does today (verified 2026-10-09)

- **Streaming** (`src/world.js`): 120 m chunks built 200 m ahead, dropped 15 m behind; 2 or 3 live. A chunk takes the theme of the section at its start; sky, fog and look follow the player. `createChunk(gfx, { z0, length, lanes, rng, theme })` returns an `Object3D` in world coordinates; there is no per-chunk update or dispose hook; a throwing `createChunk` leaves a chunk with no road.
- **The street**: only `bridge` has its own `createChunk`; downtown, midtown and uptown share `defaultChunk`: per chunk about 65 flat toon boxes, 22 windowless 10 m blocks flush at |x| = 7.5, a 9 m road with three 2.5 m lanes, 3 m sidewalks, heights 18–70, 30–110 and 12–35 m. `packs/hifi/themes/*.js` carry only a `look`, so the HiFi street is the low-fi street.
- **Randomness**: one scenery stream (`rng(seed ^ 0x9e3779b9)`) feeds every chunk in build order; no shipped level sets `seed`, so each run builds a different street. No `Math.random` in street code.
- **The bend** (`src/gfx.js`, v4's since 9132bae): anchored to the street, `setBend({ origin, segments })` feeds `uBendStart` and `uSeg[]` (one stretch per entry), each stretch bends from `BEND_LEAD` = 40 m before its start line, and `bendOffset(z)` mirrors the shader on the CPU. The patched vertex is still `modelMatrix * vec4( transformed, 1.0 )` plus `bendOffset`, so an `InstancedMesh` or `BatchedMesh` collapses to its origin; `dispose` never calls an instanced mesh's own `dispose()`; a cloned bent material renders unbent. Shadow casters are drawn unbent and receivers look up their unbent position, so shadows stay attached. v4 also skinned Milkshake in code and gave the shipped taxi a 2.0 × 2.0 × 4.0 m box.
- **Far field**: camera far 400 m, fog far 196–212 m, the HiFi sky dome (radius 300 m) is the only camera-locked object. The sun-shadow box reaches about 77 m ahead at the building line and only 19–31 m up a 70 m roof.
- **Assets**: `assets` lists only lowercase `.glb`; every listed file preloads at boot and is never freed; the menu backdrop builds before the preload lands. Levels name every module they use, so a level's files can be derived before it starts; nothing does that yet.
- **Packs**: every `.js` under `packs/hifi` is treated as an overlay, so helper modules cannot live there today.
- **Props** are capped at 5 per 100 m, centred on the road; street furniture belongs inside a theme's chunk.
- **Tests**: 118 passing at 9132bae.

## Shape of the round

### Tracks

| Track | Contents | Workers |
|---|---|---|
| Engine | The engine changes below, one task at a time (they share `src/`) | An Opus implementer and a reviewer per task |
| City | The seeded city generator as pack code; starts on flat placeholder facades, so it waits for no credits | A Sonnet implementer and a reviewer per task |
| Assets | One agent per asset, running the taxi pipeline (concept prompt, view checks, model check, optimise, pack module, test), each in its own git worktree; the main session merges their branches into `hi-fi-city` | Sonnet agents |
| Proof | Stills, the frame probe, the ledger | The main session |

Subagent sizing follows Caedon's word: Sonnet or medium-effort Opus per task; the final whole-branch review runs on the most capable model (Fable 5.1).

### Gates (only the main session acts on these, never a subagent)

The main session stops and asks Caedon before every credit spend (quoted per wave from known prices; `get_cost` is blocked by Claude Code's classifier, so the real charge is read off `balance` afterwards), every concept or design pick, every download (file names, source, sizes), any new dependency, and any push or pull request. Subagents research, write code, tests and prompts, and check generated images and models; they never spend credits, download, install, push or merge. With three or more decisions at once, the main session batches them in pickers. Paper boards come before every visual change.

### Waves

| Wave | Contents | Caedon sees | Credits (about) |
|---|---|---|---|
| 0 | Board 15 "City layout": a street cross-section, a plan with the furniture rhythm, the building shell types per theme | Board 15, approve or change | 0 |
| 1 | A price probe (one GPT Image 2.5 image at 2k medium, one at 21:9 4k, one Nano Banana 2.1 at 8:1); style frames per theme (16 GPT Image 2.5, 4 Nano Banana Pro); 4 concept variants for each of 28 models (12 furniture, 13 hero assets, Milkshake, 2 traffic vehicles) | Board 16 "Wave 1 concepts": one pick per theme and per model | 46 |
| 2 | Four views per multi-view model (front, left, rear, right), each checked before any 3D job; facade bodies (15), storefront strips (12), party walls (3), trim sheets (3), posters (12), blade signs (6), LED faces (3), skyline strips (8), all made from the picked style frames | A contact sheet of the views and images, approve or redo | 65 at the known 1k price; the probe settles the 2k price |
| 3 | Models: a pilot of three (lamp post, street tree, hydrant: thin poles are Tripo's known risk), then the other 25 | Each model in the 3D viewer, pilot first | 504 |
| 4 | Downloads (one grouped approval with every name, source and size), optimisation, pack modules, an in-game lineup | Board 17 "Wave 4 finals": in-game crops, approve each asset | 0 |

With a 20% retry allowance on waves 2 and 3 the round comes to about 750 credits; above about 1,000 the main session asks again. Balance on 2026-10-09: 2,979.75 (Ultra). Waves 0 and 1 start at once; the zero-cost probe (below) runs alongside wave 1 and must pass before wave 3.

### The zero-cost probe

Before wave 3, the main session shows Caedon screenshots of the placeholder city (flat-coloured shells, instanced placeholder furniture, a placeholder skyline ring) running under the merged v4 bend: instanced meshes in place on a turn, the skyline not covered by fogged buildings, shadow reach, draw calls and frame cost. It settles the two open engine choices below (fogged pixels, shadow reach) at no credit cost.

## Engine changes

Each is a ledger row ("generic hook" or "HiFi-only", and whether a module could have done it without the change).

1. **Base and baseline.** v4 is already in (9132bae). First task: shoot the low-fi baseline still on 9132bae; its hash is the low-fi invariant for the rest of the round. If PR #5's Auto-fix adds commits to `hi-fi-test`, merge `origin/hi-fi-test` into `hi-fi-city` when they land.
2. **Instancing-safe bend.** BEND applies `batchingMatrix` (under `USE_BATCHING`), then `instanceMatrix` (under `USE_INSTANCING`), then `modelMatrix`, in three's own order, before `bendOffset`. Normals, shadows and depth need no change. `dispose` calls `dispose()` on instanced and batched meshes while still sparing shared geometry and materials. `bendable` keys on the presence of its hook rather than `userData.bent`, so a cloned material is patched again instead of silently rendering unbent. Walls are built with vertices at least every 4 m along the street so they bend with it. Tests: the patched shader against three's real chunk text (Node), and in the probe separate meshes against one instanced and one batched mesh.
3. **Images as assets.** The `assets` rule accepts `.webp` and `.png` as well as `.glb`; `src/assets.js` loads images with `TextureLoader` (sRGB colour space) into the same cache; `gfx.texture(path)` returns the shared cached texture, and a missing one throws the same clear error `gfx.asset` does.
4. **Helpers inside a pack.** Files under `packs/<pack>/lib/` are helper modules, not overlays: `loadPack`, `applyPack` and the test helpers skip them. Overlays import them by relative path.
5. **Horizon ring** (HiFi only, `src/look.js`, beside the sky dome). A camera-centred open cylinder (radius a calibration knob, inside the 400 m far plane) wearing the theme's skyline image from a new `look.skyline` field (validated as an asset path; listed in the theme overlay's `assets`). Unbent, no fog of its own (tinted to the level sky at its base), no shadows, drawn after the dome and before the world. Open choice for the probe: buildings beyond fog far render as sky-coloured blocks over the ring; either drop fully fogged pixels in HiFi (one line in the material patch that every material already gets) or push the HiFi fog further out. The probe picks the one that hides chunk pop-in.
6. **A time uniform.** `gfx.time`, one shared uniform set from the run's clock each frame (pause freezes it; stills pin it at 0), so LED faces, marquees and blinking signs animate in their shaders without a per-chunk update hook.
7. **Per-level preload.** A pure `levelAssets(level, registry)` derives a level's files from what its JSON names (themes per section, obstacles, pickups including the default jug, props, character, ending and its declared next level). `startLevel` preloads that set behind LOADING…, with the same one-start gate; the menu backdrop builds after level 1's files land; files the starting level does not need are freed (textures and geometry disposed, cache entries dropped). An ending that returns an undeclared next level loads it on demand. The reason is texture memory (about 200 MB a level once decoded), not download size.
8. **Shadow reach and sun angle.** The probe compares a longer box with an 8192 map against two cascades (`three/addons/csm`), both under the bend; the cheaper one that reaches the far canyon wins. The sun direction becomes a look knob (`look.sun.dir`, default today's), so a look can light the avenue the way the teaser does (sun high, upper right).
9. **A worn look for power-ups.** A pickup overlay may add `createWorn(gfx)`; the engine attaches the returned object to the character while that power-up is active and disposes it when it ends. The shield bubble (board 04) is the first user. Without `createWorn` nothing changes, so low-fi is untouched.
10. **The deferred minors.** The composer keeps 4× MSAA on the render target only (the ping-pong target drops it, about 190 MB saved at 3024×1964); `composer.setPixelRatio` stops reallocating a second time per resize; `RoomEnvironment` is disposed after the PMREM bake; generated models copy their whole material (a `lib` helper every overlay uses), not a field subset.
11. **Look retune.** Once the street is physical-material, the four looks drop the high ambient (about 2) that the toon street needed and raise `env`; calibration knobs, checked by eye on each theme.

## The city (sub-project 2)

The generator is pack code: `packs/hifi/lib/city.js` and friends, called from `createChunk` in `packs/hifi/themes/{downtown,midtown,uptown,bridge}.js`, which also list their `assets`.

- **Determinism.** Each chunk seeds its own generator from one draw of `args.rng`, so the same level seed builds the same city and the build order stays 0, 120, 240…; it never touches `defaultChunk`, so low-fi cannot move. Nothing a chunk builds leaves `[z0, z0 + length]`. Tests: same seed, same chunk; the seam rule over many seeds.
- **Buildings.** Shell types per theme from code (podium, body, setback, cornice, pilasters; heights from the theme's range, blocks 8–14 m deep as today). Facades use a physical material with a generated tile (two bays by two floors, about 5 × 7 m, mapped in metres); a window mask derived from the tile in code gives glossy glass, matte masonry and lit windows that reach the bloom. The ground floor is a generated storefront strip (about 10 × 4.3 m) under a code awning; party walls wear a generated side wall. Billboard stacks as in the keyframes: flat-colour LED panels in dark bezels animated through `gfx.time`, generated posters and blade signs. Geometry is merged per material per chunk (`BufferGeometryUtils` from three's addons, no new dependency); target about 40 draw calls a chunk.
- **Street.** Road, kerbs, sidewalk slab joints, lane dashes (instanced), crosswalks at block ends: code-made, palette from board 02's tokens (road #5a5c72, sidewalk #a3a0ab; the 9:16 keyframe's cream ground is not followed).
- **Furniture.** The 12 generated pieces (two lamp posts, traffic light, hydrant, bench, two bins, planter, street tree, newsstand, bus shelter, subway entrance) as one `InstancedMesh` per model per chunk, on the rhythm board 15 fixes, with seeded jitter, only on the sidewalk band, never in a lane. Lamp heads and signals glow through emissive texels picked from their own colours, as the taxi's lamps do (the glow rule below).
- **Rooftops.** Water towers and AC units built in code.
- **Bridge.** Deck, towers and cables in code, a water shader, waterfront low-rises reusing downtown's facade tiles, the skyline across the water from the horizon ring.
- **Distant traffic.** The taxi and two generated vehicles cross at intersections as scenery (no collision), driven by `gfx.time`.
- **Skylines.** Two strips per theme (far haze, nearer towers), generated at 21:9 (or wider if the probe prices it), mirrored in code into a seamless ring. Generic spires only: nothing that reads as the Empire State Building or another landmark.

## The hero assets (sub-project 4)

Thirteen overlays go through the pipeline: obstacles `barrier_low`, `delivery_bike`, `hot_dog_cart`, `manhole_steam`, `pigeons`, `scaffold_beam`; pickups `jug`, `magnet`, `shield`, `x2`; props `overpass`, `railings`, `tunnel`. Each `createView` fits its model to the shipped box as v4 left it.

- **The box rule, revised.** A module's own `avoid` decides: anything the player jumps or slides under keeps its whole silhouette inside the collision box; anything only a lane change avoids keeps its footprint and may stand taller (Caedon's taxi ruling, 2026-10-09).
- `pigeons`: one generated bird, instanced into the flock, the wing flap in the shader. `manhole_steam`: a generated cover with code steam. `railings`: one generated segment, instanced along the run.
- `billboard` (prop) gets no 3D model: a code panel wearing generated posters shared with the city.
- `shield`: the bubble Milkshake wears is a code shader (fresnel rim, a slow shimmer) through `createWorn`, 0 credits.

## Milkshake (sub-project 3)

A multi-view remodel in the look of the Milkshake-3D element (`eb91a157-e317-4233-ad5c-7658465fa7f4`; its render is job `97ba0692-9968-468c-8357-61e4bcd049ab`), skinned and animated with v4's `skinWeights` and `fitModel` from `content/characters/milkshake.js`, with the `SKIN` knobs re-measured on the new mesh. A glossy physical material. A pack overlay `packs/hifi/characters/milkshake.js` (`createView` and `assets`), same 1.9 × 1.0 m box and the same `pose` behaviour; its blob shadow is left out in HiFi, so the sun shadow is no longer doubled.

## The asset pipeline (every model)

Concept (GPT Image 2.5, four variants, style references: the teaser keyframes, jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`, and the Milkshake-3D element) → Caedon's pick → four views by image edit in Tripo's order front, left, rear, right, each checked by the asset's agent (GPT Image can turn a requested front into a rear view) → Tripo H3.1 multi-view, detailed, PBR, `face_limit` 20000 for hero assets and Milkshake, 6000–8000 for furniture → Caedon checks it in the 3D viewer → grouped download through the context-mode shell (the Bash hook redirects `curl`) → `npm run assets:optimize -- in.glb public/hifi/<name>.glb` (meshopt, WebP at most 2048 px; facade tiles 1024 px) → a pack module with calibration knobs (yaw: Tripo may lay the long axis along x; scale; pivot) and a test that it fits its box. Simple furniture may use Tripo single-image (same price) when the agent's view check says the views add nothing.

- **Glow comes from the asset's own shape** (Caedon, 2026-10-09, on the taxi's tail lamps: a box laid over a lamp reads as an unnatural sticker). Lamp heads, signals, windows, LED faces and signs glow through emissive maps or masks taken from their own texels or meshes, never plates or quads in front of them; a crop is shown before a glow is called done.
- Only the main session drives the browser pane. Asset agents fit models from their bounds in Node; the main session renders a lineup of each wave's new models (a dev script beside `scripts/hifi-shot.js`) for the visual checks and board 17.
- File layout: `public/hifi/<name>.glb` for models; `public/hifi/city/{facades,shops,signs,sky}/<theme>-<nn>.webp` for images.
- Every generated image and model is reviewed for brands, logos, readable trademarks, real landmarks, real teams and real people (board 01 flags the Empire-State-like spire, the Times Square stacks, the marquee text and the Garden's jerseys). Sign text uses a short whitelist given verbatim (TAXI, PIZZA, DELI, HOTEL, CAFE).
- Expected download: about 30 MB for the whole pack, 10–15 MB per level.

## Proof and measurement

- **Tests** (`node --test`): the instancing bend against three's shader text; image assets and `gfx.texture`; the `lib` skip; `levelAssets` for every shipped level and the fixtures; freeing on level change; `look.skyline` and `look.sun.dir` checks; `createWorn` attach and dispose; city determinism and seams; every file a pack lists exists; every overlay fits its shipped box under the revised rule; the content-agnostic engine check stays green.
- **Stills:** the low-fi baseline after the merge and the low-fi still at the end (byte-identical); HiFi at the 9:16 shot and at a new 16:9 shot framed like keyframe 9-0 so the skyline shows, per theme (downtown, midtown, uptown, bridge), sent beside the keyframes. Stills pin `run.speed` and `gfx.time`.
- **Frame probe:** mean and p95 ms, draw calls, triangles and texture memory at 3024×1964 in HiFi and low-fi, per theme; the bar is 16.7 ms.
- **Ledger:** `docs/specs/2026-10-09-hifi-round2-ledger.md`, the same sections as sub-project 1's (engine changes, credits, downloads and dependencies, stills and measurements, rulings, progress, final review, gap to the reference, close-out) plus one row per asset (wave, job ids, credits, file, size, Caedon's approval).
- **Review:** one whole-branch review on Fable 5.1 after the last task, its fixes logged, then superpowers:finishing-a-development-branch. At the push gate Caedon decides whether the PR stacks on `hi-fi-test` or waits for PR #5.

## Risks

- **Style drift** across about 100 images and 28 models: one picked style frame per theme and the keyframes as references in every call, a fixed prompt template, one contact sheet per wave.
- **Tripo quirks:** long axis along x, a view drifting to a rear view, thin poles fused or broken. The furniture pilot comes first; code fallbacks exist for poles, signals and shelters.
- **Frame and memory budget:** 70–90 live buildings, 28 models and 2 MSAA targets. Merged shells, instanced furniture, 1024 px facade tiles, per-level freeing and the MSAA fix are the mitigations; the probe measures before wave 3.
- **Fogged buildings over the skyline**, and **shadow reach**: settled by the zero-cost probe.
- **Base drift:** PR #5 runs Auto-fix on `hi-fi-test`; new commits there are merged into `hi-fi-city` when they land, and nothing is pushed to `hi-fi-test` from here.
- **Concurrency:** asset agents work in their own worktrees and never touch `src/`; only the Engine track edits `src/`, one task at a time.
- **Brands and landmarks:** the review rule above, and Caedon's eye on boards 16 and 17.

## Out of scope

- Sub-project 5: the Broadway corner and the Garden endings, sparkle trails, steam polish, ending LED screens, the modularity report.
- HUD and camera restyles, a WebGPU renderer, HiFi on phones, KTX2 texture compression (WebP first), video textures (shader animation instead; Seedance only if Caedon asks for one hero screen at 35 credits).

## Build order (input to the plan)

1. The low-fi baseline on 9132bae, the ledger. Board 15 (wave 0) and wave 1's quote, at once.
2. Engine: instancing bend, images as assets, pack `lib`, time uniform. City track starts on placeholders as soon as `lib` and the bend land.
3. Engine: the horizon ring, shadow reach and sun knob, then the zero-cost probe with screenshots for Caedon.
4. Waves 1 and 2 run alongside steps 2 and 3; wave 3 after the probe passes.
5. Engine: per-level preload and freeing, `createWorn`, the deferred minors.
6. Wave 4: downloads, optimisation, every pack module, board 17. The city on its real facades and furniture; Milkshake; the hero assets; the look retune.
7. Stills, the probe, the ledger close-out, the whole-branch review, the push and PR gate.
