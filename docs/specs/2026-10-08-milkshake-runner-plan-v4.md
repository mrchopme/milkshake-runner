---
provenance: human-approved
last-verified: 2026-10-09
---

# Milkshake Runner v4 (second playtest response) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Point-in-time snapshot, written 2026-10-08 against `feat/v4-feedback` at 4422945 (81 tests). Patterns may have moved on since; the code is the truth.

**Goal:** Anchor the world bend to the street so turns and hills read as places you run up to (FB-6), redraw the barrier, the beam and the taxi so their silhouettes say their move (FB-7, FB-8), and make the shipped Milkshake run on skinned limbs with no new asset (FB-1), without touching the level schema or the content boundary.

**Architecture:** The generator lists the bending stretches of street; the world hands the stretches in view to one shared set of shader uniforms every frame; the vertex shader sums a per-stretch parabola anchored to the stretch's start and end lines, and a JavaScript twin of that formula is what the tests exercise. Three obstacle modules are redrawn from the same `gfx` primitives. The character module turns the loaded Tripo mesh into a six-bone skinned mesh at load, with a pure weight rule tested in Node, and the existing stride loop drives the bones.

**Tech Stack:** Vanilla ES modules, three.js 0.186 (`SkinnedMesh`, `Bone`, `Skeleton`, `onBeforeCompile`), Vite 8, `node --test`.

**Spec:** `docs/specs/2026-10-08-milkshake-runner-design-v4.md` (approved by Caedon in chat on 2026-10-08).

## Global Constraints

- Branch `feat/v4-feedback` (local, from `feat/v3-feedback` at eac3c7f). Never `git push`, open a PR, spend Higgsfield credits, install Blender or download an asset without asking Caedon in chat first. Never merge.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. A PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- `test/fixtures.test.js` is the acceptance test: the fixtures pack registers and validates with no edit under `src/`, and `src/` never names a content id other than `jug`, `milkshake` and `finish`. No new shipped id in v4, so its list is unchanged.
- The level schema does not change; unknown keys stay errors; every validator rule keeps its failing test (none change).
- Content modules import in Node: no DOM and no `three` at module scope; rendering only inside `createView` via `gfx`.
- Community strings reach the DOM through `textContent` only (nothing in v4 touches the DOM).
- `public/milkshake.glb` is not rewritten; it stays the 3.57 MB Tripo export. GLB size limit 8 MB.
- Calibration knobs are named constants with a comment: `TURN_K` 0.005, `HILL_K` 0.003, `DEAD` 20, `BEND_SEGMENTS` 4, `RANDOM_CURVE_M` 240, `FINISH_STRAIGHT_M` 120, `SKIN.*`, `LEG_SWING`, `ARM_SWING`, `HEAD_SWING`. Tuned in Task 5, never buried.
- `npm test` green and `npm run build` green before every commit. Deviations from this plan go in `docs/specs/2026-10-08-v4-ledger.md` as `Ruling:` lines.
- The sibling branch `claude/adoring-lehmann-28ec61` (the six deferred v3 minors) touches `src/gfx.js` (`bendable` chaining), `src/generator.js` (`curveAt`), `src/engine.js`, `content/characters/milkshake.js` (the puff lines) and CONTRIBUTING. Do not merge it here; the ledger notes the overlap for the merge Caedon lands.

## Review Focus

1. Two bending stretches that share a line with opposite turns (a right turn straight into a left turn): the picture must be continuous at the shared line, with no step. Pinned in Task 2's `bendOffset` test.
2. A finite level shorter than 120 m, or a section that lies entirely inside the last 120 m: it must be straight, not throw or produce a negative-length stretch. Pinned in Task 1's `curveSegments` test.
3. A section whose `curve` is an object with explicit zeros (`{ "turn": 0 }`): it is a straight stretch and must not fill a uniform slot. Pinned in Task 1's `curveSegments` test.
4. A GLB that loads but holds no mesh, or a skinning step that throws: the run must still start, on the shape cow as for a bad GLB. Covered by the existing `catch` in `createView`; checked by hand in Task 5 by renaming the GLB away for one load.
5. More than four bending stretches inside 200 m (a community level with many short sections): the first four by distance bend, the rest are drawn straight, and nothing crashes. Pinned in Task 2's `bendOffset` test.

---

### Task 1: `curveSegments`, the bending stretches of a level

**Files:**
- Modify: `src/generator.js:70-83` (`RANDOM_CURVE_M`, `FINISH_FADE_M`, `curveAt`)
- Modify: `test/logic.test.js:169` (import), `test/logic.test.js:392-411` (the `curveAt` test)
- Create: `docs/specs/2026-10-08-v4-ledger.md`
- Modify: `docs/specs/2026-10-08-milkshake-runner-design-v4.md:1-4` (frontmatter)

**Interfaces:**
- Consumes: `normalizeLevel(level)` → `{ length, seed, sections: [{ from, to, curve, … }] }` and `rng(seed)` from `src/generator.js` as they are.
- Produces: `curveSegments(norm, fromZ, toZ, seed = 0)` → `[{ from, to, turn, hill }]`, ordered by `from`, only stretches overlapping `[fromZ, toZ)`, each with its real `from` and `to` in metres (never clipped to the asked range, only to `norm.length - FINISH_STRAIGHT_M` on a finite level); `turn` and `hill` in −1..1, never both zero. `FINISH_STRAIGHT_M = 120`. `curveAt` and `FINISH_FADE_M` stay until Task 2 deletes them with their last caller.

- [ ] **Step 1: Write the failing test.** In `test/logic.test.js` change line 169 to

```js
import { generate, normalizeLevel, densityAt, rng, passable, curveAt, curveSegments, FINISH_STRAIGHT_M, cameraAt, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
```

and append, after the `curveAt` test (which stays green until Task 2):

```js
test('curveSegments lists the bending stretches of street: sections, the inherited level curve, random picks, nothing in the last 120 m', () => {
  const level = lvl({ length_m: 1500, curve: { turn: 1 }, sections: [{ from_m: 300, to_m: 600, curve: { hill: -1 } }, { from_m: 600, to_m: 900, curve: 'random' }] });
  const norm = normalizeLevel(level);
  const segs = curveSegments(norm, 0, 1500, 7);
  assert.deepEqual(segs[0], { from: 0, to: 300, turn: 1, hill: 0 }, 'the level curve applies outside sections');
  assert.deepEqual(segs[1], { from: 300, to: 600, turn: 0, hill: -1 }, 'a section curve replaces it');
  const random = segs.filter((s) => s.from >= 600 && s.from < 900);
  assert.ok(random.length <= 2 && random.every((s) => s.to <= 900 && Math.abs(s.turn) <= 1 && Math.abs(s.hill) <= 1 && (s.turn || s.hill)), 'random stretches stay inside their section, carry a pick and skip the straight ones');
  assert.deepEqual(random, curveSegments(norm, 0, 1500, 7).filter((s) => s.from >= 600 && s.from < 900), 'random picks come from the seed');
  assert.deepEqual(segs.at(-1), { from: 900, to: 1500 - FINISH_STRAIGHT_M, turn: 1, hill: 0 }, 'the level curve resumes and stops 120 m before the finish');
  assert.deepEqual(curveSegments(norm, 1380, 1500, 7), [], 'the last 120 m are straight');
  assert.deepEqual(curveSegments(norm, 100, 200, 7), [{ from: 0, to: 300, turn: 1, hill: 0 }], 'only stretches overlapping the asked range, with their real ends');
  assert.deepEqual(curveSegments(normalizeLevel(lvl()), 0, 1500), [], 'no curve means straight');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ sections: [{ from_m: 100, to_m: 200, curve: { turn: 0 } }] })), 0, 1500), [], 'explicit zeros are a straight stretch');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ length_m: 100, curve: { turn: 1 } })), 0, 100), [], 'a level shorter than the finish straight is straight');
  const E = normalizeLevel(lvl({ length_m: null, curve: 'random' }));
  const a = curveSegments(E, 0, 2400, 7), b = curveSegments(E, 0, 2400, 8);
  assert.ok(a.length >= 5 && a.every((s) => s.to - s.from === 240 && s.from % 240 === 0), 'random is cut every 240 m');
  assert.deepEqual(a, curveSegments(E, 0, 2400, 7));
  assert.notDeepEqual(a, b, 'and differs between seeds');
  assert.deepEqual(curveSegments(normalizeLevel(lvl({ length_m: 480, curve: 'random' })), 0, 480, 7).filter((s) => s.to > 360), [], 'random stops 120 m before a finite finish too');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/logic.test.js`
Expected: the file fails to load with `SyntaxError: The requested module '../src/generator.js' does not provide an export named 'curveSegments'`.

- [ ] **Step 3: Implement** (`src/generator.js`, after `FINISH_FADE_M` on line 71)

```js
export const FINISH_STRAIGHT_M = 120; // a finite level's last metres are straight, so endings play on the street they were built for

// The stretches of street in [fromZ, toZ) that bend, { from, to, turn, hill } ordered by from, each with its real start and end lines.
// A section's curve is one stretch; "random" is one stretch per RANDOM_CURVE_M with a seeded pick; nothing runs into the finish straight.
export function curveSegments(norm, fromZ, toZ, seed = 0) {
  const end = norm.length == null ? Infinity : norm.length - FINISH_STRAIGHT_M;
  const out = [];
  const push = (from, to, turn, hill) => { to = Math.min(to, end); if (from < to && from < toZ && to > fromZ && (turn || hill)) out.push({ from, to, turn, hill }); };
  for (const s of norm.sections) {
    if (!s.curve || s.to <= fromZ || s.from >= Math.min(toZ, end)) continue;
    if (s.curve === 'random') {
      for (let k = Math.floor(Math.max(s.from, fromZ) / RANDOM_CURVE_M); k * RANDOM_CURVE_M < Math.min(s.to, toZ, end); k++) {
        const pick = rng((seed + 0x9e3779b9 * (k + 1)) >>> 0);
        push(Math.max(s.from, k * RANDOM_CURVE_M), Math.min(s.to, (k + 1) * RANDOM_CURVE_M), [-1, -0.5, 0, 0.5, 1][Math.floor(pick() * 5)], [-0.6, 0, 0.6][Math.floor(pick() * 3)]);
      }
    } else push(s.from, s.to, s.curve.turn ?? 0, s.curve.hill ?? 0);
  }
  return out;
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: 82 pass (81 + 1).

- [ ] **Step 5: Start the ledger and promote the spec.** Create `docs/specs/2026-10-08-v4-ledger.md`:

```markdown
---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner v4 build ledger (started 2026-10-08)

Point-in-time log of the v4 build from `2026-10-08-milkshake-runner-plan-v4.md`: one line per task as it lands,
deviations from the plan as `Ruling:` lines. Patterns may have moved on since; the code is the truth.

| Task | State | Commit | Notes |
|---|---|---|---|

## Rulings

- Setup: Ruling: the spec's frontmatter is `human-approved` / `2026-10-08` (Caedon approved it in chat that day); the plan's is promoted the same way when he approves it — cost if wrong: a docs-only revert.
- Setup: Ruling: the probe for the skinned Milkshake lives on the local branch `spike/auto-skin` (15905f3), never merged; Task 4 rewrites it under tests — cost if wrong: none, the branch is a throwaway.

## Deferred (noticed during the build, not in the plan)
```

and change the spec's frontmatter (`docs/specs/2026-10-08-milkshake-runner-design-v4.md` lines 2–3) to `provenance: human-approved` and `last-verified: 2026-10-08`, and its Status line to `approved by Caedon on 2026-10-08, in chat`.

- [ ] **Step 6: Build and commit**

Run: `npm run build`
Expected: `✓ built`.

```bash
git add src/generator.js test/logic.test.js docs/specs/2026-10-08-v4-ledger.md docs/specs/2026-10-08-milkshake-runner-design-v4.md
git commit -m "feat: curveSegments lists the bending stretches of a level, straight for the last 120 m (FB-6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Add the Task 1 row to the ledger table in the next commit.

---

### Task 2: The anchored bend: shader, JavaScript twin, world hand-off

**Files:**
- Modify: `src/gfx.js:9-47` (the bend block: knobs, uniform, shader snippets, `patch`, `patchSprite`, `setBend`)
- Modify: `src/world.js:3` (import), `src/world.js:33-34` (`bend`, `BEND_EASE_M`), `src/world.js:99-105` (the end of `update`)
- Modify: `src/generator.js:70-83` (delete `FINISH_FADE_M` and `curveAt`)
- Modify: `test/logic.test.js:169` (import), `test/logic.test.js:392-419` (delete the `curveAt` test; rewrite the `gfx.box` test; add the `bendOffset` test)
- Modify: `test/world.test.js:66-80` and `test/world.test.js:98-107` (the two bend tests)
- Modify: `docs/specs/2026-10-08-v4-ledger.md`

**Interfaces:**
- Consumes: `curveSegments(norm, fromZ, toZ, seed)` from Task 1.
- Produces, in `src/gfx.js`: `BEND_SEGMENTS = 4`; `bendStart = { value }` (a float uniform, `origin + DEAD`); `bendSegments = { value: Vector4[BEND_SEGMENTS] }` (each `(from, to, kx, ky)`); `setBend({ origin = 0, segments = [] } = {})` fills them from `{ from, to, turn, hill }` objects, nearest first, zeros beyond `segments.length`; `bendOffset(z)` → `{ x, y }` in metres, the shader's formula over the same uniforms. `bendUniform` is deleted.

- [ ] **Step 1: Write the failing tests.** In `test/logic.test.js` change line 169 to

```js
import { generate, normalizeLevel, densityAt, rng, passable, curveSegments, FINISH_STRAIGHT_M, cameraAt, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
```

delete the whole `curveAt follows sections…` test (lines 392–411), and replace the `gfx.box subdivides along z…` test (lines 412–419) with

```js
test('gfx.box subdivides along z so long road pieces bend', () => {
  assert.equal(gfx.box(1, 1, 120, '#ffffff').geometry.parameters.depthSegments, 30);
  assert.equal(gfx.box(1, 1, 3, '#ffffff').geometry.parameters.depthSegments, 1);
  assert.ok(gfx.box(1, 1, 1, '#ffffff').material.userData.bent, 'materials from the helpers are bendable');
});

test('the bend is anchored to its stretch of street: straight before the start line, continuous across it, straight at the end line', () => {
  const seg = { from: 150, to: 400, turn: 0.7, hill: 0 };
  gfx.setBend({ origin: 0, segments: [seg] });
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [150, 400, -0.7 * gfx.TURN_K, 0], 'positive turn bends to screen-right (-x)');
  assert.deepEqual(gfx.bendOffset(100), { x: 0, y: 0 }, 'straight up to the start line');
  const far = gfx.bendOffset(250).x;
  assert.ok(far < -30, 'bends to screen-right beyond it');
  gfx.setBend({ origin: 100, segments: [seg] });
  assert.equal(gfx.bendOffset(250).x, far, 'a fixed point on the street looks the same as Milkshake approaches');
  gfx.setBend({ origin: 130, segments: [seg] }); // 20 m ahead is the start line: from here the stretch rides with Milkshake
  const atLine = gfx.bendOffset(250).x;
  gfx.setBend({ origin: 130.5, segments: [seg] });
  assert.ok(Math.abs(gfx.bendOffset(250).x - atLine) < 0.5, 'and crossing the line moves the picture by less than half a metre');
  gfx.setBend({ origin: 340, segments: [seg] }); // 60 m before the end line
  assert.ok(gfx.bendOffset(400).x < 0 && gfx.bendOffset(400).x > -6, 'the last of the bend is a few metres');
  assert.ok(gfx.bendOffset(500).x < gfx.bendOffset(400).x, 'and the far road keeps the turn\'s heading');
  gfx.setBend({ origin: 380, segments: [seg] }); // the end line is inside the dead zone
  assert.deepEqual(gfx.bendOffset(600), { x: 0, y: 0 }, 'a stretch ending within 20 m ahead, or behind, bends nothing');
  gfx.setBend({ origin: 0, segments: [{ from: 100, to: 200, turn: 1, hill: 0 }, { from: 200, to: 300, turn: -1, hill: 0 }] });
  assert.ok(Math.abs(gfx.bendOffset(200.001).x - gfx.bendOffset(199.999).x) < 0.01, 'a right turn straight into a left turn meets without a step (the slope there is 1 m per m, so 2 mm apart differ by about 2 mm)');
  assert.ok(gfx.bendOffset(300).x < gfx.bendOffset(200).x, 'the right turn\'s heading carries into the left turn');
  assert.ok(Math.abs(gfx.bendOffset(400).x - gfx.bendOffset(300).x) < 1e-9, 'and an equal left turn brings the far road back to parallel');
  gfx.setBend({ origin: 0, segments: [{ from: 100, to: 300, turn: 0, hill: -0.5 }] });
  const crest = gfx.bendOffset(300).y;
  assert.ok(crest < -50, 'a dip drops out of sight');
  assert.equal(gfx.bendOffset(500).y, crest, 'and holds its depth past the end line');
  assert.equal(gfx.bendOffset(500).x, 0);
  gfx.setBend({ origin: 0, segments: Array.from({ length: 5 }, (_, i) => ({ from: 20 + i, to: 500, turn: 0.2, hill: 0 })) });
  const four = [0, 1, 2, 3].reduce((s, i) => s - 0.2 * gfx.TURN_K * (280 - i) ** 2, 0);
  assert.ok(Math.abs(gfx.bendOffset(300).x - four) < 1e-9, 'only the first four stretches in view bend');
  gfx.setBend();
  assert.deepEqual(gfx.bendOffset(300), { x: 0, y: 0 }, 'no stretches, straight street');
  assert.equal(gfx.bendStart.value, gfx.DEAD);
});
```

In `test/world.test.js` replace the test at lines 66–80 with

```js
test('the world hands the shader the bending stretches in view, 20 m ahead of Milkshake, and straightens on dispose', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, sections: [{ from_m: 150, to_m: 400, curve: { turn: 1 } }] }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  world.update(run, 0); // the view is [run.z, run.z + 200): a stretch starting at 150 is in it
  assert.equal(gfx.bendStart.value, gfx.DEAD, 'the bend starts 20 m ahead of Milkshake');
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [150, 400, -gfx.TURN_K, 0], 'the turn ahead is in the uniforms with its start and end lines');
  assert.equal(gfx.bendOffset(100).x, 0, 'straight up to its start line');
  assert.ok(gfx.bendOffset(300).x < 0, 'bent beyond it');
  run.z = 300;
  world.update(run, 0);
  assert.equal(gfx.bendStart.value, 320, 'the start rides with Milkshake');
  assert.ok(world.live.obstacles.every((o) => o.view.object.material.userData.bent), 'everything the world adds is bendable');
  run.z = 450;
  world.update(run, 0);
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [0, 0, 0, 0], 'a stretch behind Milkshake is dropped');
  world.dispose();
  assert.deepEqual(gfx.bendSegments.value.map((v) => v.length()), [0, 0, 0, 0]);
});
```

and the test at lines 98–107 with

```js
test('a level-wide curve is fully straight at the finish line, not just aiming there', () => {
  const rock = { kind: 'obstacle', id: 'rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView(gfx) { return { object: gfx.box(1, 1, 1, '#ffffff') }; } };
  const registry = { obstacle: { rock }, pickup: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, curve: { turn: 1 } }, { registry, rules, seed: 1, end: 800 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.z = 300;
  world.update(run, 0);
  assert.ok(gfx.bendOffset(400).x < 0, 'bent in the middle of the level');
  run.z = 500; // 100 m out: the last 120 m are straight by geometry
  world.update(run, 0);
  assert.deepEqual(gfx.bendOffset(600), { x: 0, y: 0 });
  run.z = 600;
  world.update(run, 0);
  assert.deepEqual(gfx.bendSegments.value[0].toArray(), [0, 0, 0, 0], 'no stretch reaches the finish line');
  assert.deepEqual(gfx.bendOffset(650), { x: 0, y: 0 }, 'the ending\'s street is straight');
  world.dispose();
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test`
Expected: `test/logic.test.js` fails (`gfx.bendSegments` is undefined, `gfx.bendOffset is not a function`); `test/world.test.js` fails the same way.

- [ ] **Step 3: Implement the shader and the twin** (`src/gfx.js`, replace lines 9–47, from the `// World bend` comment through `setBend`)

```js
// World bend (spec v4 §1). Every material the helpers hand out bends its vertices in the vertex shader by shared uniforms:
// uBendStart (run.z + DEAD: nothing bends closer than this) and uSeg[BEND_SEGMENTS], one (from, to, kx, ky) per bending
// stretch of street in view. For a vertex at world z and each stretch: s = max(uBendStart, from), L = max(0, to - s),
// u = clamp(z - s, 0, L); x += kx·(u² + 2·L·max(0, z - to)) (a turn keeps its heading past its end line), y += ky·u² (a hill
// plateaus at its new height). The bend is anchored to the street: straight up to a start line, straight again at an end line.
// Collision never sees this: the street is straight for everything that plays.
export const TURN_K = 0.005, HILL_K = 0.003, DEAD = 20, BEND_SEGMENTS = 4; // calibration knobs: offset per m² of bend, the dead zone, stretches drawn at once
export const bendStart = { value: DEAD };
export const bendSegments = { value: Array.from({ length: BEND_SEGMENTS }, () => new THREE.Vector4()) };
const BEND_FN = `
uniform float uBendStart;
uniform vec4 uSeg[${BEND_SEGMENTS}];
vec3 bendOffset( float z ) {
  vec3 o = vec3( 0.0 );
  for ( int i = 0; i < ${BEND_SEGMENTS}; i ++ ) {
    float s = max( uBendStart, uSeg[ i ].x );
    float L = max( 0.0, uSeg[ i ].y - s );
    float u = clamp( z - s, 0.0, L );
    o.x += uSeg[ i ].z * ( u * u + 2.0 * L * max( 0.0, z - uSeg[ i ].y ) );
    o.y += uSeg[ i ].w * u * u;
  }
  return o;
}
`;
const BEND = `
  vec4 bentWorld = modelMatrix * vec4( transformed, 1.0 );
  bentWorld.xyz += bendOffset( bentWorld.z );
  vec4 mvPosition = viewMatrix * bentWorld;
  gl_Position = projectionMatrix * mvPosition;
`;
const BEND_SPRITE = `
  vec4 bentWorld = modelMatrix[ 3 ];
  bentWorld.xyz += bendOffset( bentWorld.z );
  vec4 mvPosition = viewMatrix * bentWorld;
`;
function patch(shader) {
  shader.uniforms.uBendStart = bendStart; shader.uniforms.uSeg = bendSegments;
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${BEND_FN}\nvoid main() {`).replace('#include <project_vertex>', BEND);
}
function patchSprite(shader) { // a sprite places its centre from the model-view matrix; bend that centre in world space instead
  shader.uniforms.uBendStart = bendStart; shader.uniforms.uSeg = bendSegments;
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${BEND_FN}\nvoid main() {`).replace('vec4 mvPosition = modelViewMatrix[ 3 ];', BEND_SPRITE);
}
// Marks a material bendable, once. Materials a module builds itself get this when the engine adds the object (gfx.bend).
export function bendable(material) {
  if (!material || material.userData.bent) return material;
  material.userData.bent = true;
  material.onBeforeCompile = material.isSpriteMaterial ? patchSprite : patch;
  material.needsUpdate = true;
  return material;
}
export function bend(object) { object.traverse((n) => { for (const m of [].concat(n.material ?? [])) bendable(m); }); return object; } // a mesh may carry a material array
// The stretches in view, nearest first, as { from, to, turn, hill } (metres, -1..1). No stretches straightens the street.
export function setBend({ origin = 0, segments = [] } = {}) {
  bendStart.value = origin + DEAD;
  bendSegments.value.forEach((v, i) => { const s = segments[i]; if (s) v.set(s.from, s.to, 0 - s.turn * TURN_K, s.hill * HILL_K); else v.set(0, 0, 0, 0); }); // 0 - …: a straight road is +0, never -0
}
// The shader's formula in JavaScript over the same uniforms: what the tests exercise; the GLSL is checked by eye.
export function bendOffset(z) {
  let x = 0, y = 0;
  for (const v of bendSegments.value) {
    const s = Math.max(bendStart.value, v.x), L = Math.max(0, v.y - s), u = Math.min(L, Math.max(0, z - s));
    x += v.z * (u * u + 2 * L * Math.max(0, z - v.y));
    y += v.w * u * u;
  }
  return { x, y };
}
```

- [ ] **Step 4: Hand the stretches to the shader** (`src/world.js`). Change line 3 to

```js
import { generate, normalizeLevel, rng, sectionAt, curveSegments, cameraAt } from './generator.js';
```

delete lines 33–34 (`const bend = …` and `const BEND_EASE_M = 40;`), and replace lines 99–105 (from `const target = curveAt(…)` to the `gfx.setBend(…)` call) with

```js
    gfx.setBend({ origin: run.z, segments: curveSegments(norm, run.z, run.z + AHEAD, seed) }); // the stretches in view; nothing eases, the street is the anchor
```

- [ ] **Step 5: Delete the old target** (`src/generator.js`): remove `FINISH_FADE_M` and the whole `curveAt` function with its comment (the lines that were 71 and 73–83 before Task 1 inserted `curveSegments` after them). `RANDOM_CURVE_M` and `FINISH_STRAIGHT_M` stay.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: 82 pass (81 + 1 from Task 1 − 1 deleted `curveAt` test + 1 `bendOffset` test).

- [ ] **Step 7: Look at it.** `npm run dev -- --port 5175 --strictPort` in the background, open `http://localhost:5175/milkshake-runner/`, inject `window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout`, start level 1, set `window.__milkshake.run.graceT = 1e9`, and screenshot at about 30 m (the corner at 150 m visible ahead at a fixed place, the near road straight), at 150 m (into the bend) and at 340 m (straight at the end line). No shader errors in the console. Keep the frames for Task 5's send.

- [ ] **Step 8: Build, ledger, commit**

Run: `npm run build`
Expected: `✓ built`, no warning beyond the known 800 kB bundle note.

Ledger rows for Tasks 1 and 2 (state, commit, test count, what was seen in the pane).

```bash
git add src/gfx.js src/world.js src/generator.js test/logic.test.js test/world.test.js docs/specs/2026-10-08-v4-ledger.md
git commit -m "feat: the bend is anchored to the street: per-stretch parabolas from a start line to an end line, no easing, no fade (FB-6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Obstacles you can read: barrier, beam, taxi

**Files:**
- Modify: `content/obstacles/barrier_low.js`, `content/obstacles/scaffold_beam.js`, `content/obstacles/taxi.js` (whole files)
- Modify: `test/content.test.js:5` (import) and append one test
- Modify: `docs/specs/2026-10-08-v4-ledger.md`

**Interfaces:**
- Consumes: `gfx.box(w, h, d, color, x, y, z)`, `gfx.cyl(rTop, rBottom, h, color, x, y, z)`, `gfx.group(...)`, `gfx.palette` (`hazard`, `lane`, `metal`, `taxi`, `dark`, `glass`, `rider`); `jumpHeight(rules)` and `resolveRules()` from `src/rules.js`.
- Produces: the same three module ids with `createView(gfx) → { object }`; `taxi.box` becomes `{ w: 2.0, h: 2.0, d: 4.0 }`; the other two boxes are unchanged.

- [ ] **Step 1: Write the failing test.** In `test/content.test.js` change line 5 to

```js
import { createRun, resolveRules, step, jumpHeight } from '../src/rules.js';
```

add after line 7

```js
import barrier from '../content/obstacles/barrier_low.js';
import beam from '../content/obstacles/scaffold_beam.js';
import taxi from '../content/obstacles/taxi.js';
```

and append

```js
// Board 14: the silhouette says the move. The boxes must agree with it: a barrier you can jump, a beam you can slide under, a taxi you cannot jump.
test('the shipped obstacle boxes match their moves', () => {
  const R = resolveRules();
  assert.ok(barrier.avoid === 'jump' && (barrier.box.y ?? 0) === 0 && barrier.box.h <= jumpHeight(R), 'the barrier is low and on the ground');
  assert.ok(beam.avoid === 'slide' && beam.box.y >= R.slideHeight, 'the beam leaves room to slide under');
  assert.ok(taxi.avoid === 'lane' && taxi.box.h >= jumpHeight(R) + 0.6, 'the taxi stands well above a jump\'s apex');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/content.test.js`
Expected: FAIL, `the taxi stands well above a jump's apex` (box h 1.5 against an apex of 1.35).

- [ ] **Step 3: Redraw the three modules.** `content/obstacles/barrier_low.js`:

```js
export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  // A jersey barrier (board 14): solid to the ground, stepped, orange, with two white stripes leaning across the face Milkshake sees (-z).
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(2.2, 0.5, 0.4, P.hazard, 0, 0.25), gfx.box(1.7, 0.4, 0.4, P.hazard, 0, 0.7));
    for (const x of [-0.35, 0.35]) { const s = gfx.box(0.16, 0.8, 0.02, P.lane, x, 0.45, -0.21); s.rotation.z = 0.5; g.add(s); }
    return { object: g };
  },
};
```

`content/obstacles/scaffold_beam.js`:

```js
export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  // A scaffold frame (board 14): tall grey uprights, a top rail, crossed braces, and the plank at head height in caution yellow and black. Daylight under it.
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(0.15, 2.2, 0.15, P.metal, -1.15, 1.1), gfx.box(0.15, 2.2, 0.15, P.metal, 1.15, 1.1), gfx.box(2.4, 0.08, 0.15, P.metal, 0, 2.16), gfx.box(2.4, 0.4, 0.6, P.taxi, 0, 1.4));
    for (const s of [-1, 1]) { const b = gfx.box(2.36, 0.06, 0.06, P.metal, 0, 1.86); b.rotation.z = s * 0.22; g.add(b); }
    for (const x of [-0.9, -0.3, 0.3, 0.9]) { const s = gfx.box(0.14, 0.34, 0.02, P.dark, x, 1.4, -0.31); s.rotation.z = 0.5; g.add(s); }
    return { object: g };
  },
};
```

`content/obstacles/taxi.js`:

```js
export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 2.0, d: 4.0 },
  // A boxy yellow van with a roof topper (board 14): 2.15 m to the top, 0.8 m above a jump's apex, so it never reads as jumpable.
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(
      gfx.box(2.0, 1.0, 4.0, P.taxi),                                                                   // lower body, 0 to 1.0 m
      gfx.box(1.9, 0.9, 3.0, P.taxi, 0, 1.45, -0.3),                                                     // cabin, 1.0 to 1.9 m
      gfx.box(1.6, 0.6, 0.05, P.glass, 0, 1.5, -1.82),                                                   // rear window, the face Milkshake sees
      gfx.box(0.05, 0.5, 2.4, P.glass, -0.96, 1.5, -0.3), gfx.box(0.05, 0.5, 2.4, P.glass, 0.96, 1.5, -0.3), // side windows
      gfx.box(0.7, 0.25, 0.3, P.lane, 0, 2.025, -0.3),                                                   // roof topper, 1.9 to 2.15 m
      gfx.box(0.72, 0.06, 0.32, P.rider, 0, 1.93, -0.3),                                                 // its red band
    );
    for (const x of [-0.7, 0.7]) g.add(gfx.box(0.3, 0.12, 0.05, P.rider, x, 0.75, -2.0));
    for (const [x, z] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) { const w = gfx.cyl(0.33, 0.33, 0.25, P.dark, x, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: 83 pass. The registry and fixtures tests still pass (same ids, same kinds).

- [ ] **Step 5: Look at them.** With the dev server from Task 2, start level 1 with `graceT = 1e9` and screenshot a barrier, a beam and a taxi each from the game camera as Milkshake nears it (teleport forward with `run.z = o.z - 25` for an obstacle `o` from `window.__milkshake.world.live.obstacles`, and move `engine.scene.children.find((c) => c.userData.character).position.z` to match). The stripes must sit on the face toward the camera, the braces between the uprights, the topper above the roof, nothing poking out of a silhouette.

- [ ] **Step 6: Build, ledger, commit**

Run: `npm run build`
Expected: `✓ built`.

```bash
git add content/obstacles/barrier_low.js content/obstacles/scaffold_beam.js content/obstacles/taxi.js test/content.test.js docs/specs/2026-10-08-v4-ledger.md
git commit -m "feat: the barrier is a striped block, the beam a scaffold frame, the taxi a van with a roof sign (FB-7, FB-8)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The skinned Milkshake

**Files:**
- Modify: `content/characters/milkshake.js` (whole file; the probe on `spike/auto-skin` at 15905f3 is the reference, not the source)
- Modify: `test/content.test.js:4` (import) and append one test
- Modify: `docs/specs/2026-10-08-v4-ledger.md`

**Interfaces:**
- Consumes: `gfx.three` (`Bone`, `Skeleton`, `SkinnedMesh`, `Uint16BufferAttribute`, `Float32BufferAttribute`), the GLB loaded by `GLTFLoader` as today.
- Produces: named exports `SKIN` (the knobs) and `skinWeights(y, z, K = SKIN)` → `[hips, head, armL, armR, legL, legR]` summing to 1; the default export's contract (`createView(gfx)` → `{ object, pose, update, dispose }`, `pose(time, { sliding, over, lean, airborne, speed })`) is unchanged.

- [ ] **Step 1: Write the failing test.** In `test/content.test.js` change line 4 to

```js
import milkshake, { SKIN, skinWeights } from '../content/characters/milkshake.js';
```

and append

```js
// The Tripo mesh is skinned at load from these weights (v4 spec §3); Node cannot load the GLB, so the rule is tested on its own.
test('skinWeights gives each part of the Tripo mesh to its bone and blends at the joints', () => {
  const [HIPS, HEAD, ARM_L, ARM_R, LEG_L, LEG_R] = [0, 1, 2, 3, 4, 5];
  const at = (y, z) => { const w = skinWeights(y, z); assert.ok(Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-9, 'weights sum to 1'); assert.ok(w.filter((v) => v > 0).length <= 4, 'four weights at most'); return w; };
  assert.equal(at(-0.49, 0.1)[LEG_L], 1, 'a foot is all one leg');
  assert.equal(at(-0.49, 0.1)[LEG_R], 0, 'and never pulls on the other leg');
  assert.equal(at(-0.49, -0.1)[LEG_R], 1);
  assert.equal(at(0, 0.1)[HIPS], 1, 'the flank is all hips');
  assert.equal(at(-0.1, 0.22)[ARM_L], 1, 'an outboard belly-height vertex is all arm');
  assert.equal(at(-0.1, -0.22)[ARM_R], 1);
  assert.equal(at(0.4, 0)[HEAD], 1, 'above the neck is all head');
  const crotch = at(SKIN.crotch, 0.1);
  assert.ok(crotch[LEG_L] > 0.4 && crotch[LEG_L] < 0.6 && crotch[HIPS] > 0.4, 'the crotch band blends leg into hips');
  const shoulder = at(SKIN.shoulder + SKIN.shoulderBand / 2, 0.22);
  assert.ok(shoulder[ARM_L] > 0.3 && shoulder[ARM_L] < 0.7 && shoulder[HIPS] > 0.3, 'the shoulder band blends arm into hips');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/content.test.js`
Expected: the file fails to load: `does not provide an export named 'SKIN'`.

- [ ] **Step 3: Implement.** Replace `content/characters/milkshake.js` with

```js
// Knobs for skinning the Tripo mesh, in the GLB's own frame: y from -0.5 to 0.5 is 0 to 1.9 m, +x is the muzzle, z is left-right.
// Measured on 2026-10-08 (v4 spec §3); if the GLB is ever regenerated, measure again.
export const SKIN = {
  crotch: -0.445, crotchBand: 0.03,   // the legs are separate below this height; the band blends them into the hips
  armZ: 0.165, armBand: 0.03,         // the arm nubs sit outboard of the flank from here; the band blends the shoulder in
  shoulder: 0.06, shoulderBand: 0.07, // arm weight fades out above this height
  neck: 0.19, neckBand: 0.08,         // head weight fades in above this height
};
const BONES = { hips: [-0.02, -0.4, 0], head: [-0.05, 0.22, 0], armL: [-0.04, 0.07, 0.16], armR: [-0.04, 0.07, -0.16], legL: [-0.04, SKIN.crotch, 0.1], legR: [-0.04, SKIN.crotch, -0.1] };
const LEG_SWING = 0.7, ARM_SWING = 0.7, HEAD_SWING = 0.08; // radians at the stride's peak; tuned in the manual pass

// Weights for a vertex at height y and side z: [hips, head, armL, armR, legL, legR], summing to 1. Pure, so Node can test it.
export function skinWeights(y, z, K = SKIN) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const leg = 1 - sm(K.crotch - K.crotchBand / 2, K.crotch + K.crotchBand / 2, y), left = sm(-0.02, 0.02, z);
  const arm = sm(K.armZ, K.armZ + K.armBand, Math.abs(z)) * (1 - sm(K.shoulder, K.shoulder + K.shoulderBand, y)) * (1 - leg);
  const w = [0, sm(K.neck, K.neck + K.neckBand, y), z > 0 ? arm : 0, z > 0 ? 0 : arm, leg * left, leg * (1 - left)];
  w[0] = Math.max(0, 1 - w[1] - w[2] - w[3] - w[4] - w[5]);
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: -Math.PI / 2,

  async createView(gfx) {
    const P = gfx.palette;
    const root = gfx.group(gfx.blobShadow(0.55));
    const shadow = root.children[0];
    const body = gfx.group();
    root.add(body);
    let model, arms = [], legs = [], head = null, limbAxis = 'x';
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${this.model}`);
      model = gltf.scene;
      const mesh = model.getObjectByProperty('isMesh', true);
      if (mesh) { ({ arms, legs, head } = skin(gfx.three, mesh)); limbAxis = 'z'; } // the bones swing about the GLB's left-right axis
      // The generated GLB ships a metallic PBR material, which three.js renders near-black without an environment map;
      // the toon material with the same colour map matches the rest of the street.
      model.traverse((n) => { if (n.isMesh) n.material = new gfx.three.MeshToonMaterial({ map: n.material.map, color: n.material.color }); });
      model.rotation.y = this.yaw;
      const size = new gfx.three.Box3().setFromObject(model).getSize(new gfx.three.Vector3());
      model.scale.setScalar(this.height / size.y);
      model.position.y -= new gfx.three.Box3().setFromObject(model).min.y;
    } catch {
      ({ model, arms, legs } = shapeCow(gfx)); // no GLB yet, or a bad one: the shape-built cow
    }
    body.add(model);

    // Dust: six puffs pooled under the hooves, one per footfall while on the ground. They stay on the road as Milkshake runs on.
    const puffs = gfx.group();
    root.add(puffs);
    const pool = Array.from({ length: 6 }, () => {
      const m = new gfx.three.Mesh(new gfx.three.SphereGeometry(0.18, 8, 6), new gfx.three.MeshBasicMaterial({ color: P.spot, transparent: true, opacity: 0.5, depthWrite: false }));
      m.visible = false; puffs.add(m); return m;
    });
    let lastStride = 0, nextPuff = 0;

    const BASE = 12; // m/s the v1 stride was tuned at
    const pose = (time, { sliding = false, over = false, lean = 0, airborne = false, speed = BASE } = {}) => {
      const k = speed / BASE;                                       // 1 at the old pace, 2 at 24 m/s
      const stride = airborne || sliding || over ? 0 : Math.sin(time * 14 * k);
      body.position.y = Math.abs(stride) * Math.min(0.14, 0.08 * k);
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.z = lean + stride * 0.03 * Math.max(0, k - 1);  // a little roll per stride once it is running hard
      body.rotation.x = over ? 0.9 : sliding ? -0.3 : Math.max(0, 0.1 * (k - 1)); // forward lean grows with speed
      legs.forEach((l, i) => (l.rotation[limbAxis] = stride * LEG_SWING * (i ? 1 : -1)));
      arms.forEach((a, i) => (a.rotation[limbAxis] = stride * ARM_SWING * (i ? -1 : 1)));
      if (head) head.rotation.z = -HEAD_SWING * stride;             // a counter-nod against the stride
      return stride;
    };
    return {
      object: root,
      pose,
      update(run) {
        root.position.set(run.x, run.y, run.z);
        shadow.position.y = -run.y + 0.01; // the shadow stays on the road while Milkshake jumps
        const stride = pose(run.time, { sliding: run.slideT > 0, over: run.over, lean: ((1 - run.lane) * run.rules.laneWidth - run.x) * 0.12, airborne: run.y > 0, speed: run.speed ?? BASE });
        if (run.y === 0 && run.slideT === 0 && !run.over && stride !== 0 && Math.sign(stride) !== Math.sign(lastStride)) {
          const p = pool[nextPuff++ % pool.length];
          p.visible = true; p.userData.born = run.time; p.userData.z = run.z - 0.4;
          p.position.set(nextPuff % 2 ? 0.18 : -0.18, 0.1, 0);
        }
        lastStride = stride;
        for (const p of pool) if (p.visible) {
          const age = run.time - p.userData.born;
          if (age > 0.35) { p.visible = false; continue; }
          p.position.z = p.userData.z - run.z;
          p.scale.setScalar(0.6 + age * 3);
          p.material.opacity = 0.5 * (1 - age / 0.35);
        }
      },
      dispose() { pool.forEach((p) => p.material.dispose()); gfx.dispose(root); },
    };
  },
};

// Six bones placed from the mesh's shape (BONES) and weights from skinWeights; a SkinnedMesh takes the mesh's place in its parent.
// The bones are children of the skinned mesh, so three.js's attached bind mode keeps the skin on the model wherever the root moves.
function skin(THREE, mesh) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  const joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = skinWeights(pos.getY(i), pos.getZ(i));
    const top = [0, 1, 2, 3, 4, 5].sort((a, b) => w[b] - w[a]).slice(0, 4), sum = top.reduce((s, k) => s + w[k], 0);
    top.forEach((k, j) => { joints[i * 4 + j] = k; weights[i * 4 + j] = w[k] / sum; });
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const hips = new THREE.Bone(); hips.position.fromArray(BONES.hips);
  const child = (p) => { const b = new THREE.Bone(); b.position.fromArray(p).sub(hips.position); hips.add(b); return b; };
  const head = child(BONES.head), armL = child(BONES.armL), armR = child(BONES.armR), legL = child(BONES.legL), legR = child(BONES.legR);
  const skinned = new THREE.SkinnedMesh(g, mesh.material);
  skinned.add(hips);
  skinned.bind(new THREE.Skeleton([hips, head, armL, armR, legL, legR]));
  mesh.parent.add(skinned); mesh.parent.remove(mesh);
  return { arms: [armL, armR], legs: [legL, legR], head };
}

function shapeCow(gfx) {
  const P = gfx.palette;
  const model = gfx.group(gfx.roundedBox(0.66, 1.6, 0.5, 0.2, P.cowWhite, 0, 1.1));
  const spot = (x, y, z, r = 0.12) => model.add(gfx.sphere(r, P.spot, x, y, z));
  spot(0.22, 1.7, -0.22); spot(-0.2, 1.25, -0.24); spot(0.1, 0.7, -0.24, 0.1); spot(-0.25, 1.75, 0.2, 0.09); spot(0.24, 1.0, 0.22, 0.11);
  const muzzle = gfx.sphere(0.2, P.lavender, 0, 1.45, 0.28); muzzle.scale.set(1.4, 0.9, 0.8); model.add(muzzle);
  for (const s of [-1, 1]) {
    model.add(gfx.sphere(0.045, P.eye, s * 0.13, 1.68, 0.26));
    const ear = gfx.sphere(0.12, P.cowWhite, s * 0.46, 1.8, 0); ear.scale.set(1.6, 0.7, 0.5); model.add(ear);
    const inner = gfx.sphere(0.08, P.lavender, s * 0.46, 1.8, 0.05); inner.scale.set(1.3, 0.5, 0.3); model.add(inner);
    model.add(gfx.cone(0.06, 0.2, P.lavender, s * 0.18, 2.0));
  }
  model.add(gfx.sphere(0.12, P.lavender, 0, 0.75, 0.27));
  const limb = (x, y, len, tipColor) => {
    const pivot = gfx.group(); pivot.position.set(x, y, 0); model.add(pivot);
    pivot.add(gfx.capsule(0.09, len, P.cowWhite, 0, -len / 2 - 0.05));
    if (tipColor) pivot.add(gfx.sphere(0.09, tipColor, 0, -len - 0.1));
    return pivot;
  };
  const arms = [limb(-0.42, 1.3, 0.4, P.lavender), limb(0.42, 1.3, 0.4, P.lavender)];
  const legs = [limb(-0.16, 0.42, 0.28, P.eye), limb(0.16, 0.42, 0.28, P.eye)];
  const tail = gfx.capsule(0.03, 0.3, P.cowWhite, 0.05, 0.75, -0.3); tail.rotation.x = 0.9; model.add(tail);
  model.add(gfx.sphere(0.07, P.lavender, 0.08, 0.6, -0.42));
  return { model, arms, legs };
}
```

The only lines that differ from v3 inside `createView` are the `limbAxis`/`head` declarations, the `skin` call, the two limb loops and the head line; `shapeCow` is untouched.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: 84 pass; the stride, lean and dust test still passes on the fallback cow.

- [ ] **Step 5: Look at it.** Dev server, pane, the rAF shim, level 1 with `graceT = 1e9`. Frames from the game camera at 12 m/s (the start) and at 24 m/s (teleport to `run.z = 1300`, move the character root to match). Then pause with `document.getElementById('pause').click()`, hide the pause banner (`for (const e of document.querySelectorAll('*')) if (!e.children.length && /^Paused/.test(e.textContent.trim())) e.style.visibility = 'hidden'`), and set the camera by hand for a side view (`engine.camera.position.set(run.x + 3.6, 1.1, run.z); engine.camera.lookAt(run.x, 0.95, run.z)`) and a front view (`run.x + 0.4, 1.3, run.z + 3.4` looking at `run.x, 0.9, run.z`), screenshot each. Expect: the body a solid capsule, the hands fore and aft, the feet stepping, no stretching anywhere. Also one frame mid-jump and one mid-slide: limbs still, the body squashed on the slide.

- [ ] **Step 6: Build, ledger, commit**

Run: `npm run build`
Expected: `✓ built`.

```bash
git add content/characters/milkshake.js test/content.test.js docs/specs/2026-10-08-v4-ledger.md
git commit -m "feat: Milkshake runs on six bones skinned from the shipped mesh at load, arms and feet swinging with the stride (FB-1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Docs, the manual pass, tuning, the ledger, the PR question

**Files:**
- Modify: `CONTRIBUTING.md:57` (the `curve` row)
- Modify: `docs/specs/style-sheet.md` (append a v4 note)
- Modify: `docs/specs/2026-10-08-v4-ledger.md`
- Maybe modify: `content/characters/milkshake.js` (`LEG_SWING`, `ARM_SWING`, `HEAD_SWING`) if the pane says so

**Interfaces:** none new.

- [ ] **Step 1: CONTRIBUTING.** Replace the `curve` row (line 57) with

```markdown
| `curve` | optional, level or section: `{ "turn": -1..1, "hill": -1..1 }` (positive turn bends to the right, negative hill is a dip) or `"random"` (a new pick every 240 m). A turn or hill is anchored to its section: the road runs straight to the section's start line, bends beyond it, and is straight again at its end line; nothing bends inside 20 m of Milkshake; a finite level's last 120 m are straight; at most four bending stretches are drawn inside 200 m |
```

- [ ] **Step 2: Style sheet note.** Append to `docs/specs/style-sheet.md`, after the v3 boards paragraph:

```markdown
**2026-10-08, v4 boards.** Two boards were added for the second playtest response and approved by Caedon the day they
were drawn: 13 Turns you can see coming (the bend anchored to the street, seen from above) · 14 Obstacles you can read
(barrier, beam and taxi, today beside proposed, at one scale with Milkshake). The eyebrows now read "of 14". The build that
follows them is `2026-10-08-milkshake-runner-plan-v4.md`. Snapshot, not a contract.
```

- [ ] **Step 3: The manual pass.** Dev server on 5175, the pane, the rAF shim, `graceT = 1e9`. Capture, with the `computer` screenshot tool, and send to Caedon with `SendUserFile`:
  1. Level 1 at 30 m, 150 m and 340 m: the corner ahead, into the bend, straight at the end line (Task 2's frames if still good).
  2. Level 1 at 380 m: the dip at 400 m from before its crest; at 1000 m: the bridge hill at 1080 ahead.
  3. Endless at 500 m and 1500 m: random stretches, nothing jumps between frames (take two frames 0.5 s apart at each and compare by eye).
  4. The barrier, the beam and the taxi from the game camera, each with Milkshake 20 m short of it (Task 3's frames if still good).
  5. Milkshake from the game camera at 12 and 24 m/s, the side and the front (Task 4's frames), one jump, one slide.
  6. The Broadway turn into level 2 and the Garden ending: a straight street under both (`run.z = level.length_m - 150`, then let it run).
  7. Review Focus 4: rename `public/milkshake.glb` to `public/milkshake.glb.off`, reload, see the shape cow run and the console warn once; rename it back.
  Check the console for shader errors after every scene change; check `?fixtures` plays Canal Street Dash with the arch and the curve.

- [ ] **Step 4: Tune.** If the arms or feet read too small or too big from the game camera at 24 m/s, change `LEG_SWING` / `ARM_SWING` / `HEAD_SWING` in the module, reload, look again, and record the final values in the ledger as a Ruling. The bend knobs stay unless a frame shows a problem (record any change the same way).

- [ ] **Step 5: Ledger.** Fill the table (Tasks 1–5, states, commits, test counts, frames sent), the Rulings from the build, and the Deferred list (anything noticed and not fixed). Note the sibling minors branch overlap for the merge (`gfx.bendable` chaining and `customProgramCacheKey`; `curveAt`'s `+ 0` is moot now that `curveAt` is gone; the puff lines in the character module are untouched by v4).

- [ ] **Step 6: Build and commit**

Run: `npm test && npm run build`
Expected: 84 pass, `✓ built`.

```bash
git add CONTRIBUTING.md docs/specs/style-sheet.md docs/specs/2026-10-08-v4-ledger.md content/characters/milkshake.js
git commit -m "docs: CONTRIBUTING says the bend is anchored; style sheet notes boards 13 and 14; v4 ledger and manual pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 7: Ask.** Report to Caedon with the frames, every Ruling and every Deferred item, then ask for a yes to push `feat/v4-feedback` and open a PR onto `feat/v3-feedback` (stacked under PR #2) or, if he prefers, to wait for PR #2 to merge and open it onto `feat/v1`. Stop until he answers. The PR body lists FB-6, FB-7, FB-8 and the character, the boards, the test count, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review (done 2026-10-08 while writing)

- **Spec coverage:** §1 segments → Task 1; §1 shader, twin, world hand-off, deletions → Task 2; §2 the three modules and the box test → Task 3; §3 bones, weights, motion, failure path → Task 4 (the failure path by the existing `catch`, checked by hand in Task 5 step 3.7); level schema row in CONTRIBUTING, style sheet note, ledger, manual pass, PR question → Task 5. Decisions table: option A only, no chevrons, no credits — nothing in the plan spends or installs anything.
- **Type consistency:** `curveSegments(norm, fromZ, toZ, seed)` returns `{ from, to, turn, hill }` in Tasks 1 and 2; `setBend({ origin, segments })` and `bendOffset(z)` → `{ x, y }` in Task 2's gfx, world and tests; `bendSegments.value[i]` is a `Vector4` `(from, to, kx, ky)` everywhere; `skinWeights(y, z, K = SKIN)` returns six numbers in the order `[hips, head, armL, armR, legL, legR]` in Task 4's code and test; `limbAxis` is `'x'` for the shape cow and `'z'` for the bones.
- **Test counts** are expectations, not contracts: 81 at the start, +1 (T1) +0 (T2: −1 `curveAt`, +1 `bendOffset`) +1 (T3) +1 (T4) = 84.
- **Review Focus:** 1 and 5 pinned in Task 2's `bendOffset` test; 2 and 3 in Task 1's `curveSegments` test; 4 by hand in Task 5.
- **Placeholder scan:** every code step carries its code; the manual pass lists its frames; no "similar to", no "add handling".

## Addendum (2026-10-09, after the build)

> Agent-drafted by Fable on 2026-10-09 and pending Caedon's approval; the frontmatter's `human-approved` covers the plan as
> executed and confirmed at the close-out, not this note. Point-in-time snapshot written against `feat/v4-feedback` after
> 3950926 (92 tests); the code is the truth.

The plan ran as written (ledger table, Tasks 1–5, 84 tests) and the landed code then moved in four places: the fix pass of
2026-10-08 and the live tuning of 2026-10-09, each by Caedon's decision and under a test, recorded in the ledger's Fix pass and
Live tuning sections and stated against the spec in the design spec's addendum of the same date. Where a fenced code block
above differs from the file, the file is right:

- Task 2, `src/gfx.js`: `s = max(uBendStart, from − BEND_LEAD)` with `BEND_LEAD` = 40 m, in the GLSL and in `bendOffset`
  (3950926; spec addendum 1).
- Task 2, `src/world.js`: `curveSegments(norm, run.z, builtTo, seed)`, not `run.z + AHEAD` (62ee1ea; spec addendum 2).
- Task 1, `src/generator.js`: `push` extends the last stretch when the next one touches it with the same `turn` and `hill`,
  `"random"` picks included, so the step's assertion that every random stretch is exactly 240 m reads "cut on a 240 m line, a
  multiple of 240 m long" (d9679b5; spec addendum 3).
- Task 4, `content/characters/milkshake.js`: the skinning, the toon swap, the yaw and the fit run inside the exported
  `fitModel(THREE, scene, def)`, assigned to `createView`'s state in one statement and tested in Node; the `SkinnedMesh` call
  says it drops the node's 19.5° yaw on purpose (b509fe0; spec addendum 4).

The suite is 92: 84 at Task 5, 88 after the rebase onto 4ecd1a7 (the minors' tests came with it), 92 after the fix pass,
unchanged by the tuning.
