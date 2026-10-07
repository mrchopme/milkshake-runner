---
provenance: agent-generated
last-verified: never
---

# Codex modularity review of the Milkshake Runner plan (2026-10-07)

> Point-in-time snapshot. Produced on 2026-10-07 by OpenAI Codex CLI 0.154.0 running `gpt-6.1-sol`
> (read-only sandbox) over the approved spec and plan in this folder, at Caedon's request, to check
> whether the plan is modular enough to be "vibe-coded on top of" for customisation of every aspect of
> the game and for modular level design. Ezra raised specific modularity changes in a call the same day
> that was not recorded, so this review argues from the general bar only. Line references point at the
> plan file as committed at 7ef30bf. Shade (Fable 5.1) checked the main claims against the plan before
> relaying them; it has not acted on the recommendations.

## 1. Verdict

**No—not against the October 7, 2026 requirement.** The plan is modular for testing and for adding **variations of the existing procedural runner**, but not for customising every aspect without changing shared implementation files. Today, “content” means level JSON selecting from fixed obstacle, theme, power-up and ending lists; character models, scenery construction, pickup behaviour, HUD, physics and progression remain shared code. That boundary is deliberately narrower than the new requirement: the October 2 spec explicitly calls new obstacles/themes/cutscenes “engine PRs” and excludes community-made obstacles and cutscenes from v1. This requires a scope revision, not merely tidier implementation. The smallest adequate boundary is: **the engine owns scheduling, rendering infrastructure, input transport, streaming and lifecycle; selectable content modules own appearance and gameplay policy.** Keep the existing modules, but make their built-in implementations registered defaults rather than the only implementations. See `docs/projects/milkshake-teaser/2026-10-02-milkshake-runner-design.md:87` and `docs/projects/milkshake-teaser/2026-10-02-milkshake-runner-design.md:161`.

## 2. The bar, unpacked

**Assumptions:** I interpret “every aspect” as the listed surfaces within a browser lane-runner, including character animation/hitboxes, obstacle behaviour, pickup effects, scenery, camera presentation, HUD, endings, movement parameters and scoring/completion rules. I also assume “modular level design” includes authored sections and placements—not only random-generation weights. I do **not** infer Ezra’s unavailable specifics, or assume this requires multiplayer, a visual editor, another renderer or reversing the explicit no-sound decision.

All `src/...` files below are **proposed files whose code appears inline in the plan**, not implemented files. “Core edit” means editing shared implementation, not just `src/engine.js`.

- **Add a level using existing content — data only, with a manifest edit.** Add `levels/<id>.json` and append its ID to `levels/index.json`. This is supported, although it is technically a two-file contribution.
- **Adjust difficulty, obstacle mix, jug frequency, sky and fog — data only.** The existing schema supports these variations.
- **Design precise obstacle/pickup arrangements or reusable level sections — core edits.** `generate()` supports weighted procedural rows, not authored layouts or section composition.
- **Publish a reproducible level with a fixed seed — core edits.** `rng()` exists, but `playLevel()` chooses `Math.random()` and the schema rejects a `seed` field.
- **Reskin the one shipped character — one-file asset replacement in the simplest case.** Adding/replacing `public/milkshake.glb` works if its orientation fits. Calibration requires changing `MODEL_YAW`. It globally changes the shipped character; adding a separately selectable character requires core edits.
- **Add an obstacle — core edits.** A conventional obstacle requires `catalog.OBSTACLES` and `world.MAKERS`; novel movement/collision behaviour also reaches `rules.js`, and potentially `generator.js`.
- **Select existing power-ups — data only; add or customise an effect — core edits.** New effects touch `POWERUPS`, `collectJug()`, run state/timers, rendering and HUD. Changing existing durations also edits shared rules.
- **Add a building-palette variation — one shared core-file edit.** Adding to `THEMES` lets the existing building generator use it, but this is not a one-file plugin. A forest, beach, different road or new props requires changing `scenery()`.
- **Choose existing endings or chain existing levels — data only.** Add a new ending/cutscene or parameterise the existing finish message — core edits.
- **Reskin or replace the HUD/menu — shared presentation-code edits.** CSS variables provide useful styling knobs, but there is no selectable UI definition or factory.
- **Change gravity, speed, controls, hitboxes, health, scoring or completion rules — core edits.** Some individual changes are small, but they alter shared behaviour rather than a level-selected preset.
- **Install two contributions side by side without changing levels 1–2 — not reliably supported.** There are no namespaced content registrations, per-level character/UI/rule selections or opt-in configuration boundaries.

The plan’s seeded generator is at `2026-10-02-milkshake-runner-plan.md:648`; the random session seed is at `2026-10-02-milkshake-runner-plan.md:1390`. Its contributor instructions explicitly direct new content toward engine PRs at `2026-10-02-milkshake-runner-plan.md:1955`.

## 3. Extension points

| Aspect | How it changes under the current plan | Smallest suitable extension point |
|---|---|---|
| **Character** | Replace `public/milkshake.glb`; otherwise edit `src/milkshake.js`: `loadModel()`, `shapeCow()`, `MODEL_YAW`, `pose()`. `main()` creates one global character. | Level-selected character descriptor: model URL, orientation, dimensions and default animation parameters. Optional character factory for custom animation. Preserve Milkshake as the default. |
| **Obstacle** | Edit `src/catalog.js` → `OBSTACLES`; edit `src/world.js` → `MAKERS`. New behaviour reaches `updateObstacle()`/`obstacleBox()` in `src/rules.js`. | One obstacle module exporting collision/generation metadata, a view factory and optional behaviour hooks. Derive validation’s known IDs from registrations. |
| **Pickup / power-up** | Edit `POWERUPS`/`PALETTE`; extend `createRun()`, `step()`, `collectJug()`, `jugInReach()`; update `jugMesh()` and `createHud().update()`. | Registered pickup/effect definitions with collection/timing hooks and display metadata. Generic active-effect state, rather than adding another named timer everywhere. |
| **Theme / scenery** | JSON changes sky/fog and picks `theme.buildings`. Edit `THEMES` for palettes/heights; edit `scenery()` for other environments. | Theme descriptor for palettes, lighting/camera defaults and scenery parameters; optional `createChunk()` factory for a different environment. |
| **Level** | Add JSON plus index entry. `generate()` determines placement; `playLevel()` chooses the seed. | Retain current procedural shorthand; add optional seed, ordered section overrides and explicit placements. No JavaScript inside level files. |
| **Ending / cutscene** | Edit `SCENES` and `CUTSCENES`; edit `playEnding()` for another ending category. `startLevel()` also hard-codes progression consequences. | Registered ending runner with validated parameters. Keep progression/unlocks separate from presentation. |
| **HUD / UI** | Edit `index.html`, `src/style.css`, `src/hud.js`; screen flow and result copy also live in `src/main.js`. | Default UI behind a selected factory and small view model/action interface. Data-driven styling/copy; optional replacement component that owns its DOM and cleanup. |
| **Rules / physics** | Edit constants and functions in `src/rules.js`; lane assumptions also appear in `generator.js`, `world.js`, `input.js` and `engine.js`. | Validated per-level rule parameters plus an optional rule-set factory. Resolve one rule set per session; keep the loop generic. Share lane geometry across generation, collision and presentation. |

The relevant implementation boundaries are visible in `2026-10-02-milkshake-runner-plan.md:892` (`rules.js`), `2026-10-02-milkshake-runner-plan.md:1149` (`world.js`), `2026-10-02-milkshake-runner-plan.md:1259` (`milkshake.js`) and `2026-10-02-milkshake-runner-plan.md:1339` (`hud.js`).

## 4. Risks of the current structure

### Catalog membership does not guarantee implementation

The same content is described in multiple places:

- Obstacles: `catalog.OBSTACLES` and `world.MAKERS`.
- Cutscenes: `catalog.SCENES` and `endings.CUTSCENES`.
- Power-ups: `POWERUPS`, named run fields, collection branches, timer updates, colours and HUD strings.

A contributor following “change `src/catalog.js`” can produce a level that **passes validation but crashes during rendering**: `createWorld().build()` calls `MAKERS[o.id]()`, while `playEnding()` calls `CUTSCENES[ending.scene](ctx)`. A catalog-only power-up addition can instead be silently ineffective because `collectJug()` has no matching branch.

I checked the inline validator in memory: adding an obstacle definition to the catalog makes its level reference valid even though no corresponding maker exists. See `2026-10-02-milkshake-runner-plan.md:1224` and `2026-10-02-milkshake-runner-plan.md:1813`.

### Contributions converge on shared files and global settings

A new obstacle and a new scenery theme both edit `catalog.js` and `world.js`. Two power-ups both edit `rules.js` and `hud.js`. Two cutscenes both edit `catalog.js` and `endings.js`. Even ordinary level PRs share `levels/index.json`.

More importantly, those changes can alter shipped content without conflicts being obvious:

- Replacing `milkshake.glb` changes every level.
- Changing `PALETTE`, physics constants or HUD markup changes every level.
- New rules cannot be selected only for a community level.
- `createRun()` has nowhere to initialise a level-specific rule configuration.

Separating code into files does not solve this; **selection and ownership boundaries** are missing.

### Level design is parameterisation, not composition

`generate()` fixes the row spacing, start/end clearance, lane arrangement probabilities and jug-placement strategy. A designer cannot describe a quiet introduction, an exact jump sequence, a themed midpoint or a pickup tutorial.

`densityAt()` provides one interpolation across the entire level. There is no section model, and the random seed is not exposed to the author. See `2026-10-02-milkshake-runner-plan.md:640` and `2026-10-02-milkshake-runner-plan.md:677`.

### `validateLevel()` rejects legitimate expanded-bar variations

These are intentional October 2 restrictions, but blockers under the October 7 requirement:

| Variation | Current rejection |
|---|---|
| Character selection, seed, sections, rule preset or a general pickup definition | Unknown top-level key |
| Installed new obstacle, forest theme, power-up or cutscene without editing the catalog | Fixed-list membership |
| Obstacle-free introductory or scenic level | Requires at least one obstacle; density cannot be zero |
| Short tutorial under 300 m, or finite level over 5000 m | Fixed length bounds |
| Custom finish text, duration or visual parameters | `finish` accepts no other fields |
| Objective-ended endless level | Null length cannot have an ending |

The opposite problem also exists: **nested unknown keys are generally accepted but ignored**. For example, `theme.road` passes validation, although `scenery()` uses `PALETTE.road`. Simply relaxing validation would therefore create misleading “working” customisation.

I confirmed these cases against the inline code. The restrictions are at `2026-10-02-milkshake-runner-plan.md:446`, with finish handling at `2026-10-02-milkshake-runner-plan.md:493`.

### Generation safety is coupled to the default rules

`passable()` recognises only `avoid: 'jump'` or `'slide'`; lane arrays and bounds assume three lanes. An obstacle marked “jump” can satisfy the full-row check even if its dimensions make it impossible to jump with the selected physics.

Changing gravity, character dimensions, lane count or obstacle behaviour must therefore be checked against generation assumptions—not independently accepted because each descriptor looks valid. The existing fairness test is a useful baseline, **not a guarantee for arbitrary contributed content**. See `2026-10-02-milkshake-runner-plan.md:659`.

### Presentation and progression are unnecessarily coupled

`startLevel()` interprets ending type itself:

- Every transition unlocks its destination.
- Every cutscene unlocks the specific built-in `endless`.
- Only a transition can continue directly into another level.

Adding a decorative community cutscene would consequently unlock built-in endless mode. A new presentation cannot cleanly define a different continuation. `save.js` also hard-codes `LOCKED`, and menu routing assumes specific IDs. See `2026-10-02-milkshake-runner-plan.md:1541` and `2026-10-02-milkshake-runner-plan.md:1626`.

### Failure and resource ownership are not extension-ready

Any validation error makes `main()` return the global error screen, disabling valid shipped levels alongside the bad community level. A thrown view factory or ending also lacks a session-level recovery path.

Cleanup assumes existing resource usage: `world.dispose()` disposes geometry, while endings perform their own partial cleanup. New modules need explicit ownership of objects, materials, textures, listeners and timers; otherwise removing one instance can leak resources or invalidate resources shared by another.

These are reasons to define lifecycle contracts—not reasons to introduce a heavyweight sandbox. See `2026-10-02-milkshake-runner-plan.md:1252` and `2026-10-02-milkshake-runner-plan.md:1589`.

## 5. Recommended plan changes, prioritised

Estimates are rough **incremental engineering hours**, with some overlap. “Before first build” means the architectural decision must be incorporated before implementation starts; its code lands in the affected tasks.

1. **Revise the spec’s community contract and acceptance criteria.**  
   Explicitly allow JSON levels referencing installed, reviewed content modules. Remove the “new content requires engine PRs” restriction and reconcile the out-of-scope list. Define the lane-runner envelope and what stays out of scope. Success should include an unfamiliar contributor adding content without touching shared implementation, while levels 1–2 retain their behaviour.  
   **Tasks:** Global constraints, 0, 2, 9, 10. **Cost:** 1–2 h. **Timing:** Before first build.

2. **Replace fixed lists and duplicate implementation maps with a small content registry.**  
   Use ordinary ES-module exports and directory discovery: Vite glob loading in the browser, filesystem discovery in Node, both feeding the same pure registry builder. Built-ins use the same registration path as contributions. Require namespaced community IDs; reject duplicates rather than overriding built-ins. Validate both metadata and required implementation hooks. Preserve existing level IDs through default resolution/aliases.

   A conventional obstacle should be this small:

   ```js
   // content/obstacles/ari/boulder.js
   export default {
     id: 'ari/boulder',
     meta: {
       avoid: 'lane',
       box: { w: 2, h: 1.5, d: 2 },
     },
     createView({ gfx, params }) {
       return {
         object: gfx.box(2, 1.5, 2, params.color ?? '#777777'),
       };
     },
   };
   ```

   Factories receive rendering helpers when invoked; module import and metadata remain Node-safe. Plugin-specific parameters get plugin-specific validation. No central catalog edit is needed.  
   **Tasks:** 2–7, 9. **Cost:** 4–6 h. **Timing:** Before first build.

3. **Make obstacles and pickups dispatch through registrations, with a lifecycle contract.**  
   Replace `MAKERS`, `jugMesh()` special cases and named content branches with registered factories/handlers. Keep the existing AABB and movement helpers as reusable defaults. Use a generic active-effect collection rather than extending `magnetT`, `x2T`, etc. for every addition. HUD effect labels/timers come from effect metadata. Define view `update()`/`dispose()` ownership and narrowly scoped effect hooks for collection, ticking and gameplay influence.  
   **Tasks:** 3–5; tests in 2/4. **Cost:** 4–7 h. **Timing:** Before first build; implement alongside the first built-ins.

4. **Resolve rules once per session, with validated parameters and optional overrides.**  
   Move gravity, jump/slide timing, speed curves, lane geometry, hitboxes and scoring defaults into a per-session configuration. Let an optional rule module override the existing functional surface—`createRun()`, `act()`, `step()`, `speedAt()`, collision/hit/collection handling and outcome determination—using a default-rule factory so authors need not implement everything.

   `playLevel()` should consume that resolved rule set, not import one immutable set of gameplay decisions. Generation, road width, lane positioning and camera defaults must consume the same resolved geometry. Add compatibility checks for generated obstacles under the selected physics.

   **Tasks:** 1, 3–6, 9. **Cost:** 5–8 h. **Timing:** Before first build. **Lean limit:** No general physics engine or arbitrary-genre framework.

5. **Extend level JSON with optional seed, sections and placements; retain today’s shorthand.**  
   Keep current weighted generation as the default. Add ordered section overrides and explicit placements, with clear rules for boundaries and procedural/hand-authored mixing. Normalise old files into the same internal representation, so levels 1–2 need not change.

   Illustrative additions to an otherwise complete level:

   ```json
   {
     "seed": 42,
     "character": { "id": "ari/robot" },
     "rules": {
       "id": "builtin/runner",
       "params": { "gravity": -24 }
     },
     "hud": { "id": "ari/minimal" },
     "sections": [{
       "from_m": 0,
       "to_m": 200,
       "theme": { "id": "ari/forest" },
       "generation": false,
       "placements": [{
         "at_m": 60,
         "lane": 0,
         "kind": "obstacle",
         "id": "ari/boulder"
       }]
     }]
   }
   ```

   Preserve typo detection, but validate recognised extension fields and their parameters. Permit empty/zero-density sections. Separate editorial length preferences from genuine safety limits. Since level files are already discovered, consider retaining the index for shipped ordering and automatically listing other valid community levels; this removes the shared append conflict.

   **Tasks:** 2, 3, 5, 9. **Cost:** 4–7 h. **Timing:** Schema decision before first build; section execution can follow the initial playable prototype, but must precede claiming modular level design.

6. **Turn character, scenery and UI implementations into selectable factories.**  
   Parameterise model URL, yaw, scale and animation defaults; create/reuse the selected character at session boundaries rather than one global `createMilkshake()` instance. Extract `scenery()` into the default theme implementation. Put existing HUD/menu behaviour behind small view-model/action interfaces; styling and copy should be data, with replacement factories available for different layouts. Camera/lighting defaults can be theme parameters.

   Reuse the existing `update()`, `pose()` and HUD methods where practical—do not rewrite working presentation simply to rename it.  
   **Tasks:** 0, 1, 5, 6, 8, 9. **Cost:** 4–6 h. **Timing:** Selection/lifecycle contracts before first build; factory extraction can follow the prototype, before community launch.

7. **Separate registered ending presentation from campaign flow.**  
   Keep `transition()`, `arenaFive()` and finish as built-in runners. Let them accept validated parameters and resolve a uniform flow result, for example:

   ```js
   playEnding(ending, context)
     // → Promise<{ nextLevel?: string, carryScore?: boolean }>
   ```

   Put start/endless IDs, locks and completion unlocks in a small campaign descriptor. `startLevel()` should apply those outcomes without checking whether the presentation happened to be a cutscene. Retain the existing save storage helpers.  
   **Tasks:** 2, 6, 7, 9. **Cost:** 2–4 h. **Timing:** Can be refactored after the prototype, but before contributor-facing endings ship.

8. **Replace the level-only demo with an extension acceptance pass, documentation and failure containment.**  
   Add fixtures proving a new obstacle, effect, character/theme, HUD, ending and rule override can be installed without core edits. Test duplicate IDs, missing hooks, parameter errors, section boundaries and compatibility with defaults. Document one-file examples, supported hooks, resource ownership and a precise “files you may edit” boundary.

   Keep CI failing for invalid contributions, but let the browser disable/report an invalid community level without disabling valid shipped levels. Session failures should clean up and return to a usable screen. Level JSON remains data only; installed JavaScript plugins are reviewed code, **not safely sandboxed arbitrary uploads**.

   **Tasks:** 2–7, 9, 10. **Cost:** 4–6 h. **Timing:** Contract tests start with registration; full demo/recovery can follow the prototype, before launch.

**Over-engineering to avoid:** an ECS rewrite, an event bus for every operation, a plugin package manager, dependency-resolution framework, arbitrary remote JavaScript loading, a visual editor or a general cutscene language. Ordinary registries, a few factories, parameter objects and existing pure functions are sufficient. The expanded bar does add work beyond the original one-session scope; hiding that cost would not make the plan leaner.

## 6. What to keep as is

- **Plain JavaScript ES modules, Three.js and Vite.** None of the required extension boundaries needs another package or UI framework.
- **Pure logic beneath rendering.** Keep `validate`, `generator`, `rules`, input classification and storage logic testable without Three.js or the DOM.
- **One validation implementation shared by browser and CI.** Extend it to registered content; do not create a second, permissive community validator.
- **Data-only level files and `textContent` for contributor strings.** Preserve this distinction even when reviewed JavaScript content modules become available.
- **Seeded generation and separate gameplay/scenery RNGs.** `createWorld()` already prevents scenery randomness from shifting obstacle generation; expose the seed rather than replacing the generator. See `2026-10-02-milkshake-runner-plan.md:1213`.
- **World streaming, clear start/end regions and existing fairness tests.** Extend their assumptions for selected content/rules rather than removing them.
- **Useful existing presentation seams.** `createWorld()`, character `update()`/`pose()`, the HUD interface and `playEnding()` are good starting points for factories.
- **Default character fallback, mobile input handling, pause/time-step protections and tolerant save storage.** These remain engine/default-behaviour responsibilities.
- **The shipped level chain and generic arena treatment.** Modularity should make alternatives opt-in, not destabilise the approved experience.
- **A real contributor-flow demonstration.** Keep it, but demonstrate new content and authored sections—not only another combination of the original seven obstacles.

**Review evidence:** I read both documents and executed the inline catalog/validator in memory against the three planned shipped JSON files and extension edge cases. The shipped files validate; the restrictions and catalog/renderer mismatch above are confirmed. No repository files were changed, and this review does not claim that the unbuilt browser game or its full test suite passes.
