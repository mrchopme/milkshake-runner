---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner Implementation Plan v2 (modular)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, browser-playable 3D lane runner where every aspect (obstacles, pickups, themes, characters, endings, rules, levels) is a replaceable module or a data file, so the community can extend it without touching the engine. Levels 1 and 2 ship in-house and end at the generic arena cutscene; endless mode unlocks after.

**Architecture:**
- **Engine (`src/`)**: loop, camera, lights, streaming, input, collision maths, saving, screens, validation, registry. Knows no content ids except the defaults `jug` and `milkshake` and whatever `levels/campaign.json` names.
- **Content (`content/`)**: one-file ES modules with a default export `{ kind, id, ...metadata, hooks }`. Built-ins and community modules register the same way through `import.meta.glob`. Modules never import `three` at the top level; they get `gfx` helpers at call time, so Node can import them for tests.
- **Levels (`levels/*.json`)**: data only. They select content by id, set rule parameters, and compose `sections` and `placements`. One `validateAll()` runs in the browser and in CI.
- Pure modules (`registry`, `validate`, `rules`, `generator`, `campaign`, `save`, `input.classifySwipe`) import neither `three` nor the DOM; `node --test` covers them.

**Tech Stack:** Node 22, Vite (dev), three (runtime), `node:test`, GitHub Actions, GitHub Pages.

**Spec:** [2026-10-07-milkshake-runner-design-v2.md](2026-10-07-milkshake-runner-design-v2.md). It supersedes the 2026-10-02 spec and plan, which stay in this folder as dated snapshots. The Codex review that motivated v2 is [2026-10-07-codex-modularity-review.md](2026-10-07-codex-modularity-review.md).

## Global Constraints

- Repo: `mrchopme/milkshake-runner`, local path `/Users/cmgibson/IDE Files/milkshake-runner`. Pages URL `https://mrchopme.github.io/milkshake-runner/`. Vite `base: '/milkshake-runner/'`.
- Dependencies: `three` (runtime) and `vite` (dev) only. Plain JavaScript ES modules (`"type": "module"`). No TypeScript, no UI framework.
- **The boundary:** adding a level, obstacle, pickup, theme, character or ending must require no edit under `src/`. `test/fixtures.test.js` proves it; if a task cannot make a fixture work without touching `src/`, the task fixes `src/` once so the next contributor does not have to.
- Content modules: default export only; no `three` import at module top level (a character may `await import('three/addons/...')` inside `createView`); metadata must be valid in Node. Built-in ids are plain `a-z0-9-` and live at `content/<kind>s/<id>.js`; community ids are `handle/name` and live at `content/<kind>s/<handle>/<name>.js`.
- Level files are data. Strings that come from them render through `textContent`, never `innerHTML`. Glyphs from content modules are built with `createElementNS`, never `innerHTML`.
- Rules are **parameters** (`DEFAULT_RULES` / `RULE_RANGES`); there are no rule modules in v1. Lane count is 3.
- Knicks/MSG: generic stand-ins only (arena "THE GARDEN" in plain type, numbers 7, 12, 23, 31, 44, jerseys `#ef7d22` / `#2a5caa`). No real names, faces or logos.
- **No sound** in v1.
- Higgsfield credits: the only spend is one `generate_3d` call (Task 9), quoted and approved first.
- **Ask Caedon in chat for an explicit yes before each outward action:** creating the public repo, every `git push`, enabling Pages, opening a PR, downloading the generated GLB or a font file, spending credits.
- Defaults from the spec: lanes 2.5 m apart, lane change 150 ms, speed 12 → 20 m/s, endless cap 28 m/s, magnet 8 s, shield until hit, 2x 10 s, about 1 pickup in 40 is a power-up. A row never blocks all three lanes unless one of them can be jumped or slid **under the level's rules**.
- The Paper style sheet (Task 0) is the art direction; Tasks 6, 8 and 9 follow it.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. **Tab backgrounded or phone locked mid-run.** The game pauses, and on return there is no giant time-step teleport. `step` clamps dt (Task 4 test), `visibilitychange` pauses (Task 6, manual check in Task 11).
2. **Mashing input.** Left at lane 0, jump while airborne, slide mid-jump: lane stays 0–2, no double jump, a slide in the air fast-falls. Task 4 tests.
3. **Private browsing / blocked or corrupt storage.** The game plays; progress just is not kept. Task 7 tests.
4. **One bad community file.** A level that fails validation is listed as disabled with its first error and every other level still plays; a content module with bad metadata fails the build in CI, and in the browser the registry error is shown without hiding the shipped game. Task 7 test (`loadLevels` order excludes invalid levels) and Task 2 test (registry reports every problem at once).
5. **A content hook that throws at run time.** `createView` or `run` throwing ends that run with a "this level broke" result and a usable screen, never a frozen canvas. `safeCall` test in Task 2; manual check in Task 11 with a fixture that throws.

---

### Task 0: Paper style sheet (GATE: Caedon approves before Task 1)

Done on 2026-10-05 under plan v1: Paper file "Milkshake Runner — style sheet" (fileId `01M46QWM611CXK4WQSBTH6FJK3`), seven boards, palette as Paper colour tokens. Approval is still pending. Nothing in v2 changes the art direction; v2 only changes how the game is structured.

- [ ] **Step 1: Get Caedon's approval or edits.** If he edits swatches in Paper, re-read the tokens with `get_tokens` (fileId above, `types: ["color"]`) and use those values in Task 2's `src/palette.js` and Task 9.
- [ ] **Step 2: Paste the final palette table into chat once approved.** Do not start Task 1 without the approval.

---

### Task 1: Repo, Vite, engine, Pages deploy (GATE: public repo)

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `index.html`, `src/engine.js`, `src/main.js` (temporary), `.github/workflows/ci.yml`, `docs/specs/` (copies of the v2 spec, this plan, the Codex review, and the v1 spec and plan as snapshots), `.claude/launch.json` (gitignored)

**Interfaces:**
- Produces: `createEngine(canvas) → { scene, camera, renderer, setSky(theme), follow(run), render() }` where `theme` is `{ sky: '#rrggbb', fog: 0..1 }` and `run` has `{ x, y, z }`.

- [ ] **Step 1: Ask Caedon for an explicit yes** to create public repo `mrchopme/milkshake-runner`, push `main`, and enable GitHub Pages (Actions source). Do not continue without it.

- [ ] **Step 2: Create the folder and switch the session to it**

```bash
mkdir -p "/Users/cmgibson/IDE Files/milkshake-runner" && cd "/Users/cmgibson/IDE Files/milkshake-runner" && git init -b main && node --version
```
Expected: Node `v22.x` or newer. If it is older, stop and tell Caedon. Then switch the session's directory to this folder with `mcp__ccd_directory__change_directory` (or `request_directory` if the folder has not been added to the session).

- [ ] **Step 3: Write `package.json`, then install**

```json
{
  "name": "milkshake-runner",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test test/*.test.js"
  }
}
```
```bash
npm install three && npm install -D vite
```

- [ ] **Step 4: Write `vite.config.js`, `.gitignore`, `.claude/launch.json`**

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({ base: '/milkshake-runner/' });
```
```gitignore
node_modules
dist
.claude
```
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "milkshake-runner", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"], "port": 5173 }
  ]
}
```

- [ ] **Step 5: Write `src/engine.js`**

```js
import * as THREE from 'three';

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  // Sun from above, behind the camera and a little to the right, so faces toward the camera are lit
  // and side faces take the one shade tone the style sheet shows.
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#55556a', 1.2));

  const render = () => renderer.render(scene, camera);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 60; // portrait needs a wider view to see all 3 lanes
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer, render,
    setSky(theme) {
      const sky = new THREE.Color(theme.sky);
      scene.background = sky;
      const far = 260 - theme.fog * 160;
      scene.fog = new THREE.Fog(sky, far * 0.3, far);
    },
    follow(run) {
      camera.position.set(run.x * 0.6, 3.6 + run.y * 0.3, run.z - 6.5);
      camera.lookAt(run.x * 0.8, 1.2, run.z + 12);
      sun.position.set(run.x - 6, 16, run.z - 12);
      sun.target.position.set(run.x, 0, run.z);
    },
  };
}
```
The camera looks down +z, so screen-right is −x; `rules.laneX` (Task 4) maps lane 0 to +x (screen-left).

- [ ] **Step 6: Write a minimal `index.html` and a temporary `src/main.js`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Milkshake Runner</title>
  <style>html,body{margin:0;height:100%;overflow:hidden}#game{position:fixed;inset:0;width:100%;height:100%;display:block}</style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```
```js
// src/main.js (temporary: replaced in Task 6)
import * as THREE from 'three';
import { createEngine } from './engine.js';

const engine = createEngine(document.getElementById('game'));
engine.setSky({ sky: '#9fd3f5', fog: 0.3 });
const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: '#b9a6e8' }));
cube.position.set(0, 1, 4);
engine.scene.add(cube);
engine.follow({ x: 0, y: 0, z: 0 });
(function loop() { cube.rotation.y += 0.02; engine.render(); requestAnimationFrame(loop); })();
```

- [ ] **Step 7: Run it.** `preview_start({ name: "milkshake-runner" })`, then open `http://localhost:5173/milkshake-runner/`. Expected: a sky-blue page with a spinning lavender cube and no console errors (`read_console_messages` with `onlyErrors: true`).

- [ ] **Step 8: Write `.github/workflows/ci.yml`** (the test step is added in Task 3)

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - if: github.event_name == 'push'
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.event_name == 'push'
    needs: check
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 9: Copy the design documents into the repo**

```bash
mkdir -p docs/specs && cp "/Users/cmgibson/IDE Files/shade-os/.claude/worktrees/gracious-benz-570aa5/docs/projects/milkshake-teaser/"{2026-10-07-milkshake-runner-design-v2,2026-10-07-milkshake-runner-plan-v2,2026-10-07-codex-modularity-review,2026-10-02-milkshake-runner-design,2026-10-02-milkshake-runner-plan}.md docs/specs/
```
In the copied v1 spec, change the `[README.md](README.md)` link to plain text "the Milkshake teaser README in shade-os". Ask Caedon before adding any board from the Paper sheet that shows Max's art or teaser frames to this public repo; a palette table in `docs/specs/style-sheet.md` (Task 9) is fine.

- [ ] **Step 10: Commit, create the repo, push, enable Pages** (Step 1 approval covers this)

```bash
git add -A && git commit -m "chore: scaffold Vite + Three.js engine and Pages deploy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
gh repo create mrchopme/milkshake-runner --public --source . --push
gh api -X POST repos/mrchopme/milkshake-runner/pages -f build_type=workflow
gh run watch --exit-status $(gh run list -L1 --json databaseId -q '.[0].databaseId')
```
Expected: the run passes and `https://mrchopme.github.io/milkshake-runner/` shows the spinning cube. If the Pages POST happened after the first run, `gh run rerun` it.

- [ ] **Step 11: Create the work branch.** All later tasks commit here; the PR goes up in Task 11.

```bash
git switch -c feat/v1
```

---

### Task 2: Content registry and the built-in modules

**Files:**
- Create: `src/registry.js`, `src/palette.js`, `content/obstacles/{taxi,barrier_low,scaffold_beam,hot_dog_cart,manhole_steam,pigeons,delivery_bike}.js`, `content/pickups/{jug,magnet,shield,x2}.js`, `content/themes/{downtown,midtown,uptown}.js`, `content/characters/milkshake.js`, `content/endings/{finish,transition,arena_five}.js`, `test/helpers.js`, `test/registry.test.js`

**Interfaces:**
- Produces:
  - `registry.js`: `checkModule(module) → string[]`, `buildRegistry(entries: {path, module}[]) → { obstacle, pickup, theme, character, ending }` (each `{ id: module }`; throws listing every problem), `loadRegistry({ fixtures }) → registry` (browser, via `import.meta.glob`), `safeCall(label, fn, fallback)`, `KIND_DIR`.
  - `palette.js`: `PALETTE` with keys `cowWhite, spot, lavender, eye, road, sidewalk, lane, dark, taxi, hazard, metal, glass, pigeon, rider, jug, magnet, shield, x2, arena, plaza, jerseyA, jerseyB`.
  - Module contracts (metadata checked by `checkModule`):
    - obstacle: `avoid` ∈ lane|jump|slide|timing, `box {w,h,d, y?}`, `cycle {period,on}` iff timing, `moves?`, `createView(gfx, o) → { object, update?(o, run, dt, active), dispose?() }`.
    - pickup: `color`, `duration` (seconds | 'untilHit' | omitted), `effect? {reach?, multiplier?, shield?}`, `value?`, `glyph?` (28×28 SVG path) or `label?` (≤3 chars), `createView?(gfx) → { object, update?(p, run, dt) }`.
    - theme: `sky`, `fog`, `buildings {colors[], minH, maxH}`, `createChunk?(gfx, { z0, length, lanes, rng, theme }) → Object3D`.
    - character: `height`, `width`, `model` (file in `public/` or null), `yaw`, `async createView(gfx) → { object, update(run), pose(time, state), dispose() }`.
    - ending: `params { name: { type: string|number|level, max?, min?, default? } }`, `streetAfter?` (metres of street built past the finish line; default 200, the arena uses 0), `async run(ctx) → { next?, carry? }`.
    - pickup `stroke?: true` means the glyph is a stroked path rather than a filled one.
  - `test/helpers.js`: `discover(contentDir) → Promise<{path, module}[]>` for Node.
  - The views written here are deliberately plain boxes; Task 6 replaces them with the style-sheet drawings. Task 8 replaces the endings' bodies with the real scenes.

- [ ] **Step 1: Write `src/palette.js`** (values from the Paper tokens as approved in Task 0; if Caedon edited any swatch, use the edited value)

```js
// Design tokens from the Paper style sheet. Content modules reach these as gfx.palette.
export const PALETTE = {
  cowWhite: '#ffffff', spot: '#c8c8d0', lavender: '#b9a6e8', eye: '#1d1b26',
  road: '#5a5c72', sidewalk: '#a3a0ab', lane: '#f2f2f2', dark: '#262733',
  taxi: '#f7c518', hazard: '#ff7a1a', metal: '#8a8f99', glass: '#8ccfe0', pigeon: '#d9dbe6', rider: '#e5484d',
  jug: '#ffffff', magnet: '#ff4fa3', shield: '#4dc3ff', x2: '#8b5cf6',
  arena: '#2b2e3a', plaza: '#d9d4cc', jerseyA: '#ef7d22', jerseyB: '#2a5caa',
};
```

- [ ] **Step 2: Write `test/helpers.js`**

```js
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Walks a content directory the way Vite's import.meta.glob does, so tests build the same registry.
export async function discover(root, dir = root) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) entries.push(...(await discover(root, p)));
    else if (name.endsWith('.js')) {
      const rel = relative(root, p).split('\\').join('/');
      entries.push({ path: `content/${rel}`, module: (await import(pathToFileURL(p))).default });
    }
  }
  return entries;
}
```

- [ ] **Step 3: Write the failing test `test/registry.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistry, checkModule, safeCall } from '../src/registry.js';
import { discover } from './helpers.js';

const CONTENT = new URL('../content/', import.meta.url).pathname;

test('every shipped content module registers', async () => {
  const reg = buildRegistry(await discover(CONTENT));
  assert.deepEqual(Object.keys(reg.obstacle).sort(), ['barrier_low', 'delivery_bike', 'hot_dog_cart', 'manhole_steam', 'pigeons', 'scaffold_beam', 'taxi']);
  assert.deepEqual(Object.keys(reg.pickup).sort(), ['jug', 'magnet', 'shield', 'x2']);
  assert.deepEqual(Object.keys(reg.theme).sort(), ['downtown', 'midtown', 'uptown']);
  assert.deepEqual(Object.keys(reg.character), ['milkshake']);
  assert.deepEqual(Object.keys(reg.ending).sort(), ['arena_five', 'finish', 'transition']);
});

const ok = { kind: 'obstacle', id: 'ari/rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView() {} };
const at = (path, module) => [{ path, module }];

test('community modules are namespaced and saved at their id', () => {
  assert.doesNotThrow(() => buildRegistry(at('content/obstacles/ari/rock.js', ok)));
  assert.throws(() => buildRegistry(at('content/obstacles/ari/rock.js', { ...ok, id: 'rock' })), /namespaced/);
  assert.throws(() => buildRegistry(at('content/obstacles/ari/stone.js', ok)), /saved as/);
  assert.throws(() => buildRegistry(at('content/pickups/ari/rock.js', ok)), /folder/);
});

test('duplicate ids are rejected, not overridden', () => {
  assert.throws(() => buildRegistry([...at('content/obstacles/ari/rock.js', ok), ...at('content/obstacles/ari/rock.js', { ...ok, box: { w: 2, h: 2, d: 2 } })]), /duplicate/);
});

test('every problem is reported at once', () => {
  assert.throws(() => buildRegistry([...at('content/obstacles/ari/rock.js', { ...ok, avoid: 'fly' }), ...at('content/pickups/ari/gem.js', { kind: 'pickup', id: 'ari/gem' })]), /avoid[\s\S]*gem/);
});

test('metadata is checked per kind', () => {
  assert.match(checkModule({ ...ok, avoid: 'fly' }).join(), /avoid/);
  assert.match(checkModule({ ...ok, box: { w: 1 } }).join(), /box/);
  assert.match(checkModule({ ...ok, avoid: 'timing' }).join(), /cycle/);
  assert.match(checkModule({ ...ok, createView: 'nope' }).join(), /createView/);
  assert.match(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff', effect: { teleport: true }, duration: 3 }).join(), /reach, multiplier, shield/);
  assert.match(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff', effect: { shield: true }, duration: 3 }).join(), /untilHit/);
  assert.match(checkModule({ kind: 'pickup', id: 'ari/gem', color: '#ffffff' }).join(), /value or effect/);
  assert.match(checkModule({ kind: 'theme', id: 'ari/sea', sky: 'blue', fog: 0.2, buildings: { colors: ['#ffffff'], minH: 5, maxH: 10 } }).join(), /sky/);
  assert.match(checkModule({ kind: 'character', id: 'ari/bot', height: 2, width: 1 }).join(), /createView/);
  assert.match(checkModule({ kind: 'ending', id: 'ari/wave', params: { n: { type: 'bool' } }, run() {} }).join(), /type/);
  assert.match(checkModule({ kind: 'spell', id: 'x' }).join(), /kind/);
  assert.equal(checkModule(ok).length, 0);
});

test('safeCall contains a throwing hook', () => {
  assert.equal(safeCall('test hook', () => { throw new Error('boom'); }, 42), 42);
  assert.equal(safeCall('test hook', () => 7, 42), 7);
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../src/registry.js'`.

- [ ] **Step 5: Write `src/registry.js`**

```js
// The one place that knows what a content module must look like. Pure: no three, no DOM.
export const KIND_DIR = { obstacle: 'obstacles', pickup: 'pickups', theme: 'themes', character: 'characters', ending: 'endings' };
const KINDS = Object.keys(KIND_DIR);
const PLAIN = /^[a-z0-9-]+$/, NAMESPACED = /^[a-z0-9-]+\/[a-z0-9-]+$/, HEX = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const fn = (v) => typeof v === 'function';

const CHECKS = {
  obstacle(m) {
    const e = [];
    if (!['lane', 'jump', 'slide', 'timing'].includes(m.avoid)) e.push('avoid must be lane, jump, slide or timing');
    const b = m.box;
    if (!isObj(b) || !num(b.w, 0.1, 10) || !num(b.h, 0.1, 10) || !num(b.d, 0.1, 20) || (b.y !== undefined && !num(b.y, 0, 5))) e.push('box needs w, h, d in metres (optional y = bottom)');
    const needsCycle = m.avoid === 'timing';
    const cycleOk = isObj(m.cycle) && num(m.cycle.period, 0.2, 10) && num(m.cycle.on, 0.05, m.cycle.period);
    if (needsCycle ? !cycleOk : m.cycle !== undefined) e.push('cycle {period, on} is required for timing obstacles and not allowed otherwise');
    if (m.moves !== undefined && typeof m.moves !== 'boolean') e.push('moves must be true or false');
    if (!fn(m.createView)) e.push('createView(gfx) is required');
    return e;
  },
  pickup(m) {
    const e = [];
    if (!HEX.test(m.color ?? '')) e.push('color must be a hex colour like "#ff4fa3"');
    if (!(m.duration === undefined || m.duration === 'untilHit' || num(m.duration, 0.5, 60))) e.push("duration must be seconds (0.5-60), 'untilHit' or omitted");
    if (m.value !== undefined && !(Number.isInteger(m.value) && m.value > 0)) e.push('value must be a whole number of jugs above 0');
    if (m.effect !== undefined) {
      if (!isObj(m.effect) || Object.keys(m.effect).some((k) => !['reach', 'multiplier', 'shield'].includes(k))) e.push('effect may only use reach, multiplier, shield');
      else {
        if (m.effect.reach !== undefined && !num(m.effect.reach, 1, 50)) e.push('effect.reach must be 1-50 metres');
        if (m.effect.multiplier !== undefined && !num(m.effect.multiplier, 1, 10)) e.push('effect.multiplier must be 1-10');
        if (m.effect.shield !== undefined && (m.effect.shield !== true || m.duration !== 'untilHit')) e.push("effect.shield must be true, with duration 'untilHit'");
        if (m.duration === undefined) e.push('an effect needs a duration');
      }
    }
    if (m.value === undefined && m.effect === undefined) e.push('a pickup needs value or effect');
    if (m.glyph !== undefined && typeof m.glyph !== 'string') e.push('glyph must be an SVG path string (28x28 box)');
    if (m.stroke !== undefined && typeof m.stroke !== 'boolean') e.push('stroke must be true or false');
    if (m.label !== undefined && !(typeof m.label === 'string' && m.label.length >= 1 && m.label.length <= 3)) e.push('label must be 1-3 characters');
    if (m.createView !== undefined && !fn(m.createView)) e.push('createView must be a function');
    return e;
  },
  theme(m) {
    const e = [];
    if (!HEX.test(m.sky ?? '')) e.push('sky must be a hex colour');
    if (!num(m.fog, 0, 1)) e.push('fog must be 0-1');
    const b = m.buildings;
    if (!isObj(b) || !Array.isArray(b.colors) || !b.colors.length || !b.colors.every((c) => HEX.test(c)) || !num(b.minH, 1, 200) || !num(b.maxH, b.minH, 300)) e.push('buildings needs colors[] (hex), minH, maxH');
    if (m.createChunk !== undefined && !fn(m.createChunk)) e.push('createChunk must be a function');
    return e;
  },
  character(m) {
    const e = [];
    if (!num(m.height, 0.5, 4) || !num(m.width, 0.3, 3)) e.push('height and width in metres are required');
    if (!(m.model == null || typeof m.model === 'string')) e.push('model must be a file name in public/ or null');
    if (m.yaw !== undefined && typeof m.yaw !== 'number') e.push('yaw must be a number in radians');
    if (!fn(m.createView)) e.push('createView(gfx) is required');
    return e;
  },
  ending(m) {
    const e = [];
    const p = m.params ?? {};
    if (!isObj(p)) e.push('params must be an object of {name: {type}}');
    else for (const [k, s] of Object.entries(p)) if (!isObj(s) || !['string', 'number', 'level'].includes(s.type)) e.push(`params.${k} needs a type of string, number or level`);
    if (m.streetAfter !== undefined && !num(m.streetAfter, 0, 500)) e.push('streetAfter must be 0-500 metres of street past the finish line');
    if (!fn(m.run)) e.push('run(ctx) is required');
    return e;
  },
};

export function checkModule(m) {
  if (!isObj(m)) return ['the default export must be an object'];
  if (!KINDS.includes(m.kind)) return [`kind must be one of ${KINDS.join(', ')}`];
  if (typeof m.id !== 'string' || !(PLAIN.test(m.id) || NAMESPACED.test(m.id))) return ['id must be a-z0-9- (built-in) or handle/name (community)'];
  return CHECKS[m.kind](m);
}

// entries: [{ path: 'content/<kind>s/...js', module }]. Pure. Throws one error that lists every problem.
export function buildRegistry(entries) {
  const reg = Object.fromEntries(KINDS.map((k) => [k, {}]));
  const problems = [];
  for (const { path, module: m } of entries) {
    const errs = checkModule(m);
    const label = isObj(m) && m.id ? `${m.kind} "${m.id}" (${path})` : path;
    if (errs.length) { problems.push(`${label}: ${errs.join('; ')}`); continue; }
    const dir = `content/${KIND_DIR[m.kind]}/`;
    if (!path.startsWith(dir)) problems.push(`${label}: is in the wrong folder, expected ${dir}`);
    const builtin = new RegExp(`^${dir}[a-z0-9_-]+\\.js$`).test(path);
    if (!builtin) {
      if (!NAMESPACED.test(m.id)) problems.push(`${label}: community ids must be namespaced like "yourhandle/${m.id}"`);
      else if (path !== `${dir}${m.id}.js`) problems.push(`${label}: must be saved as ${dir}${m.id}.js`);
    }
    if (reg[m.kind][m.id]) problems.push(`${label}: duplicate id`);
    else reg[m.kind][m.id] = m;
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return reg;
}

// Browser loader. `fixtures` adds test/fixtures/content for the manual pass (dev only, ?fixtures in the URL).
export function loadRegistry({ fixtures = false } = {}) {
  const files = import.meta.glob('../content/**/*.js', { eager: true, import: 'default' });
  const entries = Object.entries(files).map(([p, module]) => ({ path: p.replace(/^(\.\.\/)+/, ''), module }));
  if (fixtures) {
    const extra = import.meta.glob('../test/fixtures/content/**/*.js', { eager: true, import: 'default' });
    for (const [p, module] of Object.entries(extra)) entries.push({ path: p.replace(/^.*\/fixtures\//, ''), module });
  }
  return buildRegistry(entries);
}

// A hook written by someone else may throw; the game must not freeze because of it.
export function safeCall(label, fn, fallback) {
  try { return fn(); } catch (err) { console.warn(`${label} failed:`, err); return fallback; }
}
```

- [ ] **Step 6: Write the seven obstacle modules.** Plain boxes for now (Task 6 draws them); the metadata is final.

```js
// content/obstacles/taxi.js
export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 1.5, d: 4.0 },
  createView(gfx) { return { object: gfx.box(2.0, 1.5, 4.0, gfx.palette.taxi) }; },
};
```
```js
// content/obstacles/barrier_low.js
export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  createView(gfx) { return { object: gfx.box(2.2, 0.9, 0.4, gfx.palette.hazard) }; },
};
```
```js
// content/obstacles/scaffold_beam.js
export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  createView(gfx) { return { object: gfx.box(2.4, 0.4, 0.6, gfx.palette.hazard, 0, 1.4) }; },
};
```
```js
// content/obstacles/hot_dog_cart.js
export default {
  kind: 'obstacle', id: 'hot_dog_cart', avoid: 'jump', box: { w: 1.8, h: 1.0, d: 1.6 },
  createView(gfx) { return { object: gfx.box(1.8, 1.0, 1.6, gfx.palette.lane) }; },
};
```
```js
// content/obstacles/manhole_steam.js
export default {
  kind: 'obstacle', id: 'manhole_steam', avoid: 'timing', box: { w: 2.0, h: 2.5, d: 1.0 }, cycle: { period: 1.5, on: 0.5 },
  createView(gfx) {
    const plume = gfx.cyl(0.8, 0.5, 2.5, '#ffffff', 0, 1.25);
    return { object: gfx.group(gfx.cyl(1, 1, 0.05, gfx.palette.dark, 0, 0.03), plume), update(o, run, dt, active) { plume.visible = active; } };
  },
};
```
```js
// content/obstacles/pigeons.js
export default {
  kind: 'obstacle', id: 'pigeons', avoid: 'slide', box: { w: 2.4, h: 0.6, d: 1.0, y: 1.1 },
  createView(gfx) { return { object: gfx.group(...[-0.9, -0.4, 0.1, 0.5, 0.95].map((x) => gfx.sphere(0.18, gfx.palette.pigeon, x, 1.3))) }; },
};
```
```js
// content/obstacles/delivery_bike.js
export default {
  kind: 'obstacle', id: 'delivery_bike', avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true,
  createView(gfx) { return { object: gfx.group(gfx.box(0.3, 0.7, 1.8, gfx.palette.dark, 0, 0.35), gfx.capsule(0.28, 0.5, gfx.palette.rider, 0, 1.05)) }; },
};
```

- [ ] **Step 7: Write the four pickup modules**

```js
// content/pickups/jug.js
export default {
  kind: 'pickup', id: 'jug', color: '#ffffff', value: 1,
  glyph: 'M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z',
  createView(gfx) { return { object: gfx.group(gfx.cyl(0.25, 0.28, 0.5, gfx.palette.jug, 0, 0.8), gfx.cyl(0.12, 0.12, 0.15, gfx.palette.lavender, 0, 1.12)) }; },
};
```
```js
// content/pickups/magnet.js
export default {
  kind: 'pickup', id: 'magnet', color: '#ff4fa3', duration: 8, effect: { reach: 15 },
  glyph: 'M9.2,8 V14.6 a4.8,4.8 0 0 0 9.6,0 V8', stroke: true,
};
```
```js
// content/pickups/shield.js
export default {
  kind: 'pickup', id: 'shield', color: '#4dc3ff', duration: 'untilHit', effect: { shield: true },
  glyph: 'M14,6.5 L20.5,8.9 V14.2 C20.5,18.2 18,21.2 14,22.8 C10,21.2 7.5,18.2 7.5,14.2 V8.9 Z',
};
```
```js
// content/pickups/x2.js
export default {
  kind: 'pickup', id: 'x2', color: '#8b5cf6', duration: 10, effect: { multiplier: 2 }, label: '2×',
};
```
The magnet glyph is a stroked path, which is why it sets `stroke: true`; filled glyphs leave it out.

- [ ] **Step 8: Write the three theme modules**

```js
// content/themes/downtown.js
export default { kind: 'theme', id: 'downtown', sky: '#9fd3f5', fog: 0.3, buildings: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'], minH: 18, maxH: 70 } };
```
```js
// content/themes/midtown.js
export default { kind: 'theme', id: 'midtown', sky: '#f4b26a', fog: 0.4, buildings: { colors: ['#9aa7b8', '#6f7d8f', '#cfc6b4', '#b0855f'], minH: 30, maxH: 110 } };
```
```js
// content/themes/uptown.js
export default { kind: 'theme', id: 'uptown', sky: '#c98bd8', fog: 0.35, buildings: { colors: ['#b07a5a', '#c9a27e', '#8c5d47', '#d8c3a5'], minH: 12, maxH: 35 } };
```

- [ ] **Step 9: Write `content/characters/milkshake.js`** (metadata final; the shape-built body and GLB loading come in Task 6)

```js
export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: 0,
  async createView(gfx) {
    const object = gfx.group(gfx.box(0.66, 1.6, 0.5, gfx.palette.cowWhite, 0, 1.1));
    return { object, update(run) { object.position.set(run.x, run.y, run.z); }, pose() {}, dispose() {} };
  },
};
```

- [ ] **Step 10: Write the three ending modules** (bodies are banners for now; Task 8 replaces them with the scenes)

```js
// content/endings/finish.js
export default {
  kind: 'ending', id: 'finish',
  params: { text: { type: 'string', max: 40, default: 'FINISH!' } },
  async run(ctx) { await ctx.hud.banner(ctx.params.text, 1200); return {}; },
};
```
```js
// content/endings/transition.js
export default {
  kind: 'ending', id: 'transition',
  params: { next: { type: 'level' } },
  async run(ctx) { await ctx.hud.ring(); return { next: ctx.params.next, carry: true }; },
};
```
```js
// content/endings/arena_five.js
export default {
  kind: 'ending', id: 'arena_five', streetAfter: 0,
  params: { text: { type: 'string', max: 60, default: 'Season tip-off. Brought to you by Milkshake.' } },
  async run(ctx) { await ctx.hud.card(ctx.params.text, 3000); return {}; },
};
```

- [ ] **Step 11: Run the tests**

Run: `npm test`
Expected: PASS, 7 tests.

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat: content registry with the built-in obstacle, pickup, theme, character and ending modules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Level schema v2, validator, shipped levels, campaign, CI check

**Files:**
- Create: `src/validate.js`, `src/campaign.js`, `levels/index.json`, `levels/campaign.json`, `levels/01-broadway.json`, `levels/02-garden.json`, `levels/endless.json`, `test/validate.test.js`
- Modify: `.github/workflows/ci.yml` (add the test step)
- Depends on `src/rules.js` (`RULE_RANGES`, `resolveRules`) and `src/generator.js` (`passable`) from Tasks 4 and 5. Write the two small stubs below first; Tasks 4 and 5 replace them with the full modules and must keep these exports.

**Interfaces:**
- Produces:
  - `validate.js`: `validateLevel(level, { fileId, allIds, registry }) → string[]`, `validateAll(levels: {id: object}, index: string[], registry) → { [file]: string[] }` (empty object = valid), `validateCampaign(campaign, levelIds) → string[]`.
  - `campaign.js`: `isLocked(campaign, save, id)`, `completeLevel(save, id)`.
  - The level schema in the spec, enforced exactly (unknown keys rejected at every level).

- [ ] **Step 1: Write the stubs that Tasks 4 and 5 will replace**

```js
// src/rules.js (stub; Task 4 writes the real module and keeps these two exports)
export const DEFAULT_RULES = {
  laneWidth: 2.5, laneTime: 0.15, gravity: -30, jumpSpeed: 9, fastFall: -15, slideTime: 0.6, slideHeight: 0.8, grace: 1,
  speed: { start: 12, end: 20, cap: 28, ramp: 0.004 },
};
export const RULE_RANGES = {
  laneWidth: [1.5, 4], laneTime: [0.05, 0.5], gravity: [-60, -10], jumpSpeed: [5, 15], fastFall: [-40, -5], slideTime: [0.3, 2], slideHeight: [0.4, 1.5], grace: [0, 3],
  speed: { start: [4, 40], end: [4, 40], cap: [4, 60], ramp: [0, 0.05] },
};
export function resolveRules(overrides = {}) {
  return { ...DEFAULT_RULES, ...overrides, speed: { ...DEFAULT_RULES.speed, ...(overrides.speed ?? {}) } };
}
export const jumpHeight = (rules) => rules.jumpSpeed ** 2 / (2 * -rules.gravity);
```
```js
// src/generator.js (stub; Task 5 writes the real module and keeps this export)
import { jumpHeight } from './rules.js';
// Can the player get past this obstacle in its own lane under these rules?
export function passable(def, rules) {
  if (def.avoid === 'timing') return true;
  const bottom = def.box.y ?? 0;
  if (def.avoid === 'jump') return bottom === 0 && def.box.h <= jumpHeight(rules);
  if (def.avoid === 'slide') return bottom >= rules.slideHeight;
  return false;
}
```

- [ ] **Step 2: Write the level files and the campaign**

`levels/index.json`
```json
["01-broadway", "02-garden", "endless"]
```
`levels/campaign.json`
```json
{ "start": "01-broadway", "locked": { "02-garden": "01-broadway", "endless": "02-garden" } }
```
`levels/01-broadway.json`
```json
{
  "id": "01-broadway",
  "title": "Up Broadway",
  "author": "PulsePoint",
  "length_m": 1500,
  "theme": { "id": "downtown", "sky": "#9fd3f5", "fog": 0.3 },
  "obstacles": { "taxi": 3, "barrier_low": 3, "scaffold_beam": 2, "hot_dog_cart": 2, "manhole_steam": 1 },
  "density": { "start": 0.25, "end": 0.55 },
  "jugs": { "per_100m": 14, "powerups": ["magnet", "shield"] },
  "ending": { "id": "transition", "params": { "next": "02-garden" } }
}
```
`levels/02-garden.json`
```json
{
  "id": "02-garden",
  "title": "Road to the Garden",
  "author": "PulsePoint",
  "length_m": 1800,
  "theme": { "id": "midtown", "sky": "#f4b26a", "fog": 0.4 },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1, "manhole_steam": 1, "pigeons": 1, "delivery_bike": 1 },
  "density": { "start": 0.3, "end": 0.7 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] },
  "ending": { "id": "arena_five" }
}
```
`levels/endless.json`
```json
{
  "id": "endless",
  "title": "Endless Manhattan",
  "author": "PulsePoint",
  "length_m": null,
  "theme": { "id": "uptown", "sky": "#c98bd8", "fog": 0.35 },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1, "manhole_steam": 1, "pigeons": 1, "delivery_bike": 2 },
  "density": { "start": 0.4, "end": 0.8 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] }
}
```

- [ ] **Step 3: Write the failing test `test/validate.test.js`**

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, validateAll, validateCampaign } from '../src/validate.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from './helpers.js';

const dir = new URL('../levels/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
let registry;
before(async () => { registry = buildRegistry(await discover(new URL('../content/', import.meta.url).pathname)); });

const shipped = () => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'campaign.json'].includes(f)).map((f) => [f.slice(0, -5), read(f)]));

test('every shipped level and the campaign are valid', () => {
  const levels = shipped();
  assert.deepEqual(validateAll(levels, read('index.json'), registry), {});
  assert.deepEqual(validateCampaign(read('campaign.json'), Object.keys(levels)), []);
});

const good = {
  id: 'x', title: 'X', author: 'A', length_m: 600,
  theme: { id: 'downtown' }, obstacles: { taxi: 1, barrier_low: 1 }, density: { start: 0.3, end: 0.5 },
  jugs: { per_100m: 10, powerups: [] },
};
const errs = (patch) => validateLevel({ ...good, ...patch }, { fileId: 'x', allIds: ['x', 'y'], registry }).join(' | ');

test('a minimal level is valid', () => assert.equal(errs({}), ''));
test('rejects a non-object', () => assert.match(validateLevel([], { fileId: 'x', allIds: ['x'], registry }).join(), /JSON object/));
test('rejects unknown keys at every level', () => {
  assert.match(errs({ colour: 'red' }), /unknown key "colour"/);
  assert.match(errs({ theme: { id: 'downtown', road: '#000000' } }), /theme: unknown key "road"/);
  assert.match(errs({ density: { start: 0.3, end: 0.5, middle: 0.4 } }), /density: unknown key "middle"/);
});
test('ids must exist in the registry', () => {
  assert.match(errs({ obstacles: { tank: 1 } }), /unknown obstacle "tank"/);
  assert.match(errs({ theme: { id: 'forest' } }), /unknown theme "forest"/);
  assert.match(errs({ character: { id: 'robot' } }), /unknown character "robot"/);
  assert.match(errs({ jugs: { per_100m: 5, powerups: ['jetpack'] } }), /unknown pickup "jetpack"/);
  assert.match(errs({ jugs: { per_100m: 5, powerups: ['jug'] } }), /not a power-up/);
  assert.match(errs({ ending: { id: 'parade' } }), /unknown ending "parade"/);
});
test('numbers stay in range', () => {
  assert.match(errs({ length_m: 50 }), /100 to 10000/);
  assert.match(errs({ length_m: 20000 }), /100 to 10000/);
  assert.match(errs({ seed: 1.5 }), /seed/);
  assert.match(errs({ obstacles: { taxi: 0 } }), /above 0/);
  assert.match(errs({ theme: { id: 'downtown', sky: 'blue' } }), /hex/);
  assert.equal(errs({ density: { start: 0, end: 0 }, obstacles: {} }), '');
  assert.match(errs({ obstacles: {} }), /obstacles may be empty only/);
});
test('rules are known and in range', () => {
  assert.equal(errs({ rules: { gravity: -24, speed: { start: 10 } } }), '');
  assert.match(errs({ rules: { friction: 1 } }), /unknown rule "friction"/);
  assert.match(errs({ rules: { gravity: -5 } }), /gravity must be -60 to -10/);
  assert.match(errs({ rules: { speed: { warp: 1 } } }), /unknown rule "warp"/);
});
test('endings and their params', () => {
  assert.match(errs({ length_m: null, ending: { id: 'finish' } }), /cannot have an ending/);
  assert.match(errs({ ending: { id: 'transition' } }), /next/);
  assert.match(errs({ ending: { id: 'transition', params: { next: 'nope' } } }), /next/);
  assert.match(errs({ ending: { id: 'transition', params: { next: 'x' } } }), /itself/);
  assert.equal(errs({ ending: { id: 'transition', params: { next: 'y' } } }), '');
  assert.match(errs({ ending: { id: 'finish', params: { colour: 'red' } } }), /unknown param "colour"/);
  assert.match(errs({ ending: { id: 'finish', params: { text: 'x'.repeat(41) } } }), /at most 40/);
});
test('sections and placements', () => {
  const s = (sections) => errs({ sections });
  assert.equal(s([{ from_m: 0, to_m: 100, density: { start: 0, end: 0 } }, { from_m: 100, to_m: 200, generation: false, placements: [{ at_m: 150, lane: 1, kind: 'obstacle', id: 'barrier_low' }] }]), '');
  assert.match(s([{ from_m: 100, to_m: 50 }]), /from_m/);
  assert.match(s([{ from_m: 0, to_m: 700 }]), /inside the level/);
  assert.match(s([{ from_m: 0, to_m: 100 }, { from_m: 50, to_m: 150 }]), /overlap/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 150, lane: 0, kind: 'obstacle', id: 'taxi' }] }]), /inside its section/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 3, kind: 'obstacle', id: 'taxi' }] }]), /lane/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 0, kind: 'drone', id: 'taxi' }] }]), /kind/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 0, kind: 'pickup', id: 'taxi' }] }]), /unknown pickup/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [0, 1, 2].map((lane) => ({ at_m: 50, lane, kind: 'obstacle', id: 'taxi' })) }]), /block every lane/);
  assert.equal(s([{ from_m: 0, to_m: 100, placements: [0, 1, 2].map((lane) => ({ at_m: 50, lane, kind: 'obstacle', id: lane === 1 ? 'barrier_low' : 'taxi' })) }]), '');
  assert.match(s([{ from_m: 0, to_m: 100, rows: 3 }]), /unknown key "rows"/);
});
test('the file name is the id', () => assert.match(errs({ id: 'y' }), /file name/));
test('index lists real files, once each; unlisted levels are fine', () => {
  const out = validateAll({ x: good, z: { ...good, id: 'z' } }, ['x', 'ghost', 'x'], registry);
  assert.match(out['index.json'].join(), /ghost.*does not exist/);
  assert.match(out['index.json'].join(), /twice/);
  assert.equal(out['z.json'], undefined);
});
test('campaign points at real levels', () => {
  assert.match(validateCampaign({ start: 'nope', locked: {} }, ['x']).join(), /start/);
  assert.match(validateCampaign({ start: 'x', locked: { x: 'x' } }, ['x']).join(), /itself/);
  assert.match(validateCampaign({ start: 'x', locked: { y: 'x' } }, ['x']).join(), /"y"/);
  assert.match(validateCampaign({ start: 'x', extra: 1 }, ['x']).join(), /unknown key/);
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../src/validate.js'`.

- [ ] **Step 5: Write `src/validate.js`**

```js
import { RULE_RANGES, resolveRules } from './rules.js';
import { passable } from './generator.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isName = (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 60;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LEVEL_KEYS = ['id', 'title', 'author', 'length_m', 'seed', 'character', 'theme', 'rules', 'obstacles', 'density', 'jugs', 'sections', 'ending'];
const SECTION_KEYS = ['from_m', 'to_m', 'obstacles', 'density', 'jugs', 'theme', 'generation', 'placements'];

// Every object is checked against an allow-list, so a typo can never pass as a working option.
const keys = (obj, allowed, path, e) => { for (const k of Object.keys(obj)) if (!allowed.includes(k)) e.push(`${path}: unknown key "${k}"`); };

function checkObstacles(o, path, registry, e) {
  if (!isObj(o)) return e.push(`${path} must be an object of {id: weight}`);
  for (const [id, w] of Object.entries(o)) {
    if (!registry.obstacle[id]) e.push(`${path}: unknown obstacle "${id}" (known: ${Object.keys(registry.obstacle).join(', ')})`);
    else if (!inRange(w, Number.MIN_VALUE, 1e6)) e.push(`${path}: weight for "${id}" must be a number above 0`);
  }
}
function checkDensity(d, path, e) {
  if (!isObj(d) || !inRange(d.start, 0, 1) || !inRange(d.end, 0, 1)) return e.push(`${path} needs start and end from 0 to 1`);
  keys(d, ['start', 'end'], path, e);
}
function checkJugs(j, path, registry, e) {
  if (!isObj(j)) return e.push(`${path} must be an object`);
  keys(j, ['per_100m', 'powerups'], path, e);
  if (!inRange(j.per_100m, 0, 30)) e.push(`${path}.per_100m must be 0 to 30`);
  if (!Array.isArray(j.powerups)) return e.push(`${path}.powerups must be a list of pickup ids`);
  for (const p of j.powerups) {
    const def = registry.pickup[p];
    if (!def) e.push(`${path}.powerups: unknown pickup "${p}"`);
    else if (!def.effect) e.push(`${path}.powerups: "${p}" is not a power-up (it has no effect)`);
  }
}
function checkTheme(t, path, registry, e, requireId) {
  if (!isObj(t)) return e.push(`${path} must be an object`);
  keys(t, ['id', 'sky', 'fog'], path, e);
  if (requireId || t.id !== undefined) { if (!registry.theme[t.id]) e.push(`${path}.id: unknown theme "${t.id}" (known: ${Object.keys(registry.theme).join(', ')})`); }
  if (t.sky !== undefined && !HEX.test(t.sky)) e.push(`${path}.sky must be a hex colour like "#f4b26a"`);
  if (t.fog !== undefined && !inRange(t.fog, 0, 1)) e.push(`${path}.fog must be 0 to 1`);
}
function checkRules(r, path, e) {
  if (!isObj(r)) return e.push(`${path} must be an object`);
  for (const [k, v] of Object.entries(r)) {
    const range = RULE_RANGES[k];
    if (!range) e.push(`${path}: unknown rule "${k}"`);
    else if (Array.isArray(range)) { if (!inRange(v, range[0], range[1])) e.push(`${path}.${k} must be ${range[0]} to ${range[1]}`); }
    else if (!isObj(v)) e.push(`${path}.${k} must be an object`);
    else for (const [k2, v2] of Object.entries(v)) {
      if (!range[k2]) e.push(`${path}.${k}: unknown rule "${k2}"`);
      else if (!inRange(v2, range[k2][0], range[k2][1])) e.push(`${path}.${k}.${k2} must be ${range[k2][0]} to ${range[k2][1]}`);
    }
  }
}
function checkEnding(en, level, registry, allIds, e) {
  if (!isObj(en)) return e.push('ending must be an object');
  keys(en, ['id', 'params'], 'ending', e);
  const def = registry.ending[en.id];
  if (!def) return e.push(`ending: unknown ending "${en.id}" (known: ${Object.keys(registry.ending).join(', ')})`);
  const params = en.params ?? {};
  if (!isObj(params)) return e.push('ending.params must be an object');
  const schema = def.params ?? {};
  for (const k of Object.keys(params)) if (!schema[k]) e.push(`ending.params: unknown param "${k}" for "${en.id}"`);
  for (const [k, s] of Object.entries(schema)) {
    const v = params[k];
    if (v === undefined) { if (s.default === undefined) e.push(`ending.params.${k} is required for "${en.id}"`); continue; }
    if (s.type === 'string' && !(typeof v === 'string' && v.length <= (s.max ?? 200))) e.push(`ending.params.${k} must be text of at most ${s.max ?? 200} characters`);
    if (s.type === 'number' && !inRange(v, s.min ?? -Infinity, s.max ?? Infinity)) e.push(`ending.params.${k} must be a number${s.min !== undefined ? ` from ${s.min}` : ''}${s.max !== undefined ? ` to ${s.max}` : ''}`);
    if (s.type === 'level') { if (!allIds.includes(v)) e.push(`ending.params.${k} ("next") must name an existing level`); else if (v === level.id) e.push(`ending.params.${k} cannot point at the level itself`); }
  }
}
function checkSections(level, registry, rules, e) {
  const sections = level.sections;
  if (!Array.isArray(sections)) return e.push('sections must be a list');
  const end = level.length_m ?? Infinity;
  let cursor = 0;
  sections.forEach((s, i) => {
    const path = `sections[${i}]`;
    if (!isObj(s)) return e.push(`${path} must be an object`);
    keys(s, SECTION_KEYS, path, e);
    if (!inRange(s.from_m, 0, Infinity) || !inRange(s.to_m, 0, Infinity) || s.to_m <= s.from_m) return e.push(`${path}: from_m must be less than to_m, both 0 or more`);
    if (s.to_m > end) e.push(`${path}: must sit inside the level (length ${level.length_m} m)`);
    if (s.from_m < cursor) e.push(`${path}: sections overlap (starts at ${s.from_m} m, previous ended at ${cursor} m)`);
    cursor = s.to_m;
    if (s.obstacles !== undefined) checkObstacles(s.obstacles, `${path}.obstacles`, registry, e);
    if (s.density !== undefined) checkDensity(s.density, `${path}.density`, e);
    if (s.jugs !== undefined) checkJugs(s.jugs, `${path}.jugs`, registry, e);
    if (s.theme !== undefined) checkTheme(s.theme, `${path}.theme`, registry, e, false);
    if (s.generation !== undefined && typeof s.generation !== 'boolean') e.push(`${path}.generation must be true or false`);
    if (s.placements === undefined) return;
    if (!Array.isArray(s.placements)) return e.push(`${path}.placements must be a list`);
    const rows = new Map();
    s.placements.forEach((p, j) => {
      const pp = `${path}.placements[${j}]`;
      if (!isObj(p)) return e.push(`${pp} must be an object`);
      keys(p, ['at_m', 'lane', 'kind', 'id'], pp, e);
      if (!inRange(p.at_m, s.from_m, s.to_m - 1e-9)) e.push(`${pp}.at_m must be inside its section (${s.from_m} to ${s.to_m} m)`);
      if (![0, 1, 2].includes(p.lane)) e.push(`${pp}.lane must be 0, 1 or 2`);
      if (!['obstacle', 'pickup'].includes(p.kind)) return e.push(`${pp}.kind must be obstacle or pickup`);
      const def = registry[p.kind][p.id];
      if (!def) return e.push(`${pp}: unknown ${p.kind} "${p.id}"`);
      if (p.kind === 'obstacle') (rows.get(p.at_m) ?? rows.set(p.at_m, []).get(p.at_m)).push({ lane: p.lane, def });
    });
    for (const [z, row] of rows) {
      const lanes = new Set(row.map((r) => r.lane));
      if (lanes.size === 3 && !row.some((r) => passable(r.def, rules))) e.push(`${path}: placements at ${z} m block every lane with nothing to jump or slide`);
    }
  });
}

// The single source of truth for "is this level OK?". Runs in the browser and in CI.
export function validateLevel(level, { fileId, allIds, registry }) {
  if (!isObj(level)) return ['level must be a JSON object'];
  const e = [];
  keys(level, LEVEL_KEYS, 'level', e);
  if (typeof level.id !== 'string' || !/^[a-z0-9-]+$/.test(level.id)) e.push('id must use only a-z, 0-9 and -');
  else if (level.id !== fileId) e.push(`id "${level.id}" must match the file name "${fileId}.json"`);
  if (!isName(level.title)) e.push('title must be 1-60 characters');
  if (!isName(level.author)) e.push('author must be 1-60 characters');
  const L = level.length_m;
  if (L === null) { if ('ending' in level) e.push('an endless level (length_m: null) cannot have an ending'); }
  else if (!Number.isInteger(L) || L < 100 || L > 10000) e.push('length_m must be a whole number from 100 to 10000, or null for endless');
  if (level.seed !== undefined && !Number.isInteger(level.seed)) e.push('seed must be a whole number');
  if (level.character !== undefined) {
    if (!isObj(level.character)) e.push('character must be an object');
    else { keys(level.character, ['id'], 'character', e); if (!registry.character[level.character.id]) e.push(`character: unknown character "${level.character.id}"`); }
  }
  if (level.theme === undefined) e.push('theme is required'); else checkTheme(level.theme, 'theme', registry, e, true);
  if (level.rules !== undefined) checkRules(level.rules, 'rules', e);
  if (!isObj(level.obstacles)) e.push('obstacles must be an object of {id: weight}'); else checkObstacles(level.obstacles, 'obstacles', registry, e);
  if (level.density === undefined) e.push('density is required'); else checkDensity(level.density, 'density', e);
  if (level.jugs === undefined) e.push('jugs is required'); else checkJugs(level.jugs, 'jugs', registry, e);
  const rules = resolveRules(isObj(level.rules) ? level.rules : {});
  if (level.sections !== undefined) checkSections(level, registry, rules, e);
  if ('ending' in level && L !== null) checkEnding(level.ending, level, registry, allIds, e);
  // Empty obstacles are fine only when nothing would ever be generated from them.
  if (isObj(level.obstacles) && Object.keys(level.obstacles).length === 0) {
    const sections = Array.isArray(level.sections) ? level.sections.filter(isObj) : [];
    const dens = (d) => isObj(d) && (d.start > 0 || d.end > 0);
    const covered = sections.reduce((m, s) => Math.max(m, s.to_m || 0), 0);
    const baseGenerates = covered < (level.length_m ?? Infinity) && dens(level.density);
    const sectionGenerates = sections.some((s) => s.generation !== false && s.obstacles === undefined && dens(s.density ?? level.density));
    if (baseGenerates || sectionGenerates) e.push('obstacles may be empty only when every generated section has density 0');
  }
  return e;
}

export function validateAll(levels, index, registry) {
  const errors = {};
  const add = (file, msg) => (errors[file] ??= []).push(msg);
  if (!Array.isArray(index)) { add('index.json', 'must be a list of level ids'); return errors; }
  const allIds = Object.keys(levels);
  index.forEach((id, i) => {
    if (!allIds.includes(id)) add('index.json', `lists "${id}" but levels/${id}.json does not exist`);
    if (index.indexOf(id) !== i) add('index.json', `lists "${id}" twice`);
  });
  for (const id of allIds) for (const msg of validateLevel(levels[id], { fileId: id, allIds, registry })) add(`${id}.json`, msg);
  return errors;
}

export function validateCampaign(c, levelIds) {
  const e = [];
  if (!isObj(c)) return ['campaign must be a JSON object'];
  keys(c, ['start', 'locked'], 'campaign', e);
  if (!levelIds.includes(c.start)) e.push(`campaign.start "${c.start}" is not a level`);
  if (c.locked !== undefined) {
    if (!isObj(c.locked)) e.push('campaign.locked must be an object of {level: unlockedBy}');
    else for (const [id, by] of Object.entries(c.locked)) {
      if (!levelIds.includes(id)) e.push(`campaign.locked: "${id}" is not a level`);
      if (!levelIds.includes(by)) e.push(`campaign.locked: "${id}" is unlocked by "${by}", which is not a level`);
      if (id === by) e.push(`campaign.locked: "${id}" cannot be unlocked by itself`);
    }
  }
  return e;
}
```

- [ ] **Step 6: Write `src/campaign.js`**

```js
// Progression is data (levels/campaign.json); endings never decide what unlocks.
export const isLocked = (campaign, save, id) => Boolean(campaign.locked?.[id]) && !save.completed.includes(campaign.locked[id]);
export function completeLevel(save, id) { if (!save.completed.includes(id)) save.completed.push(id); return save; }
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: PASS (registry tests plus 12 validate tests). If the "obstacles may be empty only" test fails, simplify that rule's expression until both of its assertions hold; the intent is in its message.

- [ ] **Step 8: Add the test step to CI.** In `.github/workflows/ci.yml` insert `- run: npm test` between `npm ci` and `npm run build`.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: level schema v2 with sections, placements and rule parameters; shipped levels and campaign

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rules as parameters, run physics, generic effects, input mapping

**Files:**
- Create: `src/rules.js` (replaces the Task 3 stub; keeps `DEFAULT_RULES`, `RULE_RANGES`, `resolveRules`, `jumpHeight`), `src/input.js`, `test/logic.test.js`

**Interfaces:**
- Produces (`rules.js`):
  - `MAX_DT`, `BIKE_TRIGGER`, `BIKE_SPEED`, `DEFAULT_RULES`, `RULE_RANGES`, `resolveRules(overrides) → rules`
  - `laneX(lane, rules)`, `jumpHeight(rules)`, `speedAt(level, z, rules)`
  - `createRun(rules, character, jugs = 0) → run` with `{ rules, dims: {height, width}, lane, x, y, vy, slideT, z, time, jugs, effects: {}, graceT, over }`; `run.effects[id] = { t: seconds | Infinity, reach?, multiplier?, shield? }`
  - `act(run, 'left'|'right'|'jump'|'slide')`, `step(run, rawDt, speed) → dt`
  - `playerBox(run)`, `obstacleBox(o, def, time, rules) → box | null`, `overlaps(a, b)`
  - `hit(run) → 'grace'|'shield'|'dead'`, `multiplier(run)`, `reach(run)`, `inReach(run, pickup)`, `collect(run, pickupDef)`, `updateObstacle(o, def, run, dt)` (sets `o.x` on movers)
- Produces (`input.js`): `KEYS`, `classifySwipe(dx, dy, min = 30)`, `bindInput(touchTarget, onAction) → unbind()`

- [ ] **Step 1: Write the failing tests `test/logic.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, resolveRules, laneX, jumpHeight, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  inReach, collect, updateObstacle, multiplier, MAX_DT,
} from '../src/rules.js';
import { classifySwipe, KEYS } from '../src/input.js';

const R = resolveRules();
const COW = { height: 1.9, width: 1.0 };
const BARRIER = { avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 } };
const BEAM = { avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 } };
const STEAM = { avoid: 'timing', box: { w: 2, h: 2.5, d: 1 }, cycle: { period: 1.5, on: 0.5 } };
const BIKE = { avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true };
const MAGNET = { id: 'magnet', duration: 8, effect: { reach: 15 } };
const SHIELD = { id: 'shield', duration: 'untilHit', effect: { shield: true } };
const X2 = { id: 'x2', duration: 10, effect: { multiplier: 2 } };
const JUG = { id: 'jug', value: 1 };

function runInto(def, action, rules = R) {
  const run = createRun(rules, COW);
  const o = { lane: 1, z: 3.6 };
  if (action) act(run, action);
  let touched = false;
  while (run.z < o.z + 2) {
    step(run, 1 / 60, 12);
    const box = obstacleBox(o, def, run.time, rules);
    if (box && overlaps(playerBox(run), box)) touched = true;
  }
  return touched;
}

test('rules resolve over the defaults, nested too', () => {
  const r = resolveRules({ gravity: -24, speed: { start: 10 } });
  assert.equal(r.gravity, -24);
  assert.equal(r.speed.start, 10);
  assert.equal(r.speed.end, DEFAULT_RULES.speed.end);
  assert.ok(laneX(0, r) > laneX(2, r), 'lane 0 is screen-left (+x)');
  assert.ok(Math.abs(jumpHeight(R) - 1.35) < 0.01);
});

test('lanes clamp; no double jump; sliding in the air fast-falls', () => {
  const run = createRun(R, COW);
  act(run, 'left'); act(run, 'left'); act(run, 'left');
  assert.equal(run.lane, 0);
  for (let i = 0; i < 4; i++) act(run, 'right');
  assert.equal(run.lane, 2);
  act(run, 'jump'); step(run, 0.05, 12);
  const vy = run.vy;
  act(run, 'jump');
  assert.equal(run.vy, vy);
  act(run, 'slide');
  assert.ok(run.vy <= R.fastFall);
});

test('jumping clears a barrier; running into it hits; a weak jump no longer clears it', () => {
  assert.equal(runInto(BARRIER, 'jump'), false);
  assert.equal(runInto(BARRIER, null), true);
  assert.equal(runInto(BARRIER, 'jump', resolveRules({ jumpSpeed: 5 })), true);
});

test('sliding ducks a beam; standing hits it', () => {
  assert.equal(runInto(BEAM, 'slide'), false);
  assert.equal(runInto(BEAM, null), true);
});

test('steam only hurts while it is on', () => {
  assert.ok(obstacleBox({ lane: 1, z: 0 }, STEAM, 0.2, R));
  assert.equal(obstacleBox({ lane: 1, z: 0 }, STEAM, 1.0, R), null);
});

test('a shield absorbs one hit, grace follows, then the next hit ends the run', () => {
  const run = createRun(R, COW);
  collect(run, SHIELD);
  assert.equal(run.effects.shield.t, Infinity);
  assert.equal(hit(run), 'shield');
  assert.equal(run.effects.shield, undefined);
  assert.equal(hit(run), 'grace');
  assert.equal(run.over, false);
  for (let t = 0; t <= R.grace; t += MAX_DT) step(run, MAX_DT, 12);
  assert.equal(hit(run), 'dead');
  assert.equal(run.over, true);
});

test('a huge frame time is clamped (no teleport after a background tab)', () => {
  const run = createRun(R, COW);
  assert.equal(step(run, 5, 12), MAX_DT);
  assert.ok(Math.abs(run.z - 12 * MAX_DT) < 1e-9);
});

test('speed rises across a level and caps in endless', () => {
  assert.equal(speedAt({ length_m: 1000 }, 0, R), 12);
  assert.equal(speedAt({ length_m: 1000 }, 1000, R), 20);
  assert.equal(speedAt({ length_m: null }, 1e6, R), 28);
  assert.equal(speedAt({ length_m: 1000 }, 500, resolveRules({ speed: { start: 10, end: 30 } })), 20);
});

test('effects: reach, multiplier, timers and expiry', () => {
  const run = createRun(R, COW, 3);
  assert.equal(inReach(run, { z: 10, lane: 0 }), false);
  collect(run, MAGNET);
  assert.equal(inReach(run, { z: 10, lane: 0 }), true);
  assert.equal(inReach(run, { z: -5, lane: 1 }), false);
  collect(run, JUG); assert.equal(run.jugs, 4);
  collect(run, X2); collect(run, JUG); assert.equal(run.jugs, 6);
  assert.equal(multiplier(run), 2);
  for (let t = 0; t < 10.1; t += MAX_DT) step(run, MAX_DT, 12);
  assert.equal(run.effects.x2, undefined);
  assert.equal(run.effects.magnet, undefined);
  assert.equal(multiplier(run), 1);
});

test('a jug in your lane is picked up without a magnet; one lane over is not', () => {
  const run = createRun(R, COW);
  assert.equal(inReach(run, { z: 0.5, lane: 1 }), true);
  assert.equal(inReach(run, { z: 0.5, lane: 0 }), false);
});

test('the player box follows the character and the slide height', () => {
  const run = createRun(R, { height: 2.4, width: 1.4 });
  assert.equal(playerBox(run).y1, 2.4);
  assert.equal(playerBox(run).x1 - playerBox(run).x0, 1.4);
  act(run, 'slide');
  assert.equal(playerBox(run).y1, R.slideHeight);
});

test('bikes only start moving when the player is close', () => {
  const run = createRun(R, COW);
  const far = { lane: 1, z: 100, moveTo: 0 };
  updateObstacle(far, BIKE, run, 0.05);
  assert.equal(far.x, undefined);
  const near = { lane: 1, z: 20, moveTo: 0 };
  updateObstacle(near, BIKE, run, 0.05);
  assert.ok(near.x > laneX(1, R) && near.x < laneX(0, R));
  const parked = { lane: 1, z: 20, moveTo: null };
  updateObstacle(parked, BIKE, run, 0.05);
  assert.equal(parked.x, undefined);
});

test('swipes and keys map to actions', () => {
  assert.equal(classifySwipe(50, 0), 'right');
  assert.equal(classifySwipe(-50, 5), 'left');
  assert.equal(classifySwipe(0, -60), 'jump');
  assert.equal(classifySwipe(3, 60), 'slide');
  assert.equal(classifySwipe(10, 10), null);
  assert.equal(KEYS.Space, 'jump');
  assert.equal(KEYS.Escape, 'pause');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL: `createRun` is not exported by the Task 3 stub (`SyntaxError: The requested module '../src/rules.js' does not provide an export named 'createRun'`).

- [ ] **Step 3: Write `src/rules.js`** (replacing the stub)

```js
// Rules are parameters. A level may override any default within RULE_RANGES; nothing in here names content.
export const MAX_DT = 0.05;          // longest frame the physics will accept (a backgrounded tab must not teleport)
export const BIKE_TRIGGER = 30;      // metres ahead at which a moving obstacle starts to swerve
export const BIKE_SPEED = 4;         // its lateral speed, m/s

export const DEFAULT_RULES = {
  laneWidth: 2.5, laneTime: 0.15, gravity: -30, jumpSpeed: 9, fastFall: -15, slideTime: 0.6, slideHeight: 0.8, grace: 1,
  speed: { start: 12, end: 20, cap: 28, ramp: 0.004 },
};
export const RULE_RANGES = {
  laneWidth: [1.5, 4], laneTime: [0.05, 0.5], gravity: [-60, -10], jumpSpeed: [5, 15], fastFall: [-40, -5], slideTime: [0.3, 2], slideHeight: [0.4, 1.5], grace: [0, 3],
  speed: { start: [4, 40], end: [4, 40], cap: [4, 60], ramp: [0, 0.05] },
};

export function resolveRules(overrides = {}) {
  return { ...DEFAULT_RULES, ...overrides, speed: { ...DEFAULT_RULES.speed, ...(overrides.speed ?? {}) } };
}

// The camera looks down +z, so screen-left is +x: lane 0 = +laneWidth, lane 2 = -laneWidth.
export const laneX = (lane, rules) => (1 - lane) * rules.laneWidth;
export const jumpHeight = (rules) => rules.jumpSpeed ** 2 / (2 * -rules.gravity);

export function speedAt(level, z, rules) {
  const s = rules.speed;
  if (level.length_m === null) return Math.min(s.cap, s.start + z * s.ramp);
  return s.start + (s.end - s.start) * Math.min(1, z / level.length_m);
}

export function createRun(rules, character, jugs = 0) {
  return {
    rules, dims: { height: character.height, width: character.width },
    lane: 1, x: 0, y: 0, vy: 0, slideT: 0, z: 0, time: 0, jugs, effects: {}, graceT: 0, over: false,
  };
}

export function act(run, action) {
  const R = run.rules;
  if (run.over) return;
  if (action === 'left') run.lane = Math.max(0, run.lane - 1);
  else if (action === 'right') run.lane = Math.min(2, run.lane + 1);
  else if (action === 'jump' && run.y === 0 && run.vy === 0) { run.vy = R.jumpSpeed; run.slideT = 0; }
  else if (action === 'slide') { run.slideT = R.slideTime; if (run.y > 0) run.vy = Math.min(run.vy, R.fastFall); }
}

export function step(run, rawDt, speed) {
  const R = run.rules;
  const dt = Math.min(rawDt, MAX_DT);
  run.time += dt;
  run.z += speed * dt;
  const maxMove = (R.laneWidth / R.laneTime) * dt;
  run.x += Math.max(-maxMove, Math.min(maxMove, laneX(run.lane, R) - run.x));
  if (run.y > 0 || run.vy !== 0) {
    run.vy += R.gravity * dt;
    run.y += run.vy * dt;
    if (run.y <= 0) { run.y = 0; run.vy = 0; }
  }
  run.slideT = Math.max(0, run.slideT - dt);
  run.graceT = Math.max(0, run.graceT - dt);
  for (const [id, e] of Object.entries(run.effects)) {
    if (!Number.isFinite(e.t)) continue;
    e.t -= dt;
    if (e.t <= 0) delete run.effects[id];
  }
  return dt;
}

export function playerBox(run) {
  const h = run.slideT > 0 ? Math.min(run.rules.slideHeight, run.dims.height) : run.dims.height;
  const hw = run.dims.width / 2;
  return { x0: run.x - hw, x1: run.x + hw, y0: run.y, y1: run.y + h, z0: run.z - 0.4, z1: run.z + 0.4 };
}

export function obstacleBox(o, def, time, rules) {
  if (def.cycle && time % def.cycle.period >= def.cycle.on) return null; // a timing obstacle is "off"
  const x = o.x ?? laneX(o.lane, rules), y = def.box.y ?? 0, b = def.box;
  return { x0: x - b.w / 2, x1: x + b.w / 2, y0: y, y1: y + b.h, z0: o.z - b.d / 2, z1: o.z + b.d / 2 };
}

export const overlaps = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;

export function hit(run) {
  if (run.graceT > 0) return 'grace';
  const shield = Object.entries(run.effects).find(([, e]) => e.shield);
  if (shield) { delete run.effects[shield[0]]; run.graceT = run.rules.grace; return 'shield'; }
  run.over = true;
  return 'dead';
}

export function multiplier(run) { let m = 1; for (const e of Object.values(run.effects)) if (e.multiplier) m *= e.multiplier; return m; }
export function reach(run) { let r = 0; for (const e of Object.values(run.effects)) if (e.reach) r = Math.max(r, e.reach); return r; }

export function inReach(run, p) {
  const dz = p.z - run.z, r = reach(run);
  if (r > 0 && dz > -1 && dz < r) return true;
  return Math.abs(dz) < 0.8 && Math.abs(laneX(p.lane, run.rules) - run.x) < 1;
}

// def is a pickup module: value adds jugs now; effect starts a timed (or until-hit) capability.
export function collect(run, def) {
  if (def.value) run.jugs += def.value * multiplier(run);
  if (def.effect) run.effects[def.id] = { t: def.duration === 'untilHit' ? Infinity : def.duration, ...def.effect };
}

export function updateObstacle(o, def, run, dt) {
  if (!def.moves || o.moveTo == null || o.z - run.z > BIKE_TRIGGER) return;
  const x = o.x ?? laneX(o.lane, run.rules), target = laneX(o.moveTo, run.rules), s = BIKE_SPEED * dt;
  o.x = x + Math.max(-s, Math.min(s, target - x));
}
```

- [ ] **Step 4: Write `src/input.js`**

```js
export const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide',
  Escape: 'pause',
};

export function classifySwipe(dx, dy, min = 30) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy < 0 ? 'jump' : 'slide';
}

// Keys on window, swipes on touchTarget. A swipe fires as soon as it crosses the threshold.
export function bindInput(touchTarget, onAction) {
  let start = null;
  const onKey = (e) => {
    const a = KEYS[e.code];
    if (!a || e.repeat) return;
    e.preventDefault();
    onAction(a);
  };
  const onStart = (e) => { const t = e.changedTouches[0]; start = { x: t.clientX, y: t.clientY }; };
  const onMove = (e) => {
    e.preventDefault(); // no page scroll, no pull-to-refresh
    if (!start) return;
    const t = e.changedTouches[0];
    const a = classifySwipe(t.clientX - start.x, t.clientY - start.y);
    if (a) { start = null; onAction(a); }
  };
  addEventListener('keydown', onKey);
  touchTarget.addEventListener('touchstart', onStart, { passive: true });
  touchTarget.addEventListener('touchmove', onMove, { passive: false });
  return () => {
    removeEventListener('keydown', onKey);
    touchTarget.removeEventListener('touchstart', onStart);
    touchTarget.removeEventListener('touchmove', onMove);
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS (registry, validate, and 13 logic tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: rules as per-level parameters, generic effects, input mapping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Generator v2: seed, sections, placements, fairness per rules

**Files:**
- Create: `src/generator.js` (replaces the Task 3 stub; keeps `passable`)
- Modify: `test/logic.test.js` (append)

**Interfaces:**
- Consumes: `registry.obstacle[id]` modules (`avoid`, `box`, `moves`), `rules` from Task 4.
- Produces:
  - `rng(seed) → () => number`, `passable(def, rules)`
  - `normalizeLevel(level) → { length, seed, sections: [{ from, to, obstacles, density, densitySpan, jugs, theme, generation, placements }] }`
  - `sectionAt(norm, z)`, `densityAt(section, z)`
  - `generate(norm, r, fromZ, toZ, registry, rules) → { obstacles: {id, lane, z, moveTo?, placed?}[], pickups: {id, lane, z, placed?}[] }` where pickup `id` is `'jug'` or a power-up id
  - Constants `ROW_GAP, START_CLEAR, END_CLEAR, SPECIAL_CHANCE, ENDLESS_RAMP_M, JUG_CLEARANCE`

- [ ] **Step 1: Append the failing tests to `test/logic.test.js`**

```js
import { before } from 'node:test';
import { generate, normalizeLevel, densityAt, rng, passable, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from './helpers.js';

let registry;
before(async () => { registry = buildRegistry(await discover(new URL('../content/', import.meta.url).pathname)); });

const lvl = (patch = {}) => ({
  id: 't', length_m: 1500, theme: { id: 'downtown' },
  density: { start: 0.5, end: 0.9 },
  obstacles: { taxi: 3, barrier_low: 2, scaffold_beam: 2, delivery_bike: 1, manhole_steam: 1 },
  jugs: { per_100m: 12, powerups: ['magnet', 'shield', 'x2'] },
  ...patch,
});
const all = (level, seed, rules = R) => generate(normalizeLevel(level), rng(seed), 0, level.length_m ?? 3000, registry, rules);
const rowsOf = (obstacles) => Map.groupBy(obstacles, (o) => o.z);
const isPassable = (o, rules = R) => passable(registry.obstacle[o.id], rules);
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

test('same seed builds the same street', () => assert.deepEqual(all(lvl(), 7), all(lvl(), 7)));

test('the road is clear at the start and before the end', () => {
  for (const s of seeds.slice(0, 20)) for (const o of all(lvl(), s).obstacles) assert.ok(o.z >= START_CLEAR && o.z < 1500 - END_CLEAR, `obstacle at ${o.z}`);
});

test('a full row always has a jump or slide option under the default rules', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl(), s).obstacles).values()) if (row.length === 3) assert.ok(row.some((o) => isPassable(o)), `seed ${s}`);
});

test('with nothing to jump or slide, a row never fills all three lanes', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 1 } }), s).obstacles).values()) assert.ok(row.length <= 2);
});

test('fairness follows the level rules: a weak jump makes the barrier a wall', () => {
  const weak = resolveRules({ jumpSpeed: 5 });
  assert.equal(passable(registry.obstacle.barrier_low, R), true);
  assert.equal(passable(registry.obstacle.barrier_low, weak), false);
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 2, barrier_low: 2 } }), s, weak).obstacles).values()) assert.ok(row.length <= 2, `seed ${s}`);
});

test('pickups keep clear of obstacles in their lane', () => {
  for (const s of seeds.slice(0, 50)) {
    const { obstacles, pickups } = all(lvl(), s);
    for (const p of pickups) assert.ok(!obstacles.some((o) => o.lane === p.lane && Math.abs(o.z - p.z) < JUG_CLEARANCE));
  }
});

test('specials only come from the level list, everything else is a jug', () => {
  const ids = new Set(seeds.slice(0, 10).flatMap((s) => all(lvl({ jugs: { per_100m: 30, powerups: ['x2'] } }), s).pickups.map((p) => p.id)));
  assert.deepEqual([...ids].sort(), ['jug', 'x2']);
  assert.ok(all(lvl({ jugs: { per_100m: 30, powerups: [] } }), 1).pickups.every((p) => p.id === 'jug'));
});

test('moving obstacles only move into a free neighbouring lane', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { delivery_bike: 1, taxi: 1 } }), s).obstacles).values()) {
    for (const o of row.filter((o) => o.id === 'delivery_bike')) {
      if (o.moveTo === null) continue;
      assert.equal(Math.abs(o.moveTo - o.lane), 1);
      assert.ok(!row.some((other) => other.lane === o.moveTo));
    }
  }
});

test('density controls how busy the street is', () => {
  const count = (d) => all(lvl({ density: { start: d, end: d } }), 3).obstacles.length;
  assert.ok(count(1) > count(0.1) * 3);
});

test('chunked generation keeps rows on one grid', () => {
  const r = rng(5), norm = normalizeLevel(lvl({ length_m: null }));
  const zs = [...generate(norm, r, 0, 120, registry, R).obstacles, ...generate(norm, r, 120, 240, registry, R).obstacles].map((o) => o.z);
  assert.ok(zs.every((z) => z % ROW_GAP === 0));
});

test('a quiet section has no obstacles and a density override interpolates inside it', () => {
  const level = lvl({ sections: [{ from_m: 0, to_m: 600, density: { start: 0, end: 0 } }, { from_m: 600, to_m: 900, density: { start: 0, end: 1 } }] });
  for (const s of seeds.slice(0, 20)) assert.ok(all(level, s).obstacles.every((o) => o.z >= 600));
  const norm = normalizeLevel(level);
  assert.equal(densityAt(norm.sections[1], 600), 0);
  assert.equal(densityAt(norm.sections[1], 750), 0.5);
  assert.equal(norm.sections.length, 3, 'the rest of the level is a base section');
  assert.equal(norm.sections[2].densitySpan[1], 1500, 'base sections interpolate across the whole level');
});

test('placements land exactly where asked and a non-generating section has nothing else', () => {
  const level = lvl({ sections: [{ from_m: 100, to_m: 400, generation: false, placements: [
    { at_m: 150, lane: 1, kind: 'obstacle', id: 'barrier_low' },
    { at_m: 150, lane: 0, kind: 'obstacle', id: 'delivery_bike' },
    { at_m: 220, lane: 2, kind: 'pickup', id: 'shield' },
  ] }] });
  for (const s of seeds.slice(0, 10)) {
    const { obstacles, pickups } = all(level, s);
    const inSection = obstacles.filter((o) => o.z >= 100 && o.z < 400);
    assert.deepEqual(inSection.map((o) => [o.id, o.lane, o.z, o.moveTo]).sort(), [['barrier_low', 1, 150, undefined], ['delivery_bike', 0, 150, null]].sort());
    assert.ok(pickups.some((p) => p.id === 'shield' && p.lane === 2 && p.z === 220 && p.placed));
  }
});

test('a section theme merges over the level theme', () => {
  const norm = normalizeLevel(lvl({ theme: { id: 'downtown', sky: '#111111', fog: 0.2 }, sections: [{ from_m: 0, to_m: 100, theme: { sky: '#222222' } }] }));
  assert.deepEqual(norm.sections[0].theme, { id: 'downtown', sky: '#222222', fog: 0.2 });
  assert.deepEqual(norm.sections[1].theme, { id: 'downtown', sky: '#111111', fog: 0.2 });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL: `generate` is not exported by the Task 3 stub.

- [ ] **Step 3: Write `src/generator.js`** (replacing the stub)

```js
import { jumpHeight } from './rules.js';

export const ROW_GAP = 12;          // metres between generated obstacle rows
export const START_CLEAR = 40;      // empty road at the start of every level
export const END_CLEAR = 60;        // empty road before a finite level's end
export const SPECIAL_CHANCE = 1 / 40;
export const ENDLESS_RAMP_M = 2000; // endless density reaches density.end here
export const JUG_CLEARANCE = 3;     // no pickup within this many metres of an obstacle in its lane

// mulberry32: tiny seeded PRNG, so a seed always builds the same street.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Can the player get past this obstacle in its own lane under these rules? Dimensions decide, not the label alone.
export function passable(def, rules) {
  if (def.avoid === 'timing') return true;
  const bottom = def.box.y ?? 0;
  if (def.avoid === 'jump') return bottom === 0 && def.box.h <= jumpHeight(rules);
  if (def.avoid === 'slide') return bottom >= rules.slideHeight;
  return false;
}

// Turns a level file into ordered sections that cover the whole level. Base sections (no override)
// interpolate density across the whole level, so a level without sections behaves exactly as before.
export function normalizeLevel(level) {
  const length = level.length_m;
  const end = length ?? Infinity;
  const levelSpan = [0, length ?? ENDLESS_RAMP_M];
  const base = (from, to) => ({ from, to, obstacles: level.obstacles, density: level.density, densitySpan: levelSpan, jugs: level.jugs, theme: level.theme, generation: true, placements: [] });
  const sections = [];
  let cursor = 0;
  for (const s of level.sections ?? []) {
    if (s.from_m > cursor) sections.push(base(cursor, s.from_m));
    sections.push({
      ...base(s.from_m, s.to_m),
      obstacles: s.obstacles ?? level.obstacles,
      density: s.density ?? level.density,
      densitySpan: s.density ? [s.from_m, s.to_m] : levelSpan,
      jugs: s.jugs ?? level.jugs,
      theme: s.theme ? { ...level.theme, ...s.theme } : level.theme,
      generation: s.generation !== false,
      placements: s.placements ?? [],
    });
    cursor = s.to_m;
  }
  if (cursor < end) sections.push(base(cursor, end));
  return { length, seed: level.seed, sections };
}

export const sectionAt = (norm, z) => norm.sections.find((s) => z >= s.from && z < s.to) ?? norm.sections[norm.sections.length - 1];

export function densityAt(section, z) {
  const [z0, z1] = section.densitySpan;
  const t = z1 > z0 ? Math.min(1, Math.max(0, (z - z0) / (z1 - z0))) : 1;
  return section.density.start + (section.density.end - section.density.start) * t;
}

function pick(weights, r) {
  const entries = Object.entries(weights);
  let x = r() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of entries) if ((x -= w) < 0) return id;
  return entries[entries.length - 1][0];
}

function shuffledLanes(r) {
  const lanes = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

// Obstacles and pickups for z in [fromZ, toZ). Call with consecutive ranges on one rng.
export function generate(norm, r, fromZ, toZ, registry, rules) {
  const obstacles = [], pickups = [];
  const lastRow = norm.length == null ? Infinity : norm.length - END_CLEAR;
  const firstRow = Math.ceil(Math.max(fromZ, START_CLEAR) / ROW_GAP) * ROW_GAP;

  for (let z = firstRow; z < Math.min(toZ, lastRow); z += ROW_GAP) {
    const s = sectionAt(norm, z);
    if (!s.generation || r() >= densityAt(s, z)) continue;
    const ids = Object.keys(s.obstacles);
    if (!ids.length) continue;
    const roll = r();
    const lanes = shuffledLanes(r).slice(0, roll < 0.15 ? 3 : roll < 0.5 ? 2 : 1);
    const picked = lanes.map(() => pick(s.obstacles, r));
    if (lanes.length === 3 && !picked.some((id) => passable(registry.obstacle[id], rules))) {
      const passIds = ids.filter((id) => passable(registry.obstacle[id], rules));
      if (passIds.length) picked[0] = passIds[Math.floor(r() * passIds.length)];
      else { lanes.pop(); picked.pop(); }
    }
    lanes.forEach((lane, i) => {
      const def = registry.obstacle[picked[i]];
      const o = { id: picked[i], lane, z };
      if (def.moves) {
        const free = [lane - 1, lane + 1].filter((l) => l >= 0 && l <= 2 && !lanes.includes(l));
        o.moveTo = free.length ? free[Math.floor(r() * free.length)] : null;
      }
      obstacles.push(o);
    });
  }

  for (const s of norm.sections) for (const p of s.placements) {
    if (p.at_m < fromZ || p.at_m >= toZ) continue;
    const item = { id: p.id, lane: p.lane, z: p.at_m, placed: true };
    if (p.kind === 'obstacle') { if (registry.obstacle[p.id].moves) item.moveTo = null; obstacles.push(item); }
    else pickups.push(item);
  }

  for (const s of norm.sections) {
    if (!s.jugs.per_100m) continue;
    const gap = 100 / s.jugs.per_100m;
    const z0 = Math.max(fromZ, s.from, START_CLEAR / 2);
    const z1 = Math.min(toZ, s.to, norm.length == null ? Infinity : norm.length - END_CLEAR / 2);
    // ponytail: clearance only checks this chunk's obstacles; a pickup at a chunk edge can sit beside the
    // next chunk's first row. Harmless (pickups never hurt); check neighbours if it ever looks wrong.
    for (let k = Math.ceil(z0 / gap); k * gap < z1; k++) {
      const z = k * gap;
      const free = [0, 1, 2].filter((l) => !obstacles.some((o) => o.lane === l && Math.abs(o.z - z) < JUG_CLEARANCE));
      if (!free.length) continue;
      const lane = free[Math.floor(r() * free.length)];
      const specials = s.jugs.powerups;
      const id = specials.length && r() < SPECIAL_CHANCE ? specials[Math.floor(r() * specials.length)] : 'jug';
      pickups.push({ id, lane, z });
    }
  }
  return { obstacles, pickups };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS (all earlier tests plus 13 generator tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seeded generator with sections, placements and rules-aware fairness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `gfx`, content views, world streaming, character, HUD, game loop (level 1 playable)

**Files:**
- Create: `src/gfx.js`, `src/world.js`, `src/character.js`, `src/hud.js`, `src/game.js`, `src/levels.js`, `src/style.css`
- Modify: `index.html` (full shell), `src/main.js` (temporary: boots straight into the campaign start), every `content/obstacles/*.js` and `content/pickups/jug.js` (real views from the style sheet), `content/characters/milkshake.js` (shape cow and GLB loader)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces:
  - `gfx.js` (handed to content modules as `gfx`): `box, cyl, sphere, capsule, cone, roundedBox, group, mat, blobShadow, glow, orb(def), textTexture, glyphTexture, labelTexture, sprite, dispose, palette, three`
  - `createWorld(scene, level, { registry, rules, seed, end }) → { live: { obstacles, pickups }, update(run, dt), removePickup(p), skyAt(z), dispose() }`; `defaultChunk(gfx, args)`; `ROAD_HALF`
  - `loadCharacter(def) → Promise<view>` where view = `{ object, update(run), pose(time, state), dispose() }`
  - `createHud() → { show(on), onPause(fn), update(run, level, registry), setPaused(on), flash(), ring(): Promise, banner(text, ms): Promise, card(text, ms): Promise }`
  - `loadLevels(registry) → { levels, campaign, order, errors, valid(id) }`
  - `playLevel({ engine, level, registry, hud, character, carryJugs }) → Promise<{ outcome: 'complete'|'dead'|'error', run, world, error? }>`
  - Content view contracts: obstacle `createView(gfx, o) → { object, update?(o, run, dt, active), dispose?() }`; pickup `createView(gfx) → { object, update?(p, run, dt) }`; character `createView(gfx) → Promise<{ object, update(run), pose(time, { sliding, over, lean, airborne }), dispose() }>`.

- [ ] **Step 1: Write `src/gfx.js`**

```js
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';

// Toon primitives for content modules. Materials are cached and shared; dispose() never touches them.
export const palette = PALETTE;
export const three = THREE; // escape hatch for endings that need Vector3, Points and the like

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color, ...opts }));
  return mats.get(key);
}
const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
export const box = (w, h, d, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts)), x, y, z);
export const roundedBox = (w, h, d, radius, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), mat(color)), x, y, z);
export const cyl = (rTop, rBottom, h, color, x = 0, y = h / 2, z = 0, opts) => at(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 20), mat(color, opts)), x, y, z);
export const sphere = (r, color, x = 0, y = r, z = 0, opts) => at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts)), x, y, z);
export const capsule = (r, len, color, x = 0, y = len / 2 + r, z = 0, opts) => at(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color, opts)), x, y, z);
export const cone = (r, h, color, x = 0, y = h / 2, z = 0) => at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat(color)), x, y, z);
export function group(...children) { const g = new THREE.Group(); if (children.length) g.add(...children); return g; }

// A soft round shadow on the ground: the cheapest way to show where something floating or jumping is.
export function blobShadow(r = 0.6, opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: PALETTE.eye, transparent: true, opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.renderOrder = -1;
  return m;
}
export function glow(r, color, y = 0.9) {
  return at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })), 0, y, 0);
}

export function textTexture(text, { w = 1024, h = 192, color = '#ffffff', font = '900 120px "Lilita One", system-ui, sans-serif' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  Object.assign(x, { fillStyle: color, font, textAlign: 'center', textBaseline: 'middle' });
  x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A pickup glyph (28x28 path data) as a texture.
export function glyphTexture(path, { stroke = false, color = '#ffffff' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const x = c.getContext('2d');
  x.scale(128 / 28, 128 / 28);
  const p = new Path2D(path);
  if (stroke) { x.strokeStyle = color; x.lineWidth = 3.6; x.stroke(p); } else { x.fillStyle = color; x.fill(p); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const labelTexture = (label) => textTexture(label, { w: 128, h: 128, font: '900 72px "Lilita One", system-ui, sans-serif' });
export function sprite(texture, w, h) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  s.scale.set(w, h, 1); return s;
}

// The default power-up view: a glowing orb in the pickup's colour with its glyph or label on the front.
export function orb(def) {
  const g = group(blobShadow(0.3), glow(0.6, def.color), sphere(0.4, def.color, 0, 0.9, 0, { emissive: def.color, emissiveIntensity: 0.5 }));
  const tex = def.glyph ? glyphTexture(def.glyph, { stroke: def.stroke }) : def.label ? labelTexture(def.label) : null;
  if (tex) g.add(at(sprite(tex, 0.5, 0.5), 0, 0.9, -0.45));
  return g;
}

// Frees geometry and per-object textures. Shared toon materials from mat() stay alive on purpose.
export function dispose(object) {
  object.traverse((n) => {
    n.geometry?.dispose();
    if (n.isSprite || n.isPoints || n.material?.map) { n.material.map?.dispose(); n.material.dispose(); }
  });
}
```
`"Lilita One"` falls back to system-ui until Task 9 adds the font.

- [ ] **Step 2: Write `src/world.js`**

```js
import * as THREE from 'three';
import * as gfx from './gfx.js';
import { generate, normalizeLevel, rng, sectionAt } from './generator.js';
import { laneX, obstacleBox, updateObstacle, reach } from './rules.js';
import { safeCall } from './registry.js';

const CHUNK = 120;  // metres built at a time (a multiple of ROW_GAP)
const AHEAD = 200;  // keep this much street built ahead of the player
const BEHIND = 15;  // drop things this far behind
export const ROAD_HALF = 4.5;

// The default street: road, sidewalks, lane dashes and plain toon blocks. A theme may replace it with createChunk.
export function defaultChunk(g, { z0, length, lanes, rng: r, theme }) {
  const grp = g.group(g.box(ROAD_HALF * 2, 0.1, length, g.palette.road, 0, -0.05, z0 + length / 2));
  for (const side of [-1, 1]) grp.add(g.box(3, 0.25, length, g.palette.sidewalk, side * (ROAD_HALF + 1.5), 0.125, z0 + length / 2));
  for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) grp.add(g.box(0.12, 0.02, 3, g.palette.lane, x, 0.01, z + 1.5));
  const b = theme.buildings;
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    const depth = 8 + r() * 6, h = b.minH + r() * (b.maxH - b.minH);
    grp.add(g.box(10, h, depth - 0.5, b.colors[Math.floor(r() * b.colors.length)], side * (ROAD_HALF + 8), h / 2, z + depth / 2));
    z += depth;
  }
  return grp;
}

export function createWorld(scene, level, { registry, rules, seed, end }) {
  const norm = normalizeLevel(level);
  const r = rng(seed), rs = rng(seed ^ 0x9e3779b9); // scenery has its own rng so it never shifts the street
  const root = new THREE.Group();
  scene.add(root);
  const live = { obstacles: [], pickups: [] };
  const chunks = [];
  const lanes = { count: 3, width: rules.laneWidth, roadHalf: ROAD_HALF };
  let builtTo = 0;
  const drop = (obj) => { root.remove(obj); gfx.dispose(obj); };
  const fallbackView = () => ({ object: gfx.box(1, 1, 1, '#ff00ff') }); // a loud pink block instead of a crash

  function build() {
    const { obstacles, pickups } = generate(norm, r, builtTo, builtTo + CHUNK, registry, rules);
    for (const o of obstacles) {
      o.def = registry.obstacle[o.id];
      o.view = safeCall(`obstacle ${o.id} createView`, () => o.def.createView(gfx, o), null) ?? fallbackView();
      o.view.object.position.set(laneX(o.lane, rules), 0, o.z);
      root.add(o.view.object);
      live.obstacles.push(o);
    }
    for (const p of pickups) {
      p.def = registry.pickup[p.id];
      p.view = safeCall(`pickup ${p.id} createView`, () => (p.def.createView ? p.def.createView(gfx) : { object: gfx.orb(p.def) }), null) ?? fallbackView();
      p.view.object.position.set(laneX(p.lane, rules), 0, p.z);
      root.add(p.view.object);
      live.pickups.push(p);
    }
    const section = sectionAt(norm, builtTo);
    const themeDef = registry.theme[section.theme.id];
    const theme = { ...themeDef, ...section.theme };
    const args = { z0: builtTo, length: CHUNK, lanes, rng: rs, theme };
    const g = safeCall(`theme ${theme.id} createChunk`, () => (themeDef.createChunk ? themeDef.createChunk(gfx, args) : defaultChunk(gfx, args)), null) ?? new THREE.Group();
    root.add(g);
    chunks.push({ z: builtTo, g });
    builtTo += CHUNK;
  }

  function update(run, dt) {
    while (builtTo < Math.min(end, run.z + AHEAD)) build();
    const behind = run.z - BEHIND;
    for (const list of [live.obstacles, live.pickups]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].z < behind) { drop(list[i].view.object); list.splice(i, 1); }
    }
    while (chunks.length && chunks[0].z + CHUNK < behind) drop(chunks.shift().g);
    for (const o of live.obstacles) {
      updateObstacle(o, o.def, run, dt);
      if (o.x !== undefined) o.view.object.position.x = o.x;
      const active = obstacleBox(o, o.def, run.time, rules) !== null;
      if (o.view.update) safeCall(`obstacle ${o.id} update`, () => o.view.update(o, run, dt, active));
    }
    const pull = reach(run);
    for (const p of live.pickups) {
      p.view.object.rotation.y = run.time * 3;
      if (pull > 0 && p.z - run.z < pull) p.view.object.position.x += (run.x - p.view.object.position.x) * 0.2;
      if (p.view.update) safeCall(`pickup ${p.id} update`, () => p.view.update(p, run, dt));
    }
  }

  const skyAt = (z) => {
    const s = sectionAt(norm, z), t = registry.theme[s.theme.id];
    return { sky: s.theme.sky ?? t.sky, fog: s.theme.fog ?? t.fog };
  };
  function removePickup(p) { live.pickups.splice(live.pickups.indexOf(p), 1); drop(p.view.object); }
  function dispose() { scene.remove(root); gfx.dispose(root); }

  return { live, update, removePickup, skyAt, dispose };
}
```

- [ ] **Step 3: Write `src/character.js`**

```js
import * as gfx from './gfx.js';

const cache = new Map();

// One view per character id per session. A level picks its character by id; the engine never names one.
export function loadCharacter(def) {
  if (!cache.has(def.id)) {
    cache.set(def.id, Promise.resolve().then(() => def.createView(gfx)).catch((err) => {
      console.warn(`character ${def.id} createView failed:`, err);
      return fallbackView(def);
    }));
  }
  return cache.get(def.id);
}

function fallbackView(def) {
  const object = gfx.group(gfx.box(def.width * 0.7, def.height, def.width * 0.5, '#ff00ff', 0, def.height / 2));
  return { object, update(run) { object.position.set(run.x, run.y, run.z); }, pose() {}, dispose() {} };
}
```

- [ ] **Step 4: Write the real Milkshake view in `content/characters/milkshake.js`** (the style sheet's back view: rounded box, white ears with lavender inner, lavender horns, hands, tail tuft, udder, muzzle, hoof tips, blob shadow)

```js
export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: 0,

  async createView(gfx) {
    const P = gfx.palette;
    const root = gfx.group(gfx.blobShadow(0.55));
    const shadow = root.children[0];
    const body = gfx.group();
    root.add(body);
    let model, arms = [], legs = [];
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${this.model}`);
      model = gltf.scene;
      model.rotation.y = this.yaw;
      const size = new gfx.three.Box3().setFromObject(model).getSize(new gfx.three.Vector3());
      model.scale.setScalar(this.height / size.y);
      model.position.y -= new gfx.three.Box3().setFromObject(model).min.y;
    } catch {
      ({ model, arms, legs } = shapeCow(gfx)); // no GLB yet, or a bad one: the shape-built cow
    }
    body.add(model);

    const pose = (time, { sliding = false, over = false, lean = 0, airborne = false } = {}) => {
      const stride = airborne || sliding || over ? 0 : Math.sin(time * 14);
      body.position.y = Math.abs(stride) * 0.08;
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.z = lean;
      body.rotation.x = over ? 0.9 : sliding ? -0.3 : 0;
      legs.forEach((l, i) => (l.rotation.x = stride * 0.7 * (i ? 1 : -1)));
      arms.forEach((a, i) => (a.rotation.x = stride * 0.7 * (i ? -1 : 1)));
    };
    return {
      object: root,
      pose,
      update(run) {
        root.position.set(run.x, run.y, run.z);
        shadow.position.y = -run.y + 0.01; // the shadow stays on the road while Milkshake jumps
        pose(run.time, { sliding: run.slideT > 0, over: run.over, lean: ((1 - run.lane) * run.rules.laneWidth - run.x) * 0.12, airborne: run.y > 0 });
      },
      dispose() { gfx.dispose(root); },
    };
  },
};

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

- [ ] **Step 5: Replace the obstacle views with the style-sheet drawings** (metadata unchanged)

```js
// content/obstacles/taxi.js
export default {
  kind: 'obstacle', id: 'taxi', avoid: 'lane', box: { w: 2.0, h: 1.5, d: 4.0 },
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(
      gfx.box(2.0, 0.9, 4.0, P.taxi),
      gfx.box(1.7, 0.45, 2.0, P.glass, 0, 1.125, -0.2),
      gfx.box(1.7, 0.15, 2.0, P.taxi, 0, 1.425, -0.2),
      gfx.box(0.6, 0.15, 0.3, P.lane, 0, 1.58, -0.2),
    );
    for (const x of [-0.7, 0.7]) g.add(gfx.box(0.3, 0.12, 0.05, P.rider, x, 0.65, -2.0));
    for (const [x, z] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) { const w = gfx.cyl(0.33, 0.33, 0.25, P.dark, x, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
```
```js
// content/obstacles/barrier_low.js
export default {
  kind: 'obstacle', id: 'barrier_low', avoid: 'jump', box: { w: 2.2, h: 0.9, d: 0.4 },
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.box(0.15, 0.9, 0.4, P.lane, -0.9), gfx.box(0.15, 0.9, 0.4, P.lane, 0.9), gfx.box(2.2, 0.3, 0.15, P.hazard, 0, 0.7)) };
  },
};
```
```js
// content/obstacles/scaffold_beam.js
export default {
  kind: 'obstacle', id: 'scaffold_beam', avoid: 'slide', box: { w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.box(0.15, 1.6, 0.15, P.metal, -1.15, 0.8), gfx.box(0.15, 1.6, 0.15, P.metal, 1.15, 0.8), gfx.box(2.4, 0.4, 0.6, P.hazard, 0, 1.4)) };
  },
};
```
```js
// content/obstacles/hot_dog_cart.js
export default {
  kind: 'obstacle', id: 'hot_dog_cart', avoid: 'jump', box: { w: 1.8, h: 1.0, d: 1.6 },
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(1.8, 0.85, 1.6, P.lane, 0, 0.425), gfx.box(1.8, 0.15, 1.6, P.hazard, 0, 0.925),
      gfx.box(1.82, 0.11, 1.62, P.rider, 0, 0.55), gfx.box(1.82, 0.11, 1.62, P.taxi, 0, 0.38));
    for (const x of [-0.95, 0.95]) { const w = gfx.cyl(0.22, 0.22, 0.1, P.dark, x, 0.22, 0.3); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
```
```js
// content/obstacles/manhole_steam.js
export default {
  kind: 'obstacle', id: 'manhole_steam', avoid: 'timing', box: { w: 2.0, h: 2.5, d: 1.0 }, cycle: { period: 1.5, on: 0.5 },
  createView(gfx) {
    const P = gfx.palette;
    const plume = gfx.group(...[[0, 0.5, 0.4], [-0.25, 1.1, 0.5], [0.25, 1.65, 0.6], [-0.1, 2.3, 0.62], [0.35, 2.75, 0.42]].map(([x, y, r]) => gfx.sphere(r, '#ffffff', x, y)));
    const g = gfx.group(gfx.cyl(1.15, 1.15, 0.04, P.hazard, 0, 0.02), gfx.cyl(1, 1, 0.06, P.dark, 0, 0.04), plume);
    return { object: g, update(o, run, dt, active) { plume.visible = active; } };
  },
};
```
```js
// content/obstacles/pigeons.js
export default {
  kind: 'obstacle', id: 'pigeons', avoid: 'slide', box: { w: 2.4, h: 0.6, d: 1.0, y: 1.1 },
  createView(gfx) {
    const P = gfx.palette;
    const wings = [];
    const g = gfx.group(gfx.blobShadow(1.1, 0.18));
    [-0.95, -0.45, 0.05, 0.5, 0.95].forEach((x, i) => {
      const y = i % 2 ? 1.48 : 1.25;
      const body = gfx.sphere(0.14, P.pigeon, x, y); body.scale.set(1.5, 1, 1);
      const beak = gfx.cone(0.04, 0.12, P.hazard, x + 0.26, y + 0.07); beak.rotation.z = -Math.PI / 2;
      const wing = gfx.box(0.5, 0.03, 0.18, P.pigeon, x, y + 0.05); wing.position.y = y + 0.05; wings.push(wing);
      g.add(body, gfx.sphere(0.08, P.pigeon, x + 0.17, y + 0.08), beak, wing);
    });
    return { object: g, update(o, run) { wings.forEach((w, i) => (w.rotation.z = Math.sin(run.time * 12 + i) * 0.6)); } };
  },
};
```
```js
// content/obstacles/delivery_bike.js
export default {
  kind: 'obstacle', id: 'delivery_bike', avoid: 'lane', box: { w: 0.8, h: 1.4, d: 1.8 }, moves: true,
  createView(gfx) {
    const P = gfx.palette;
    const g = gfx.group(gfx.box(0.1, 0.1, 1.2, P.dark, 0, 0.45), gfx.box(0.5, 0.45, 0.45, P.hazard, 0, 0.85, -0.55),
      gfx.capsule(0.22, 0.4, P.rider, 0, 1.0), gfx.sphere(0.16, P.dark, 0, 1.42));
    for (const z of [-0.6, 0.6]) { const w = gfx.cyl(0.33, 0.33, 0.1, P.dark, 0, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w); }
    return { object: g };
  },
};
```
```js
// content/pickups/jug.js
export default {
  kind: 'pickup', id: 'jug', color: '#ffffff', value: 1,
  glyph: 'M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z',
  createView(gfx) {
    const P = gfx.palette;
    return { object: gfx.group(gfx.blobShadow(0.3), gfx.glow(0.45, P.lavender, 0.85),
      gfx.cyl(0.25, 0.28, 0.45, P.jug, 0, 0.775), gfx.cyl(0.12, 0.25, 0.15, P.jug, 0, 1.075), gfx.cyl(0.12, 0.12, 0.14, P.lavender, 0, 1.22)) };
  },
};
```

- [ ] **Step 6: Write `index.html` (full shell) and `src/style.css`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Milkshake Runner</title>
</head>
<body>
  <canvas id="game"></canvas>
  <div id="hud" hidden>
    <div class="bar">
      <div class="pill" id="jugpill"><svg viewBox="0 0 28 28" width="18" height="24"><path d="M9,11 L12,6 H16 L19,11 V22 a2,2 0 0 1 -2,2 H11 a2,2 0 0 1 -2,-2 Z" fill="#fff"/><rect x="11.5" y="2" width="5" height="4" rx="1" fill="#b9a6e8"/></svg><span id="jugs">0</span></div>
      <div id="progress"><div></div></div>
      <button id="pause" aria-label="Pause"></button>
    </div>
    <div id="powerups"></div>
  </div>
  <div id="ring"></div>
  <div id="overlay" hidden></div>
  <div id="card" hidden></div>
  <section id="menu" class="screen" hidden>
    <h1 class="wordmark">MILKSHAKE<br>RUNNER</h1>
    <div class="spacer"></div>
    <button id="play" class="primary">RUN</button>
    <div class="row"><button id="levels">LEVELS</button><button id="endless" hidden>ENDLESS</button></div>
    <p class="hint">Swipe, or use the arrow keys · Esc pauses</p>
  </section>
  <section id="select" class="screen panel" hidden>
    <h2>Levels</h2>
    <div id="level-list"></div>
    <button id="back">BACK</button>
  </section>
  <section id="results" class="screen panel" hidden>
    <h2 id="result-title"></h2>
    <p id="result-jugs"></p>
    <button id="again" class="primary">RUN AGAIN</button>
    <button id="to-menu">MENU</button>
  </section>
  <section id="error" class="screen panel" hidden>
    <h2>This build has problems</h2>
    <ul id="error-list"></ul>
    <p>Fix the files above and reload. See CONTRIBUTING.md.</p>
  </section>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```
```css
:root { --ink: #1d1b26; --paper: #ffffff; --accent: #b9a6e8; --display: "Lilita One", system-ui, sans-serif; font-family: system-ui, sans-serif; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #9fd3f5; overscroll-behavior: none; }
#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }

#hud { position: fixed; inset: 0; pointer-events: none; padding: max(16px, env(safe-area-inset-top)) 16px 0; color: #fff; }
#hud .bar { display: flex; align-items: center; gap: 12px; }
.pill { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; border-radius: 22px; background: rgba(29, 27, 38, 0.84); font: 26px/28px var(--display); }
#progress { flex: 1; height: 10px; border-radius: 5px; background: rgba(29, 27, 38, 0.4); overflow: hidden; }
#progress > div { height: 100%; width: 0; background: #fff; }
#pause { pointer-events: auto; width: 44px; height: 44px; border-radius: 50%; border: 0; background: #fff; position: relative; }
#pause::before, #pause::after { content: ''; position: absolute; top: 14px; width: 5px; height: 16px; border-radius: 2px; background: var(--ink); }
#pause::before { left: 15px; } #pause::after { left: 24px; }
#powerups { display: flex; gap: 8px; margin-top: 8px; }
.chip { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border-radius: 18px; background: rgba(29, 27, 38, 0.84); font: 20px/24px var(--display); }
.chip svg { width: 28px; height: 28px; }
.chip .secs:empty { display: none; }
.chip:has(.secs:empty) { padding-right: 4px; }
#hud.hit { animation: hit 0.3s; }
@keyframes hit { 50% { background: rgba(77, 195, 255, 0.35); } }

#overlay, #card { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: #fff; font: clamp(28px, 7vw, 56px)/1.1 var(--display); text-shadow: 0 4px 0 rgba(29, 27, 38, 0.6); }
#overlay { background: rgba(29, 27, 38, 0.35); }
#card { pointer-events: none; place-items: end center; padding-bottom: 12vh; }
#card .banner { padding: 18px 24px; border-radius: 26px; background: var(--accent); color: var(--ink); text-shadow: none; box-shadow: 0 7px 0 var(--ink); font-size: clamp(22px, 5.5vw, 40px); }
#card .banner small { display: block; font-size: 0.5em; }
#ring { position: fixed; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle, transparent 30%, var(--accent) 45%, transparent 60%); }
#ring.go { animation: ring 0.6s ease-out; }
@keyframes ring { 0% { opacity: 1; transform: scale(0.2); } 100% { opacity: 0; transform: scale(2.5); } }

.screen { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; padding: max(72px, env(safe-area-inset-top) + 48px) 32px max(24px, env(safe-area-inset-bottom)); gap: 12px; text-align: center; color: var(--ink); }
.screen.panel { background: var(--paper); justify-content: center; overflow-y: auto; }
.spacer { flex: 1; }
.wordmark { margin: 0; font: clamp(44px, 15vw, 64px)/0.95 var(--display); color: #fff; text-shadow: 0 5px 0 var(--ink); }
.screen button { min-width: 150px; min-height: 48px; padding: 0 24px; border: 0; border-radius: 24px; font: 20px/24px var(--display); color: var(--ink); background: #fff; cursor: pointer; }
.screen button.primary { width: 100%; max-width: 360px; min-height: 60px; font-size: 30px; background: var(--accent); box-shadow: 0 5px 0 var(--ink); }
.screen .row { display: flex; gap: 12px; width: 100%; max-width: 360px; }
.screen .row button { flex: 1; min-width: 0; }
.hint { font: 500 13px/16px system-ui, sans-serif; color: #fff; margin: 0; }
.panel h2 { font: 44px/48px var(--display); margin: 0 0 8px; }
.panel button { background: var(--ink); color: #fff; }
.panel button.primary { color: var(--ink); }
.panel button:disabled { opacity: 0.45; cursor: default; }
#level-list { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 420px; }
#level-list button { width: 100%; text-align: left; display: flex; flex-direction: column; align-items: flex-start; padding: 10px 20px; font-size: 20px; }
#level-list small { font: 500 13px/18px system-ui, sans-serif; opacity: 0.8; }
#error-list { max-width: 640px; text-align: left; font: 500 15px/22px system-ui, sans-serif; }
```

- [ ] **Step 7: Write `src/levels.js`**

```js
import { validateAll, validateCampaign } from './validate.js';
import { orderLevels } from './campaign.js';
import index from '../levels/index.json';
import campaign from '../levels/campaign.json';

const files = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });
const fixtureFiles = import.meta.glob('../test/fixtures/levels/*.json', { eager: true, import: 'default' });

// Loads every level file, validates all of them with the same code CI runs, and keeps the valid ones playable.
// `fixtures` adds the test pack's levels for the manual pass (dev only, ?fixtures in the URL).
export function loadLevels(registry, { fixtures = false } = {}) {
  const levels = {};
  for (const [path, data] of Object.entries(fixtures ? { ...files, ...fixtureFiles } : files)) {
    const id = path.split('/').pop().slice(0, -'.json'.length);
    if (!['index', 'campaign'].includes(id)) levels[id] = data;
  }
  const errors = validateAll(levels, index, registry);
  const campaignErrors = validateCampaign(campaign, Object.keys(levels));
  if (campaignErrors.length) errors['campaign.json'] = campaignErrors;
  return { levels, campaign, errors, ...orderLevels(levels, index, errors) };
}
```
Add `orderLevels` to `src/campaign.js` now (Task 7 tests it):
```js
// Display order: the shipped index first, then every other level by title. Invalid files stay listed, disabled.
export function orderLevels(levels, index, errors) {
  const listed = index.filter((id) => levels[id]);
  const rest = Object.keys(levels).filter((id) => !index.includes(id)).sort((a, b) => String(levels[a].title).localeCompare(String(levels[b].title)));
  return { order: [...listed, ...rest], valid: (id) => !errors[`${id}.json`] };
}
```

- [ ] **Step 8: Write `src/hud.js`**

```js
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

// A power-up icon from its module: colour circle plus glyph path or label. Built with DOM calls, never innerHTML.
export function pickupIcon(def) {
  const svg = el('svg', { viewBox: '0 0 28 28' });
  svg.append(el('circle', { cx: 14, cy: 14, r: 14, fill: def.color }));
  if (def.glyph) svg.append(el('path', def.stroke ? { d: def.glyph, fill: 'none', stroke: '#fff', 'stroke-width': 3.6 } : { d: def.glyph, fill: '#fff' }));
  else if (def.label) { const t = el('text', { x: 14, y: 19, 'text-anchor': 'middle', fill: '#fff', 'font-size': 14, 'font-weight': 900 }); t.textContent = def.label; svg.append(t); }
  return svg;
}

export function createHud() {
  let onPause = () => {};
  let paused = false;
  $('pause').onclick = () => onPause();
  $('overlay').onclick = () => paused && onPause();
  const chips = $('powerups');

  return {
    show(on) { $('hud').hidden = !on; if (!on) { chips.replaceChildren(); chips.dataset.key = ''; } },
    onPause(fn) { onPause = fn; },
    update(run, level, registry) {
      $('jugs').textContent = run.jugs;
      $('progress').hidden = level.length_m === null;
      if (level.length_m) $('progress').firstElementChild.style.width = `${Math.min(100, (run.z / level.length_m) * 100)}%`;
      const key = Object.keys(run.effects).join(',');
      if (key !== chips.dataset.key) {
        chips.dataset.key = key;
        chips.replaceChildren(...Object.keys(run.effects).map((id) => {
          const c = document.createElement('div'); c.className = 'chip'; c.dataset.id = id;
          c.append(pickupIcon(registry.pickup[id]), Object.assign(document.createElement('span'), { className: 'secs' }));
          return c;
        }));
      }
      for (const c of chips.children) { const e = run.effects[c.dataset.id]; c.lastElementChild.textContent = e && Number.isFinite(e.t) ? Math.ceil(e.t) : ''; }
    },
    setPaused(on) { paused = on; $('overlay').textContent = on ? 'Paused · tap or press Esc' : ''; $('overlay').hidden = !on; },
    flash() { const h = $('hud'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); },
    async ring() { const r = $('ring'); r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); await wait(600); },
    async banner(text, ms = 1200) { const o = $('overlay'); o.textContent = text; o.hidden = false; await wait(ms); o.hidden = true; },
    async card(text, ms = 3000, sub = '') {
      const c = $('card');
      const b = document.createElement('div'); b.className = 'banner'; b.textContent = text;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
      c.replaceChildren(b); c.hidden = false; await wait(ms); c.hidden = true; c.replaceChildren();
    },
  };
}
```

- [ ] **Step 9: Write `src/game.js`**

```js
import { createRun, act, step, speedAt, playerBox, obstacleBox, overlaps, hit, inReach, collect, resolveRules } from './rules.js';
import { createWorld } from './world.js';
import { bindInput } from './input.js';

// Runs one level to its end. A content hook that throws ends the run with outcome 'error' instead of freezing.
export function playLevel({ engine, level, registry, hud, character, carryJugs = 0 }) {
  return new Promise((resolve) => {
    const rules = resolveRules(level.rules ?? {});
    const charDef = registry.character[level.character?.id ?? 'milkshake'];
    const run = createRun(rules, charDef, carryJugs);
    const streetAfter = level.ending ? (registry.ending[level.ending.id].streetAfter ?? 200) : 200;
    const world = createWorld(engine.scene, level, {
      registry, rules, seed: level.seed ?? ((Math.random() * 2 ** 32) >>> 0),
      end: level.length_m === null ? Infinity : level.length_m + streetAfter,
    });
    let paused = false, last = performance.now(), raf = 0, skyKey = '';

    const setPaused = (p) => { paused = p; hud.setPaused(p); last = performance.now(); };
    hud.onPause(() => setPaused(!paused));
    const unbind = bindInput(engine.renderer.domElement, (a) => { if (a === 'pause') setPaused(!paused); else if (!paused) act(run, a); });
    const onHide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onHide);
    hud.show(true);

    function tick(rawDt) {
      const dt = step(run, rawDt, speedAt(level, run.z, rules));
      world.update(run, dt);
      const me = playerBox(run);
      for (const o of world.live.obstacles) {
        const box = obstacleBox(o, o.def, run.time, rules);
        if (box && overlaps(me, box) && hit(run) === 'shield') hud.flash();
      }
      for (const p of [...world.live.pickups]) if (inReach(run, p)) { collect(run, p.def); world.removePickup(p); }
      const sky = world.skyAt(run.z), key = `${sky.sky}/${sky.fog}`;
      if (key !== skyKey) { skyKey = key; engine.setSky(sky); }
      character.update(run);
      engine.follow(run);
      hud.update(run, level, registry);
      if (run.over) end('dead');
      else if (level.length_m !== null && run.z >= level.length_m) end('complete');
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) {
        try { tick(dt); } catch (error) { console.error(error); end('error', error); return; }
      }
      engine.render();
    }

    function end(outcome, error) {
      cancelAnimationFrame(raf);
      unbind();
      document.removeEventListener('visibilitychange', onHide);
      hud.onPause(() => {});
      hud.show(false);
      hud.setPaused(false);
      resolve({ outcome, run, world, error }); // the caller disposes the world after any ending scene
    }

    raf = requestAnimationFrame(frame);
  });
}
```

- [ ] **Step 10: Temporary `src/main.js` that boots into the campaign start**

```js
import './style.css';
import { createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { loadLevels } from './levels.js';
import { loadCharacter } from './character.js';
import { createHud } from './hud.js';
import { playLevel } from './game.js';

async function main() {
  const engine = createEngine(document.getElementById('game'));
  const registry = loadRegistry({ fixtures: import.meta.env.DEV && location.search.includes('fixtures') });
  const { levels, campaign, errors } = loadLevels(registry);
  if (Object.keys(errors).length) console.warn(errors);
  const level = levels[campaign.start];
  const character = await loadCharacter(registry.character[level.character?.id ?? 'milkshake']);
  engine.scene.add(character.object);
  const hud = createHud();
  const { outcome, run } = await playLevel({ engine, level, registry, hud, character });
  hud.banner(`${outcome}: ${run.jugs} jugs. Reload to retry`, 1e9);
}
main();
```

- [ ] **Step 11: Run `npm test`.** Expected: all PASS (the pure modules are unchanged except `campaign.js` gaining `orderLevels`).

- [ ] **Step 12: Play it in the browser pane** (`preview_start`, then `/milkshake-runner/`). Check:
  - The street streams in; buildings are plain blocks; lane dashes converge.
  - Arrow keys change lanes (left goes screen-left); jump clears barriers and carts; slide clears beams and pigeons; steam blinks and only hurts while on.
  - Jugs count up; a special shows a chip with its icon and seconds; the shield chip has no number; a hit with the shield flashes the HUD.
  - Hitting a taxi ends the run with `dead`.
  - Milkshake is the shape cow (no GLB yet) with a shadow that stays on the road while jumping.
  - Switch tabs and back: Paused. No console errors.
  Send Caedon one screenshot with SendUserFile.

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "feat: gfx helpers, content views, world streaming, HUD and game loop (level 1 playable)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Screens, saved progress, campaign unlocks, level discovery, failure containment

**Files:**
- Create: `src/save.js`
- Modify: `src/main.js` (full flow), `test/logic.test.js` (append), `src/endings.js` (stub, replaced in Task 8)

**Interfaces:**
- Produces:
  - `save.js`: `loadSave(storage?) → { best: {}, completed: [] }`, `writeSave(save, storage?)`, `recordRun(save, id, jugs)`
  - `campaign.js` (from Task 3 and 6): `isLocked`, `completeLevel`, `orderLevels`
  - `main.js` calls `playEnding(ending, ctx) → { next?, carry? }` from `src/endings.js` (Task 8). Until then, the stub below.

- [ ] **Step 1: Append the failing tests to `test/logic.test.js`**

```js
import { loadSave, writeSave, recordRun } from '../src/save.js';
import { isLocked, completeLevel, orderLevels } from '../src/campaign.js';

const campaign = { start: 'a', locked: { b: 'a', endless: 'b' } };

test('blocked storage never breaks the game', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(blocked), { best: {}, completed: [] });
  assert.doesNotThrow(() => writeSave({ best: {}, completed: [] }, blocked));
  assert.deepEqual(loadSave(undefined), { best: {}, completed: [] });
  assert.deepEqual(loadSave({ getItem: () => 'not json' }), { best: {}, completed: [] });
});

test('save round-trips and best only goes up', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = loadSave(storage);
  recordRun(s, 'a', 10); recordRun(s, 'a', 4); completeLevel(s, 'a'); completeLevel(s, 'a');
  writeSave(s, storage);
  assert.deepEqual(loadSave(storage), { best: { a: 10 }, completed: ['a'] });
});

test('campaign locks come from the data, and community levels are open', () => {
  const s = { best: {}, completed: [] };
  assert.equal(isLocked(campaign, s, 'b'), true);
  assert.equal(isLocked(campaign, s, 'canal-street-dash'), false);
  completeLevel(s, 'a');
  assert.equal(isLocked(campaign, s, 'b'), false);
  assert.equal(isLocked(campaign, s, 'endless'), true);
});

test('shipped order first, community levels by title, invalid files listed but not playable', () => {
  const levels = { a: { title: 'A' }, b: { title: 'B' }, zed: { title: 'Alpha' }, bad: { title: 'Broken' } };
  const { order, valid } = orderLevels(levels, ['b', 'a', 'ghost'], { 'bad.json': ['nope'] });
  assert.deepEqual(order, ['b', 'a', 'zed', 'bad']);
  assert.equal(valid('a'), true);
  assert.equal(valid('bad'), false);
});
```

- [ ] **Step 2: Run it to confirm it fails.** Run `npm test`. Expected: FAIL with `Cannot find module '.../src/save.js'`.

- [ ] **Step 3: Write `src/save.js`**

```js
const KEY = 'milkshake-runner';
const fresh = () => ({ best: {}, completed: [] });

// Storage can be missing, blocked (private mode) or corrupt: the game must still play.
export function loadSave(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY) || '{}');
    const s = { ...fresh(), ...(data && typeof data === 'object' ? data : {}) };
    if (!Array.isArray(s.completed)) s.completed = [];
    if (!s.best || typeof s.best !== 'object') s.best = {};
    return s;
  } catch {
    return fresh();
  }
}
export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* progress just is not kept */ }
}
export function recordRun(save, id, jugs) { save.best[id] = Math.max(save.best[id] || 0, jugs); return save; }
```

- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: PASS.

- [ ] **Step 5: Write the `src/endings.js` stub** (Task 8 replaces it)

```js
export async function playEnding(ending, ctx) { await ctx.hud.banner('FINISH!', 1200); return {}; }
```

- [ ] **Step 6: Replace `src/main.js`**

```js
import './style.css';
import { createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { loadLevels } from './levels.js';
import { loadCharacter } from './character.js';
import { createHud } from './hud.js';
import { playLevel } from './game.js';
import { playEnding } from './endings.js';
import { createWorld } from './world.js';
import { createRun, resolveRules } from './rules.js';
import { loadSave, writeSave, recordRun } from './save.js';
import { isLocked, completeLevel } from './campaign.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'select', 'results', 'error'];
const show = (id) => SCREENS.forEach((s) => ($(s).hidden = s !== id));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (parent, tag, content, cls) => { const n = document.createElement(tag); n.textContent = content; if (cls) n.className = cls; parent.append(n); return n; };

function showErrors(errors) {
  // Community strings: textContent only.
  for (const [file, msgs] of Object.entries(errors)) text($('error-list'), 'li', `${file}: ${msgs.join('; ')}`);
  show('error');
}

async function main() {
  const engine = createEngine($('game'));
  const hud = createHud();
  const save = loadSave();
  const fixtures = import.meta.env.DEV && location.search.includes('fixtures');
  let registry;
  try { registry = loadRegistry({ fixtures }); }
  catch (err) { return showErrors({ 'content/': String(err.message).split('\n') }); }
  const { levels, campaign, order, errors, valid } = loadLevels(registry, { fixtures });
  if (errors['campaign.json'] || errors['index.json'] || !valid(campaign.start)) return showErrors(errors);
  if (Object.keys(errors).length) console.warn('Some levels are disabled:', errors);

  const defaultRules = resolveRules();
  let backdrop = null;
  const character = async (level) => {
    const view = await loadCharacter(registry.character[level.character?.id ?? 'milkshake']);
    if (!view.object.parent) engine.scene.add(view.object);
    return view;
  };

  async function menu() {
    const level = levels[campaign.start];
    const view = await character(level);
    for (const v of engine.scene.children.filter((c) => c.userData.character && c !== view.object)) engine.scene.remove(v);
    view.object.userData.character = true;
    if (!backdrop) backdrop = createWorld(engine.scene, level, { registry, rules: defaultRules, seed: 1, end: 400 });
    const idle = createRun(defaultRules, registry.character[level.character?.id ?? 'milkshake']);
    backdrop.update(idle, 0);
    view.update(idle);
    engine.setSky(backdrop.skyAt(0));
    engine.follow(idle);
    engine.render();
    $('endless').hidden = !levels.endless || isLocked(campaign, save, 'endless');
    show('menu');
  }

  function levelSelect() {
    const list = $('level-list');
    list.replaceChildren();
    for (const id of order) {
      const lv = levels[id], b = document.createElement('button');
      const locked = isLocked(campaign, save, id), broken = !valid(id);
      text(b, 'span', String(lv.title ?? id));
      const bits = [`by ${lv.author ?? 'unknown'}`];
      if (save.best[id]) bits.push(`best ${save.best[id]}`);
      if (locked) bits.push('locked');
      if (broken) bits.push(`needs fixing: ${errors[`${id}.json`][0]}`);
      text(b, 'small', bits.join(' · '));
      b.disabled = locked || broken;
      b.onclick = () => startLevel(id);
      list.append(b);
    }
    show('select');
  }

  async function startLevel(id, carry = 0) {
    show(null);
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    const level = levels[id];
    const view = await character(level);
    let result;
    try {
      result = await playLevel({ engine, level, registry, hud, character: view, carryJugs: carry });
    } catch (error) {
      console.error(error);
      result = { outcome: 'error', run: { jugs: carry }, world: null, error };
    }
    const { outcome, run, world } = result;
    let flow = {};
    if (outcome === 'complete') {
      flow = await playEnding(level.ending, { engine, level, registry, run, hud, character: view, rules: run.rules });
      completeLevel(save, id);
    } else { engine.render(); await wait(900); }
    recordRun(save, id, run.jugs);
    writeSave(save);
    world?.dispose();
    if (flow.next && levels[flow.next] && valid(flow.next)) return startLevel(flow.next, flow.carry ? run.jugs : 0);

    $('result-title').textContent = outcome === 'complete' ? `${level.title}: cleared!` : outcome === 'dead' ? 'Bonk!' : 'This level broke';
    $('result-jugs').textContent = outcome === 'error' ? `Something in "${level.title}" threw an error. The other levels still work.` : `${run.jugs} jugs · best ${save.best[id]}`;
    $('again').onclick = () => startLevel(id);
    show('results');
  }

  $('play').onclick = () => startLevel(campaign.start);
  $('levels').onclick = levelSelect;
  $('endless').onclick = () => startLevel('endless');
  $('back').onclick = menu;
  $('to-menu').onclick = menu;
  await menu();
}
main();
```

- [ ] **Step 7: Check it in the browser.**
  - The menu shows the street behind the wordmark, with RUN, LEVELS and (once unlocked) ENDLESS.
  - RUN plays level 1 to a FINISH banner, then returns to results (the real transition comes in Task 8).
  - Level select shows level 2 and Endless locked on a fresh profile (`localStorage.clear()` via `javascript_tool`, reload).
  - Break a level: edit `levels/02-garden.json` to `"obstacles": {"tank": 1}`. The level list shows "needs fixing: … unknown obstacle "tank"" on that entry only, and level 1 still plays. **Revert the edit.**
  - Break the start level the same way: the error screen shows. **Revert.**
  - Console errors: none.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: menu over the live street, level select with campaign locks, saved progress, per-level failure containment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Endings as modules with flow results

**Files:**
- Modify: `src/endings.js` (replace the stub), `content/endings/transition.js`, `content/endings/arena_five.js`, `content/endings/finish.js`

**Interfaces:**
- Consumes: `engine`, `gfx`, `character` view (`object`, `pose`), `hud` (`ring`, `card`, `banner`), `run`, `level`, `registry`, `rules`
- Produces: `playEnding(ending | undefined, ctx) → Promise<{ next?, carry? }>`; it resolves params with the module's defaults and wraps `run` in a try/catch (a throwing ending ends like `finish`).

- [ ] **Step 1: Write `src/endings.js`**

```js
import * as gfx from './gfx.js';

const FINISH = { id: 'finish' };

// Resolves params (defaults from the module) and runs the ending. Endings only present; main applies the flow.
export async function playEnding(ending = FINISH, ctx) {
  const def = ctx.registry.ending[ending.id] ?? ctx.registry.ending.finish;
  const params = {};
  for (const [k, s] of Object.entries(def.params ?? {})) params[k] = ending.params?.[k] ?? s.default;
  try {
    const flow = await def.run({ ...ctx, gfx, params });
    return flow && typeof flow === 'object' ? flow : {};
  } catch (err) {
    console.warn(`ending ${def.id} failed:`, err);
    if (def.id !== 'finish') await ctx.hud.banner('FINISH!', 1200);
    return {};
  }
}
```

- [ ] **Step 2: Write `content/endings/finish.js`**

```js
export default {
  kind: 'ending', id: 'finish',
  params: { text: { type: 'string', max: 40, default: 'FINISH!' } },
  async run(ctx) { await ctx.hud.banner(ctx.params.text, 1200); return {}; },
};
```

- [ ] **Step 3: Write `content/endings/transition.js`** (the Broadway turn plus the glow ring)

```js
const ease = (t) => t * t * (3 - 2 * t);
const CAM_OFFSET = [-3, 3.5, 11]; // side shot of the turn; calibration knob, tune in the manual pass

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t, now / 1000); engine.render(); if (t < 1) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
}

export default {
  kind: 'ending', id: 'transition',
  params: { next: { type: 'level' } },
  async run({ engine, character, hud, params, gfx }) {
    const V = gfx.three.Vector3;
    const start = character.object.position.clone();
    const camFrom = engine.camera.position.clone();
    const camTo = start.clone().add(new V(...CAM_OFFSET));
    await animate(engine, 1500, (t, time) => {
      const e = ease(t);
      character.object.rotation.y = (e * Math.PI) / 2; // turn to face +x: a left turn up Broadway
      character.object.position.set(start.x + e * e * 8, start.y, start.z + e * 6);
      character.pose(time);
      engine.camera.position.lerpVectors(camFrom, camTo, e);
      engine.camera.lookAt(character.object.position.x, 1.2, character.object.position.z);
    });
    await hud.ring();
    character.object.rotation.y = 0;
    return { next: params.next, carry: true };
  },
};
```

- [ ] **Step 4: Write `content/endings/arena_five.js`** (board 07 of the style sheet: plaza, arena wall with two lavender rings, "THE GARDEN" sign, orange tip-off circle, five stand-ins 1.45 m apart in a shallow V, Milkshake walks up, the camera circles once while confetti falls, the lavender card)

```js
const ease = (t) => t * t * (3 - 2 * t);
const NUMBERS = [7, 12, 23, 31, 44];                                   // made-up stand-ins, no real players
const SKIN = ['#8d5a3b', '#c68e62', '#5a3a24', '#e0b08a', '#a8714a'];

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t, now / 1000); engine.render(); if (t < 1) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
}

function player(gfx, x, z, i) {
  const P = gfx.palette, jersey = i % 2 ? P.jerseyB : P.jerseyA, skin = SKIN[i];
  const g = gfx.group(gfx.blobShadow(0.45));
  for (const dx of [-0.14, 0.14]) g.add(gfx.box(0.22, 0.7, 0.22, skin, dx, 0.35), gfx.box(0.28, 0.08, 0.3, P.dark, dx, 0.04));
  g.add(gfx.box(0.8, 0.35, 0.4, P.lane, 0, 0.87), gfx.roundedBox(0.8, 0.85, 0.4, 0.12, jersey, 0, 1.47));
  for (const dx of [-0.52, 0.52]) g.add(gfx.capsule(0.09, 0.5, skin, dx, 1.35));
  g.add(gfx.sphere(0.28, skin, 0, 2.15));
  const number = gfx.sprite(gfx.textTexture(String(NUMBERS[i]), { w: 256, h: 256, font: '900 170px "Lilita One", system-ui, sans-serif' }), 0.55, 0.55);
  number.position.set(0, 1.5, -0.3);
  g.add(number);
  g.position.set(x, 0, z);
  return g;
}

function confetti(gfx, center) {
  const T = gfx.three, n = 300, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const colors = [gfx.palette.jerseyA, gfx.palette.jerseyB, gfx.palette.lavender, '#ffffff', gfx.palette.x2].map((c) => new T.Color(c));
  for (let i = 0; i < n; i++) {
    pos.set([center.x + (Math.random() - 0.5) * 14, center.y + Math.random() * 10, center.z + (Math.random() - 0.5) * 10], i * 3);
    colors[i % colors.length].toArray(col, i * 3);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.18, vertexColors: true }));
  pts.fall = (dt) => { for (let i = 1; i < pos.length; i += 3) pos[i] = pos[i] < 0 ? center.y + 10 : pos[i] - dt * 3; geo.attributes.position.needsUpdate = true; };
  return pts;
}

export default {
  kind: 'ending', id: 'arena_five', streetAfter: 0,
  params: { text: { type: 'string', max: 60, default: 'Season tip-off. Brought to you by Milkshake.' } },
  async run({ engine, character, hud, params, gfx, level }) {
    const P = gfx.palette, T = gfx.three;
    const z0 = level.length_m;                 // the street ends here; the plaza starts here
    const c = new T.Vector3(0, 0, z0 + 16.5);  // plaza centre, where the five wait
    const g = gfx.group(
      gfx.box(40, 0.2, 50, P.plaza, 0, 0.1, z0 + 25),
      gfx.cyl(18, 18, 12, P.arena, 0, 6, c.z + 28.5, { side: T.DoubleSide }),
      gfx.cyl(18.05, 18.05, 0.3, P.lavender, 0, 8.3, c.z + 28.5), gfx.cyl(18.05, 18.05, 0.3, P.lavender, 0, 5.7, c.z + 28.5),
    );
    const ring = new T.Mesh(new T.RingGeometry(3.4, 3.55, 48), new T.MeshBasicMaterial({ color: P.jerseyA }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.21, c.z + 1.5); g.add(ring);
    const sign = gfx.sprite(gfx.textTexture('THE GARDEN', { w: 1024, h: 224 }), 10, 2.2);
    sign.position.set(0, 7, c.z + 10.3); g.add(sign);
    NUMBERS.forEach((_, i) => g.add(player(gfx, (i - 2) * 1.45, c.z + 1.5 - Math.abs(i - 2) * 0.25, i)));
    engine.scene.add(g);

    const start = character.object.position.clone();
    character.object.rotation.set(0, 0, 0);
    await animate(engine, 1800, (t, time) => {
      character.object.position.set(start.x * (1 - t), 0, start.z + ease(t) * (c.z - 1.5 - start.z));
      character.pose(time);
      engine.camera.position.set(0, 4.4, character.object.position.z - 7);
      engine.camera.lookAt(0, 1.5, c.z + 1.5);
    });
    const pts = confetti(gfx, new T.Vector3(0, 1.5, c.z));
    g.add(pts);
    const card = hud.card(params.text.split('. ')[0].toUpperCase(), 4000, params.text.split('. ').slice(1).join('. '));
    await animate(engine, 4000, (t) => {
      const a = -Math.PI / 2 + t * Math.PI * 2; // start behind Milkshake, circle once
      engine.camera.position.set(Math.cos(a) * 8.5, 4.4, c.z + Math.sin(a) * 8.5);
      engine.camera.lookAt(0, 1.5, c.z);
      pts.fall(1 / 60);
    });
    await card;
    engine.scene.remove(g);
    gfx.dispose(g);
    return {};
  },
};
```
`hud.card(text, ms, sub)` splits "Season tip-off. Brought to you by Milkshake." into the big line and the small line, exactly as the style sheet shows.

- [ ] **Step 5: Check the endings in the browser.** Temporarily set `"length_m": 300` in both shipped levels.
  - Level 1 ends with the left turn, the side shot and the glow ring, then level 2 starts with the jug count carried.
  - Level 2's street stops at the finish line and opens onto the plaza (no buildings through the arena); the five stand-ins, THE GARDEN, the lavender rings, confetti and the card appear; then results, and ENDLESS appears on the menu.
  - Tune `CAM_OFFSET` if the turn frames badly. Screenshot both endings for Caedon. **Revert `length_m`** and run `npm test`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: endings as content modules returning flow results; Broadway turn and the Garden tip-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Milkshake model, Paper palette, display font (GATE: credits and downloads)

**Files:**
- Create: `public/milkshake.glb`, `public/fonts/LilitaOne-Regular.woff2` + `public/fonts/OFL.txt` (if Caedon approves the download), `docs/specs/style-sheet.md`
- Modify: `src/palette.js` (final values), `src/style.css` (`:root` vars and `@font-face`), `content/characters/milkshake.js` (`yaw`, only if the model needs it)

**Interfaces:** no new names; values only.

- [ ] **Step 1: Quote the model cost.** Load the Higgsfield `balance` and `generate_3d` tools with ToolSearch. Read the balance. Get the front image URL of the Milkshake-3D master render (job `97ba0692-9968-468c-8357-61e4bcd049ab`) with `show_generation_by_ids`. Use `models_explore` (`action: "recommend"`) for the `generate_3d` credit cost.

- [ ] **Step 2: STOP and ask Caedon two things in one message:** (a) "generate_3d on the Milkshake-3D front render costs N credits (balance M). Run it and download the GLB (about X MB) into `public/milkshake.glb`?" and (b) "Lilita One is the display font on the style sheet. Download the woff2 (about 30 KB, SIL Open Font Licence) into `public/fonts/`, or use a Google Fonts link, or stay on system fonts?" Wait for both answers.
  - **If no model:** skip Steps 3–4; the shape cow stays. **If no font:** skip Step 5; `var(--display)` already falls back to system-ui.

- [ ] **Step 3: Run `generate_3d`, wait with `jobs_wait`, then download the result**

```bash
curl -fL -o public/milkshake.glb "<GLB URL from the job result>" && ls -lh public/milkshake.glb
```
If the file is over 8 MB, shrink it and check the size again:
```bash
npx -y @gltf-transform/cli optimize public/milkshake.glb public/milkshake.glb --texture-compress webp
```

- [ ] **Step 4: Check the model in the browser.**
  - Milkshake must face away from the camera. If not, set `yaw` in `content/characters/milkshake.js` to `Math.PI`, `Math.PI / 2` or `-Math.PI / 2` until it does.
  - The bob and lean should read; the height should match the shape cow.
  - If the mesh is unusable (broken, wrong character), delete `public/milkshake.glb` (the shape cow returns) and tell Caedon.

- [ ] **Step 5: Add the font, if approved**

```bash
mkdir -p public/fonts && curl -fL -o public/fonts/LilitaOne-Regular.woff2 "<woff2 URL from fonts.googleapis.com css2 for Lilita One, found with a curl -A 'Mozilla/5.0' of https://fonts.googleapis.com/css2?family=Lilita+One>" && curl -fL -o public/fonts/OFL.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/lilitaone/OFL.txt" && ls -l public/fonts
```
Then at the top of `src/style.css`:
```css
@font-face { font-family: "Lilita One"; src: url("/milkshake-runner/fonts/LilitaOne-Regular.woff2") format("woff2"); font-display: swap; }
```
(With a Google Fonts link instead: add `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap">` to `index.html` and skip the download.)

- [ ] **Step 6: Apply the approved palette.** Re-read the Paper tokens (`get_tokens`, fileId `01M46QWM611CXK4WQSBTH6FJK3`, `types: ["color"]`). Copy every value into `PALETTE` in `src/palette.js` (22 keys) and set `--ink`, `--paper`, `--accent` in `src/style.css`. Keep `jerseyA`/`jerseyB` off the Knicks' exact `#f58426`/`#006bb6`; nudge them if Paper landed there. Write the table to `docs/specs/style-sheet.md` with the provenance header (`provenance: agent-generated`, `last-verified: never`) and a line naming the Paper file as the source.

- [ ] **Step 7: Run `npm test`, play level 1 briefly, send Caedon a screenshot.** Expected: tests PASS, no console errors, the HUD numbers are in Lilita One if the font was approved.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: generated Milkshake model, Paper-approved palette, display font

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The fixtures pack, acceptance tests, CONTRIBUTING, README

**Files:**
- Create: `test/fixtures/content/obstacles/demo/boulder.js`, `test/fixtures/content/pickups/demo/triple.js`, `test/fixtures/content/themes/demo/forest.js`, `test/fixtures/content/characters/demo/robot.js`, `test/fixtures/content/endings/demo/banner.js`, `test/fixtures/levels/demo-canal-street-dash.json`, `test/fixtures.test.js`, `CONTRIBUTING.md`, `README.md`

**Interfaces:**
- The fixtures are a complete community contribution written against the contracts in Task 2. They are the acceptance test of the whole plan: if any of them needs an edit under `src/`, fix `src/` so the next contributor does not.

- [ ] **Step 1: Write the failing test `test/fixtures.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildRegistry } from '../src/registry.js';
import { validateAll } from '../src/validate.js';
import { generate, normalizeLevel, rng } from '../src/generator.js';
import { resolveRules } from '../src/rules.js';
import { discover } from './helpers.js';

const here = (p) => new URL(p, import.meta.url);
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const fullRegistry = async () => buildRegistry([...(await discover(here('../content/').pathname)), ...(await discover(here('./fixtures/content/').pathname))]);

// The acceptance test for v2: a complete community pack installs with no edit under src/.
test('the fixtures pack registers alongside the shipped content', async () => {
  const reg = await fullRegistry();
  assert.ok(reg.obstacle['demo/boulder'] && reg.pickup['demo/triple'] && reg.theme['demo/forest'] && reg.character['demo/robot'] && reg.ending['demo/banner']);
  assert.equal(Object.keys(reg.obstacle).length, 8);
});

test('the demo level validates next to the shipped ones and lands its placements', async () => {
  const reg = await fullRegistry();
  const levelsDir = here('../levels/');
  const levels = Object.fromEntries(readdirSync(levelsDir).filter((f) => f.endsWith('.json') && !['index.json', 'campaign.json'].includes(f)).map((f) => [f.slice(0, -5), read(new URL(f, levelsDir))]));
  levels['demo-canal-street-dash'] = read(here('./fixtures/levels/demo-canal-street-dash.json'));
  assert.deepEqual(validateAll(levels, read(new URL('index.json', levelsDir)), reg), {});
  const level = levels['demo-canal-street-dash'];
  const { obstacles, pickups } = generate(normalizeLevel(level), rng(level.seed), 0, 900, reg, resolveRules(level.rules));
  assert.ok(obstacles.every((o) => o.z >= 150), 'the quiet intro is quiet');
  assert.ok(obstacles.some((o) => o.id === 'demo/boulder' && o.placed && o.z === 210));
  assert.ok(pickups.some((p) => p.id === 'demo/triple' && p.placed && p.z === 240));
});

test('the engine never names content (defaults jug, milkshake and finish excepted)', () => {
  const src = readdirSync(here('../src/').pathname).filter((f) => f.endsWith('.js')).map((f) => readFileSync(here(`../src/${f}`), 'utf8')).join('\n');
  for (const id of ['taxi', 'barrier_low', 'scaffold_beam', 'hot_dog_cart', 'manhole_steam', 'pigeons', 'delivery_bike', 'magnet', 'x2', 'downtown', 'midtown', 'uptown', 'arena_five', 'transition', 'demo/']) {
    assert.ok(!new RegExp(`['"\`]${id}['"\`]`).test(src), `src/ mentions "${id}"`);
  }
});
```

- [ ] **Step 2: Run it to confirm it fails.** Run `npm test`. Expected: FAIL (`ENOENT` on `test/fixtures/content/`).

- [ ] **Step 3: Write the fixtures pack**

```js
// test/fixtures/content/obstacles/demo/boulder.js
export default {
  kind: 'obstacle', id: 'demo/boulder', avoid: 'lane', box: { w: 1.8, h: 1.6, d: 1.8 },
  createView(gfx) { return { object: gfx.group(gfx.blobShadow(0.9, 0.15), gfx.sphere(0.9, '#7d7a72', 0, 0.8)) }; },
};
```
```js
// test/fixtures/content/pickups/demo/triple.js
export default { kind: 'pickup', id: 'demo/triple', color: '#2fd67b', duration: 6, effect: { multiplier: 3 }, label: '3×' };
```
```js
// test/fixtures/content/themes/demo/forest.js
export default {
  kind: 'theme', id: 'demo/forest', sky: '#bfe3c6', fog: 0.5,
  buildings: { colors: ['#2f6b3a', '#3f8a4c', '#275a30'], minH: 6, maxH: 14 },
  // A theme may replace the whole street: here a dirt road through toon pines instead of buildings.
  createChunk(gfx, { z0, length, lanes, rng }) {
    const g = gfx.group(gfx.box(lanes.roadHalf * 2, 0.1, length, '#6b5a3e', 0, -0.05, z0 + length / 2));
    for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) g.add(gfx.box(0.12, 0.02, 3, '#d8c9a3', x, 0.01, z + 1.5));
    const greens = this.buildings.colors;
    for (const side of [-1, 1]) for (let z = z0; z < z0 + length; z += 4 + rng() * 4) {
      const x = side * (lanes.roadHalf + 2 + rng() * 6), h = 3 + rng() * 5;
      g.add(gfx.cyl(0.2, 0.3, h * 0.4, '#5a3d22', x, h * 0.2, z), gfx.cone(1 + rng(), h * 0.7, greens[Math.floor(rng() * greens.length)], x, h * 0.75, z));
    }
    return g;
  },
};
```
```js
// test/fixtures/content/characters/demo/robot.js
export default {
  kind: 'character', id: 'demo/robot', height: 2.0, width: 0.9, model: null,
  async createView(gfx) {
    const root = gfx.group(gfx.blobShadow(0.5));
    const shadow = root.children[0];
    const body = gfx.group(gfx.box(0.7, 0.9, 0.5, '#9aa3ad', 0, 0.95), gfx.box(0.5, 0.5, 0.5, '#c9d1d9', 0, 1.7), gfx.box(0.3, 0.1, 0.05, '#2fd67b', 0, 1.75, 0.26));
    for (const s of [-1, 1]) body.add(gfx.box(0.2, 0.5, 0.2, '#6b7480', s * 0.2, 0.25), gfx.box(0.15, 0.7, 0.15, '#6b7480', s * 0.45, 1.0));
    root.add(body);
    const pose = (time, { sliding = false, over = false } = {}) => {
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.x = over ? 0.9 : 0;
      body.position.y = Math.abs(Math.sin(time * 14)) * 0.06;
    };
    return {
      object: root, pose,
      update(run) { root.position.set(run.x, run.y, run.z); shadow.position.y = -run.y + 0.01; pose(run.time, { sliding: run.slideT > 0, over: run.over }); },
      dispose() { gfx.dispose(root); },
    };
  },
};
```
```js
// test/fixtures/content/endings/demo/banner.js
export default {
  kind: 'ending', id: 'demo/banner',
  params: { text: { type: 'string', max: 40, default: 'YOU MADE IT' }, hold: { type: 'number', min: 0.5, max: 5, default: 2 } },
  async run(ctx) { await ctx.hud.banner(ctx.params.text, ctx.params.hold * 1000); return {}; },
};
```
```json
// test/fixtures/levels/demo-canal-street-dash.json
{
  "id": "demo-canal-street-dash",
  "title": "Canal Street Dash (demo)",
  "author": "demo",
  "length_m": 900,
  "seed": 42,
  "character": { "id": "demo/robot" },
  "theme": { "id": "demo/forest" },
  "rules": { "gravity": -24, "speed": { "start": 10, "end": 18 } },
  "obstacles": { "demo/boulder": 2, "barrier_low": 2, "pigeons": 1 },
  "density": { "start": 0.3, "end": 0.6 },
  "jugs": { "per_100m": 15, "powerups": ["demo/triple", "magnet"] },
  "sections": [
    { "from_m": 0, "to_m": 150, "density": { "start": 0, "end": 0 } },
    { "from_m": 150, "to_m": 300, "generation": false, "placements": [
      { "at_m": 180, "lane": 1, "kind": "obstacle", "id": "barrier_low" },
      { "at_m": 210, "lane": 0, "kind": "obstacle", "id": "demo/boulder" },
      { "at_m": 210, "lane": 2, "kind": "obstacle", "id": "demo/boulder" },
      { "at_m": 240, "lane": 1, "kind": "pickup", "id": "demo/triple" }
    ] }
  ],
  "ending": { "id": "demo/banner", "params": { "text": "CANAL STREET CLEARED" } }
}
```
(JSON has no comments; the `//` line above is the file name, not file content.)

- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: PASS, all four files. If "the engine never names content" fails, the fix belongs in `src/` (the engine special-cased something), not in the test.

- [ ] **Step 5: Write `CONTRIBUTING.md`**

````markdown
# Contributing to Milkshake Runner

Everything after level 2 comes from the community, and the game is built so you never have to touch
the engine. You can add two kinds of things:

- a **level**: one JSON file in `levels/`
- **content**: a one-file JavaScript module in `content/` (an obstacle, a pickup, a theme, a character or an ending)

Both go through a pull request. CI runs the same checks the game runs when it loads, so anything that
would break the game cannot merge. Everything under `src/` is the engine; you should not need to edit it.
If you find you do, open an issue: that is a bug in the engine's modularity, not in your contribution.

## 1. Add a level

1. Fork the repo. Add `levels/<your-level-id>.json`. The id is `a-z 0-9 -` and must equal the file name.
2. Do **not** edit `levels/index.json` or `levels/campaign.json`; your level is listed automatically after the shipped ones.
3. Check it: `npm ci && npm test`, then `npm run dev` and play it from **Levels**.
4. Open a pull request.

### A level that uses everything

```json
{
  "id": "canal-street-dash",
  "title": "Canal Street Dash",
  "author": "your-github-name",
  "length_m": 900,
  "seed": 42,
  "character": { "id": "milkshake" },
  "theme": { "id": "downtown", "sky": "#ffb38a", "fog": 0.5 },
  "rules": { "gravity": -24, "speed": { "start": 10, "end": 18 } },
  "obstacles": { "hot_dog_cart": 3, "delivery_bike": 2, "pigeons": 2, "taxi": 1 },
  "density": { "start": 0.3, "end": 0.6 },
  "jugs": { "per_100m": 15, "powerups": ["magnet", "x2"] },
  "sections": [
    { "from_m": 0, "to_m": 150, "density": { "start": 0, "end": 0 } },
    { "from_m": 150, "to_m": 300, "generation": false, "placements": [
      { "at_m": 180, "lane": 1, "kind": "obstacle", "id": "barrier_low" },
      { "at_m": 240, "lane": 0, "kind": "pickup", "id": "shield" }
    ] }
  ],
  "ending": { "id": "finish", "params": { "text": "CANAL STREET CLEARED" } }
}
```

| Field | Rule |
|---|---|
| `id`, `title`, `author` | id = file name; title and author 1 to 60 characters |
| `length_m` | whole number 100 to 10000 (300 to 5000 feels right); `null` = endless, which cannot have an ending |
| `seed` | optional whole number; the same seed always builds the same street |
| `character.id` | optional; a registered character (default `milkshake`) |
| `theme` | `id` of a registered theme; optional `sky` (hex) and `fog` (0 to 1) overrides |
| `rules` | optional; see the table below |
| `obstacles` | `{ id: weight }` from registered obstacles; weights above 0 |
| `density` | `start` and `end` from 0 to 1: how busy the street is at each end (0 is allowed) |
| `jugs` | `per_100m` 0 to 30; `powerups`: registered pickups that have an `effect` |
| `sections` | optional, ordered, non-overlapping; each may override `obstacles`, `density`, `jugs`, `theme`, turn `generation` off, and list `placements` |
| `placements` | `{ at_m, lane (0-2), kind (obstacle or pickup), id }` inside the section; a row may not block all three lanes with nothing to jump or slide |
| `ending` | optional; `id` of a registered ending plus its `params` |

Unknown keys anywhere are rejected, so a typo fails loudly instead of silently doing nothing.

Rules you can set (defaults in brackets): `laneWidth` 1.5–4 (2.5) · `laneTime` 0.05–0.5 (0.15) · `gravity` -60 to -10 (-30) · `jumpSpeed` 5–15 (9) · `fastFall` -40 to -5 (-15) · `slideTime` 0.3–2 (0.6) · `slideHeight` 0.4–1.5 (0.8) · `grace` 0–3 (1) · `speed.start` / `speed.end` 4–40 (12 / 20) · `speed.cap` 4–60 (28) · `speed.ramp` 0–0.05 (0.004). Fairness is checked against **your** rules: if you weaken the jump, barriers stop counting as jumpable.

## 2. Add content

Content is a one-file ES module with a default export. Pick a handle (your GitHub name is good) and save the file at
`content/<kind>s/<handle>/<name>.js` with `id: "<handle>/<name>"`. The registry rejects a wrong path, a duplicate id or missing fields, and tells you exactly what is wrong.

Modules receive `gfx` when they draw: `gfx.box(w, h, d, color, x, y, z)`, `gfx.cyl`, `gfx.sphere`, `gfx.capsule`, `gfx.cone`, `gfx.roundedBox`, `gfx.group(...)`, `gfx.blobShadow(r)`, `gfx.glow(r, color)`, `gfx.sprite`, `gfx.textTexture`, `gfx.palette` (the game's colours) and `gfx.three` if you need Three.js itself. Do not import `three` at the top of your file; tests import your module in Node.

Complete, working examples live in `test/fixtures/content/` (a boulder, a 3× pickup, a forest theme that replaces the street, a robot character, a banner ending) and `test/fixtures/levels/`. Run `npm run dev` and open `http://localhost:5173/milkshake-runner/?fixtures` to play them.

### Obstacle

```js
// content/obstacles/ari/boulder.js
export default {
  kind: 'obstacle', id: 'ari/boulder',
  avoid: 'lane',                        // lane | jump | slide | timing: how the player gets past it
  box: { w: 1.8, h: 1.6, d: 1.8 },      // collision box in metres; add y for something you slide under
  // cycle: { period: 1.5, on: 0.5 },   // timing obstacles only: hurts for `on` seconds every `period`
  // moves: true,                       // swerves one lane when the player gets close
  createView(gfx, o) {
    return { object: gfx.sphere(0.9, '#7d7a72', 0, 0.8) };   // optional: update(o, run, dt, active), dispose()
  },
};
```
Jumpable means `box.h` fits under the level's jump height (1.35 m by default); slidable means `box.y` is at or above the slide height (0.8 m).

### Pickup

```js
// content/pickups/ari/triple.js
export default {
  kind: 'pickup', id: 'ari/triple', color: '#2fd67b',
  duration: 6,                          // seconds, or 'untilHit', or leave out for an instant pickup
  effect: { multiplier: 3 },            // the engine knows reach (metres), multiplier and shield
  label: '3×',                          // or glyph: '<28x28 SVG path>' (+ stroke: true for an outline glyph)
  // value: 5,                          // instant pickups add jugs
};
```
Pickups without `createView` get the standard glowing orb with your glyph or label.

### Theme

```js
// content/themes/ari/forest.js
export default {
  kind: 'theme', id: 'ari/forest', sky: '#bfe3c6', fog: 0.5,
  buildings: { colors: ['#2f6b3a', '#3f8a4c'], minH: 6, maxH: 14 },   // used by the default street
  // createChunk(gfx, { z0, length, lanes, rng, theme }) { ... return an Object3D }  // replace the street entirely
};
```

### Character

```js
// content/characters/ari/robot.js
export default {
  kind: 'character', id: 'ari/robot', height: 2.0, width: 0.9, model: null,   // or model: 'robot.glb' in public/
  async createView(gfx) {
    const object = gfx.group(gfx.box(0.7, 2.0, 0.5, '#9aa3ad', 0, 1.0));
    return {
      object,
      update(run) { object.position.set(run.x, run.y, run.z); },   // called every frame
      pose(time, { sliding, over, lean, airborne }) {},             // called during endings
      dispose() { gfx.dispose(object); },
    };
  },
};
```

### Ending

```js
// content/endings/ari/banner.js
export default {
  kind: 'ending', id: 'ari/banner',
  params: { text: { type: 'string', max: 40, default: 'YOU MADE IT' } },   // types: string, number, level
  // streetAfter: 0,   // metres of street past the finish line (default 200)
  async run({ engine, character, hud, params, gfx, level }) {
    await hud.banner(params.text, 2000);
    return {};        // or { next: 'another-level-id', carry: true } to chain into another level
  },
};
```

## What you may change

- Your own files under `levels/` and `content/<kind>s/<your-handle>/`.
- Not `src/`, not the shipped modules, not `levels/index.json` or `levels/campaign.json`. If your idea needs an engine change, open an issue first.
- Level files are data; your text renders as text. Content modules are code and are reviewed as code before they merge.

Please keep it friendly: no real people, brands, team names or logos.
````

- [ ] **Step 6: Write `README.md`**

```markdown
# Milkshake Runner

PulsePoint's mascot Milkshake runs through Manhattan. Play: https://mrchopme.github.io/milkshake-runner/

- Levels 1 and 2 are built in. Everything after that comes from the community: levels are JSON files, and new obstacles, pickups, themes, characters and endings are one-file modules. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Dev: `npm ci && npm run dev` (add `?fixtures` to the URL to play the example community pack). Tests: `npm test`.
- Design: [docs/specs/](docs/specs/).
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "test: community fixtures pack as the modularity acceptance test; contributor guide

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Manual pass, PR, community PR demo

**Files:** none, unless the pass finds bugs. Fix those in their owning file, with a test if the logic is pure.

- [ ] **Step 1: Desktop pass in the browser pane** on a fresh profile (`localStorage.clear()` via `javascript_tool`, reload):
  - Menu → RUN → level 1 → the Broadway turn plus ring → level 2 (jugs carried) → the street ends at the plaza → the arena cutscene → results → ENDLESS appears → Endless runs for a minute with no lag. Expose `engine` on `window` temporarily and watch `renderer.info.memory.geometries` stay flat.
  - Each power-up is picked up at least once; chips show icon plus seconds; the shield chip has no number.
  - Esc pauses and resumes, and so does the pause button.
  - `?fixtures`: the level list shows "Canal Street Dash (demo)"; it plays with the robot, the forest, the boulders and the 3× pickup, and ends with the banner.
  - Break a community file: in `test/fixtures/levels/demo-canal-street-dash.json` change `"demo/boulder"` to `"demo/rock"`. Only that level shows "needs fixing"; everything else plays. Make `demo/boulder.js`'s `createView` throw: the pink fallback block appears and the run continues. Make `demo/banner.js`'s `run` throw: the level ends with FINISH!. **Revert all three.**
  - Console errors: none in the shipped game (the deliberate breakages log warnings).

- [ ] **Step 2: Phone pass.** `resize_window({ preset: "mobile" })`, reload. Check:
  - All three lanes are visible in portrait; the HUD clears the notch area; buttons are at least 44 px.
  - Swipe via touch events works (dispatch `touchstart`/`touchmove` on `#game` with `javascript_tool`): the lane changes and the page does not scroll.
  - Resize to landscape (812×375) mid-run: no stretching. Switch tabs: Paused.
  Then `resize_window({ preset: "desktop" })`.

- [ ] **Step 3: Review Focus check.** Go through the five Review Focus lines at the top of this plan and record pass or fail for each in the PR body.

- [ ] **Step 4: Run `npm test && npm run build`.** Expected: PASS, and `dist/` is built.

- [ ] **Step 5: Ask Caedon for a yes, then push and open the PR**

```bash
git push -u origin feat/v1
gh pr create --title "Milkshake Runner v1 (modular)" --body "$(cat <<'EOF'
Levels 1–2, Broadway transition, arena_five cutscene (generic stand-ins), endless mode, power-ups, and the modular architecture from the v2 spec: content registry, one-file content modules, per-level rule parameters, level sections and placements, campaign data, per-level failure containment, and a fixtures pack that proves a community contribution needs no engine edit.

Spec: docs/specs/2026-10-07-milkshake-runner-design-v2.md
Manual pass + Review Focus results: <fill from Steps 1–3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Then bind it with `mcp__ccd_pr__get_status` / `bind_pr`. **Do not merge.** Caedon reviews and merges. Once merged, the Pages deploy runs at `https://mrchopme.github.io/milkshake-runner/`.

- [ ] **Step 6 (after Caedon merges): community PR demo.** Ask Caedon for a yes first. Then branch `community/demo-pack` from the updated `main`, copy the fixtures pack into real places (`content/<kind>s/demo/*.js` and `levels/canal-street-dash.json` with its id and title adjusted, `author: "demo"`), and open a PR titled "Example community pack: Canal Street Dash". Confirm CI is green and tell Caedon it is ready to merge as the first community contribution, or to close.
