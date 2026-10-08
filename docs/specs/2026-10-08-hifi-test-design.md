---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner: HiFi test, sub-project 1 design (foundation + the taxi)

**Date:** 2026-10-08 · **Status:** design approved by Caedon in chat on 2026-10-08; this written spec awaits his review · **Builds on:** [spec v3](2026-10-08-milkshake-runner-design-v3.md), [plan v3](2026-10-08-milkshake-runner-plan-v3.md), the Paper style sheet (board 01 "Reference") · **Branch:** `hi-fi-test`, local, cut from `feat/v3-feedback` at e3742bc · **Builder:** chosen at the plan stage

> Point-in-time snapshot. Written on 2026-10-08 against `feat/v3-feedback` at e3742bc (PR #2 open, PR #1 open).
> The decisions table records what Caedon chose in chat that day; everything else is the agent's design and may
> have moved on since. Read the current `src/` before treating a detail here as how the game works today.

## Goal

Test how far the app's modularity reaches by rebuilding every asset at the fidelity of the teaser on Paper board
01 "Reference" (style-sheet file `01M46QWM611CXK4WQSBTH6FJK3`): glossy toy shading, windows, storefronts and
billboards, sparkle trails, soft shadows, everything animated, a near-4K look on desktop, and a procedurally
generated city at the street's edges. The work splits into five sub-projects; this document covers the first: the
engine foundation plus one asset, the taxi, carried end to end, so the whole pipeline is proven before credits are
spent at scale.

**Success means (sub-project 1)**
- `?hifi` shows a generated, glossy taxi under the new look: tone mapping, sun shadows, reflections, a gradient sky, bloom.
- `?lofi`, and every touch device by default, render exactly as `feat/v3-feedback` does today.
- Low-fi, HiFi and reference stills from the teaser's 9:16 framing are sent to Caedon.
- `npm test` and `npm run build` pass: the 85 existing tests plus the new ones.
- Every `src/` change is logged in the ledger, which is the modularity measurement.
- The slice spends at most 40 credits.

## Decisions (Caedon, 2026-10-08, in chat)

| Item | Decision |
|---|---|
| Purpose | A modularity test: HiFi versions of every asset from the Paper reference board |
| Engine boundary | Free rein. The engine changes however the look needs; modularity is measured afterwards from the ledger of `src/` changes |
| Asset source | Generated everything: hero models, the city kit and textures come from generation (Higgsfield) |
| Performance target | Desktop showcase: 60 fps at about 4K on Caedon's Mac (M4 Pro, 3024×1964 Retina panel). Phones keep low-fi |
| Character | This branch owns Milkshake: remodel and run cycle (sub-project 3) |
| Approach | A: a looks-only overlay pack plus an asset loader (B, fork in place, and C, a WebGPU renderer, were declined) |
| Sequencing | Five sub-projects, each with its own spec, plan and credit approval; the taxi slice first |
| Quality default | HiFi on mouse and trackpad devices, low-fi on touch; `?hifi` and `?lofi` force either |

## The target (board 01)

Board 01's own "Stays in the teaser" column is the gap list: glossy toy shading (the game uses flat toon tones);
windows, billboards and storefronts (the game's buildings are plain blocks); sparkle trails and soft shadows.
Caedon added full animation, the near-4K look and the procedural edges.

Resolution is not the gap: the renderer already draws at twice the CSS size (`setPixelRatio(min(dpr, 2))`), which
is 3024×1964 on the Retina panel. The look comes from materials, light, detail and post-processing. The keyframes
are offline renders; at 60 fps in a browser the realistic bar is "reads like the teaser in motion" (palette, gloss,
density, light), not a frame-for-frame match.

## What the engine does today (verified 2026-10-08)

- One directional sun and one hemisphere light at fixed values; no tone mapping, no shadows, no environment map; the sky is a flat colour plus linear fog from the theme's `sky` and `fog` (`src/engine.js`).
- `gfx.mat` hands out cached `MeshToonMaterial`s; the shipped obstacles, pickups, props and themes build from `gfx.box`, `gfx.cyl` and friends.
- Obstacle, pickup and prop `createView` and theme `createChunk` are called synchronously (`src/world.js`); only a character's `createView` may be async.
- `gfx.dispose` disposes every geometry and any material that has a texture map.
- `gfx.bend` rebuilds the vertex position from `modelMatrix` alone and drops `instanceMatrix` and `batchingMatrix` (checked against three r186's `project_vertex` chunk), so an `InstancedMesh` or `BatchedMesh` collapses under the bend.
- The registry holds one module per kind and id, rejects duplicates, and levels name modules by id.
- Board 04's worn-shield bubble is not implemented anywhere. Nothing can live at the horizon: chunks scroll and drop.
- `test/fixtures.test.js` fails if `src/` names a shipped content id; the engine stays content-agnostic.

## The five sub-projects

| # | Sub-project | Main contents | Credits (estimate) |
|---|---|---|---|
| 1 | Foundation + the taxi (this document) | Overlay packs, quality switch, asset loader, the look, the taxi end to end, stills, ledger | ≤ 40 |
| 2 | The city | Generated building kit and street furniture, skyline panoramas, the seeded city generator, a horizon layer, an instancing-safe bend, per-level preload | 700–900 |
| 3 | Milkshake | Multi-view remodel, a rig built in code, a procedural run cycle, glossy material | 100–150 |
| 4 | Hero assets | The other 6 obstacles, 4 pickups, 4 props, the shield bubble, distant traffic | 400–500 |
| 5 | Endings and finish | Broadway corner, the Garden, sparkles, steam, LED screens, polish, the modularity report | about 200 |

The table sums to about 1,450 to 1,800 credits; with retries the whole test may reach 2,000 of the 3,000 on the
account (Ultra plan, checked 2026-10-08).

Agent note: the v4 round's brief (`feat/v4-feedback`) also covers character modelling. With this branch owning
Milkshake, the two overlap; that is Caedon's call to settle with the v4 session.

Prices quoted on 2026-10-08 with `get_cost` (nothing submitted):

| Item | Model | Credits |
|---|---|---|
| Concept image | GPT Image 2.5 / Nano Banana Pro | 0.25 / 2 |
| 3D model, multi-view, detailed, PBR | Tripo H3.1 | 18 |
| 3D model, single image, detailed, PBR | Tripo H3.1 | 18 |
| 3D model, low-poly, PBR | Hunyuan3D v3 | 18 |
| 3D model, textured, PBR | Meshy 7 | 38 |
| 5 s video loop | Seedance 2.5 | 35 |

Hosted 3D Jutsu (Blender 5.2) cannot import our own files, only its curated catalog, so it cannot clean up or rig
generated models. Cleanup happens in code and in the optimise step below.

## Design

### 1. Packs: a looks-only overlay

- A pack lives in `packs/<pack>/<kind>s/<id>.js` and mirrors a shipped id: `packs/hifi/obstacles/taxi.js` re-skins `taxi`. The `kind` and `id` in the file must match its path and a registered shipped module.
- A pack module may set only `createView`, `createChunk`, `look` and `assets`, besides `kind` and `id`. Any other field is rejected with "packs change how things look, not how they play". A field the kind does not use (a `createChunk` on an obstacle) is rejected too.
- Merging is per id: `{ ...shipped, ...overlay }`. The merged module runs through the same `checkModule` as all content, plus the new `look` and `assets` checks. An overlay that fails is dropped and listed with the other problems (lenient in the browser, strict in tests), and the shipped module carries on.
- `applyPack(registry, entries)` in `src/registry.js` is pure and returns `{ registry, problems }`, so it is tested in Node like the rest of the registry. With no entries it returns the registry unchanged.
- The browser loads a pack lazily with a non-eager `import.meta.glob('../packs/*/**/*.js')`, keeping only the chosen pack's files, so low-fi never downloads pack code.

### 2. Quality switch

- `?hifi` forces `hifi`, `?lofi` forces `lofi`; otherwise `matchMedia('(pointer: fine)')` picks `hifi` and anything else picks `lofi`. One line in `src/main.js`.
- `lofi` loads no pack and sets no look, so the engine runs today's code path.

### 3. Asset loader

- Pack modules list files under `public/` in `assets`, for example `assets: ['hifi/taxi.glb']`.
- `src/assets.js` preloads them with `GLTFLoader` and `MeshoptDecoder` (`three/addons/libs/meshopt_decoder.module.js`, already in `node_modules`; no new runtime dependency). WebP textures decode natively. Results are cached by path.
- `gfx.asset(path)` returns a synchronous clone of the cached scene that shares its geometry and materials, so views stay synchronous. A path that was not preloaded throws a clear error, which the existing `safeCall` turns into the pink fallback block. Skinned scenes (sub-project 3) will clone with `SkeletonUtils.clone`.
- Every mesh in a cached asset is flagged `userData.shared`; `gfx.dispose` skips shared geometry and materials, so dropping one taxi never frees the next.
- The menu shows at once while preloading runs in the background; `startLevel` awaits the preload, and RUN reads "LOADING…" until it settles.
- `ponytail:` every pack asset preloads at boot. Sub-project 2 switches to per-level preload when the pack passes about 30 MB.

### 4. The look (HiFi only)

A theme overlay carries a `look` block. It is data, validated for ranges like the rest of a theme:

| Field | Meaning | Range |
|---|---|---|
| `exposure` | tone-mapping exposure | 0.2 to 3 |
| `sun.color`, `sun.intensity` | the key light | hex, 0 to 10 |
| `ambient` | hemisphere fill intensity | 0 to 3 |
| `env` | reflection strength from a studio environment | 0 to 3 |
| `skyTop` | top of the sky gradient; the horizon is the level's sky colour | hex |
| `bloom.strength`, `bloom.threshold`, `bloom.radius` | glow on bright pixels | 0 to 3, 0 to 1, 0 to 1 |

`world.skyAt(z)` also returns the active section theme's id and `look`, and `game.js` passes them to `engine.setSky`,
which already runs whenever the sky changes; the change key gains the theme id, so a section that switches theme
under the same sky colour still re-applies the look. With a look, the engine:

- tone-maps with `NeutralToneMapping` (Khronos PBR Neutral keeps base colours true to the palette) at the look's exposure;
- casts sun shadows: `PCFSoftShadowMap`, a 4096 map, an orthographic box about 24 m wide reaching from 10 m behind the run to 70 m ahead, moved by the existing sun follow. Everything the engine adds to the scene (world items, chunks, the character) is marked as casting and receiving; the flags do nothing while the shadow map is off, so low-fi renders the same without a mode check;
- reflects a studio environment: `scene.environment` from `PMREMGenerator` over `RoomEnvironment`, scaled by `env`;
- draws a camera-centred sky dome with a vertical gradient from `skyTop` to the level's sky colour, outside the fog, with the fog colour set to the level's sky;
- renders through an `EffectComposer` on a half-float target with 4× MSAA: `RenderPass`, `UnrealBloomPass`, `OutputPass`. `engine.render()` renders the composer and `resize` updates it, so endings, which call `engine.render()`, get the look too;
- sets the sun and hemisphere light from the look.

Without a look the engine keeps today's path: no tone mapping, no shadows, a flat colour background, no composer.

The bend still applies: standard and physical materials include `project_vertex`, so `gfx.bend` patches them. The
dome and the post passes are not bent. Shadows stay attached to bent geometry, because both the shadow map and each
receiver's lookup use unbent world positions.

`packs/hifi/themes/downtown.js` carries only a `look` in this slice; the city replaces its street in sub-project 2.

### 5. The taxi, end to end

1. **Concept art.** GPT Image 2.5, four variants (about 1 credit), with the teaser keyframes (Higgsfield jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`) as style reference and the Milkshake-3D element (`eb91a157-e317-4233-ad5c-7658465fa7f4`) for the glossy vinyl feel. The brief: a glossy toy yellow taxi with chunky rounded proportions and a roof sign reading TAXI, rear three-quarter view, plain light background, no logos or brand names. **Gate: Caedon picks one.** This step can run first, so the pick happens while the engine work is under way.
2. **Views.** Front, side and rear of the chosen design, made by image edits with the chosen image as reference (about 1 credit).
3. **Model.** Tripo H3.1 multi-view: geometry and texture `detailed`, PBR on, `face_limit` 20000 (18 credits). One retry is budgeted. If the topology comes back unusable, Meshy 5 remesh is the fallback.
4. **Download.** The GLB comes down into the scratchpad through the context-mode shell (the Bash hook redirects `curl`). **Gate: Caedon approves with the file name, source and size.**
5. **Optimise.** `@gltf-transform/cli` as a new devDependency (**gate: Caedon approves the install**). An npm script `assets:optimize` records the exact command: meshopt geometry, WebP textures capped at 2048 px, output `public/hifi/taxi.glb`, target 3 MB or less.
6. **Module.** `packs/hifi/obstacles/taxi.js`:
   - `assets: ['hifi/taxi.glb']`; `createView(gfx)` takes `gfx.asset('hifi/taxi.glb')`.
   - The footprint is scaled to the shipped box (2.0 m wide, 4.0 m long, 1.5 m tall), keeping proportions, with the wheels on the road and the rear facing the player (−z), as the shipped taxi does. The silhouette still reads "change lane": nothing rises above the roof sign.
   - The body material becomes a `MeshPhysicalMaterial` with clearcoat, keeping the generated maps.
   - Small emissive meshes for the TAXI sign and the tail lights, so bloom catches them.
   - Static in this slice; hazard blinkers wait for sub-project 4 or 5.

Every HiFi obstacle follows one rule: same collision box and silhouette as the shipped one, so "jump, slide or
change lane" still reads at a glance. Detail goes inside the box, never above it.

### 6. Proof and measurement

- **Stills.** A fixture level, `test/fixtures/levels/hifi-shot.json` (theme `downtown`, a section with generation off that places a taxi in the middle lane and jug columns in the outer lanes, as in the 9:16 keyframe), and a dev script, `scripts/hifi-shot.js`, pasted into the page through the existing `window.__milkshake` hook. It starts the level, holds the run, frames the teaser's 9:16 shot (calibration knob: camera position and target, tuned by eye against the reference), and saves 2160×3840 stills through the scratchpad file-drop server. Stills are taken with `?fixtures&lofi` and `?fixtures&hifi` and sent to Caedon beside the reference. They are not committed.
- **Tests** (`node --test`):
  - `applyPack`: overlays only the allowed fields; rejects gameplay fields (`box`, `avoid`, `height` and the rest) with the message above; rejects an unknown shipped id and a path that does not match the id; the merged module passes `checkModule`; no entries leave the registry unchanged.
  - `look`: ranges and hex checks.
  - `gfx.dispose` skips shared geometry and materials.
  - Pack modules import in Node: no top-level `three`.
  - The 85 existing tests stay green, including the content-agnostic engine check.
- **Performance.** Draw calls, triangles and the mean frame time over 300 frames, read through the dev hook at 3024×1964 and written to the ledger. The bar is 16.7 ms on the M4 Pro; the browser pane throttles, so Caedon's full-screen browser is the real check.
- **Ledger.** `docs/specs/2026-10-08-hifi-ledger.md`: one line per `src/` change (file, what, why, "generic hook" or "HiFi-only", and whether a module could have done it without the change), plus one line per generation (job id, model, credits).

## Gates

The agent stops and asks Caedon before: every credit spend (quoted first), the concept-art choice, every download
(file name, source, size), installing `@gltf-transform/cli`, and any push or pull request.

## Build order (input to the plan)

1. Concept art, gated, so Caedon picks while the rest is built.
2. Ledger, the shot fixture and script; low-fi baseline stills.
3. Packs: `applyPack` and its tests, the quality switch, the lazy pack load.
4. Assets: the loader, `gfx.asset`, the shared-flag dispose, their tests; RUN waits on the preload.
5. The look: `look` validation, the engine's look path and the downtown look; check that low-fi is unchanged.
6. The taxi: views and model (gated), download (gated), optimise (gated install), the module.
7. HiFi stills, the performance probe, the ledger close-out.

## Risks

- **Generated geometry.** Tripo may return a lumpy or asymmetric car. Multi-view input, one retry and Meshy remesh are the mitigations.
- **Style drift** across about 50 generated assets later on. Every concept image comes from the same references and brief, reviewed per batch.
- **Brands.** Image models can invent real logos. Every concept image is reviewed, and the brief forbids logos and brand names.
- **Palette shift.** Tone mapping changes colours; Neutral was chosen to keep them, and the low-fi path is untouched.
- **Low-fi regressions.** The overlay must not touch low-fi; the "no entries, unchanged registry" test and the `?lofi` stills guard it.

## Out of scope for sub-project 1

- The city generator, building kit, skyline and horizon layer, instancing-safe bend and per-level preload (sub-project 2).
- Milkshake's remodel and rig (sub-project 3).
- Every other asset and the shield bubble (sub-project 4).
- Endings, sparkles, LED screens, traffic and any HUD restyle (sub-project 5; the HUD stays as it is unless Caedon asks).
- A WebGPU renderer (approach C, declined), HiFi performance on phones, and KTX2 GPU texture compression (WebP first; KTX2 only if texture memory becomes a problem).
