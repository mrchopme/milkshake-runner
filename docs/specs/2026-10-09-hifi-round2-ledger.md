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
| 17 | `src/worn.js` | New `wornLooks(registry, gfx)`: while a power-up's effect lasts, its `createWorn(gfx)` view rides on the character (built once, updated each frame, disposed when the effect ends; a `createWorn` result without an `object` counts as no view) | The HiFi shield bubble Milkshake wears | Generic hook | No: a power-up had no way to show on the character |
| 17 | `src/registry.js` | `CHECKS.pickup` checks `createWorn` is a function; `SKIN_FIELDS.pickup` adds `createWorn` | A pack overlay may give a power-up a worn look | Generic hook | No: the pack-overlay rule lives in the engine |
| 17 | `src/game.js` | `worn.update(run, character.object)` after `character.update(run)` in `tick`; `worn.dispose()` first in `end` | Wires the worn looks into the run | Generic hook | No: the run loop is the engine's |
| 15 | `src/gfx.js` | `fogCut = { value: 0 }`, a shared `uFogCut` uniform: `patch` and `patchSprite` drop a bent fragment the fog has fully hidden (`fogFactor > 0.999`, after three's `fog_fragment`) while it is 1 | Fully fogged buildings read as pale blocks in front of the skyline ring; dropped, the skyline shows through (the Task 14 probe, fog option A) | HiFi-only (only the look sets it; low-fi stays at 0 and the branch never runs) | No: the fog is three's, patched where the bend is |
| 15 | `src/gfx.js` | `hook.beforeBend(material)`: `bendable` calls it before wrapping, and the wrapper runs the module's own hook, then the one `beforeBend` left, then the bend | CSM's `setupMaterial` replaces `onBeforeCompile` instead of chaining; the bend has to stay last | Generic hook (only the HiFi look sets it; unset in low-fi) | No: `bendable` owns the material's hook chain |
| 15 | `src/look.js` | Two CSM cascades (`maxFar` 220, 4096 maps, `three/addons/csm`) replace the sun's single 4096 shadow box (deleted); while a look is on they carry the sun's colour and intensity and the sun hides; they aim along `engine.sunDir` itself; `hook.beforeBend` is `csm.setupMaterial`; `render` refits the splits when the fov or aspect changes and updates the cascades; `dispose()` takes them out | The probe's shadow option B: the far canyon falls into shade (5.83 ms mean / 9.5 p95), where one box around the run did not reach | HiFi-only (`src/look.js` loads only in HiFi) | No |
| 15 | `src/look.js` | `apply` sets `fogCut.value` to 1 with a look, 0 without | The fog cut follows the look, theme by theme | HiFi-only | No |
| 15 | `src/look.js` | `RING.height` 0.3 scales the skyline ring's image-aspect height | At 1 the 360 m ring stood about 485 m tall; 0.3 sits the skyline at the avenue's end (the probe) | HiFi-only | No: nothing could live at the horizon |
| 15 (fix 1) | `src/gfx.js` | `hook.cutFog`: `cutFog` patches a bent shader only once the HiFi look has set it (in `createLook`, before anything compiles); the test-only `fragmentShader` guard is gone | Low-fi's fragment shaders stay three's, with no `discard` (Apple, Mali and Adreno GPUs treat a shader that can discard as alpha-tested) | HiFi-only (only the look sets it) | No: the fog is three's, patched where the bend is |
| 15 (fix 1) | `src/look.js` | `cascadeHook(csm)`: CSM's `setupMaterial` for lit materials only (Standard/Physical, Toon, Lambert, Phong), and a `dispose` listener deletes each from `csm.shaders`; the look sets `hook.cutFog`; its uncalled `dispose()` is removed | CSM's Map is strong and kept every bent material, several per spawn (jug blob and glow, orb and billboard sprites, the shield bubble) | HiFi-only | No |
| 15 (fix 1) | `src/engine.js` | Comment only: the sun's placement comment names the look's cascades instead of the old shadow box | The box is gone | No behaviour change | — |

## Assets

| Asset | Wave | Job ids | Credits | File | Size | Caedon's approval |
|---|---|---|---|---|---|---|
| style: downtown | 1 (pick) | f549c2e3-c041-4efb-a70d-3a55cb4de145 (variant 4) | — | — | — | picked 2026-10-13 |
| style: midtown | 1 (pick) | ae99b100-9a6d-465d-9386-91d02265c2a3 (2) | — | — | — | picked 2026-10-13 |
| style: uptown | 1 (pick) | ce281982-6f14-4adb-8337-9a96dc087ef6 (2) | — | — | — | picked 2026-10-13 |
| style: bridge | 1 (pick) | dbb92908-b164-4f68-ac9a-7dbb93cda0a7 (5, Nano Banana Pro) | — | — | — | picked 2026-10-13 |
| lamp | 1 (pick) | 3133cf3e-ed51-41c8-97a2-c9d4d1fc2624 (redo set, 3) | — | — | — | picked 2026-10-13 |
| lamp_double | 1 (pick) | 3fc00899-9696-4970-8d24-6dbd01e25904 (1) | — | — | — | picked 2026-10-13 |
| traffic_light | 1 (pick) | ce995a6f-1f5b-42cd-a2ab-e0da85031693 (2) | — | — | — | picked 2026-10-13 |
| hydrant | 1 (pick) | b19f139f-6012-48ab-9906-9bdf348f9a9c (1) | — | — | — | picked 2026-10-13 |
| bench | 1 (pick) | a07fce84-6830-48b3-b26a-c6264b79559e (1) | — | — | — | picked 2026-10-13 |
| bin | 1 (pick) | ba55be1d-42a1-40ae-9a6d-a8f34183ed98 (2) | — | — | — | picked 2026-10-13 |
| bin_box | 1 (pick) | 22fc22cc-ff1d-4582-a67b-fbd0207d6550 (2) | — | — | — | picked 2026-10-13 |
| planter | 1 (pick) | 631f1bfc-df67-4fdb-be5d-871e7e05c9f8 (3) | — | — | — | picked 2026-10-13 |
| tree | 1 (pick) | e3eddf0a-bd18-4461-98c7-5d8348f34229 (1) | — | — | — | picked 2026-10-13 |
| newsstand | 1 (pick) | 7863661e-e66b-4563-986f-315cf309d2ec (2) | — | — | — | picked 2026-10-13 |
| bus_shelter | 1 (pick) | 6a2da64d-8d3b-4d1b-9139-c3ccbfa320e6 (1) | — | — | — | picked 2026-10-13 |
| subway | 1 (pick) | 2667c6d0-6df3-4f99-a1c4-9c41958b7342 (2) | — | — | — | picked 2026-10-13 |
| barrier_low | 1 (pick) | 1b1ecb99-02ef-4167-9ed1-de77f55c3255 (2) | — | — | — | picked 2026-10-13 |
| delivery_bike | 1 (pick) | 5496bcfc-8fe2-4d90-ad11-73f0c8a6f278 (4) | — | — | — | picked 2026-10-13 |
| hot_dog_cart | 1 (pick) | a5faf683-fc15-4bd2-a6ba-6d8a12685773 (2) | — | — | — | picked 2026-10-13 |
| manhole_steam | 1 (pick) | 08e7eeb4-08b2-458a-b0c0-5a370bd4b4a3 (2) | — | — | — | picked 2026-10-13 |
| pigeon | 1 (pick) | f95d121d-3ed5-409c-9075-3735ca1315b8 (1) | — | — | — | picked 2026-10-13 |
| scaffold_beam | 1 (pick) | 8b67208c-cf55-4086-b157-952ba4822143 (2) | — | — | — | picked 2026-10-13 |
| jug | 1 (pick) | b7312c2c-7407-4e90-86d5-e9ec3ead9c6f (1) | — | — | — | picked 2026-10-13 |
| magnet | 1 (pick) | dd3fc874-9ed1-452a-98eb-26a6448bdb7f (1) | — | — | — | picked 2026-10-13 |
| shield | 1 (pick) | 55881c5a-bdb0-4988-a000-74beb6accdf6 (1) | — | — | — | picked 2026-10-13 |
| x2 | 1 (pick) | 0f28e9a8-5cc8-4b50-aa33-4f3701f7f26f (2) | — | — | — | picked 2026-10-13 |
| overpass | 1 (pick) | a9e12a65-4d32-48f0-84a1-24f928e3e224 (1) | — | — | — | picked 2026-10-13 |
| railings | 1 (pick) | 94388a08-7001-4a7a-882c-504dde7daddc (1) | — | — | — | picked 2026-10-13 |
| tunnel | 1 (pick) | 142290f4-83ba-472d-8b39-f86dffae869f (2) | — | — | — | picked 2026-10-13 |
| sedan | 1 (pick) | bdb850bd-932f-4f33-8fa3-2238d62034df (1) | — | — | — | picked 2026-10-13 |
| van | 1 (pick) | 6f4ff7f8-1cf1-47ca-b2fb-f728cef42fa4 (3) | — | — | — | picked 2026-10-13 |
| milkshake | 1 (pick) | 7fb9ffe8-1bce-4441-9b12-900e80f1a05b (4) | — | — | — | picked 2026-10-13 |

## Credits

Budget for the round: about 750 (ask again above about 1,000). Balance at the start: 2,979.75 (Ultra, 2026-10-09).

| Task | Job ids | Model | What | Credits (balance before → after) |
|---|---|---|---|---|
| 5 | `scratchpad/wave1-jobs.json` (16 GPT style frames, 4 NBP hero frames, 112 + 4 concepts, 3 price probes) | gpt_image_2_5, nano_banana_pro, nano_banana_2_1 | Wave 1 (Caedon: "Approve (about 46)"; lamp redo 1) | 45.75 (2,979.75 → 2,934) |
| 20 | `scratchpad/w2/jobs.tsv` (203: 52 views, 151 city images; 2 storefronts resubmitted after a 503 that charged nothing) | gpt_image_2_5 | Wave 2 (Caedon re-confirmed "Go ahead (about 133)" after compaction; probe gate "about 139") | 132.5 (2,934 → 2,801.5) |
| 20 | `scratchpad/w2/redo-jobs.tsv` (18 view redos, 4 midtown skylines without the sun glow) | gpt_image_2_5 | Wave 2 redos (Caedon: "Redo 18 views (4.5)", "Redo without glow (4)") | 8.5 (2,801.5 → 2,793) |

## Downloads and dependencies

| Task | What | Source | Size | Approved by Caedon |
|---|---|---|---|---|

## Stills and measurements

| Task | Still or probe | Query | Result | SHA-256 |
|---|---|---|---|---|
| 2–16 | low-fi re-shots | `?fixtures&lofi` after Tasks 2+6, 16 and 19 merged | 464,350 bytes each time, byte-identical | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 14 | `hifiProbe` per shot level (placeholder city, Tasks 9–13 and 16–19 in) | `?fixtures&hifi`, 150 frames at 3024×1964 (1512×982 at dpr 2), browser pane | downtown 5.98 ms mean / 11.3 p95, 351 calls, 234,800 tris; midtown 5.55 / 9.8, 348, 195,928; uptown 5.49 / 10.7, 351, 278,244; bridge 5.31 / 10.3, 260, 185,492; textures 32–51 across the four (render targets and per-theme placeholder tiles) | — |
| 14 | fog option B (console: fog near and far × 1.6, 63.6/212 → 101.8/339) | downtown, 120 frames | 5.36 / 11.7 ms; the far end reads clearer, no change in cost | — |
| 14 | shadow option A (console: 8192 map, box top/bottom ±90, sun target 60 m ahead) | downtown, 120 frames | 5.98 / 12.3 ms, 367 calls; no visible difference in the 16:9 frame | — |
| 14 | skyline ring height × 0.3 (console) | downtown 16:9 | the placeholder skyline sits low at the avenue's end instead of a grey wall; the ring formula (~485 m on 360 m) needs this calibration | — |
| 1 | `baseline-lofi-r2.png`, 2160×3840 | `?fixtures&lofi` on fba8e25 (9132bae's code plus docs), `hifiShot` | 464,350 bytes. **The round's low-fi invariant** (v4's merge retired c97c809e… on purpose) | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 1 | `baseline-lofi-r2b.png`, 2160×3840 | same, after a page reload | 464,350 bytes, byte-identical to the first | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 1 | `hifi-r2-start.png`, 2160×3840 | `?fixtures&hifi` on fba8e25 | 1,580,843 bytes, the before picture for the round | fc6bd358523be6f79b9d725b131ad1af704b14b66f74d8d8083ccf281cd12aa2 |
| 15 | `t15-lofi.png`, 2160×3840 | `?fixtures&lofi` after merging Task 15 (2012105) | 464,350 bytes, byte-identical to the baseline | 3d77a9396eb7561df7bf6b010f19d49fc163b0e0fa9048f8890ccc560807a8e3 |
| 15 | `hifiProbe` downtown and midtown, fog cut + 2 CSM cascades together | `?fixtures&hifi`, 150 frames at 3024×1964 | downtown 7.74 ms mean / 11.2 p95, 527 calls, 352,622 tris; midtown 5.93 / 10.4, 519, 293,115 (Task 14 base: 5.98 / 11.3 and 5.55 / 9.8) | — |
| 15 | `t15-downtown-16x9`, `t15-midtown-clean` (1080×1920), `t15-bridge-16x9` | `?fixtures&hifi` on 2012105 | the skyline sits low at the avenue's end (ring × 0.3); cascaded shadows; white paint and the taxi's lamps still bloom (Task 24) | — |

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
- Task 16: Ruling: a start pressed while the menu's own load runs waits for it, then loads its own files and starts; only a second start while one is pending is dropped, and the RUN/LOADING… label follows whichever call owns a load (main session, fix round 1); `levelAssets` also takes the `levels` map and adds the files of the next level the ending declares (a `level` param), one step ahead, and the same union is the keep set for `release` — the sub-project 1 gate let the first click during the boot load start, and spec Engine change 7 preloads the declared next level so a transition carries on — if wrong, a boot click reads RUN while nothing is ready, or level 2 loads behind a frozen frame.
- Task 12: Ruling: the pylons (`box(1.6, 38, 1.6)` at x ±6.2, off the 10 m deck) stand in the water, base y −6, top y 32, with the crossbeam just under the top — a 38 m pylon starting at deck level would hang over the water — cost if wrong: raise `TOWER` by 6 m if board 15 means 38 m above the deck.
- Task 12: Ruling: cables are 8 segments per direction per pylon (32 in a tower chunk), a half catenary (y ∝ (1 − t)²) from just under the pylon top down to 1.2 m above the deck edge (x ±4.8), ending 0.5 m inside the chunk edge so the tilted boxes' thickness stays inside the seam; a tower pair needs a chunk at least 120 m long — cost if wrong: retune `CABLE` at the frame probe.
- Task 12: Ruling: the waterfront low-rises centre at |x| 30.5–50.5 (as the shipped bridge), 8 m wide, a downtown facade wall facing the road plus a body box in the wall's colour, merged per material; the water's UVs are in world metres (`WATER.tile` 10 m) so the ripples run on across chunk seams; the deck and paint use downtown's road and paint colours — cost if wrong: retune `LOW`/`WATER` at the frame probe.
- Task 12: Ruling: the brief's test also runs at z0 1200 (1080 and 840 are odd multiples of 120, so the first bridge chunk of either level has no tower) and checks the 45-mesh budget; a second test checks the water's shader patch binds `gfx.time` and replaces `normal_fragment_maps` — strengthening, nothing weakened — cost if wrong: none.
- Task 15: Ruling: the fog cut also patches bent sprites (`patchSprite`), as the probe did; the brief names only `patch` — a fully fogged sprite would otherwise draw as a fog-coloured shape over the skyline — cost if wrong: one `cutFog` call to delete.
- Task 15: Ruling: "dispose the CSM with the look" — the look had no `dispose`, so it gains a minimal one (nothing calls it yet; the look lives for the session) that clears `hook.beforeBend`, removes the cascades, frees their shadow maps and shows the sun again; it never calls three's `csm.dispose()`, which deletes each material's `onBeforeCompile`: after `bendable()` that is the bend wrapper, so every bent material would draw straight — cost if wrong: seven lines to delete.
- Task 15: Ruling (fix round 1, the main session's): the fog cut compiles only in HiFi (`gfx.hook.cutFog`, set once by `createLook` before anything compiles), not in every session as the brief's `patch` had it, so low-fi's shader text stays the base's, with no `discard`; no program-cache key, since `?lofi` and `?hifi` never share a page — cost if wrong: a page that switched quality in place would keep the first quality's shaders.
- Task 15: Ruling (fix round 1, supersedes the "dispose the CSM with the look" Ruling above): the look keeps no `dispose()`: it lives for the session, and nothing called it. The warning stays as a comment by the CSM: never `csm.dispose()`, which deletes each material's `onBeforeCompile` (after `bendable()`, the bend). The leak to watch was CSM's material Map, not its lights: `cascadeHook` hands CSM only lit materials and drops each from the Map when disposed — cost if wrong: a later task that disposes the look writes its own teardown.
- Task 18: Ruling: the MSAA readBuffer check is settled from three 0.186.1's `EffectComposer` source, not a browser log — the composer is internal to `createLook` and not on the dev hook; with `OutputPass.needsSwap = false` no pass swaps, so `readBuffer` stays `renderTarget2` (the clone of the 4× MSAA target) every frame and `renderTarget1` is never drawn into, so `renderTarget1.samples = 0` is the right one — cost if wrong: aliased edges, caught by the before/after stills in Task 18 Step 4.
- Task 18: Ruling: Milkshake's dust puffs keep `born = run.time`; when a run's clock restarts while the view lives on (the shot helper's level switch, and any hand-off that reuses the view), a leftover puff's age goes negative and `opacity = 0.5 * (1 - age / 0.35)` reaches ~6.7, which the HiFi bloom turns into a white flare over the bottom of the frame (found in Task 15's midtown frame; gone after a reload). The one-line fix (a puff with a negative age hides) rides in Task 18's minors with a Node test — cost if wrong: none, a hidden puff is the right state for a clock that went back.
- Task 24: note (Task 15 review M5): `RING.height` 0.3 squashes a 21:9 skyline over half the ring to about 7.8:1; with the real strips, prefer more repeats around the ring (keeping the art's aspect) over the height knob — cost if wrong: flattened towers on the horizon.
- Task 20: Ruling: views are checked against the convention that a left view shows the object's front pointing to the left edge of the frame (camera at the object's left); 18 of 52 drew the wrong side (a rear drawn as a second front, both sides facing the same way, an end drawn as a long side) and were redone with the side spelled out in the view clause (Caedon approved, 4.5); the newsstand's left and right are mirror-consistent but swapped, so they go to Tripo swapped, free — cost if wrong: a mirrored model, harmless for these left-right symmetric props.

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
- Task 15: complete (commits 841b3b2..141acba, merged as 2012105; fix round 1: CSM forgets disposed materials and sees only lit ones, the fog cut compiles only when a HiFi look exists, uncalled `dispose()` removed, stale comments; re-review clean; npm test 154; `?lofi` 3d77a939…, unchanged)
- Task 15: minors (re-review, parked): N1 the CSM test stands in for `csm.shaders`, so a three rename would slip by (three pinned ^0.186.1); N2 the first Task 15 Engine-changes row reads in pre-fix terms, superseded by the `15 (fix 1)` rows.
- Task 20: Steps 1–3 done (203 generated, 0 failed; 18 views and 4 midtown skylines redone). Step 4: Caedon asked for the contact sheet and picks on a Paper board beside the others, not a separate HTML page; download not yet approved.

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
- Task 10: Ruling: `packs/hifi/lib/buildings.js` imports `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js` at the top of the file — the "no top-level three" rule exists so content imports in Node without a renderer, and that addon imports only `three` core, which Node already loads in the tests (the spec names `BufferGeometryUtils` for the merge) — cost if wrong: the helper takes `mergeGeometries` through `gfx` instead, a one-line `src/gfx.js` change with its ledger row.
- Task 10: Ruling: the water tower is clamped to blocks deeper than 4 m (`depth > 4` ahead of its seeded draw), as the brief's prose asks and its code block left out — a 1.8 m tank centred on a 3–4 m block crosses the block's ends and can leave the chunk — cost if wrong: a few short blocks lose a tower.
- Task 10: Ruling: the theme overlays change only `STYLE` (`parts: [buildings], facades: [], shops: []`) and its import; no colour keys were added to `STYLE`, because the shells already take their colours from the shipped `theme.buildings.colors` passed in as `style.buildings` — cost if wrong: a later task adds colour keys to `STYLE`.
- Task 10: fix round 1/5 (2 addressed, 0 open — placeholder cached under a tile's key; the cross street open to the sky; commits 8d145d9..b16871f)
- Task 10: complete (commits c030bcc..b16871f, review clean after the fix round; merged over Task 13 without conflict; npm test 137)
- Task 10: minor (deferred): placeholder walls take `colors[f]` while the body and cornice take a separate random colour; the water-tower geometry is rebuilt per chunk (could be built once and shared); `tile()` sets wrap on the shared texture without `needsUpdate`; no guard for `minH < 4.3 m`; the facade-line test uses one seed.
- Task 16: fix round 1/5 (2 addressed, 0 open — a dropped start reset the label during the menu's load; the declared next level was not preloaded; commits 83e2b9a..c98c7b3)
- Task 16: complete (commits 081a120..c98c7b3, review clean after the fix round)
- Task 16: minor (deferred): `menu()` and a waiting start can overlap their `character()` calls (harmless while every level uses Milkshake); disposing the menu backdrop before `release` relies on microtask order (an explicit await would be sturdier); the keep set now spans two levels' files (the declared next level), a memory-budget note for the probe.
- Wave 1 spend (Task 5): probe 4.75 (GPT 2k medium 1:1 = 1.00, GPT 21:9 4k low = 0.75, Nano Banana 2.1 8:1 4k = 3.00); 16 GPT style frames 4; 4 Nano Banana Pro hero frames 8; 112 concepts 28; total 44.75 (balance 2,979.75 → 2,935). Job ids in the Credits table.
- City frames after Tasks 9, 10 and 13 (main session, `?fixtures&hifi`, 1080×1920 and 1920×1080, downtown, midtown, uptown): shells, window grids, storefront bands, the paved cross street and the ring's foot fading to each theme's sky all read; low-fi re-shot after Task 16: 3d77a939…, unchanged. Observed for the probe and Task 24: the placeholder skyline ring stands far too tall (a grey column reaches the top of the 16:9 frame; Task 13's concern about ~485 m rings confirmed), and the white crosswalk and lane paint blooms like light bars.
- Task 17: review approved (commits 3ec8658..72bbb61, merged). Main session's rim crop (1080×1920, shield effect forced on the shot level): the bubble attaches once and reads as a translucent sky-blue sphere, but its rim barely glows (opacity 0.22 scales the fresnel term below the bloom threshold, as the reviewer predicted) → fix round 1 sent with a guard for a `createWorn` that returns no `.object`.
- Task 19: complete (commits d968787..fb28fe8, review clean; npm test 144 after merge; no `src/` change)
- Task 19: minor (deferred): `const LEG_SWING =0.7` spacing; `cowView`'s `skin` parameter shadows the module's `skin()` function; `BONES` legs read the default `SKIN.crotch`, so a caller that changes `crotch` must pass bones too; a HiFi `load`/`dress` that throws falls back to the shape cow silently (a `console.warn` would help Task 23).
- Task 11: review found 3 Important (traffic: the preloaded taxi GLB drives sideways in its own frame; frozen car shadows; cars past the end of the paving) → fix round 1 sent.
- Task 17: fix round 1/5 (2 addressed, 0 open — rim alpha; a view without an object; commits 72bbb61..896c385). Task 17: complete (commits 3ec8658..896c385); rim crop re-shot after merge (see Stills).
- Task 11: Ruling: furniture follows board 15 as Caedon approved it, not the brief's sample `RHYTHM`: lamps, trees, hydrants and bins keep the brief's rhythm (`RHYTHM`); benches and newsstands are `SCATTER`ed about one a chunk each (`perChunk`, scaled by length) on a random side and spot; a bus shelter or subway entrance appears at most once a chunk, on one side (`RARE.chance` 0.5); every rhythm copy jitters ±0.3 m and is dropped within 2 m of the side street (`CLEAR`), scattered pieces draw their spot with the side street's clear zone plus a 1.5 m half-footprint left out — the board is the approved source — cost if wrong: retune the knobs at the frame probe.
- Task 11: Ruling: every furniture copy, not only the wide kinds, is clamped to `[z0 + 2, z0 + length - 2]` — the brief's lamp starts at `z0` and the jitter would push a copy over the seam; one clamp is simpler than a per-kind width — cost if wrong: a copy at a chunk's very end sits up to 2 m off its rhythm.
- Task 11: Ruling: sign stacks start no later than 6.24 m (not 6 m) from the chunk's end, and keep that clearance from the side street — the bezel is 8% wider than its panel, so a 6 m panel's bezel crossed the seam by 0.12 m — cost if wrong: none visible.
- Task 11: Ruling: the code stand-ins (`STAND` in `kit.js`, shared by furniture and traffic) are boxes sized and coloured per kind, the lamp a pole plus an emissive head (the head itself, per the glow rule), the tree a trunk plus a crown, instead of the brief's single `default` box — "roughly the right size and colour" — cost if wrong: placeholders only, gone when Task 23's models land.
- Task 11: Ruling: traffic's per-kind phase is a uniform `uPhase` on each cloned material (with `fract(gl_InstanceID * 0.618 + uPhase)`), and a car heading +x drives the far lane (`cross.z + 9`), -x the near one (`cross.z + 3`) — three keys programs by the hook's source, so a constant baked in per clone would share the wrong program, and instance 0 of every kind would otherwise start at the same spot; lanes by direction keep cars from driving through each other — cost if wrong: retune `DRIVE` at the probe.
- Task 11: Ruling: the brief's furniture and traffic tests also assert that something was built (they passed vacuously before the parts existed), and a board 15 test checks the side-street clearance and at most one shelter or subway a chunk — strengthening, nothing weakened — cost if wrong: none.
- Task 11: Ruling (fix round 1): traffic bakes each loaded model part's fit (node transforms, scale, yaw) into a geometry cached per part and flagged shared (`fitted` in `traffic.js`), so the instance matrix is the placement alone and the drive's +z is the car's own ahead in metres; placeholders, already in that frame, are used as they are — smaller than passing a per-part axis into a shared material, and testable in Node — cost if wrong: one extra geometry per loaded car part, kept until reload (`release` does not free the baked copies).
- Task 11: Ruling (fix round 1): car shadows use a pack-only `customDepthMaterial` (`MeshDepthMaterial`, `RGBADepthPacking`) carrying the same drive hook and phase uniform, so the shadow drives with the car; no `src/` change — the hook is shared, so it is no messier than the colour pass; like every other shadow in the city it is not bent — cost if wrong: car shadows sit off the bent car on a turn.
- Task 11: Ruling (fix round 1): cars drive from |x| 9 to `DRIVE.to` 19.5 (the paving ends at 4.5 + `CROSS.reach` = 22 m, less half the longest car) instead of the brief's 40, and wrap — cost if wrong: retune `DRIVE.to` if the generated cars are longer than 5 m.
- Task 11: fix round 1/5 (3 addressed + 2 minors, 0 open — traffic in the fitted frame, car shadows through a `customDepthMaterial` with the drive hook (pack-only, no `src/` change), drive limited to the paving (|x| 9 → 19.5); commits 1e745b1..89da28e)
- Task 11: complete (commits 4e7d979..89da28e, review clean after the fix round)
- Task 11: minor (deferred): traffic's bounding sphere ignores the 10.5 m drive (a car can be frustum-culled near the frame edge; pad the sphere or `frustumCulled = false`); `kitParts` keeps stale parts after `release()` and each baked car geometry lives for the session; the taxi stand-in stays adopted for the rest of `test/city.test.js`; `RGBADepthPacking` is moot with depth-texture shadow maps.
- Task 12: complete (commits 22c5d42..95c63a5, review clean; npm test 151; no `src/` change)
- Task 12: minor (deferred): `WATER.scroll.toFixed(2)` would round a retuned 0.004 to 0 (freezing the ripples); cable segments are single 7.5 m boxes (bend only at their nodes); cables end 1.2 m above the deck; pylons stand 38 m from the water (about 32 m above the deck); waterfront blocks mostly sit below deck level (plan-mandated heights): all for the probe frames.
- Task 5: the lamp's four concepts came out as snakes ("cobra-head" read literally); redone once with "a plain street fixture, not an animal" (4 × 0.25 = 1 credit, inside wave 1's 20% allowance; jobs e6e45a28, cf55f8ea, 3133cf3e, ccca68d2). Board 16 "Wave 1 concepts" laid out on Paper (images by URL); every image reviewed for brands, landmarks and text: sign words only PIZZA, HOTEL, CAFE, DELI, TAXI; the 2× token reads "2×"; midtown style frames 1 and 5 carry deco spires in the haze (flagged; avoided in the recommendation); three magnet concepts have smiley faces; three delivery-bike riders came out as cows.
- Task 5: Caedon's picks (2026-10-13, AskUserQuestion): style frames downtown 4, midtown 2, uptown 2, bridge 5; concepts as recommended except Milkshake 4 (grey spots, closest to the low-fi Milkshake). Job ids in the Assets table.
- Task 17: rim crop after the fix (1080×1920, shield forced on the shot level, bubble2 c20a6bb3…): the bubble's fresnel edge now glows blue-white and blooms at the top, the middle stays see-through with Milkshake visible; glow from its own shape, no ring or plate (Caedon's rule).
- Task 14: the zero-cost probe. Throwaway branches `probe/fog-cut` (5e9251a) and `probe/csm` (d05bc8d), built by a subagent, served from detached worktrees on 5178 and 5181. Fog cut: 5.22 ms mean, the skyline shows through where fully fogged buildings sat as pale blocks; fog pushed out 1.6× (to 339 m) would sit past the 200 m streaming edge, so new chunks would pop in. Cascades: 5.83 ms mean / 9.5 p95, 525 calls, the far canyon falls into shade; the longer 8192 box: 5.98 / 12.3, no visible change at the 16:9 camera. Ring height × 0.3 puts the skyline low at the avenue's end.
- Task 14: gate (Caedon, 2026-10-13, AskUserQuestion): fog "Drop fogged pixels"; shadows "Cascades"; waves 2 and 3 "Go ahead (about 643)" (wave 2 about 139 at the measured 2k medium price of 1.00 an image, 3 candidates per facade and storefront; wave 3 504, the 54-credit pilot first).
- Task 15: Ruling: the skyline ring's height becomes a calibration knob at 0.3× the image-aspect height (the probe's console test), in Task 15 beside the fog and shadow choices, since all three are probe outcomes in `src/look.js` — cost if wrong: one knob value.
