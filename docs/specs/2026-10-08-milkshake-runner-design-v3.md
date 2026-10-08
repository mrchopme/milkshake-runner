---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner: design spec v3 (playtest response)

**Date:** 2026-10-08 · **Status:** awaiting Caedon's review · **Builds on:** [spec v2](2026-10-07-milkshake-runner-design-v2.md), [plan v2](2026-10-07-milkshake-runner-plan-v2.md), [playtest feedback](2026-10-08-playtest-feedback.md) · **Builder:** Fable, inline

> Point-in-time snapshot. Written on 2026-10-08 against the v1 build (`feat/v1` at 8a8d41e, PR #1 open) and
> Caedon's first playtest. The decisions table records what Caedon chose in chat that day; everything else is
> Fable's design and may have moved on since. Read the current `src/` before treating a detail here as how
> the game works today.

## Goal

Answer the five playtest items without breaking the v2 contract: nothing under `content/`, `levels/` or
`test/fixtures/` may need an edit under `src/`, and `test/fixtures.test.js` stays the acceptance test. Every
new capability is an engine feature that level data or a content module selects.

**Success means**
- Milkshake visibly runs, and runs harder as the street speeds up (FB-1, FB-2).
- A level has turns, dips and hills, props that hide the road ahead, and camera changes, all authored per section in JSON (FB-3).
- A collected power-up says what it does; the magnet pulls jugs in instead of deleting them (FB-4).
- The building band no longer flickers (FB-5).
- Levels 1 and 2 use the new features, endless cycles them at random, and the fixtures pack exercises them with no `src/` edit.

## Decisions (Caedon, 2026-10-08, in chat)

| Item | Decision |
|---|---|
| FB-3 scope | Shader world-bend per section (turn, dip, hill), a `prop` content kind (overpass, tunnel, billboard, bridge railings) and per-section camera overrides. Gameplay stays on the straight street. Real path geometry is out. |
| FB-1 | Procedural running now (stride, bob, lean, foot dust, speed lines), zero credits. A rigged, animated GLB is a separate gated step (Higgsfield's Meshy rigging with a run clip); if it looks right, the character module plays the clip. |
| FB-2 | Steeper continuous ramp, speed carried through the Broadway turn into level 2, endless climbs faster to a higher cap, motion cues scale with speed, and a reaction-time floor keeps rows fair. |
| FB-4 | Magnet pull fix regardless. A toast on collect from module metadata (`name`, `blurb`) plus a HOW TO PLAY screen built from the registry. |
| FB-5 | Fix now: clamp buildings to their chunk, with a unit test and before/after screenshots. |
| Shipped levels | Set pieces in both level 1 and level 2. |
| Ezra's asks | Already baked into v2. Not raised again. |

## What v1 does today (verified 2026-10-08)

- The GLB is one mesh, no skeleton, no clips; the module bobs it 8 cm and leans it (`content/characters/milkshake.js`).
- Speed ramps 12 → 20 m/s linearly across a level and resets to 12 on every level (`speedAt` in `src/rules.js`). Nothing on screen follows it.
- The street is a straight +z line with a fixed chase camera (`follow()` in `src/engine.js`). Theme chunks and endings position things in world coordinates, so a real path would change their contracts.
- With a magnet, `inReach` is true for any pickup up to 15 m ahead and `game.js` collects it in the same tick `world.js` starts pulling it. The pull never shows.
- `defaultChunk()` lets the last building of a chunk run past the chunk end. Over 50 seeds, 95% of seams overlap the next chunk's first building (mean 5.4 m, 70% in a different colour). The overlapping coplanar faces z-fight as the camera moves: the brown flicker.

## Engine capabilities

All live in `src/` and are selected by data. The engine still names no content id (`test/fixtures.test.js` keeps checking).

### 1. World bend (FB-3: turns, dips, hills)

The world bends in the vertex shader; nothing moves on the CPU. For a vertex at world z, with `d = z − run.z − DEAD` (DEAD = 20 m, nothing bends inside the reaction distance, so lanes stay legible) and `d` clamped at 0:

```
x += −turn · TURN_K · d²      // positive turn bends the road to screen-right (−x)
y +=  hill · HILL_K · d²      // negative hill is a dip: the road drops out of sight over a crest
```

`TURN_K` and `HILL_K` are engine calibration knobs (start 0.005 and 0.003 per m²). `turn` and `hill` are −1..1 and come from the active section's `curve`. The engine eases the live values toward the section's target over about 40 m of travel, so a turn arrives, is run through and straightens out. In a finite level the bend fades to 0 over the last 120 m, so every ending runs on a straight street as before.

How it reaches every material: `gfx.mat()`, `blobShadow`, `glow` and `sprite` patch their materials at creation (`onBeforeCompile` replaces `project_vertex`, sprites patch their centre). `gfx.bend(object)` patches any material a module made itself (the character's toon swap, anything a `createView` or `createChunk` built from `gfx.three`); `world.js` and `main.js` call it on everything they add. One shared uniform drives all of them. `gfx.box` subdivides along z (one segment per 4 m) so long roads and sidewalks curve instead of staying straight between their end vertices. Content that builds raw geometry longer than about 6 m along z should subdivide it; CONTRIBUTING says so.

Normals, lighting, fog and collision are untouched: collision stays in the straight logical space, fog depth uses the bent view position, toon shading uses the unbent normals.

### 2. Camera overrides (FB-3)

`follow(run)` keeps its shape (behind, above, looking down the lane) but reads three values from the active section's `camera`: `height` (1.5–8, default 3.6), `distance` (3–12, default 6.5) and `fov` (45–100, default 60; portrait still adds 15). Values ease toward the section's target over about half a second. FOV also widens with speed (see 3). When a level ends the camera returns to the defaults before the ending runs.

### 3. Speed that is felt (FB-2)

- `step()` stores `run.speed`, so content can read it. Defaults change: `speed.start` 12, `end` 24, `cap` 30, `ramp` 0.006 (endless reaches 30 m/s at 3000 m). Endless itself sets `cap` 34 and `ramp` 0.008.
- **Carry:** a flow result `{ next, carry: true }` now carries speed as well as jugs. `speedAt(level, z, rules, from)` ramps a finite level from `from` to `min(cap, from + (end − start))`, so level 2 starts at the speed level 1 finished with and keeps climbing. Without carry, `from` is `speed.start`.
- **Reaction floor:** a new rule `reaction` (seconds, 0.2–1.5, default 0.6). The generator skips a row when it is closer than `speedAt(z) · reaction` metres to the previous generated row. Placements are the author's call and are never skipped; instead the validator rejects two placed obstacle rows closer than the floor at that point of the level (the author lowers `rules.reaction` or spreads them out).
- **Cues:** FOV widens with speed (`+0.6°` per m/s over 12, so +7° at 24 m/s); the engine draws speed streaks parented to the camera, fading in above 16 m/s; the character module scales its stride with `run.speed` (see 5).

### 4. Magnet pull, toast, HOW TO PLAY (FB-4)

- **Pull:** a pickup within `reach` metres ahead, any lane, is *pulled*, not collected: `world.js` moves its logical `x` and `z` toward the player (lateral 12 m/s, longitudinal twice the run speed) and the view follows. `inReach(run, p)` collects only within 0.8 m along z and 1 m across, using `p.x` when the pull has set it. The jug visibly flies in over a few frames.
- **Pickup metadata:** two optional fields on a pickup module, `name` (1–24 characters) and `blurb` (1–80 characters). The registry checks them. Defaults: `name` is the id in capitals, `blurb` is empty.
- **Toast:** collecting a pickup with an `effect` shows a card at the bottom of the screen for 2 s: its icon, name and blurb. A new pickup replaces the card. Jugs do not toast.
- **HOW TO PLAY:** a menu button opens a screen with the controls and every registered pickup that has an effect (icon, name, blurb), in registry order. It opens by itself once per browser before the first run (`save.helpSeen`). Community pickups appear with no further work.

### 5. Running (FB-1)

`content/characters/milkshake.js` reads `run.speed`:
- stride rate `14 · speed / 12` rad/s, bob `0.08 · speed / 12` (capped at 0.14 m), forward lean `0.1 · (speed / 12 − 1)`, a small alternating roll per stride;
- foot dust: a pool of six small translucent puffs spawned at each stride beat while on the ground and not sliding, scaling up and fading over 0.35 s, held in place on the road while the character runs on;
- the shape-built fallback cow keeps its limb swing, now at the same stride rate.

The rigged model is **not** in this build. It is a gated step after the manual pass: Caedon approves the Higgsfield spend (balance 16 on 2026-10-08; the cost preflight was blocked by the agent's permission mode, so the price is unknown) and the download; the module then plays the clip through an `AnimationMixer` with `timeScale = speed / 12` and keeps the dust. If the rig looks wrong the procedural motion stays.

### 6. Props (FB-3: hide what is coming)

A new content kind, `prop`: roadside or over-road scenery with no collision.

```js
// content/props/overpass.js
export default {
  kind: 'prop', id: 'overpass', length: 8,           // metres of street it occupies, 1–100
  createView(gfx, { z, length, lanes }) { return { object: gfx.group(/* deck, pillars */) }; }, // optional update(p, run, dt), dispose()
};
```

The engine places the view at `(0, 0, z)`; the module builds relative to the road centre using `lanes.roadHalf` and `lanes.width`. Props stream and drop with the chunks, go through `safeCall` and the pink fallback like obstacles, and bend with the world.

Shipped props: `overpass` (deck on pillars, 8 m), `tunnel` (walls and a ceiling, 60 m, dark mouth), `billboard` (tall roadside sign, 4 m), `railings` (side railings for elevated stretches, 40 m).

### 7. Chunk seam clamp (FB-5)

`defaultChunk()` clamps the last building's depth to the chunk end and skips a remainder under 3 m. A test asserts nothing a chunk builds sticks out of `[z0, z0 + length]`.

## Level schema v3

Everything in v2 still validates. New, all optional, and unknown keys stay errors:

| Key | Where | Rule |
|---|---|---|
| `curve` | level, section | `{ turn: −1..1, hill: −1..1 }`, both optional, or the string `"random"` (a new target every 240 m from the level seed). A section inherits the level's `curve`; the default is straight. |
| `camera` | level, section | `{ height: 1.5–8, distance: 3–12, fov: 45–100 }`, each optional; sections inherit the level's. |
| `props` | level, section | `{ per_100m: 0–5, ids: { propId: weight } }`; generated on a grid like jugs, never overlapping another prop, never past the level's end. |
| `placements[].kind` | section | now also `"prop"`: `{ at_m, kind: "prop", id }`, no `lane` (an error if given); `at_m + length` must fit inside the level. |
| `rules.reaction` | level | 0.2–1.5 seconds, default 0.6. |

Endless levels use `curve: "random"` and generated `props`; sections still work there for the opening stretch.

## Shipped content changes

- **Pickups:** `magnet` (name MAGNET, blurb "pulls in every jug ahead for 8 s"), `shield` ("takes one hit for you"), `x2` (name 2× JUGS, "every jug counts double for 10 s").
- **Character:** procedural running as in capability 5.
- **Props:** the four modules above under `content/props/`.
- **Levels:** `01-broadway` and `02-garden` gain `props` weights and authored sections: each has at least two turns (one each way), a dip, a hill with railings, a tunnel or overpass in front of a dense stretch, and one camera change (a low chase camera through the tunnel, a high one over the hill). `endless` gets `curve: "random"`, `props`, and the faster ramp. The exact JSON is in the plan and is tuned in the manual pass.
- **Fixtures:** a `demo/arch` prop, and the demo level uses `curve`, `camera`, a prop placement and `rules.reaction`, so the acceptance test covers v3 with no `src/` edit.
- **CONTRIBUTING / README:** the new keys, the `prop` kind, `name`/`blurb`, the z-subdivision note, and the field tables updated.

## Testing

`node --test` as before, extended:
- **rules:** `step()` sets `run.speed`; `speedAt` with a carried `from`; `inReach` collects only up close and honours `p.x`; a pure `pull(run, p, dt)` moves a pulled pickup toward the player; `reaction` validates in range.
- **generator:** the reaction floor skips close rows at speed and never touches placements; props land on their grid, never overlap, never pass the end, and only come from the level's `ids`; `curveAt(norm, z)` interpolates sections, honours `"random"` deterministically from the seed, and fades to 0 before a finite finish; `cameraAt(norm, z)` inherits level → section.
- **registry:** the `prop` kind (id, `length` 1–100, `createView`); pickup `name` and `blurb` lengths.
- **validate:** every new key and range, `"prop"` placements (no lane, must fit), `curve: "random"`, unknown keys still rejected, placed obstacle rows closer than the reaction floor rejected.
- **world:** nothing a `defaultChunk` builds leaves its chunk (FB-5); a prop view is created, streamed and disposed like an obstacle; a pulled pickup's view follows its logical position.
- **fixtures:** the pack registers with the new prop and validates; the shipped prop ids join the "engine never names content" list.
- **engine:** `cameraFor(run, overrides, speed)` is pure and tested; the shader patch, streaks, toast and HOW TO PLAY are checked in the manual pass with screenshots (a turn, a dip, a tunnel mouth, the camera change, the magnet pull, the toast, and the FB-5 seam before and after).

## Build order

1. FB-5 clamp and test, with before/after screenshots.
2. Speed: `run.speed`, new defaults, carry, reaction floor, FOV by speed, streaks.
3. Procedural running in the character module.
4. Magnet pull, pickup `name`/`blurb`, toast, HOW TO PLAY.
5. World bend: material patch, `gfx.box` subdivision, `curveAt`, schema and validator.
6. Camera overrides per section.
7. `prop` kind end to end, the four shipped props, the fixture prop.
8. Author levels 1, 2 and endless; CONTRIBUTING and README.
9. Manual pass with screenshots; ledger; PR after Caedon's review.
10. Gated: rig and animate the GLB (credits and a download need Caedon's yes), then the clip branch in the character module.

## Out of scope for v3

Real path geometry (true turns and elevation) · sound · a rigged model inside the main plan · random camera changes · HUD speed readout · more than 3 lanes · the deferred review minors not named above (fixtures bundled into production, hard-coded font path, CI concurrency group, error outcome recorded as a best, ENDLESS button ignoring validity, no catch around `main()`, low-fps tunnelling at the cap, CONTRIBUTING's `model:` wording).
