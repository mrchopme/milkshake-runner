---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner — first playtest feedback (2026-10-08)

> Point-in-time snapshot. Caedon relayed this feedback in chat on 2026-10-08 after testing the dev build of PR #1
> (`feat/v1`, commit 8a8d41e). The five items below quote that feedback; the tags, code pointers and directions were
> added by Fable and are suggestions to verify, not decisions. Patterns may have moved on since: read the current
> `src/` before acting. This branch (`feat/v2-plus-feedback`) is `feat/v1` plus this file, so a follow-up session can
> start from the shipped v1 code with the feedback beside it.

How these relate to plan v2 (`2026-10-07-milkshake-runner-plan-v2.md`): FB-2 is in the plan but too gentle to feel;
FB-4's magnet half is a known deferred minor from the branch review; FB-1, FB-3 and FB-5 are not covered by the plan.

| Id | Tags | One line |
|---|---|---|
| FB-1 | `animation` `character` `game-feel` | No running animation; the player cannot read how fast Milkshake is going |
| FB-2 | `pacing` `difficulty` `rules` | No perceptible speed-up through a level; reaction time never has to adapt |
| FB-3 | `camera` `level-design` `world` `new-feature` | No camera changes, turns, dips, over/under; the whole street is visible ahead |
| FB-4 | `powerups` `onboarding` `bug` | Power-ups are unexplained; with the magnet, jugs ahead vanish as if glitched |
| FB-5 | `rendering` `bug` `world` | Every 20–25 s the brown building band in the background glitches visually |

## FB-1 · No running animation `animation` `character` `game-feel`

**Feedback:** "there's no running animation so it's unclear how to understand how fast milkshake is running."

**State in v1:** the generated GLB (`public/milkshake.glb`, Tripo, single static mesh) only bobs and leans; limb swing
exists only for the shape-built fallback cow (`content/characters/milkshake.js`, `pose()` and `shapeCow()`). Nothing
else in the frame moves with speed: the road is a flat colour with lane dashes, buildings are plain blocks.

**Directions to weigh:** (a) animate the model: a rigged export (Meshy 7 rigging costs more credits; Tripo H3.1 has no
rig) or splitting the mesh into body/limb groups in Blender; (b) procedural motion that reads at any speed: stronger
bob and lean scaled by speed, foot-plant dust puffs, speed lines or a wind streak sprite, a road texture that scrolls;
(c) a camera FOV that widens with speed (`src/engine.js` `follow()`), which also serves FB-2. The character contract
already passes `pose(time, { sliding, over, lean, airborne })`; adding `speed` to that bag keeps it a content-side change.

## FB-2 · No progressive speed-up `pacing` `difficulty` `rules`

**Feedback:** "there's no progressive speed up through the level like any other endless runner where it gets faster
and faster and you're forced to change your reaction time."

**State in v1:** speed does ramp, but gently and invisibly: `speedAt()` in `src/rules.js` goes linearly from
`speed.start` 12 to `speed.end` 20 m/s across the level and endless caps at 28 m/s via `speed.ramp` 0.004 per metre.
Each level restarts at 12. Obstacle density ramps separately (`density.start` → `density.end`). Nothing on screen
signals speed (no FOV change, no motion cues, no speed readout), so the ramp is felt as flat.

**Directions to weigh:** steeper or stepped ramps (per-level `rules.speed` already validates in range 4–40, cap 4–60),
carrying speed across the level 1 → 2 transition instead of resetting, shorter `ROW_GAP` at high speed, and the motion
cues from FB-1. Keep fairness: `passable()` and the generator are speed-agnostic today, but reaction windows shrink
with speed, so a minimum reaction distance per speed may need to enter the generator.

## FB-3 · No camera changes, turns, dips, over/under `camera` `level-design` `world` `new-feature`

**Feedback:** "there's no camera angle changes that create a way to hide what's coming up next in the level having
turns, dips, the ability to go underneath and above and having different visual breakups that hide the rest of the
level is important."

**State in v1:** the street is a straight +z line; the camera is a fixed follow (`src/engine.js` `follow()`:
behind, above, looking down the lane). `src/world.js` builds 120 m chunks of road, sidewalk and block buildings; a
theme may replace scenery with `createChunk`, but geometry, lanes and camera are engine-owned. Nothing is in the plan
for curves, hills, tunnels or camera moves; the spec's section model (`sections[]` with per-range overrides) is the
natural place to hang them.

**Directions to weigh:** (a) visual-only curvature: bend the world in a vertex shader or rotate chunks around the
camera so the road appears to curve while gameplay stays on a straight z axis (cheap, common in runners); (b) real
height: a `profile` per section (dip, hill, overpass, tunnel) that offsets y along z, with the character and camera
following; (c) section-level `camera` overrides (height, distance, FOV, a side angle for a set piece); (d) occluders:
overpasses, tunnel mouths, billboards, tall foreground props so the next rows are revealed late. Each of these touches
the engine; decide which become section parameters (data) and which stay engine features.

## FB-4 · Power-ups unexplained; magnet looks glitched `powerups` `onboarding` `bug`

**Feedback:** "we need to understand what each of these power-ups do right now when the magnet turns on the coins
that you're running through just start to disappear in front of you like it's glitched."

**State in v1:** the magnet sets `effects.magnet.reach = 15`; `inReach()` in `src/rules.js` returns true for any
pickup up to 15 m ahead, so `src/game.js` collects it the same tick that `src/world.js` starts sliding it toward the
player. The pull animation never shows; jugs blink out 15 m ahead. This was deferred minor #9 of the branch review.
Nothing names a power-up when collected: the HUD chip shows the icon and a countdown only (`src/hud.js`).

**Directions to weigh:** collect only within about a metre and let the pull move the pickup's `z` and `x` toward the
player over a few frames; a short toast on first pickup ("MAGNET · pulls jugs for 8 s") driven by module metadata, so
community pickups get it for free (add an optional `blurb` to the pickup contract and `checkModule`); a one-screen
"how to play" on first run listing the shipped power-ups from the registry.

## FB-5 · Background band glitches every 20–25 s `rendering` `bug` `world`

**Feedback:** "every 20 to 25 seconds the brown section of the outline of the background starts to glitch out
visually."

**State in v1:** not reproduced in the hidden-pane checks. Most likely causes to test first: (a) building boxes
overlapping at chunk seams: `defaultChunk()` in `src/world.js` lets the last building of a chunk run past
`z0 + length`, so it intersects the next chunk's first building and the overlapping faces z-fight as the camera
moves; (b) chunk drop and build happening in one frame (`update()` builds the next 120 m when the player is 200 m
from the built edge and drops chunks 15 m behind), which at 12–20 m/s is every 6–10 s and may show as a hitch or a
pop at the horizon; (c) fog distance `260 - fog × 160` with camera far 400 and `AHEAD` 200 m, so distant blocks sit
at the fog edge and flicker in and out. A quick test: clamp the last building's depth to the chunk end and give
buildings a small per-building x offset or depth gap; and log `build()` timestamps against when the glitch appears.

## Related deferred review findings (same branch review, 2026-10-08)

Magnet pull invisible (FB-4), throwing `createChunk` leaves an empty street, fixtures bundled into production,
hard-coded font path, no CI concurrency group for Pages, an error outcome recorded as a best, ENDLESS button ignoring
level validity, no catch around `main()`, low-fps tunnelling at the endless cap, CONTRIBUTING's `model:` wording.

## Ezra's modularity asks

Caedon ruled on 2026-10-08 that Ezra's asks from the 2026-10-07 call are already baked into v2 and are not to be raised again.
