---
provenance: human-approved
last-verified: 2026-10-08
---

# Milkshake Runner: design spec v4 (second playtest response)

**Date:** 2026-10-08 · **Status:** approved by Caedon on 2026-10-08, in chat · **Builds on:** [spec v3](2026-10-08-milkshake-runner-design-v3.md), [plan v3](2026-10-08-milkshake-runner-plan-v3.md), [v3 ledger](2026-10-08-v3-ledger.md) · **Builder:** Fable, inline

> Point-in-time snapshot. Written on 2026-10-08 against `feat/v3-feedback` at eac3c7f (PR #2 open onto `feat/v1`, 81 tests)
> and Caedon's second playtest. The decisions table records what Caedon chose in chat that day; everything else is Fable's
> design and may have moved on since. Read the current `src/` and `content/` before treating a detail here as how the game
> works today. The Paper boards 13 and 14 in the style sheet file (`01M46QWM611CXK4WQSBTH6FJK3`) were drawn from this
> design and approved the same day.

## Goal

Answer the three new playtest items and finish the character without breaking the v2 contract: nothing under `content/`,
`levels/` or `test/fixtures/` may need an edit under `src/`, `test/fixtures.test.js` stays the acceptance test, and the
level schema does not change. No credits, no downloads, no new asset.

**Success means**
- A turn or a hill is a place on the street: you see it coming from 200 m out, run up to it, through it and out (FB-6).
- The barrier, the beam and the taxi each say their move from their silhouette (FB-7, FB-8).
- Milkshake runs with swinging arms and stepping feet on the shipped model, with no warping (FB-1, finished).
- The shipped levels play unchanged; the fixtures pack still registers and validates with no `src/` edit.

## Feedback (Caedon, 2026-10-08, after the v3 review build)

| Id | Tags | Caedon's words |
|---|---|---|
| FB-6 | `world` `camera` `game-feel` | "The curves left to right trigger too late. We need to show visually that there is a turn, right now the turn visuals look like the path is actively bending in front of us as we move towards it." |
| FB-7 | `obstacles` `readability` | "we need to better visually seperate the scaffold beam from the barrier. The two render similarly in game and make it hard to tell which is which." |
| FB-8 | `obstacles` `readability` | "Also the taxi height needs to be higher, seems as though we can jump them in game." |
| FB-1 (carried) | `animation` `character` | The v3 rigged export was "still very warped"; the procedural bob and lean shipped. The character round was deferred to this build. |

Also from Caedon that day: the Higgsfield balance is refilled, still gated on his yes per job; Blender is discussed only if needed.

## Decisions (Caedon, 2026-10-08, in chat)

| Item | Decision |
|---|---|
| FB-6 approach | **A**, anchor the bend to the section. **B**, a real corner with the world turning around Milkshake, only after a playtest of A if it is not enough. **C**, chevron signs at a turn, not now. |
| FB-7 | Board 14 approved: the barrier becomes a solid stepped block with white stripes; the beam becomes a grey scaffold frame with a yellow-and-black plank at head height, an X-brace above it and daylight under it. Hit boxes unchanged. |
| FB-8 | Board 14 approved: the taxi becomes a boxy van with a roof ad topper, 2.2 m tall; its hit box grows to 2.0 m. |
| Character | The probe approved: skin the shipped GLB inside the content module with six bones placed from its own shape, drive them with the shape cow's stride code. No credits, no Blender, the asset untouched. If more leg is wanted than this mesh has, Blender run headless with automatic weights is the next step, and needs an install Caedon approves. |
| Boards | 13 "Turns you can see coming" and 14 "Obstacles you can read" drawn in the style sheet file and approved 2026-10-08; the older boards' eyebrows now read "of 14". |
| Credits | None spent in v4. Every generation job stays gated on Caedon's yes. |

## What v3 does today (verified 2026-10-08)

- **Bend.** `curveAt(norm, run.z)` returns the curve of the section Milkshake is in; `world.update` eases a live value toward it over 40 m of travel and hands one `(kx, ky, origin, dead)` to the shader, which bends every vertex beyond `run.z + 20` by `k · d²`. So a turn is invisible until Milkshake crosses its start line, then grows in front of Milkshake as the ease catches up, and it moves with Milkshake all the way: nothing is anchored to the street. A finite level fades the value to 0 over its last 120 m.
- **Obstacles.** The barrier is two white posts with an orange bar at 0.55–0.85 m; the beam is two grey posts with an orange bar at 1.2–1.6 m. Same silhouette, same orange, seen from a camera 3.6 m up. The taxi's roof is at 1.5 m; a jump peaks at 1.35 m (`jumpHeight`), so it already catches a jumper but reads as jumpable.
- **Character.** One Tripo mesh (33,061 vertices, one material, 3.57 MB), no skeleton, bobbed and leaned by the module; the shape-built fallback cow swings capsule limbs. Measured in the GLB's own frame (y from −0.5 to 0.5 is 0 to 1.9 m, +x is the muzzle, z is left-right): the legs are separate below y −0.445 (11 cm of leg), the arm nubs sit outboard of the flank (|z| > 0.165) between the belly and y 0.1, the head starts at y 0.23 with no neck, the tail hangs at the back below y −0.3.
- The probe on the throwaway branch `spike/auto-skin` (commit 15905f3) skinned that mesh at load with six bones and position-blended weights; it deformed cleanly at a 0.7 rad swing and at 1.1 rad. Frames were sent to Caedon and approved. The branch is not merged; the real version is written under tests.

## Engine capabilities

### 1. Anchored bend (FB-6)

The bend becomes a function of the street, not of Milkshake.

**Segments.** `curveSegments(norm, fromZ, toZ, seed)` in `src/generator.js` lists the stretches of street in `[fromZ, toZ)` that bend, each `{ from, to, turn, hill }`, ordered by `from`:
- every section whose `curve` is an object with a non-zero `turn` or `hill` gives one segment `[section.from, section.to)`;
- a section whose `curve` is `"random"` gives one segment per `RANDOM_CURVE_M` (240 m) stretch inside it, with the same seeded pick as today (`turn` from −1, −0.5, 0, 0.5, 1; `hill` from −0.6, 0, 0.6; the all-zero picks are skipped);
- on a finite level no segment runs past `length − FINISH_STRAIGHT_M` (120 m): the last 120 m are straight by geometry, so every ending still plays on a straight street.

`curveAt` and `FINISH_FADE_M` are deleted; nothing else used them.

**Shader.** `src/gfx.js` keeps one shared set of uniforms: `uBendStart` (a float, `run.z + DEAD`) and `uSeg[4]`, one `vec4(from, to, kx, ky)` per segment with `kx = −turn · TURN_K` and `ky = hill · HILL_K` (the signs as today: positive turn bends to screen-right). Unused slots are zero. For a vertex at world z the offset is the sum over segments of

```
s    = max(uBendStart, from)          // the bend begins at the later of the start line and 20 m ahead
L    = max(0, to − s)                 // how much of the stretch is still ahead of that point
u    = clamp(z − s, 0, L)
x   += kx · (u² + 2 · L · max(0, z − to))   // a turn keeps its new heading past its end line
y   += ky · u²                              // a hill plateaus at its new height
```

Before the start line the road is straight up to it and bends beyond it at a fixed place. As Milkshake crosses, `s` moves from the start line to `run.z + 20` without a jump, so the picture is continuous. Inside the stretch the remaining bend shrinks with `L`, so the road ahead unwinds and is exactly straight at the end line; a stretch behind Milkshake contributes nothing. There is no easing anywhere.

`gfx.bendOffset(z)` is the JavaScript twin of that formula, reading the same uniforms, and is what the tests exercise; the GLSL is checked by eye in the manual pass. `gfx.setBend({ origin, segments })` fills the uniforms (at most `BEND_SEGMENTS = 4` segments, the nearest first; a level with more than four bending stretches inside 200 m bends only the first four, documented in CONTRIBUTING). `gfx.setBend()` with no arguments straightens everything, as on dispose today.

**World.** `world.update` calls `curveSegments(norm, run.z, run.z + AHEAD, seed)` every frame and passes the result to `setBend` with `origin = run.z`. The eased `bend` object, `BEND_EASE_M` and the finish fade go. The 20 m dead zone, `TURN_K` 0.005 and `HILL_K` 0.003 are unchanged: the strengths Caedon approved on board 08 read the same inside a stretch.

Lanes, collision, placements and the generator still live on the straight street. The camera, the props and the themes are untouched: they bend through the same uniforms as before.

### 2. Obstacle silhouettes (FB-7, FB-8)

Three content modules redrawn from the same `gfx` primitives, as on board 14. Ids, the levels and the validator are untouched.

- **`barrier_low`** (jump, box unchanged `w 2.2, h 0.9, d 0.4`): a hazard-orange base block 2.2 × 0.5 × 0.4 m under a hazard-orange top block 1.7 × 0.4 × 0.4 m, stepped like a jersey barrier, with two white stripe slabs leaning across the face toward Milkshake. Solid to the ground, nothing to see under it.
- **`scaffold_beam`** (slide, box unchanged `w 2.4, h 0.4, d 0.6, y 1.2`): two metal-grey uprights 2.2 m tall at x ±1.15, a grey top rail, two grey braces crossing between the plank and the rail, and the plank itself 2.4 × 0.4 × 0.6 m at 1.2–1.6 m in taxi yellow with four dark stripe slabs on its face. Daylight under it: nothing below 1.2 m but the two thin uprights.
- **`taxi`** (change lane, box `w 2.0, h 2.0, d 4.0`): a yellow lower body 2.0 × 1.0 × 4.0 m, a yellow cabin 1.9 × 0.9 × 3.0 m on top of it with glass in the rear window and along the sides, a white roof topper 0.7 × 0.25 × 0.3 m with a red band, tail lights at 0.75 m, the wheels as today. 2.15 m to the top, 0.8 m above a jump's apex. The box grows from 1.5 m to 2.0 m to match the roof.

The colour rule the board states: orange stays the jump colour (barrier, cart awning); the beam is yellow and black like caution tape in a grey frame; vehicles stay vehicles. The pigeons, the cart, the steam and the bike are untouched.

### 3. Skinned Milkshake (FB-1, finished)

`content/characters/milkshake.js` skins the loaded mesh before the toon swap and the size fit:

- **Bones**, placed in the GLB's own frame from the measurements above: `hips` at (−0.02, −0.40, 0), its children `head` (−0.05, 0.22, 0), `armL` and `armR` (−0.04, 0.07, ±0.16), `legL` and `legR` (−0.04, `crotch`, ±0.10). The hips bone is a child of the skinned mesh; the skinned mesh replaces the loaded mesh in its parent and keeps its geometry and material.
- **Weights** from `skinWeights(y, z)`, a pure exported function of a vertex's height and side with named knobs in `SKIN` (`crotch −0.445`, `crotchBand 0.03`, `armZ 0.165`, `armBand 0.03`, `shoulder 0.06`, `shoulderBand 0.07`, `neck 0.19`, `neckBand 0.08`, all in the GLB's frame, each with a comment saying what it marks): legs below the crotch split by the sign of z with a 3 cm blend into the hips; arms where |z| leaves the flank, fading out below the shoulder; head above the neck line; the hips take the rest. Every vertex keeps its four largest weights, normalised to 1. The geometry gets `skinIndex` and `skinWeight` attributes; nothing is written to the GLB.
- **Motion.** `pose()` is unchanged in contract and in what it does to the body: bob, lean, roll and the stride still come from `run.speed`. The limb loops swing the bones about their z axis (the GLB's left-right axis) where the shape cow's pivots swing about x; a `limbAxis` picked per model keeps one loop for both. Knobs `LEG_SWING` and `ARM_SWING` (0.7 rad to start) and `HEAD_SWING` (0.08 rad, a counter-nod) are tuned in the manual pass. Dust and the ending poses are untouched. The shape-built fallback cow is untouched.
- **Failure.** If the loaded scene has no mesh the module behaves as today; if skinning throws, the `catch` that already guards the loader falls back to the shape cow, as for a bad GLB.

The GLB stays the v1 Tripo export at 3.57 MB. Three.js skins in the vertex shader before the bend patch runs, so the skinned cow bends with the street like everything else.

## Level schema

Unchanged. Everything that validated under v3 validates under v4 and means the same thing; only the picture of a `curve` changes. CONTRIBUTING's `curve` row says so: a turn or hill is anchored to its section, straight up to the start line, bent beyond it, straight again at the end line; nothing bends inside 20 m; a finite level's last 120 m are straight; at most four bending stretches are drawn inside 200 m.

## Shipped content changes

- **Obstacles:** `barrier_low`, `scaffold_beam`, `taxi` as in capability 2.
- **Character:** `milkshake` as in capability 3.
- **Levels, pickups, props, themes, endings, fixtures:** untouched.
- **Docs:** CONTRIBUTING's `curve` row; `docs/specs/style-sheet.md` gains the note for boards 13 and 14; this spec, the v4 plan and the v4 ledger.

## Testing

`node --test` as before, extended:
- **generator:** `curveSegments` lists a section's stretch with its turn and hill, skips straight sections, inherits the level's curve, cuts `"random"` into 240 m stretches that are reproducible from the seed and differ between seeds, clips every stretch to 120 m before a finite finish, and returns only stretches overlapping the asked range.
- **gfx:** `bendOffset` is 0 before a stretch's start line and non-zero after it; it is continuous when Milkshake crosses the start line (the offset at a fixed world point is the same the frame before and the frame after); it shrinks as Milkshake runs through a stretch and is 0 everywhere once the end line is within 20 m ahead or behind; a turn's far road keeps a slope past the end line while a hill holds its height; `setBend()` zeros everything; the fifth stretch in view is ignored.
- **world:** every frame the uniforms carry the stretches in view with the start 20 m ahead of Milkshake, and dispose straightens the street (replaces the easing test); a level-wide curve on a finite level is straight at the finish line (kept, now by geometry).
- **content:** `skinWeights` gives a foot vertex to one leg, a flank vertex to the hips, an outboard belly-height vertex to one arm, a vertex above the neck to the head, blends across the crotch band, and always sums to 1 with at most four non-zero weights; the shipped obstacle boxes match their moves (barrier no taller than a jump, beam no lower than a slide, taxi taller than a jump); the existing stride, lean and dust test still passes on the fallback cow.
- **fixtures:** unchanged and still green, which is the boundary check.
- **manual pass** with screenshots: the level 1 right turn seen from 150 m out, at the corner and 60 m before its end; the dip at 400 m from before its crest; the bridge hill; endless random stretches; the three obstacles from the game camera beside Milkshake; Milkshake running from the game camera, the side and the front at 12 and 24 m/s; a jump and a slide mid-run; the Broadway and the Garden endings on a straight street.

## Build order

1. `curveSegments` and the shader twin `bendOffset`, under tests, then the GLSL and the world hand-off; delete the easing and the fade; look at the turn in the pane.
2. The three obstacle modules, with the box test; look at them beside Milkshake.
3. The skinning in the character module, `skinWeights` under test; look at it from three angles; tune the swing knobs.
4. CONTRIBUTING and the style sheet note; the manual pass with screenshots; the ledger; PR after Caedon's yes.

## Out of scope for v4

The real corner (option B) · chevron or sign props at a turn (option C) · Blender, a regenerated model, any credit spend · more lanes, sound, a HUD speed readout · the v3 deferred items (the theme switch at 120 m chunk boundaries, bigger dust at the cap, the two remaining review minors) · the six deferred minors already fixed on the minors branch, which merges under this build when Caedon lands it; the one overlap is the bend hook in `gfx.js`, reconciled at merge and recorded in the ledger.

## Addendum (2026-10-09, after the build)

> Agent-drafted by Fable on 2026-10-09 and pending Caedon's approval: the frontmatter above dates his approval to 2026-10-08
> and covers the text above this heading, not this section. Point-in-time snapshot written against `feat/v4-feedback` after
> 3950926 (PR #4 onto `feat/v1`, 92 tests); the code may have moved on since, so read `src/` and `content/` before treating a
> detail here as how the game works today.

The approved text above is left as written. The build changed it in four places, each by Caedon's decision and each under a
test; the v4 ledger's Fix pass (2026-10-08) and Live tuning (2026-10-09) sections are the record and this is their reading
against the spec's sections. Where the two differ, the code is the truth.

1. **§1: the bend begins `BEND_LEAD` = 40 m before a stretch's start line** (3950926, live tuning). Caedon played the pushed
   build at the pane on 2026-10-09 and said "the turn still reads late, bend it earlier": a parabola is flat where it starts, so
   a section's start line showed almost no deflection and the corner only read once its steeper part was near. The formula's
   first line is now

   ```
   s    = max(uBendStart, from − BEND_LEAD)   // the bend begins at the later of 40 m before the start line and 20 m ahead
   ```

   in the GLSL and in `bendOffset` alike (`src/gfx.js`; `BEND_LEAD` is a knob exported beside `TURN_K`, `HILL_K`, `DEAD` and
   `BEND_SEGMENTS`, baked into the GLSL as a literal). The uniforms still carry the section's own start and end lines; `L` and
   `u` follow from the moved `s`, so the rest of the formula, the continuity as Milkshake crosses and the straight end line are
   as written, and the start line itself already turns. Where §1 and the level schema section say "straight up to the start
   line", read "straight up to 40 m before the start line"; CONTRIBUTING's `curve` row says so. Test: `the bend is anchored to
   its stretch of street …` in `test/logic.test.js` asserts 0 at the lead-in line and a turn under way at the start line.

2. **§1, World: `world.update` calls `curveSegments(norm, run.z, builtTo, seed)`, not `run.z + AHEAD`** (62ee1ea, fix
   pass). The street is built 120 m at a time while less than 200 m of it is ahead, so it runs up to 320 m ahead; a stretch
   whose start line sat between 200 and 320 m was drawn straight until it entered the 200 m window, then popped (hidden by the
   shipped fog, about 30 % visible on a `fog: 0` community level). With `builtTo` every drawn vertex is bent by every stretch it
   lies in, and nothing pops when it enters view. The four-slot cap counts from the same list: the nearest four stretches inside
   the built street, not inside 200 m (CONTRIBUTING's row still says "inside 200 m"). Caedon chose this knowing it departs from
   the spec's letter. Test: `a stretch that starts past 200 m but inside the built street is in the uniforms too, so nothing
   pops when it enters view` (`test/world.test.js`).

3. **§1, Segments: consecutive stretches with equal `turn` and `hill` and touching ends are one stretch** (d9679b5, fix
   pass). `curveSegments` merges in its `push`: a stretch that starts where the last one ended with the same bend extends it
   instead of taking a slot. The ruling's reason: the formula as approved is exact under splitting a stretch, so the picture and
   the cut lines are identical and only the slot count changes; a level-wide curve inherited by many short sections (a community
   level with sections of 50 m or less) is one stretch and never fills the four slots. The merge applies to `"random"` stretches
   too: two neighbouring picks that happen to match become one 480 m stretch, so "one segment per 240 m stretch" reads "cut on
   a 240 m line, a multiple of 240 m long" (a flag to exempt random picks would be code for no visible gain). Since 1, the
   merge also protects the picture: a stretch in the uniforms bends over its own length plus the 40 m lead-in, so a level-wide
   curve handed over as one stretch per section would gain a lead-in's worth of bend at every inner section line (8 m by the
   line and a steeper heading past it, on a full turn). Test: `curveSegments merges touching stretches with the same bend, so a
   level-wide curve over many sections is one stretch and never fills the slots` (`test/logic.test.js`).

4. **§3: the skinning runs inside `fitModel(THREE, scene, def)`, exported and tested in Node** (b509fe0, fix pass).
   `createView` loads the GLB and then does one thing with it:
   `({ model, arms, legs, head, limbAxis } = fitModel(gfx.three, gltf.scene, this))`. `fitModel` skins the scene's mesh as §3
   describes (`skin`: six bones from `BONES`, weights from `skinWeights`, a `SkinnedMesh` in the mesh's place), sets `limbAxis`
   to `'z'`, swaps the toon material, applies `def.yaw` and fits the model to `def.height`, and returns those five values or
   throws. So a scene that breaks anywhere after `skin()` leaves nothing behind: the `catch` falls back to the shape cow with
   its own `limbAxis` `'x'` and no `head` (§3's Failure bullet covered a throw during skinning; the fix covers everything up to
   the fit, which used to leave the fallback cow swinging its limbs sideways). Tests, in Node on synthetic meshes in the Tripo
   frame: `fitModel skins the loaded mesh in place: six bones under the hips under the mesh, weights that sum to 1, the swing
   axis z, the model fitted to its height` and `a model that breaks after skinning is thrown away whole, so the fallback cow
   keeps its own limb axis` (`test/content.test.js`). One thing §3 did not say and the code now says at the `SkinnedMesh` call:
   it is built from the raw geometry and deliberately drops the GLB node's own transform, which is only a 19.5° yaw, so
   Milkshake faces straight down the street where v3 ran turned 19.5° toward screen-left. Caedon chose to keep it facing
   straight (fix-pass decisions, 2026-10-08); `yaw` in the module (`-Math.PI / 2`) is where the three-quarter stance would come
   back (`+ 0.34`).

**Noticed while drafting, not in the ledger, not seen in the pane** (Fable's reading of the code, Caedon's call): 1 and 2
together leave one small pop. `curveSegments` lists a stretch once its own start line is inside `[run.z, builtTo)`, but its bend
now begins 40 m before that line, so a stretch whose start line sits within 40 m past the next chunk seam shows that lead-in
straight until the chunk builds, which happens when the seam is 200 m ahead: up to 40 m of road, 160–200 m out, from straight
to at most 8 m of offset on a full turn. The same class of pop as the one 2 removed, fog-hidden on the shipped levels;
`curveSegments(norm, run.z, builtTo + gfx.BEND_LEAD, seed)` would close it.
