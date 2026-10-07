# Milkshake Runner: design spec v2 (modular)

**Date:** 2026-10-07 · **Status:** awaiting Caedon's review · **Supersedes:** [v1, 2026-10-02](2026-10-02-milkshake-runner-design.md) · **Builder:** Fable, inline

> Why a v2: on 2026-10-07 Caedon asked that the game be "fully modular and essentially able to be
> structured, vibe-coded on top of, for more customization of all the different aspects of the game,
> as well as modular level design." A Codex review ([2026-10-07](2026-10-07-codex-modularity-review.md))
> found v1 modular only at the level-parameter layer. This spec keeps everything v1 decided about the
> game itself and changes how it is built so that every aspect is a replaceable module. Ezra's own
> modularity asks from the same day were not recorded; they fold in when we have them.

## Goal

A browser-playable 3D lane runner in the style of Subway Surfers. Milkshake runs through Manhattan.
It ships as a **community launch**: levels 1 and 2 are built in-house, and the community extends it
in two ways:

1. **Levels** are JSON files: pick content by id, set parameters, and compose sections and exact placements.
2. **Content** (obstacles, pickups, themes, characters, endings) are one-file JavaScript modules under `content/`, merged through pull-request review. The seven shipped obstacles, four pickups, three themes, Milkshake and the three endings are themselves content modules, registered the same way.

**Success means:**
- A public URL plays on desktop and on phones (portrait first).
- Level 1 hands off to level 2 with no menu in between; level 2 ends at the generic arena cutscene.
- Someone outside the team can add a level, a new obstacle, a new pickup, a theme, a character or an ending **without editing any file under `src/`**, and the shipped levels play exactly as before.
- A broken community file fails CI and, if it ever reaches the site, disables only itself.

## Decisions

Unchanged from v1 (made 2026-10-02): community launch · generic Knicks/MSG stand-ins · plain Three.js + Vite · public repo `mrchopme/milkshake-runner` on GitHub Pages · toon primitives plus one Milkshake model · Paper style sheet first · jugs plus magnet, shield and 2x · finite levels plus endless · Fable builds · no sound.

New on 2026-10-07:

| Topic | Decision |
|---|---|
| Scope | Full modularity before the first build, in lean form (registry, modules, parameters, sections). No ECS, no event bus, no plugin manager, no visual editor. |
| Community contributions | Reviewed JavaScript modules under `content/` plus JSON levels. No remote or unreviewed code ever runs. |
| Rules and physics | Per-level **parameters** with validated ranges. Code-level rule changes stay engine PRs. |
| HUD | Skinnable by data (colours, labels, icons come from content). Layout stays engine code. |
| Process | Spec and plan revised; Caedon re-reviews both; then the Paper gate and Task 1. |

## Architecture

Two halves with one boundary:

- **Engine (`src/`)** owns scheduling, rendering infrastructure, the camera, input transport, world streaming, collision maths, saving, the screen flow, validation and the registry. It knows nothing about taxis or magnets.
- **Content (`content/`)** owns what things look like and how they behave, through small declared hooks. Built-ins and community modules use the same path.
- **Levels (`levels/*.json`)** are data only: they select content by id and set parameters.

```
src/
  engine.js      renderer, camera, lights, resize, setSky, follow
  gfx.js         toon primitive helpers handed to content modules (box, cyl, sphere, capsule, cone, group, blobShadow, textSprite, mat, PALETTE)
  registry.js    buildRegistry(modules) (pure) + loadRegistry() via import.meta.glob('../content/**/*.js')
  validate.js    validateLevel(level, {fileId, registry}) and validateAll(levels, index, registry): one implementation for browser and CI
  rules.js       DEFAULT_RULES, RULE_RANGES, resolveRules(); run physics, collision, generic effects
  generator.js   normalizeLevel() -> sections; generate() with seed, sections, placements, fairness per rules
  world.js       streams chunks; asks content modules for views; shared lane geometry
  game.js        playLevel({...}) -> { outcome, run, world }
  endings.js     playEnding(ending, ctx) -> flow result { next?, carry? }
  campaign.js    start level, locks, unlocks (levels/campaign.json)
  hud.js, levels.js, save.js, input.js, character.js, main.js
content/
  obstacles/   taxi.js barrier_low.js scaffold_beam.js hot_dog_cart.js manhole_steam.js pigeons.js delivery_bike.js
  pickups/     jug.js magnet.js shield.js x2.js
  themes/      downtown.js midtown.js uptown.js
  characters/  milkshake.js
  endings/     finish.js transition.js arena_five.js
levels/        index.json (shipped order) · campaign.json · 01-broadway.json · 02-garden.json · endless.json
test/          registry, validate, logic, fixtures (a complete community pack that must install with zero src/ edits)
```

### Content module contract

Every module is one file with a default export. The registry rejects a module whose metadata fails its kind's checks, and rejects duplicate ids rather than letting one override another. Built-in ids are plain (`taxi`); community ids are namespaced (`ari/boulder`). Metadata must be importable in Node (no DOM at import time); rendering happens only inside `createView`/`run`, which receive `gfx`.

```js
// content/obstacles/taxi.js
export default {
  kind: 'obstacle', id: 'taxi',
  avoid: 'lane',                         // lane | jump | slide | timing
  box: { w: 2.0, h: 1.5, d: 4.0 },       // collision box in metres; optional y = box bottom
  moves: false,                          // true: swerves one lane when the player is near
  // cycle: { period: 1.5, on: 0.5 }     // timing obstacles only
  createView(gfx) { return { object: gfx.group(/* toon boxes */) }; } // optional update(o, run, dt), dispose()
};

// content/pickups/magnet.js
export default {
  kind: 'pickup', id: 'magnet', color: '#ff4fa3',
  duration: 8,                           // seconds | 'untilHit' | omitted = instant
  effect: { reach: 15 },                 // engine capabilities: reach | multiplier | shield
  glyph: 'M9.2,8 V14.6 a4.8,4.8 0 0 0 9.6,0 V8',   // 28x28 path, drawn white on HUD chips and the orb
  // value: 1                            // instant pickups add jugs (the plain jug is { value: 1 })
  // createView(gfx)                     // optional; the default is the glowing orb with the glyph
};

// content/themes/downtown.js
export default {
  kind: 'theme', id: 'downtown', sky: '#9fd3f5', fog: 0.3,
  buildings: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'], minH: 18, maxH: 70 },
  // createChunk(gfx, { z0, length, lanes, rng })  // optional: replaces the default street scenery
};

// content/characters/milkshake.js
export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: 0,
  async createView(gfx) { /* returns { object, update(run), pose(time, state), dispose() } */ },
};

// content/endings/transition.js
export default {
  kind: 'ending', id: 'transition',
  params: { next: { type: 'level' } },   // param types: string (max), number (min, max), level (must exist)
  async run(ctx) { /* ... */ return { next: ctx.params.next, carry: true }; },
};
```

The engine implements exactly three effect capabilities: `reach` (pull pickups from any lane within N metres), `multiplier` (jug value), `shield` (absorb one hit; requires `duration: 'untilHit'`). New pickups combine them; a capability the engine does not have is an engine PR.

### Level schema v2

Everything from v1 still validates. New, all optional: `seed`, `character`, `rules`, `sections`, `placements`, and `ending.params`. Unknown keys are rejected at every nesting level, so a typo can never pass as a "working" customisation.

```json
{
  "id": "02-garden", "title": "Road to the Garden", "author": "PulsePoint",
  "length_m": 1800, "seed": 42,
  "character": { "id": "milkshake" },
  "theme": { "id": "midtown", "sky": "#f4b26a", "fog": 0.4 },
  "rules": { "gravity": -30, "speed": { "start": 12, "end": 20 } },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1, "manhole_steam": 1, "pigeons": 1, "delivery_bike": 1 },
  "density": { "start": 0.3, "end": 0.7 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] },
  "sections": [
    { "from_m": 0, "to_m": 150, "density": { "start": 0, "end": 0 } },
    { "from_m": 150, "to_m": 300, "obstacles": { "barrier_low": 1 }, "generation": false,
      "placements": [
        { "at_m": 180, "lane": 1, "kind": "obstacle", "id": "barrier_low" },
        { "at_m": 210, "lane": 0, "kind": "pickup", "id": "shield" }
      ] }
  ],
  "ending": { "id": "arena_five", "params": { "text": "Season tip-off. Brought to you by Milkshake." } }
}
```

Rules:
- `id` is `a-z0-9-`, equals the file name, unique across `levels/`.
- `length_m` is an integer 100 to 10000, or `null` for endless. Editorial guidance (300 to 5000 for a comfortable level) lives in CONTRIBUTING, not the validator.
- `seed` is an integer; omitted means a fresh random run each time.
- `character.id`, `theme.id`, every obstacle id, every `jugs.powerups` entry, every placement id and `ending.id` must exist in the registry for its kind.
- `rules` keys and ranges come from `RULE_RANGES` (lane width 1.5 to 4, gravity -60 to -10, jump speed 5 to 15, speeds 4 to 40 and so on). Lane count stays 3 in v1.
- `density` values are 0 to 1 (0 is allowed: a scenic section). `obstacles` may be empty only when every generated section has density 0.
- `sections` are ordered, non-overlapping ranges inside the level; each may override `obstacles`, `density`, `jugs` and `theme` for its range, turn `generation` off, and list `placements`. A placement's `at_m` must sit inside its section; placement rows are checked by the same fairness rule as generated rows.
- `ending.params` are validated against the ending module's `params` schema. An endless level cannot have an ending.
- Unknown keys anywhere are errors.

### Discovery, campaign, containment

- `levels/index.json` is the **shipped** order. Every other valid `levels/*.json` is listed after it, by title, so a community level never edits a shared file.
- `levels/campaign.json` holds progression: `{ "start": "01-broadway", "locked": { "02-garden": "01-broadway", "endless": "02-garden" } }` (a level is locked until the named level has been completed). Community levels are unlocked by default. Endings no longer decide unlocks; they return a flow result `{ next?, carry? }` and `main` applies the campaign.
- The browser validates everything on load with the same `validateAll` CI runs. An invalid community level is shown disabled with its first error; shipped levels keep working. If the campaign start level itself is invalid, the error screen shows. A module that throws during a run ends that run with a "this level broke" result instead of a frozen screen.

### Gameplay, endings, art

Unchanged from v1, with these clarifications:
- Physics numbers (lane width 2.5 m, lane change 150 ms, speed 12 → 20 m/s, endless cap 28 m/s, magnet 8 s, shield until hit, 2x 10 s) are the **defaults** in `DEFAULT_RULES` and the pickup modules; a level may vary them within range.
- The Paper style sheet (Task 0, 2026-10-05, approval pending) remains the art direction. It already assumes blob shadows, the bottle-shaped jug, glyphs on power-up orbs and HUD chips, plain-block buildings, and the Garden ending as drawn.
- The arena cutscene is a content module (`arena_five`); the street ends at `length_m` and opens onto the plaza so buildings never run through the arena.

### Testing

`node --test` over four files:
- `test/registry.test.js`: every `content/` module loads in Node and passes its kind's checks; duplicate ids, missing hooks and malformed metadata are rejected; community ids must be namespaced.
- `test/validate.test.js`: shipped levels pass; each rule above has a failing case; nested unknown keys fail; registry-missing ids fail; placements that block a row fail.
- `test/logic.test.js`: seeded generation is reproducible; sections and placements land where asked; fairness holds for the shipped content under default rules and for a low-gravity variant; rule parameters flow into physics; generic effects (reach, multiplier, shield) behave; saving survives blocked storage.
- `test/fixtures.test.js`: a complete community pack in `test/fixtures/` (an obstacle, a pickup, a theme with its own scenery, a character, an ending, and a level using seed, sections and placements) builds a registry and validates **without any change under `src/`**. This is the acceptance test for the whole v2.

Manual pass as in v1, plus: load the fixtures pack in the dev build and play its level; break one community level and confirm only it is disabled.

## Build order

0. Paper style sheet (done 2026-10-05; approval pending).
1. Repo, Vite, engine, Pages deploy, folder skeleton.
2. Registry and module contracts, with the built-in modules' metadata and tests.
3. Level schema v2, validator, shipped levels, campaign file, CI test step.
4. Rules as parameters; run physics and generic effects; tests.
5. Generator v2: seed, sections, placements, fairness per rules; tests.
6. `gfx` helpers, content views (seven obstacles, pickups, default scenery, Milkshake), world streaming, game loop, HUD: level 1 playable.
7. Screens, saved progress, campaign unlocks, level discovery, failure containment.
8. Endings as modules with flow results; level 1 → 2 → arena.
9. Milkshake model and Paper palette.
10. Fixtures pack, acceptance tests, CONTRIBUTING v2, README.
11. Manual pass, PR, community PR demo.

Rough size: v1 was about 25 to 35 hours of build; v2 adds about 20 to 25.

## Out of scope for v1

Sound · leaderboards and accounts · an in-game level editor · rule modules (code-level physics changes) · HUD layout factories · more than 3 lanes · remote or unreviewed code · real NBA or Knicks names, faces or logos.
