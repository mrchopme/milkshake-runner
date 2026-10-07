# Milkshake Runner: design spec

> **Superseded on 2026-10-07** by [design spec v2](2026-10-07-milkshake-runner-design-v2.md), which makes every aspect of the game a module. Kept as a dated snapshot.

**Date:** 2026-10-02 · **Status:** awaiting Caedon's review · **Builder:** Fable, in one planned session

> Agreed in a discussion-first session with Caedon on 2026-10-02. It is based on Ezra's ask on the
> 2026-10-02 call (quotes in the Milkshake teaser README in shade-os). This spec moves into the new
> `milkshake-runner` repo when that repo is created (build step 1).

## Goal

A browser-playable 3D lane runner, in the style of Subway Surfers. PulsePoint's mascot Milkshake runs through Manhattan.
It ships as a **community launch**: levels 1 and 2 are built in-house, and every later level is a
JSON file that someone from the community submits as a pull request.

**Success means:**
- A public URL plays on desktop and on phones (portrait first).
- Level 1 hands off to level 2 with no menu in between, and level 2 ends at a generic arena cutscene.
- Someone outside the team can add a level by writing one JSON file and opening a PR. CI rejects a broken level before it merges.

## Decisions (made by Caedon, 2026-10-02)

| Topic | Decision |
|---|---|
| Audience | Community launch (public) |
| Knicks / MSG | **Generic stand-ins**: an unnamed arena called "The Garden", 5 made-up players in orange and blue, no real names, faces, or logos |
| Build style | A planned build in one session (spec, then plan, then build) |
| Rendering | 3D, plain Three.js and Vite, no UI framework |
| Repo / hosting | New public repo `mrchopme/milkshake-runner`, hosted on GitHub Pages |
| Art | Toon primitives built in code, plus one Milkshake model. Style sheet previewed in Paper **before** any code |
| Milk jugs | Coins, plus power-ups: magnet, shield, 2x |
| Level shape | Finite levels with endings, plus an endless mode |
| Model | Fable |
| Sound | Out for v1 |

## Architecture

```
index.html            screens: menu → level select → play → results
src/engine.js         game loop, camera, 3 lanes, input (keys + swipe), collision (AABB)
src/world.js          streams track chunks from level data; toon primitives
src/milkshake.js      loads assets/milkshake.glb; falls back to a cow built from shapes
src/levels.js         fetches levels/index.json + level files; validateLevel()
src/endings.js        scripted finishes: transition, cutscene, finish
src/hud.js            DOM overlay: jug count, progress bar, power-up timers, pause
levels/index.json     ordered list of level ids (static hosting can't list a directory)
levels/01-broadway.json
levels/02-garden.json
levels/endless.json
test/validate.test.js one test file: the shipped levels pass, and the broken examples fail
.github/workflows/    on PR: validate levels + run tests · on main: build and deploy to Pages
CONTRIBUTING.md       "add a level in one JSON file"
```

`validateLevel()` is the one place that decides whether a level is valid. The browser calls it on load and shows a readable error screen if a level fails. CI runs the same function under Node.

## Level schema (the community contract)

```json
{
  "id": "02-garden",
  "title": "Road to the Garden",
  "author": "PulsePoint",
  "length_m": 1800,
  "theme": { "sky": "#f4b26a", "buildings": "midtown", "fog": 0.4 },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1,
                 "manhole_steam": 1, "pigeons": 1, "delivery_bike": 1 },
  "density": { "start": 0.3, "end": 0.7 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] },
  "ending": { "type": "cutscene", "scene": "arena_five" }
}
```

**Validation rules:**
- `id` matches `^[a-z0-9-]+$` and is the file name. It must be unique and listed in `levels/index.json`.
- `title` and `author` are strings of 1 to 60 characters.
- `length_m` is an integer from 300 to 5000, or `null`. `null` means endless, and is only allowed when there is no `ending`.
- `theme.sky` is a hex colour. `theme.buildings` is one of `downtown | midtown | uptown`. `theme.fog` is from 0 to 1.
- `obstacles` keys must be known obstacle ids. Values are weights greater than 0, and the engine normalises them. At least one key is required.
- `density.start` and `density.end` are from 0.1 to 1. They are the chance that a chunk row has an obstacle, interpolated across the level.
- `jugs.per_100m` is from 0 to 30. `jugs.powerups` is a subset of `magnet | shield | x2`.
- `ending.type` is one of three:
  - `finish`: the default finish line. No other fields.
  - `transition`: needs `next`, which must be an existing level id.
  - `cutscene`: needs `scene`, which must be from the engine's fixed list (v1: `arena_five`).
- Unknown top-level keys are rejected, so typos don't pass silently.

Contributors can only pick from fixed sets of obstacles, themes, and endings. Level files hold no code, so any merged level is safe to run. New obstacles, themes, or cutscenes come in as engine PRs.

## Gameplay

- **Lanes:** 3 lanes, 2.5 m apart. Lane changes take about 150 ms.
- **Controls:**
  - Change lane: ← → / A D / swipe left or right
  - Jump: ↑ / W / Space / swipe up
  - Slide: ↓ / S / swipe down
  - Pause: Esc or the on-screen button
- **Speed:** 12 m/s at the start, rising to 20 m/s by the end of a finite level. Endless mode keeps rising and caps at 28 m/s.
- **Obstacles** (all original):

| id | Avoid by | Notes |
|---|---|---|
| `taxi` | lane change | parked, blocks one lane |
| `barrier_low` | jump | police sawhorse |
| `scaffold_beam` | slide | construction scaffold overhead |
| `hot_dog_cart` | lane change or jump | low cart |
| `manhole_steam` | timing | bursts on a 1.5 s cycle, safe between bursts |
| `pigeons` | slide | flock at head height |
| `delivery_bike` | lane change | moves into the next lane as you approach it |

  The generator never fills all 3 lanes in one row unless one of them can be jumped or slid.
- **Milk jugs:** each jug is +1, and the jug count is the score. About 1 jug in 40 is a special jug, picked from the level's `powerups`:
  - **Magnet:** 8 s, pulls in jugs from every lane.
  - **Shield:** lasts until a hit; the hit breaks it. Shown as a glow bubble.
  - **2x:** 10 s, double jugs.
- **Hit with no shield:** a stumble animation, then the run ends and the results screen shows.
- **Saved progress** (localStorage, wrapped in try/catch): best score per level, level 2 unlocked, endless unlocked. No accounts and no leaderboard.

## Endings

- **`transition`** (level 1 → 2): Milkshake slows down and the camera swings out. Milkshake turns left onto Broadway, matching the teaser. A glow ring flashes (Ezra's scene-change motif), and the next level loads in place, keeping the jug count.
- **`cutscene: arena_five`** (end of level 2): the street opens into a generic arena plaza with "THE GARDEN" in plain type. Five stand-in players with made-up numbers stand in a line. The camera circles once and confetti fires. The card reads **"Season tip-off. Brought to you by Milkshake."** Then the results screen shows, and endless mode unlocks.
- **`finish`**: a finish banner, then results. This is the default for community levels.

## Art pipeline

1. **Paper style sheet first** (gate: Caedon approves it before any build). One page with:
   - Milkshake's in-game silhouette and toon colour palette, from the `Milkshake-3D` Element (`eb91a157-…`) and the teaser's game keyframes (`ed480a6e-…`, `854c98cf-…`)
   - The milk jug and 3 power-up icons
   - The 7 obstacles
   - The HUD and menu
   - The arena ending frame
2. **Milkshake model:** run Higgsfield `generate_3d` on a front render of `Milkshake-3D`. Quote the credit cost and get Caedon's OK first (balance was about 125 on 2026-10-01).
   - The mesh will probably be static, so the run cycle is procedural: bob, lean, and arm swing on child groups if the mesh splits; otherwise bob and lean only.
   - **Fallback:** a cow built from shapes. White capsule body, pale grey spots, lavender muzzle, ears, horns, and hands, and black dot eyes. The code supports either one.
3. Everything else is built in code from the Paper palette. **No other credit spend in v1.**

## Testing

- `test/validate.test.js`, run with `node --test`. Every shipped level passes. A small set of broken levels must fail with the expected error: unknown obstacle, missing `next`, null length with an ending, an unknown key, and an id that doesn't match the file name.
- **Manual pass** in the in-app browser at desktop size and at phone portrait (375×812):
  - Play level 1 → transition → level 2 → cutscene.
  - Play endless mode.
  - Pick up each power-up.
  - Load a deliberately broken level and see the error screen.

## Build order

1. Create the repo (asking Caedon before creating it as public), set up Vite, the Pages deploy workflow, and an empty scene live on a URL. Move this spec into the repo.
2. Engine: lanes, input, collision, a placeholder cow.
3. `levels.js`, `validateLevel()`, the test file, and the CI check.
4. World streaming, obstacles, jugs, power-ups, the HUD.
5. Level 1, `transition`, level 2, `arena_five`, endless mode, and saved progress.
6. The Milkshake model and the Paper-approved palette.
7. CONTRIBUTING.md, plus one example community level opened as a real PR to prove the flow.
8. Manual pass, then hand Caedon the URL.

The Paper style sheet (art step 1) comes before step 1.

## Out of scope for v1

Sound and music · leaderboards and accounts · an in-game level editor · community-made cutscenes or obstacles · jetpack / super jump · real NBA or Knicks names, faces, or logos (stand-ins can be swapped if PulsePoint gets rights later).
