---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner Implementation Plan

> **Superseded on 2026-10-07** by [plan v2](2026-10-07-milkshake-runner-plan-v2.md). Task 0 (the Paper style sheet) was executed under this plan on 2026-10-05 and carries over. Kept as a dated snapshot.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, browser-playable 3D lane runner. Milkshake runs two built-in Manhattan levels, ending at a generic arena cutscene, plus an endless mode. The community adds levels as validated JSON files.

**Architecture:**
- Plain Three.js + Vite, plain JS ES modules, no UI framework.
- Game logic lives in pure modules (`catalog`, `validate`, `generator`, `rules`, `input.classifySwipe`, `save`) that import neither `three` nor the DOM, so `node --test` covers them.
- Rendering modules (`engine`, `world`, `milkshake`, `game`, `endings`, `hud`, `main`) sit on top of them and are checked by hand in the browser.
- Levels are JSON files in `levels/`, bundled with `import.meta.glob`. The browser and CI validate them with the same `validateAll()`.

**Tech Stack:** Node 22, Vite (dev), three (runtime), `node:test`, GitHub Actions, GitHub Pages.

**Spec:** [2026-10-02-milkshake-runner-design.md](2026-10-02-milkshake-runner-design.md). Read it before starting.

## Global Constraints

- Repo: `mrchopme/milkshake-runner`, local path `/Users/cmgibson/IDE Files/milkshake-runner`. Pages URL: `https://mrchopme.github.io/milkshake-runner/`. Vite `base: '/milkshake-runner/'`.
- Dependencies: `three` (runtime) and `vite` (dev) only. No other packages.
- Plain JavaScript ES modules (`"type": "module"`). No TypeScript, no UI framework.
- Pure modules (`src/catalog.js`, `src/validate.js`, `src/generator.js`, `src/rules.js`, `src/input.js` *except* `bindInput`, `src/save.js`) must never import `three` or touch `document`/`window` at import time.
- Level files hold data only. Community-written strings (`title`, `author`, validation errors) are rendered with `textContent`, **never** `innerHTML`.
- Knicks/MSG: **generic stand-ins only.** The arena is "THE GARDEN" in plain type. Players use made-up numbers `7, 12, 23, 31, 44`, and jersey colours `#ef7d22` / `#2a5caa`, which are deliberately not the team's exact colours. No real names, faces, or logos.
- **No sound** in v1.
- Higgsfield credits: the only spend is one `generate_3d` call (Task 8), quoted to Caedon and approved first.
- **Ask Caedon in chat for an explicit yes before each outward action:** creating the public repo, every `git push`, enabling Pages, opening a PR, downloading the generated GLB, spending credits.
- Lanes: 3 lanes, 2.5 m apart. Lane 0 is screen-left. A lane change takes about 150 ms.
- Speed: 12 → 20 m/s across a finite level. Endless mode keeps rising and caps at 28 m/s.
- Power-ups: magnet 8 s, shield until hit, 2x 10 s. About 1 jug in 40 is special.
- The generator never fills all 3 lanes in one row unless one of them can be jumped or slid.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; when Fable executes, use its own model line. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. **Tab backgrounded or phone locked mid-run.** The game pauses. On return there's no giant time-step "teleport" into an obstacle. Covered by the `step` clamps dt test (Task 4) and the `visibilitychange` pause (Task 5, manual check in Task 10).
2. **Mashing input.** Left at lane 0, jump while airborne, slide mid-jump. The lane stays within 0–2, there's no double jump, and a slide in the air fast-falls. Tests in Task 4.
3. **Private browsing / blocked or corrupt storage.** The game plays normally and progress just isn't kept. Tests in Task 6.
4. **Phone rotated or window resized mid-run.** The canvas and camera re-fit with no stretching, and portrait uses a wider FOV. Covered by `engine.resize` (Task 1), manual check in Task 10.
5. **Swiping on iOS Safari.** No page scroll, pull-to-refresh, or rubber-banding. Covered by `touch-action: none`, `overscroll-behavior: none`, and `preventDefault` on `touchmove` (Tasks 4–5), manual check in Task 10.

---

### Task 0: Paper style sheet (GATE: Caedon approves before Task 1)

No code. This produces the art direction every later task uses.

**Files:** none in the repo. Output is a Paper file plus a palette table pasted into chat.

**Interfaces:**
- Produces: an approved palette, hex values for every `PALETTE` key in Task 2's `catalog.js` (`cowWhite, spot, lavender, eye, road, sidewalk, lane, taxi, hazard, metal, rider, jug, magnet, shield, x2, arena, plaza, jerseyA, jerseyB`), plus a `--ink`, `--paper`, `--accent` UI trio. Task 8 copies these in.

- [ ] **Step 1: Load the Paper tools and guide**

  Run ToolSearch `select:` on the Paper tools you need (`get_guide`, `get_basic_info`, `list_files`, `create_file`, `create_artboard`, `write_html`, `get_font_family_info`, `get_screenshot`, `finish_working_on_nodes`). Then call `get_guide({ topic: "paper-mcp-instructions" })` and follow it.

- [ ] **Step 2: Gather the references (no credits)**

  Use Higgsfield `show_reference_elements` (Element `eb91a157-e317-4233-ad5c-7658465fa7f4`, Milkshake-3D) and `show_generation_by_ids` for the teaser game keyframes `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`. Copy their image URLs for use in `<img>` tags.

- [ ] **Step 3: Build one page, "Milkshake Runner, style sheet", with these artboards**

  1. **Reference:** the Milkshake-3D render and both game keyframes.
  2. **Palette:** one labelled swatch per `PALETTE` key above, plus `--ink/--paper/--accent`. Start from the defaults in Task 2 and adjust them toward the keyframes. Every swatch shows its hex.
  3. **Milkshake in-game:** a toon silhouette, back view and side view (what the camera sees).
  4. **Pickups:** the milk jug and the 3 power-up icons (magnet, shield, 2x).
  5. **Obstacles:** the 7 obstacles from the spec table, each labelled with its id and how to avoid it.
  6. **HUD + menu:** a portrait phone frame (375×812) showing the HUD, and a second frame showing the menu.
  7. **Arena ending frame:** "THE GARDEN" in plain type, 5 stand-in players (numbers 7, 12, 23, 31, 44, orange/blue), Milkshake, confetti, and the card "Season tip-off. Brought to you by Milkshake."

- [ ] **Step 4: Screenshot each artboard with `get_screenshot`, send the images with SendUserFile, then call `finish_working_on_nodes`.**

- [ ] **Step 5: STOP and ask Caedon to approve or edit the style sheet**

  Once approved, paste the final palette table into chat. Task 8 uses it. Do not start Task 1 without the approval.

---

### Task 1: Repo, Vite, engine, Pages deploy (GATE: public repo)

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `index.html`, `src/engine.js`, `src/main.js` (temporary), `.github/workflows/ci.yml`, `docs/specs/2026-10-02-milkshake-runner-design.md`, `docs/specs/2026-10-02-milkshake-runner-plan.md`, `.claude/launch.json` (gitignored)

**Interfaces:**
- Produces: `createEngine(canvas) → { scene, camera, renderer, setSky(theme), follow(run), render() }`.
  - `theme` is `{ sky: '#rrggbb', fog: 0..1 }`.
  - `run` needs `{ x, y, z }`.

- [ ] **Step 1: Ask Caedon for an explicit yes** to: create public repo `mrchopme/milkshake-runner`, push `main`, and enable GitHub Pages (Actions source). Do not continue without it.

- [ ] **Step 2: Create the folder and switch the session to it**

```bash
mkdir -p "/Users/cmgibson/IDE Files/milkshake-runner" && cd "/Users/cmgibson/IDE Files/milkshake-runner" && git init -b main && node --version
```
Expected: Node `v22.x` or newer. If it's older, stop and tell Caedon. Then switch the session's directory to this folder with `mcp__ccd_directory__change_directory`, or `request_directory` if the folder hasn't been added to the session yet.

- [ ] **Step 3: Write `package.json`**

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
Then:
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
      sun.position.set(run.x - 8, 20, run.z - 10);
      sun.target.position.set(run.x, 0, run.z);
    },
  };
}
```
The camera looks down +z, so screen-right is −x. `rules.laneX` (Task 4) maps lane 0 to +x.

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
// src/main.js (temporary: replaced in Task 5)
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

- [ ] **Step 7: Run it.** Use `preview_start({ name: "milkshake-runner" })`, then navigate to `http://localhost:5173/milkshake-runner/`. Expected: a sky-blue page with a spinning lavender cube. Check `read_console_messages` with `onlyErrors: true`: expected none.

- [ ] **Step 8: Write `.github/workflows/ci.yml`.** The test step comes in Task 2.

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

- [ ] **Step 9: Copy the spec and this plan into the repo**

```bash
mkdir -p docs/specs && cp "/Users/cmgibson/IDE Files/shade-os/.claude/worktrees/gracious-benz-570aa5/docs/projects/milkshake-teaser/2026-10-02-milkshake-runner-"{design,plan}.md docs/specs/
```
In the copied spec, change the `[README.md](README.md)` link to plain text "the Milkshake teaser README in shade-os".

- [ ] **Step 10: Commit, create the repo, push, enable Pages** (Step 1 approval covers this)

```bash
git add -A && git commit -m "chore: scaffold Vite + Three.js engine and Pages deploy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
gh repo create mrchopme/milkshake-runner --public --source . --push
gh api -X POST repos/mrchopme/milkshake-runner/pages -f build_type=workflow
gh run watch --exit-status $(gh run list -L1 --json databaseId -q '.[0].databaseId')
```
Expected: the run passes, and `https://mrchopme.github.io/milkshake-runner/` shows the spinning cube. If the Pages POST happened after the first run, re-run it with `gh run rerun`.

- [ ] **Step 11: Create the work branch.** All later tasks commit here, and the PR goes up in Task 10.

```bash
git switch -c feat/v1
```

---

### Task 2: Catalog, level validator, level files, CI check

**Files:**
- Create: `src/catalog.js`, `src/validate.js`, `levels/index.json`, `levels/01-broadway.json`, `levels/02-garden.json`, `levels/endless.json`, `test/validate.test.js`
- Modify: `.github/workflows/ci.yml` (add the test step)

**Interfaces:**
- Produces:
  - `catalog.js`: `LANE_WIDTH`, `OBSTACLES` (map `id → { avoid, w, h, d, y?, period?, on?, moves? }`), `THEMES` (`downtown|midtown|uptown → { colors[], minH, maxH }`), `POWERUPS`, `SCENES`, `PALETTE`.
  - `validate.js`: `validateLevel(level, { fileId, allIds }) → string[]` and `validateAll(levels: {id: object}, index: string[]) → { [file: string]: string[] }`. An empty object means valid.

- [ ] **Step 1: Write `src/catalog.js`**

```js
// The fixed sets community levels pick from. Adding an entry here is an engine PR.
export const LANE_WIDTH = 2.5;

// avoid: how the player gets past it. w/h/d: collision box in metres, y: box bottom.
export const OBSTACLES = {
  taxi:          { avoid: 'lane',   w: 2.0, h: 1.5, d: 4.0 },
  barrier_low:   { avoid: 'jump',   w: 2.2, h: 0.9, d: 0.4 },
  scaffold_beam: { avoid: 'slide',  w: 2.4, h: 0.4, d: 0.6, y: 1.2 },
  hot_dog_cart:  { avoid: 'jump',   w: 1.8, h: 1.0, d: 1.6 },
  manhole_steam: { avoid: 'timing', w: 2.0, h: 2.5, d: 1.0, period: 1.5, on: 0.5 },
  pigeons:       { avoid: 'slide',  w: 2.4, h: 0.6, d: 1.0, y: 1.1 },
  delivery_bike: { avoid: 'lane',   w: 0.8, h: 1.4, d: 1.8, moves: true },
};

export const THEMES = {
  downtown: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'], minH: 18, maxH: 70 },
  midtown:  { colors: ['#9aa7b8', '#6f7d8f', '#cfc6b4', '#b0855f'], minH: 30, maxH: 110 },
  uptown:   { colors: ['#b07a5a', '#c9a27e', '#8c5d47', '#d8c3a5'], minH: 12, maxH: 35 },
};

export const POWERUPS = ['magnet', 'shield', 'x2'];
export const SCENES = ['arena_five'];

// Defaults. Task 8 replaces these with the Paper-approved values.
export const PALETTE = {
  cowWhite: '#ffffff', spot: '#c8c8d0', lavender: '#b9a6e8', eye: '#141414',
  road: '#3a3a44', sidewalk: '#9a978f', lane: '#f2f2f2',
  taxi: '#f7c518', hazard: '#ff7a1a', metal: '#8a8f99', rider: '#2f6fd6',
  jug: '#ffffff', magnet: '#ff4d6d', shield: '#4dc3ff', x2: '#ffd23f',
  arena: '#2b2e3a', plaza: '#d9d4cc', jerseyA: '#ef7d22', jerseyB: '#2a5caa',
};
```

- [ ] **Step 2: Write the level files**

`levels/index.json`:
```json
["01-broadway", "02-garden", "endless"]
```
`levels/01-broadway.json`:
```json
{
  "id": "01-broadway",
  "title": "Up Broadway",
  "author": "PulsePoint",
  "length_m": 1500,
  "theme": { "sky": "#9fd3f5", "buildings": "downtown", "fog": 0.3 },
  "obstacles": { "taxi": 3, "barrier_low": 3, "scaffold_beam": 2, "hot_dog_cart": 2, "manhole_steam": 1 },
  "density": { "start": 0.25, "end": 0.55 },
  "jugs": { "per_100m": 14, "powerups": ["magnet", "shield"] },
  "ending": { "type": "transition", "next": "02-garden" }
}
```
`levels/02-garden.json`:
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
`levels/endless.json`:
```json
{
  "id": "endless",
  "title": "Endless Manhattan",
  "author": "PulsePoint",
  "length_m": null,
  "theme": { "sky": "#c98bd8", "buildings": "uptown", "fog": 0.35 },
  "obstacles": { "taxi": 3, "barrier_low": 2, "scaffold_beam": 2, "hot_dog_cart": 1,
                 "manhole_steam": 1, "pigeons": 1, "delivery_bike": 2 },
  "density": { "start": 0.4, "end": 0.8 },
  "jugs": { "per_100m": 12, "powerups": ["magnet", "shield", "x2"] }
}
```

- [ ] **Step 3: Write the failing test `test/validate.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, validateAll } from '../src/validate.js';

const dir = new URL('../levels/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

test('every shipped level is valid', () => {
  const levels = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.json') && f !== 'index.json') levels[f.slice(0, -5)] = read(f);
  assert.deepEqual(validateAll(levels, read('index.json')), {});
});

const good = {
  id: 'x', title: 'X', author: 'A', length_m: 600,
  theme: { sky: '#ffffff', buildings: 'midtown', fog: 0.2 },
  obstacles: { taxi: 1 }, density: { start: 0.3, end: 0.5 },
  jugs: { per_100m: 10, powerups: [] },
};
const ctx = { fileId: 'x', allIds: ['x', 'y'] };
const errs = (patch) => validateLevel({ ...good, ...patch }, ctx).join(' | ');

test('a minimal level is valid', () => assert.equal(errs({}), ''));
test('rejects a non-object', () => assert.match(validateLevel([], ctx).join(), /JSON object/));
test('rejects an unknown obstacle', () => assert.match(errs({ obstacles: { tank: 1 } }), /unknown obstacle "tank"/));
test('rejects a zero weight', () => assert.match(errs({ obstacles: { taxi: 0 } }), /above 0/));
test('rejects a transition with no next', () => assert.match(errs({ ending: { type: 'transition' } }), /next/));
test('rejects a transition to a missing level', () => assert.match(errs({ ending: { type: 'transition', next: 'nope' } }), /next/));
test('rejects an unknown cutscene', () => assert.match(errs({ ending: { type: 'cutscene', scene: 'parade' } }), /arena_five/));
test('rejects endless with an ending', () => assert.match(errs({ length_m: null, ending: { type: 'finish' } }), /cannot have an ending/));
test('rejects an out-of-range length', () => assert.match(errs({ length_m: 100 }), /300 to 5000/));
test('rejects an unknown top-level key', () => assert.match(errs({ colour: 'red' }), /unknown key "colour"/));
test('rejects an id that does not match the file', () => assert.match(errs({ id: 'y' }), /file name/));
test('rejects a bad sky colour', () => assert.match(errs({ theme: { ...good.theme, sky: 'blue' } }), /hex/));
test('rejects an unknown power-up', () => assert.match(errs({ jugs: { per_100m: 5, powerups: ['jetpack'] } }), /powerups/));
test('index must list real files, once each', () => {
  const out = validateAll({ x: good }, ['x', 'ghost', 'x']);
  assert.match(out['index.json'].join(), /ghost.*does not exist/);
  assert.match(out['index.json'].join(), /twice/);
});
test('every level file must be in the index', () => {
  assert.match(validateAll({ x: good }, [])['x.json'].join(), /not listed/);
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../src/validate.js'`.

- [ ] **Step 5: Write `src/validate.js`**

```js
import { OBSTACLES, THEMES, POWERUPS, SCENES } from './catalog.js';

const KEYS = ['id', 'title', 'author', 'length_m', 'theme', 'obstacles', 'density', 'jugs', 'ending'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isName = (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 60;

// The single source of truth for "is this level OK?". Runs in the browser and in CI.
export function validateLevel(level, { fileId, allIds }) {
  if (!isObj(level)) return ['level must be a JSON object'];
  const e = [];
  for (const k of Object.keys(level)) if (!KEYS.includes(k)) e.push(`unknown key "${k}"`);

  if (typeof level.id !== 'string' || !/^[a-z0-9-]+$/.test(level.id)) e.push('id must use only a-z, 0-9 and -');
  else if (level.id !== fileId) e.push(`id "${level.id}" must match the file name "${fileId}.json"`);
  if (!isName(level.title)) e.push('title must be 1-60 characters');
  if (!isName(level.author)) e.push('author must be 1-60 characters');

  const L = level.length_m;
  if (L === null) {
    if ('ending' in level) e.push('an endless level (length_m: null) cannot have an ending');
  } else if (!Number.isInteger(L) || L < 300 || L > 5000) {
    e.push('length_m must be a whole number from 300 to 5000, or null for endless');
  }

  const t = level.theme;
  if (!isObj(t)) e.push('theme is required');
  else {
    if (typeof t.sky !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(t.sky)) e.push('theme.sky must be a hex colour like "#f4b26a"');
    if (!Object.hasOwn(THEMES, t.buildings)) e.push(`theme.buildings must be one of: ${Object.keys(THEMES).join(', ')}`);
    if (!inRange(t.fog, 0, 1)) e.push('theme.fog must be a number from 0 to 1');
  }

  const o = level.obstacles;
  if (!isObj(o) || Object.keys(o).length === 0) e.push('obstacles must list at least one obstacle');
  else for (const [id, w] of Object.entries(o)) {
    if (!Object.hasOwn(OBSTACLES, id)) e.push(`unknown obstacle "${id}" (known: ${Object.keys(OBSTACLES).join(', ')})`);
    else if (!inRange(w, Number.MIN_VALUE, 1e6)) e.push(`obstacle weight for "${id}" must be a number above 0`);
  }

  const d = level.density;
  if (!isObj(d) || !inRange(d.start, 0.1, 1) || !inRange(d.end, 0.1, 1)) e.push('density.start and density.end must be numbers from 0.1 to 1');

  const j = level.jugs;
  if (!isObj(j) || !inRange(j.per_100m, 0, 30)) e.push('jugs.per_100m must be a number from 0 to 30');
  if (!isObj(j) || !Array.isArray(j.powerups) || j.powerups.some((p) => !POWERUPS.includes(p))) {
    e.push(`jugs.powerups must be a list using only: ${POWERUPS.join(', ')}`);
  }

  if ('ending' in level) {
    const en = level.ending;
    if (!isObj(en)) e.push('ending must be an object');
    else if (en.type === 'finish') { if (Object.keys(en).length > 1) e.push('a finish ending takes no other fields'); }
    else if (en.type === 'transition') {
      if (!allIds.includes(en.next) || en.next === level.id) e.push('a transition ending needs "next" set to another existing level id');
    } else if (en.type === 'cutscene') {
      if (!SCENES.includes(en.scene)) e.push(`a cutscene ending needs "scene" set to one of: ${SCENES.join(', ')}`);
    } else e.push('ending.type must be finish, transition or cutscene');
  }
  return e;
}

export function validateAll(levels, index) {
  const errors = {};
  const add = (file, msg) => (errors[file] ??= []).push(msg);
  if (!Array.isArray(index)) { add('index.json', 'must be a list of level ids'); return errors; }
  const allIds = Object.keys(levels);
  index.forEach((id, i) => {
    if (!allIds.includes(id)) add('index.json', `lists "${id}" but levels/${id}.json does not exist`);
    if (index.indexOf(id) !== i) add('index.json', `lists "${id}" twice`);
  });
  for (const id of allIds) {
    for (const msg of validateLevel(levels[id], { fileId: id, allIds })) add(`${id}.json`, msg);
    if (!index.includes(id)) add(`${id}.json`, 'is not listed in levels/index.json');
  }
  return errors;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, all 16 tests.

- [ ] **Step 7: Add the test step to CI.** In `.github/workflows/ci.yml`, insert `- run: npm test` between `npm ci` and `npm run build`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: level catalog, validator, built-in levels, CI check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Street generator

**Files:**
- Create: `src/generator.js`, `test/logic.test.js`

**Interfaces:**
- Consumes: `OBSTACLES` from `catalog.js`; the level object shape from Task 2.
- Produces:
  - `rng(seed) → () => number in [0,1)`
  - `densityAt(level, z) → number`
  - `generate(level, r, fromZ, toZ) → { obstacles: {id, lane, z, moveTo?}[], jugs: {z, lane, kind}[] }`, where `kind ∈ 'jug' | 'magnet' | 'shield' | 'x2'`
  - Constants `ROW_GAP, START_CLEAR, END_CLEAR, SPECIAL_CHANCE, ENDLESS_RAMP_M, JUG_CLEARANCE`

- [ ] **Step 1: Write the failing tests at the top of `test/logic.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBSTACLES } from '../src/catalog.js';
import { generate, rng, ROW_GAP, START_CLEAR, END_CLEAR, JUG_CLEARANCE } from '../src/generator.js';

const lvl = (patch = {}) => ({
  length_m: 1500,
  density: { start: 0.5, end: 0.9 },
  obstacles: { taxi: 3, barrier_low: 2, scaffold_beam: 2, delivery_bike: 1, manhole_steam: 1 },
  jugs: { per_100m: 12, powerups: ['magnet', 'shield', 'x2'] },
  ...patch,
});
const all = (level, seed) => generate(level, rng(seed), 0, level.length_m ?? 3000);
const rowsOf = (obstacles) => Map.groupBy(obstacles, (o) => o.z);
const passable = (id) => ['jump', 'slide'].includes(OBSTACLES[id].avoid);
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

test('same seed builds the same street', () => assert.deepEqual(all(lvl(), 7), all(lvl(), 7)));

test('road is clear at the start and before the end', () => {
  for (const s of seeds.slice(0, 20)) for (const o of all(lvl(), s).obstacles) {
    assert.ok(o.z >= START_CLEAR && o.z < 1500 - END_CLEAR, `obstacle at ${o.z}`);
  }
});

test('a full row always has a jump or slide option', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl(), s).obstacles).values()) {
    if (row.length === 3) assert.ok(row.some((o) => passable(o.id)), `seed ${s}`);
  }
});

test('with no jump/slide obstacles a row never fills all 3 lanes', () => {
  for (const s of seeds) for (const row of rowsOf(all(lvl({ obstacles: { taxi: 1 } }), s).obstacles).values()) {
    assert.ok(row.length <= 2);
  }
});

test('jugs keep clear of obstacles in their lane', () => {
  for (const s of seeds.slice(0, 50)) {
    const { obstacles, jugs } = all(lvl(), s);
    for (const j of jugs) assert.ok(!obstacles.some((o) => o.lane === j.lane && Math.abs(o.z - j.z) < JUG_CLEARANCE));
  }
});

test('specials only come from the level list', () => {
  const kinds = new Set(seeds.slice(0, 10).flatMap((s) => all(lvl({ jugs: { per_100m: 30, powerups: ['x2'] } }), s).jugs.map((j) => j.kind)));
  assert.deepEqual([...kinds].sort(), ['jug', 'x2']);
  const none = all(lvl({ jugs: { per_100m: 30, powerups: [] } }), 1).jugs;
  assert.ok(none.every((j) => j.kind === 'jug'));
});

test('moving bikes only move into a free neighbouring lane', () => {
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
  const r = rng(5), level = lvl({ length_m: null });
  const zs = [...generate(level, r, 0, 120).obstacles, ...generate(level, r, 120, 240).obstacles].map((o) => o.z);
  assert.ok(zs.every((z) => z % ROW_GAP === 0));
});
```
`Map.groupBy` needs Node 21+. CI uses 22.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../src/generator.js'`.

- [ ] **Step 3: Write `src/generator.js`**

```js
import { OBSTACLES } from './catalog.js';

export const ROW_GAP = 12;          // metres between obstacle rows
export const START_CLEAR = 40;      // empty road at the start of every level
export const END_CLEAR = 60;        // empty road before a finite level's end
export const SPECIAL_CHANCE = 1 / 40;
export const ENDLESS_RAMP_M = 2000; // endless density reaches density.end here
export const JUG_CLEARANCE = 3;     // no jug within this many metres of an obstacle in its lane

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

const passable = (id) => OBSTACLES[id].avoid === 'jump' || OBSTACLES[id].avoid === 'slide';

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

export function densityAt(level, z) {
  const span = level.length_m ?? ENDLESS_RAMP_M;
  const t = Math.min(1, Math.max(0, z / span));
  return level.density.start + (level.density.end - level.density.start) * t;
}

// Obstacles and jugs for z in [fromZ, toZ). Call with consecutive ranges on one rng.
export function generate(level, r, fromZ, toZ) {
  const obstacles = [];
  const jugs = [];
  const lastRow = level.length_m === null ? Infinity : level.length_m - END_CLEAR;
  const passIds = Object.keys(level.obstacles).filter(passable);

  const firstRow = Math.ceil(Math.max(fromZ, START_CLEAR) / ROW_GAP) * ROW_GAP;
  for (let z = firstRow; z < Math.min(toZ, lastRow); z += ROW_GAP) {
    if (r() >= densityAt(level, z)) continue;
    const roll = r();
    const lanes = shuffledLanes(r).slice(0, roll < 0.15 ? 3 : roll < 0.5 ? 2 : 1);
    const ids = lanes.map(() => pick(level.obstacles, r));
    if (lanes.length === 3 && !ids.some(passable)) {
      if (passIds.length) ids[0] = passIds[Math.floor(r() * passIds.length)];
      else { lanes.pop(); ids.pop(); }
    }
    lanes.forEach((lane, i) => {
      const o = { id: ids[i], lane, z };
      if (OBSTACLES[o.id].moves) {
        const free = [lane - 1, lane + 1].filter((l) => l >= 0 && l <= 2 && !lanes.includes(l));
        o.moveTo = free.length ? free[Math.floor(r() * free.length)] : null;
      }
      obstacles.push(o);
    });
  }

  if (level.jugs.per_100m > 0) {
    const gap = 100 / level.jugs.per_100m;
    const jugEnd = level.length_m === null ? Infinity : level.length_m - END_CLEAR / 2;
    // ponytail: clearance only checks this chunk's obstacles; a jug right at a chunk edge can sit
    // beside the next chunk's first row. Harmless (jugs never hurt); check neighbours if it looks bad.
    for (let k = Math.ceil(Math.max(fromZ, START_CLEAR / 2) / gap); k * gap < Math.min(toZ, jugEnd); k++) {
      const z = k * gap;
      const free = [0, 1, 2].filter((l) => !obstacles.some((o) => o.lane === l && Math.abs(o.z - z) < JUG_CLEARANCE));
      if (!free.length) continue;
      const lane = free[Math.floor(r() * free.length)];
      const { powerups } = level.jugs;
      const kind = powerups.length && r() < SPECIAL_CHANCE ? powerups[Math.floor(r() * powerups.length)] : 'jug';
      jugs.push({ z, lane, kind });
    }
  }
  return { obstacles, jugs };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS (the validate tests plus 9 generator tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seeded street generator with fair-row rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Run rules and input mapping

**Files:**
- Create: `src/rules.js`, `src/input.js`
- Modify: `test/logic.test.js` (append)

**Interfaces:**
- Consumes: `OBSTACLES`, `LANE_WIDTH`.
- Produces:
  - `rules.js`:
    - `laneX(lane) → x`
    - `speedAt(level, z) → m/s`
    - `createRun(jugs = 0) → run`, where run is `{ lane, x, y, vy, slideT, z, time, jugs, shield, magnetT, x2T, graceT, over }`
    - `act(run, 'left'|'right'|'jump'|'slide')`
    - `step(run, rawDt, speed) → clampedDt`
    - `playerBox(run)`, `obstacleBox(o, time) → box | null`, `overlaps(a, b)`
    - `hit(run) → 'grace'|'shield'|'dead'`
    - `jugInReach(run, jug)`, `collectJug(run, kind)`
    - `updateObstacle(o, run, dt)`, which sets `o.x` on moving bikes
    - Constants `MAX_DT, GRACE_TIME, MAGNET_TIME, X2_TIME, MAGNET_RANGE, BIKE_TRIGGER`
  - `input.js`:
    - `KEYS` (code → action, incl. `'pause'`)
    - `classifySwipe(dx, dy, min = 30) → action | null`
    - `bindInput(touchTarget, onAction) → unbind()`

- [ ] **Step 1: Append the failing tests to `test/logic.test.js`**

```js
import {
  laneX, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit,
  jugInReach, collectJug, updateObstacle, MAX_DT, GRACE_TIME,
} from '../src/rules.js';
import { classifySwipe, KEYS } from '../src/input.js';

function runInto(obstacle, action) {
  const r = createRun();
  if (action) act(r, action);
  let touched = false;
  while (r.z < obstacle.z + 2) {
    step(r, 1 / 60, 12);
    const box = obstacleBox(obstacle, r.time);
    if (box && overlaps(playerBox(r), box)) touched = true;
  }
  return touched;
}

test('lane 0 is screen-left (+x) and lanes clamp at the edges', () => {
  assert.ok(laneX(0) > laneX(2));
  const r = createRun();
  act(r, 'left'); act(r, 'left'); act(r, 'left');
  assert.equal(r.lane, 0);
  for (let i = 0; i < 4; i++) act(r, 'right');
  assert.equal(r.lane, 2);
});

test('no double jump; sliding in the air fast-falls', () => {
  const r = createRun();
  act(r, 'jump'); step(r, 0.05, 12);
  const vy = r.vy;
  act(r, 'jump');
  assert.equal(r.vy, vy);
  act(r, 'slide');
  assert.ok(r.vy <= -15);
});

test('jumping clears a low barrier; running into it hits', () => {
  const barrier = { id: 'barrier_low', lane: 1, z: 3.6 };
  assert.equal(runInto(barrier, 'jump'), false);
  assert.equal(runInto(barrier, null), true);
});

test('sliding ducks a scaffold beam; standing hits it', () => {
  const beam = { id: 'scaffold_beam', lane: 1, z: 3.6 };
  assert.equal(runInto(beam, 'slide'), false);
  assert.equal(runInto(beam, null), true);
});

test('steam only hurts while it is on', () => {
  const steam = { id: 'manhole_steam', lane: 1, z: 0 };
  assert.ok(obstacleBox(steam, 0.2));
  assert.equal(obstacleBox(steam, 1.0), null);
});

test('a shield absorbs one hit, then a moment of grace, then the next hit ends the run', () => {
  const r = createRun();
  r.shield = true;
  assert.equal(hit(r), 'shield');
  assert.equal(hit(r), 'grace');
  assert.equal(r.over, false);
  step(r, MAX_DT, 12); for (let t = 0; t < GRACE_TIME; t += MAX_DT) step(r, MAX_DT, 12);
  assert.equal(hit(r), 'dead');
  assert.equal(r.over, true);
});

test('a huge frame time is clamped (no teleport after a background tab)', () => {
  const r = createRun();
  assert.equal(step(r, 5, 12), MAX_DT);
  assert.ok(Math.abs(r.z - 12 * MAX_DT) < 1e-9);
});

test('speed rises across a level and caps in endless', () => {
  assert.equal(speedAt({ length_m: 1000 }, 0), 12);
  assert.equal(speedAt({ length_m: 1000 }, 1000), 20);
  assert.equal(speedAt({ length_m: null }, 1e6), 28);
});

test('the magnet collects jugs ahead in any lane', () => {
  const r = createRun();
  assert.equal(jugInReach(r, { z: 10, lane: 0 }), false);
  r.magnetT = 8;
  assert.equal(jugInReach(r, { z: 10, lane: 0 }), true);
  assert.equal(jugInReach(r, { z: -5, lane: 1 }), false);
});

test('jugs score, 2x doubles, specials start power-ups', () => {
  const r = createRun(3);
  collectJug(r, 'jug'); assert.equal(r.jugs, 4);
  collectJug(r, 'x2'); collectJug(r, 'jug'); assert.equal(r.jugs, 6);
  collectJug(r, 'shield'); assert.equal(r.shield, true);
  collectJug(r, 'magnet'); assert.ok(r.magnetT > 0);
});

test('bikes only start moving when Milkshake is close', () => {
  const r = createRun();
  const far = { id: 'delivery_bike', lane: 1, z: 100, moveTo: 0 };
  updateObstacle(far, r, 0.05);
  assert.equal(far.x, undefined);
  const near = { id: 'delivery_bike', lane: 1, z: 20, moveTo: 0 };
  updateObstacle(near, r, 0.05);
  assert.ok(near.x > laneX(1) && near.x < laneX(0));
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
Expected: FAIL with `Cannot find module '.../src/rules.js'`.

- [ ] **Step 3: Write `src/rules.js`**

```js
import { OBSTACLES, LANE_WIDTH } from './catalog.js';

export const GRAVITY = -30, JUMP_V = 9, FAST_FALL_V = -15;
export const SLIDE_TIME = 0.6, LANE_TIME = 0.15, MAX_DT = 0.05, GRACE_TIME = 1;
export const MAGNET_TIME = 8, X2_TIME = 10, MAGNET_RANGE = 15;
export const BIKE_TRIGGER = 30, BIKE_SPEED = 4; // metres ahead when a bike starts moving; lateral m/s

// Camera looks down +z, so screen-left is +x: lane 0 = +2.5, lane 2 = -2.5.
export const laneX = (lane) => (1 - lane) * LANE_WIDTH;

export function speedAt(level, z) {
  if (level.length_m === null) return Math.min(28, 12 + z * 0.004);
  return 12 + 8 * Math.min(1, z / level.length_m);
}

export function createRun(jugs = 0) {
  return { lane: 1, x: 0, y: 0, vy: 0, slideT: 0, z: 0, time: 0, jugs, shield: false, magnetT: 0, x2T: 0, graceT: 0, over: false };
}

export function act(run, action) {
  if (run.over) return;
  if (action === 'left') run.lane = Math.max(0, run.lane - 1);
  else if (action === 'right') run.lane = Math.min(2, run.lane + 1);
  else if (action === 'jump' && run.y === 0 && run.vy === 0) { run.vy = JUMP_V; run.slideT = 0; }
  else if (action === 'slide') { run.slideT = SLIDE_TIME; if (run.y > 0) run.vy = Math.min(run.vy, FAST_FALL_V); }
}

export function step(run, rawDt, speed) {
  const dt = Math.min(rawDt, MAX_DT);
  run.time += dt;
  run.z += speed * dt;
  const maxMove = (LANE_WIDTH / LANE_TIME) * dt;
  run.x += Math.max(-maxMove, Math.min(maxMove, laneX(run.lane) - run.x));
  if (run.y > 0 || run.vy !== 0) {
    run.vy += GRAVITY * dt;
    run.y += run.vy * dt;
    if (run.y <= 0) { run.y = 0; run.vy = 0; }
  }
  for (const k of ['slideT', 'magnetT', 'x2T', 'graceT']) run[k] = Math.max(0, run[k] - dt);
  return dt;
}

export function playerBox(run) {
  const h = run.slideT > 0 ? 0.8 : 1.9;
  return { x0: run.x - 0.5, x1: run.x + 0.5, y0: run.y, y1: run.y + h, z0: run.z - 0.4, z1: run.z + 0.4 };
}

export function obstacleBox(o, time) {
  const d = OBSTACLES[o.id];
  if (d.period && time % d.period >= d.on) return null; // steam is off
  const x = o.x ?? laneX(o.lane), y = d.y ?? 0;
  return { x0: x - d.w / 2, x1: x + d.w / 2, y0: y, y1: y + d.h, z0: o.z - d.d / 2, z1: o.z + d.d / 2 };
}

export const overlaps = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;

export function hit(run) {
  if (run.graceT > 0) return 'grace';
  if (run.shield) { run.shield = false; run.graceT = GRACE_TIME; return 'shield'; }
  run.over = true;
  return 'dead';
}

export function jugInReach(run, jug) {
  const dz = jug.z - run.z;
  if (run.magnetT > 0) return dz > -1 && dz < MAGNET_RANGE;
  return Math.abs(dz) < 0.8 && Math.abs(laneX(jug.lane) - run.x) < 1;
}

export function collectJug(run, kind) {
  if (kind === 'jug') run.jugs += run.x2T > 0 ? 2 : 1;
  else if (kind === 'magnet') run.magnetT = MAGNET_TIME;
  else if (kind === 'shield') run.shield = true;
  else if (kind === 'x2') run.x2T = X2_TIME;
}

export function updateObstacle(o, run, dt) {
  if (o.moveTo == null || o.z - run.z > BIKE_TRIGGER) return;
  const x = o.x ?? laneX(o.lane), target = laneX(o.moveTo), s = BIKE_SPEED * dt;
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
    e.preventDefault(); // no page scroll / pull-to-refresh
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
Expected: PASS (everything so far plus 12 new tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: run physics, collisions, power-ups, input mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: World, placeholder Milkshake, game loop, HUD (level 1 playable)

**Files:**
- Create: `src/world.js`, `src/milkshake.js`, `src/game.js`, `src/hud.js`, `src/levels.js`, `src/style.css`
- Modify: `index.html` (full shell), `src/main.js` (temporary: boots straight into level 1)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `createWorld(scene, level, seed) → { live: { obstacles, jugs }, update(run), removeJug(jug), dispose() }`
  - `createMilkshake() → Promise<THREE.Group & { update(run), pose(time, { sliding, over, lean }) }>`
  - `createHud() → { show(on), onPause(fn), update(run, level), setPaused(on), flash(), ring(): Promise, banner(text, ms): Promise, card(text, ms): Promise }`
  - `loadLevels() → { levels, index, errors }`
  - `playLevel({ engine, level, milkshake, hud, carryJugs }) → Promise<{ outcome: 'complete'|'dead', run, world }>`

- [ ] **Step 1: Write `index.html` (full shell)**

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
    <div class="bar"><span id="jugs">0</span><div id="progress"><div></div></div><button id="pause" aria-label="Pause">II</button></div>
    <div id="powerups"></div>
  </div>
  <div id="ring"></div>
  <div id="overlay" hidden></div>
  <div id="card" hidden></div>
  <section id="menu" class="screen" hidden>
    <h1>Milkshake Runner</h1>
    <button id="play">Run</button>
    <button id="levels">Levels</button>
    <button id="endless" hidden>Endless</button>
    <p class="hint">Swipe, or use the arrow keys · Esc pauses</p>
  </section>
  <section id="select" class="screen" hidden>
    <h2>Levels</h2>
    <div id="level-list"></div>
    <button id="back">Back</button>
  </section>
  <section id="results" class="screen" hidden>
    <h2 id="result-title"></h2>
    <p id="result-jugs"></p>
    <button id="again">Run again</button>
    <button id="to-menu">Menu</button>
  </section>
  <section id="error" class="screen" hidden>
    <h2>A level file has problems</h2>
    <ul id="error-list"></ul>
    <p>Fix the file and reload. See CONTRIBUTING.md.</p>
  </section>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/style.css`**

```css
:root { --ink: #1d1b26; --paper: #fffaf3; --accent: #b9a6e8; --ring: rgba(185, 166, 232, 0.95); font-family: system-ui, sans-serif; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #9fd3f5; overscroll-behavior: none; }
#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }

#hud { position: fixed; inset: 0; pointer-events: none; padding: max(12px, env(safe-area-inset-top)) 16px 0; color: #fff; font-weight: 800; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); }
#hud .bar { display: flex; align-items: center; gap: 12px; font-size: 22px; }
#jugs::before { content: '🥛 '; }
#progress { flex: 1; height: 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.35); overflow: hidden; }
#progress > div { height: 100%; width: 0; background: #fff; }
#pause { pointer-events: auto; width: 44px; height: 44px; border-radius: 50%; border: 0; font-weight: 900; }
#powerups { margin-top: 8px; font-size: 16px; }
#hud.hit { animation: hit 0.3s; }
@keyframes hit { 50% { background: rgba(77, 195, 255, 0.35); } }

#overlay, #card { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: #fff; font: 900 clamp(28px, 7vw, 56px)/1.1 system-ui, sans-serif; text-shadow: 0 3px 0 rgba(0, 0, 0, 0.4); }
#overlay { background: rgba(0, 0, 0, 0.35); }
#card { pointer-events: none; }
#ring { position: fixed; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle, transparent 30%, var(--ring) 45%, transparent 60%); }
#ring.go { animation: ring 0.6s ease-out; }
@keyframes ring { 0% { opacity: 1; transform: scale(0.2); } 100% { opacity: 0; transform: scale(2.5); } }

.screen { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; overflow-y: auto; text-align: center; color: var(--ink); background: color-mix(in srgb, var(--paper) 88%, transparent); }
.screen button { min-width: 220px; min-height: 48px; border: 0; border-radius: 24px; font: 700 18px system-ui, sans-serif; color: #fff; background: var(--ink); }
.screen button:disabled { opacity: 0.45; }
#level-list { display: flex; flex-direction: column; gap: 8px; }
#error-list { max-width: 640px; text-align: left; }
```

- [ ] **Step 3: Write `src/levels.js`**

```js
import { validateAll } from './validate.js';
import index from '../levels/index.json';

const files = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });

export function loadLevels() {
  const levels = {};
  for (const [path, data] of Object.entries(files)) {
    const id = path.split('/').pop().slice(0, -'.json'.length);
    if (id !== 'index') levels[id] = data;
  }
  return { levels, index, errors: validateAll(levels, index) };
}
```

- [ ] **Step 4: Write `src/world.js`**

```js
import * as THREE from 'three';
import { THEMES, PALETTE, LANE_WIDTH } from './catalog.js';
import { generate, rng } from './generator.js';
import { laneX, obstacleBox, MAGNET_RANGE } from './rules.js';

const CHUNK = 120;  // metres built at a time (multiple of ROW_GAP)
const AHEAD = 200;  // keep this much street built ahead of Milkshake
const BEHIND = 15;  // drop things this far behind
const ROAD_HALF = 4.5;

const mats = new Map();
const mat = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color, ...opts }));
  return mats.get(key);
};
const mesh = (geo, color, x = 0, y = 0, z = 0, opts) => {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.position.set(x, y, z);
  return m;
};
const box = (w, h, d, color, x = 0, y = h / 2, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
const group = (...children) => { const g = new THREE.Group(); g.add(...children); return g; };

// Visuals match the collision boxes in catalog.OBSTACLES.
const MAKERS = {
  taxi: () => group(box(2.0, 0.9, 4.0, PALETTE.taxi), box(1.7, 0.6, 2.0, PALETTE.taxi, 0, 1.2, -0.2), box(0.6, 0.15, 0.3, '#222222', 0, 1.58, -0.2)),
  barrier_low: () => group(box(0.15, 0.9, 0.4, '#ffffff', -0.9), box(0.15, 0.9, 0.4, '#ffffff', 0.9), box(2.2, 0.3, 0.15, PALETTE.hazard, 0, 0.7)),
  scaffold_beam: () => group(box(0.15, 1.6, 0.15, PALETTE.metal, -1.15, 0.8), box(0.15, 1.6, 0.15, PALETTE.metal, 1.15, 0.8), box(2.4, 0.4, 0.6, PALETTE.hazard, 0, 1.4)),
  hot_dog_cart: () => group(box(1.8, 0.85, 1.6, '#c9ccd2', 0, 0.425), box(1.8, 0.15, 1.6, PALETTE.hazard, 0, 0.925)),
  manhole_steam: () => {
    const plume = mesh(new THREE.CylinderGeometry(0.8, 0.5, 2.5, 16), '#ffffff', 0, 1.25, 0, { transparent: true, opacity: 0.7 });
    plume.name = 'plume';
    return group(mesh(new THREE.CylinderGeometry(1, 1, 0.05, 24), '#222222', 0, 0.03, 0), plume);
  },
  pigeons: () => group(...[-0.9, -0.4, 0.1, 0.5, 0.95].map((x, i) => mesh(new THREE.SphereGeometry(0.18, 10, 8), '#7d7f88', x, 1.3 + (i % 2) * 0.15, 0))),
  delivery_bike: () => group(box(0.3, 0.7, 1.8, '#333333', 0, 0.35), mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 10), PALETTE.rider, 0, 1.05, 0)),
};

function jugMesh(kind) {
  if (kind !== 'jug') return group(mesh(new THREE.SphereGeometry(0.4, 16, 12), PALETTE[kind], 0, 0.9, 0, { emissive: PALETTE[kind], emissiveIntensity: 0.5 }));
  return group(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.5, 14), PALETTE.jug, 0, 0.8, 0), mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 10), PALETTE.lavender, 0, 1.12, 0));
}

function scenery(level, r, z0) {
  const t = THEMES[level.theme.buildings];
  const g = group(box(ROAD_HALF * 2, 0.1, CHUNK, PALETTE.road, 0, -0.05, z0 + CHUNK / 2));
  for (const side of [-1, 1]) g.add(box(3, 0.25, CHUNK, PALETTE.sidewalk, side * (ROAD_HALF + 1.5), 0.125, z0 + CHUNK / 2));
  for (let z = z0; z < z0 + CHUNK; z += 6) {
    for (const x of [LANE_WIDTH / 2, -LANE_WIDTH / 2]) g.add(box(0.12, 0.02, 3, PALETTE.lane, x, 0.01, z + 1.5));
  }
  for (const side of [-1, 1]) {
    for (let z = z0; z < z0 + CHUNK;) {
      const depth = 8 + r() * 6, h = t.minH + r() * (t.maxH - t.minH);
      g.add(box(10, h, depth - 0.5, t.colors[Math.floor(r() * t.colors.length)], side * (ROAD_HALF + 8), h / 2, z + depth / 2));
      z += depth;
    }
  }
  return g;
}

export function createWorld(scene, level, seed) {
  const r = rng(seed), rs = rng(seed ^ 0x9e3779b9); // separate rng so scenery never shifts the street
  const root = new THREE.Group();
  scene.add(root);
  const live = { obstacles: [], jugs: [] };
  const chunks = [];
  const end = level.length_m === null ? Infinity : level.length_m + 200; // street past the end, for the ending camera
  let builtTo = 0;

  const drop = (obj) => { root.remove(obj); obj.traverse((n) => n.geometry?.dispose()); };

  function build() {
    const { obstacles, jugs } = generate(level, r, builtTo, builtTo + CHUNK);
    for (const o of obstacles) { o.mesh = MAKERS[o.id](); o.mesh.position.set(laneX(o.lane), 0, o.z); root.add(o.mesh); live.obstacles.push(o); }
    for (const j of jugs) { j.mesh = jugMesh(j.kind); j.mesh.position.set(laneX(j.lane), 0, j.z); root.add(j.mesh); live.jugs.push(j); }
    const g = scenery(level, rs, builtTo);
    root.add(g);
    chunks.push({ z: builtTo, g });
    builtTo += CHUNK;
  }

  function update(run) {
    while (builtTo < Math.min(end, run.z + AHEAD)) build();
    const behind = run.z - BEHIND;
    for (const list of [live.obstacles, live.jugs]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].z < behind) { drop(list[i].mesh); list.splice(i, 1); }
    }
    while (chunks.length && chunks[0].z + CHUNK < behind) drop(chunks.shift().g);
    for (const o of live.obstacles) {
      if (o.x !== undefined) o.mesh.position.x = o.x;
      const plume = o.mesh.getObjectByName('plume');
      if (plume) plume.visible = obstacleBox(o, run.time) !== null;
    }
    for (const j of live.jugs) {
      j.mesh.rotation.y = run.time * 3;
      if (run.magnetT > 0 && j.z - run.z < MAGNET_RANGE) j.mesh.position.x += (run.x - j.mesh.position.x) * 0.2;
    }
  }

  function removeJug(j) { live.jugs.splice(live.jugs.indexOf(j), 1); drop(j.mesh); }
  function dispose() { scene.remove(root); root.traverse((n) => n.geometry?.dispose()); }

  return { live, update, removeJug, dispose };
}
```

- [ ] **Step 5: Write `src/milkshake.js`**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PALETTE } from './catalog.js';
import { laneX } from './rules.js';

const HEIGHT = 1.9;
const MODEL_YAW = 0; // calibration knob: rotate the generated GLB until it faces +z (away from camera)

function shapeCow() {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  add(new THREE.CapsuleGeometry(0.45, 0.8, 6, 16), PALETTE.cowWhite, 0, 1.15, 0);
  for (const [x, y, z] of [[0.3, 1.3, 0.3], [-0.28, 0.9, 0.3], [0.1, 1.6, -0.4], [-0.35, 1.2, -0.25], [0.32, 0.8, -0.28]]) {
    add(new THREE.SphereGeometry(0.13, 12, 8), PALETTE.spot, x, y, z);
  }
  add(new THREE.SphereGeometry(0.22, 16, 12), PALETTE.lavender, 0, 1.45, 0.4).scale.set(1.4, 0.9, 0.8);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.05, 8, 6), PALETTE.eye, s * 0.14, 1.7, 0.41);
    add(new THREE.SphereGeometry(0.12, 12, 8), PALETTE.lavender, s * 0.5, 1.8, 0).scale.set(1.6, 0.7, 0.6);
    add(new THREE.ConeGeometry(0.06, 0.2, 10), PALETTE.lavender, s * 0.2, 2.05, 0);
  }
  add(new THREE.SphereGeometry(0.1, 10, 8), PALETTE.lavender, 0, 0.75, 0.38);
  const limb = (x, y, len, tip) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    g.add(pivot);
    add(new THREE.CapsuleGeometry(0.11, len, 4, 10), PALETTE.cowWhite, 0, -len / 2 - 0.05, 0, pivot);
    if (tip) add(new THREE.SphereGeometry(0.1, 10, 8), PALETTE.lavender, 0, -len - 0.1, 0, pivot);
    return pivot;
  };
  g.userData.arms = [limb(-0.55, 1.45, 0.4, true), limb(0.55, 1.45, 0.4, true)];
  g.userData.legs = [limb(-0.2, 0.55, 0.3, false), limb(0.2, 0.55, 0.3, false)];
  return g;
}

async function loadModel() {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}milkshake.glb`);
  const model = gltf.scene;
  model.rotation.y = MODEL_YAW;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(HEIGHT / size.y);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;
  return model;
}

export async function createMilkshake() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let model;
  try { model = await loadModel(); } catch { model = shapeCow(); } // no GLB yet, or a bad one: the shape cow
  body.add(model);
  const { arms = [], legs = [] } = model.userData;

  root.pose = (time, { sliding = false, over = false, lean = 0, airborne = false } = {}) => {
    const stride = airborne || sliding || over ? 0 : Math.sin(time * 14);
    body.position.y = Math.abs(stride) * 0.08;
    body.scale.y = sliding ? 0.5 : 1;
    root.rotation.z = lean;
    root.rotation.x = over ? 0.9 : sliding ? -0.3 : 0;
    legs.forEach((l, i) => (l.rotation.x = stride * 0.7 * (i ? 1 : -1)));
    arms.forEach((a, i) => (a.rotation.x = stride * 0.7 * (i ? -1 : 1)));
  };
  root.update = (run) => {
    root.position.set(run.x, run.y, run.z);
    root.rotation.y = 0;
    root.pose(run.time, { sliding: run.slideT > 0, over: run.over, lean: (laneX(run.lane) - run.x) * 0.12, airborne: run.y > 0 });
  };
  return root;
}
```

- [ ] **Step 6: Write `src/hud.js`**

```js
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createHud() {
  let onPause = () => {};
  let paused = false;
  $('pause').onclick = () => onPause();
  $('overlay').onclick = () => paused && onPause();

  return {
    show(on) { $('hud').hidden = !on; },
    onPause(fn) { onPause = fn; },
    update(run, level) {
      $('jugs').textContent = run.jugs;
      $('progress').hidden = level.length_m === null;
      if (level.length_m) $('progress').firstElementChild.style.width = `${Math.min(100, (run.z / level.length_m) * 100)}%`;
      $('powerups').textContent = [
        run.shield && 'SHIELD',
        run.magnetT > 0 && `MAGNET ${Math.ceil(run.magnetT)}`,
        run.x2T > 0 && `2x ${Math.ceil(run.x2T)}`,
      ].filter(Boolean).join('  ·  ');
    },
    setPaused(on) {
      paused = on;
      $('overlay').textContent = on ? 'Paused · tap or press Esc' : '';
      $('overlay').hidden = !on;
    },
    flash() { const h = $('hud'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); },
    async ring() { const el = $('ring'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); await wait(600); },
    async banner(text, ms = 1200) { const o = $('overlay'); o.textContent = text; o.hidden = false; await wait(ms); o.hidden = true; },
    async card(text, ms = 3000) { const c = $('card'); c.textContent = text; c.hidden = false; await wait(ms); c.hidden = true; },
  };
}
```

- [ ] **Step 7: Write `src/game.js`**

```js
import {
  createRun, act, step, speedAt, playerBox, obstacleBox, overlaps, hit,
  jugInReach, collectJug, updateObstacle,
} from './rules.js';
import { createWorld } from './world.js';
import { bindInput } from './input.js';

export function playLevel({ engine, level, milkshake, hud, carryJugs = 0 }) {
  return new Promise((resolve) => {
    const run = createRun(carryJugs);
    const world = createWorld(engine.scene, level, (Math.random() * 2 ** 32) >>> 0);
    let paused = false, last = performance.now(), raf = 0;

    const setPaused = (p) => { paused = p; hud.setPaused(p); last = performance.now(); };
    hud.onPause(() => setPaused(!paused));
    const unbind = bindInput(engine.renderer.domElement, (a) => {
      if (a === 'pause') setPaused(!paused);
      else if (!paused) act(run, a);
    });
    const onHide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onHide);
    engine.setSky(level.theme);
    hud.show(true);

    function tick(rawDt) {
      const dt = step(run, rawDt, speedAt(level, run.z));
      world.update(run);
      const me = playerBox(run);
      for (const o of world.live.obstacles) {
        updateObstacle(o, run, dt);
        const box = obstacleBox(o, run.time);
        if (box && overlaps(me, box) && hit(run) === 'shield') hud.flash();
      }
      for (const j of [...world.live.jugs]) if (jugInReach(run, j)) { collectJug(run, j.kind); world.removeJug(j); }
      milkshake.update(run);
      engine.follow(run);
      hud.update(run, level);
      if (run.over) end('dead');
      else if (level.length_m !== null && run.z >= level.length_m) end('complete');
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) tick(dt);
      engine.render();
    }

    function end(outcome) {
      cancelAnimationFrame(raf);
      unbind();
      document.removeEventListener('visibilitychange', onHide);
      hud.onPause(() => {});
      hud.show(false);
      resolve({ outcome, run, world }); // caller disposes world after any ending scene
    }

    raf = requestAnimationFrame(frame);
  });
}
```

- [ ] **Step 8: Temporary `src/main.js` that boots straight into level 1**

```js
import './style.css';
import { createEngine } from './engine.js';
import { createMilkshake } from './milkshake.js';
import { createHud } from './hud.js';
import { loadLevels } from './levels.js';
import { playLevel } from './game.js';

async function main() {
  const engine = createEngine(document.getElementById('game'));
  const hud = createHud();
  const { levels } = loadLevels();
  const milkshake = await createMilkshake();
  engine.scene.add(milkshake);
  const { outcome, run } = await playLevel({ engine, level: levels['01-broadway'], milkshake, hud });
  hud.banner(`${outcome}: ${run.jugs} jugs. Reload to retry`, 1e9);
}
main();
```

- [ ] **Step 9: Run `npm test`.** Expected: all PASS, with the pure modules unchanged.

- [ ] **Step 10: Play it in the browser pane.** Use `preview_start({ name: "milkshake-runner" })` and `/milkshake-runner/`. Check:
  - The street streams in.
  - Arrow keys change lanes. Left goes screen-left.
  - Jump clears barriers and carts. Slide clears beams and pigeons.
  - Steam blinks, and you can only be hit while it's on.
  - Jugs count up, and specials show in the HUD.
  - Hitting a taxi ends the run.
  - `read_console_messages` with `onlyErrors: true` shows none.

  Switch the tab away and back: the game shows Paused. Take a screenshot and send it to Caedon with SendUserFile.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: playable level 1 with world streaming, shape-built Milkshake, HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Screens, saved progress, error screen, level flow

**Files:**
- Create: `src/save.js`
- Modify: `src/main.js` (full flow), `test/logic.test.js` (append)

**Interfaces:**
- Produces:
  - `save.js`: `loadSave(storage?) → { best: {}, unlocked: [] }`, `writeSave(save, storage?)`, `recordRun(save, id, jugs)`, `unlock(save, id)`, `isLocked(save, id)`, and `LOCKED = ['02-garden', 'endless']`
  - `main.js` calls `playEnding(ending, ctx)` from Task 7. Until Task 7 lands, stub it as shown in Step 4.

- [ ] **Step 1: Append the failing tests**

```js
import { loadSave, writeSave, recordRun, unlock, isLocked } from '../src/save.js';

test('blocked storage never breaks the game', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(blocked), { best: {}, unlocked: [] });
  assert.doesNotThrow(() => writeSave({ best: {}, unlocked: [] }, blocked));
  assert.deepEqual(loadSave(undefined), { best: {}, unlocked: [] });
});

test('a corrupt save falls back to a fresh one', () => {
  assert.deepEqual(loadSave({ getItem: () => 'not json' }), { best: {}, unlocked: [] });
});

test('save round-trips through storage', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  writeSave(unlock(recordRun(loadSave(storage), '01-broadway', 12), '02-garden'), storage);
  assert.deepEqual(loadSave(storage), { best: { '01-broadway': 12 }, unlocked: ['02-garden'] });
});

test('best only goes up; built-in levels unlock in order; community levels are open', () => {
  const s = loadSave(undefined);
  recordRun(s, 'a', 10); recordRun(s, 'a', 4);
  assert.equal(s.best.a, 10);
  assert.equal(isLocked(s, '02-garden'), true);
  unlock(s, '02-garden'); unlock(s, '02-garden');
  assert.deepEqual(s.unlocked, ['02-garden']);
  assert.equal(isLocked(s, '02-garden'), false);
  assert.equal(isLocked(s, 'endless'), true);
  assert.equal(isLocked(s, 'canal-street-dash'), false);
});
```

- [ ] **Step 2: Run it to confirm it fails.** Run `npm test`. Expected: FAIL with `Cannot find module '.../src/save.js'`.

- [ ] **Step 3: Write `src/save.js`**

```js
const KEY = 'milkshake-runner';
export const LOCKED = ['02-garden', 'endless'];
const fresh = () => ({ best: {}, unlocked: [] });

// Storage can be missing, blocked (private mode) or corrupt: the game must still play.
export function loadSave(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY) || '{}');
    return { ...fresh(), ...(data && typeof data === 'object' ? data : {}) };
  } catch {
    return fresh();
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* progress just isn't kept */ }
}

export function recordRun(save, id, jugs) { save.best[id] = Math.max(save.best[id] || 0, jugs); return save; }
export function unlock(save, id) { if (!save.unlocked.includes(id)) save.unlocked.push(id); return save; }
export const isLocked = (save, id) => LOCKED.includes(id) && !save.unlocked.includes(id);
```

- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: PASS.

- [ ] **Step 5: Replace `src/main.js`**

```js
import './style.css';
import { createEngine } from './engine.js';
import { createMilkshake } from './milkshake.js';
import { createHud } from './hud.js';
import { loadLevels } from './levels.js';
import { playLevel } from './game.js';
import { playEnding } from './endings.js';
import { createRun } from './rules.js';
import { loadSave, writeSave, recordRun, unlock, isLocked } from './save.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'select', 'results', 'error'];
const show = (id) => SCREENS.forEach((s) => ($(s).hidden = s !== id));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const engine = createEngine($('game'));
  const hud = createHud();
  const save = loadSave();
  const { levels, index, errors } = loadLevels();

  if (Object.keys(errors).length) {
    // Community strings: textContent only.
    for (const [file, msgs] of Object.entries(errors)) {
      const li = document.createElement('li');
      li.textContent = `${file}: ${msgs.join('; ')}`;
      $('error-list').append(li);
    }
    return show('error');
  }

  const milkshake = await createMilkshake();
  engine.scene.add(milkshake);

  function menu() {
    engine.setSky(levels[index[0]].theme);
    const idle = createRun();
    milkshake.update(idle);
    engine.follow(idle);
    engine.render();
    $('endless').hidden = isLocked(save, 'endless');
    show('menu');
  }

  function levelSelect() {
    const list = $('level-list');
    list.replaceChildren();
    for (const id of index) {
      const lv = levels[id], locked = isLocked(save, id), best = save.best[id];
      const b = document.createElement('button');
      b.textContent = `${lv.title} · by ${lv.author}${best ? ` · best ${best}` : ''}${locked ? ' · locked' : ''}`;
      b.disabled = locked;
      b.onclick = () => startLevel(id);
      list.append(b);
    }
    show('select');
  }

  async function startLevel(id, carry = 0) {
    show(null);
    const level = levels[id];
    const { outcome, run, world } = await playLevel({ engine, level, milkshake, hud, carryJugs: carry });
    if (outcome === 'complete') {
      await playEnding(level.ending, { engine, milkshake, run, hud });
      if (level.ending?.type === 'transition') unlock(save, level.ending.next);
      if (level.ending?.type === 'cutscene') unlock(save, 'endless');
    } else {
      engine.render();
      await wait(900); // let the stumble read
    }
    recordRun(save, id, run.jugs);
    writeSave(save);
    world.dispose();
    if (outcome === 'complete' && level.ending?.type === 'transition') return startLevel(level.ending.next, run.jugs);

    $('result-title').textContent = outcome === 'complete' ? `${level.title}: cleared!` : 'Bonk!';
    $('result-jugs').textContent = `${run.jugs} jugs · best ${save.best[id]}`;
    $('again').onclick = () => startLevel(id);
    show('results');
  }

  $('play').onclick = () => startLevel(index[0]);
  $('levels').onclick = levelSelect;
  $('endless').onclick = () => startLevel('endless');
  $('back').onclick = menu;
  $('to-menu').onclick = menu;
  menu();
}
main();
```
Until Task 7 lands, create `src/endings.js` with only:
```js
export async function playEnding(ending, { hud }) { await hud.banner('FINISH!', 1200); }
```

- [ ] **Step 6: Check it in the browser.**
  - The menu shows.
  - Run plays level 1 and reaches a FINISH banner, then flows straight into level 2 with the jug count kept.
  - Level select shows 02 and Endless as locked on a fresh profile. Clear them with `localStorage.clear()` via `javascript_tool`, then reload.
  - Corrupt a level: edit `levels/02-garden.json` to `"obstacles": {"tank": 1}`. The error screen lists `02-garden.json: unknown obstacle "tank" …`. **Revert the edit.**
  - Console errors: none.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: menu, level select, saved progress, level error screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Endings (transition, arena_five, finish)

**Files:**
- Modify: `src/endings.js` (replace the stub)

**Interfaces:**
- Consumes:
  - `engine` (`scene, camera, render`)
  - `milkshake.pose(time, opts)`, plus its `position` and `rotation`
  - `hud.ring()`, `hud.card()`, `hud.banner()`
  - `run` (frozen at the level end)
  - `PALETTE`
- Produces: `playEnding(ending | undefined, { engine, milkshake, run, hud }) → Promise<void>`

- [ ] **Step 1: Write `src/endings.js`**

```js
import * as THREE from 'three';
import { PALETTE } from './catalog.js';

const ease = (t) => t * t * (3 - 2 * t);
const NUMBERS = [7, 12, 23, 31, 44]; // made-up stand-ins, no real players
const SKIN = ['#8d5a3b', '#c68e62', '#5a3a24', '#e0b08a', '#a8714a'];
// Camera offset (from Milkshake at the turn) for the side shot. Tune in the manual pass.
const TRANSITION_CAM = new THREE.Vector3(-3, 3.5, 11);

function animate(engine, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t, now / 1000);
      engine.render();
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function textTexture(text, { w = 1024, h = 192, color = '#ffffff', bg = null, font = '900 120px system-ui, sans-serif' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  Object.assign(x, { fillStyle: color, font, textAlign: 'center', textBaseline: 'middle' });
  x.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function transition({ engine, milkshake, hud }) {
  const start = milkshake.position.clone();
  const camFrom = engine.camera.position.clone();
  const camTo = start.clone().add(TRANSITION_CAM);
  await animate(engine, 1500, (t, time) => {
    const e = ease(t);
    milkshake.rotation.y = (e * Math.PI) / 2; // turn to face +x: a left turn up Broadway
    milkshake.position.set(start.x + e * e * 8, start.y, start.z + e * 6);
    milkshake.pose(time);
    engine.camera.position.lerpVectors(camFrom, camTo, e);
    engine.camera.lookAt(milkshake.position.x, 1.2, milkshake.position.z);
  });
  await hud.ring();
}

function confetti(center) {
  const n = 300, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const colors = [PALETTE.jerseyA, PALETTE.jerseyB, PALETTE.lavender, '#ffffff', PALETTE.x2].map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    pos.set([center.x + (Math.random() - 0.5) * 14, center.y + Math.random() * 10, center.z + (Math.random() - 0.5) * 10], i * 3);
    colors[i % colors.length].toArray(col, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true }));
  pts.fall = (dt) => {
    for (let i = 1; i < pos.length; i += 3) pos[i] = pos[i] < 0 ? center.y + 10 : pos[i] - dt * 3;
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

async function arenaFive({ engine, milkshake, hud }) {
  const z0 = milkshake.position.z + 30;
  const g = new THREE.Group();
  const toon = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 50), toon(PALETTE.plaza));
  plaza.position.set(0, 0.05, z0 + 15);
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 12, 48, 1, true), toon(PALETTE.arena, { side: THREE.DoubleSide }));
  arena.position.set(0, 6, z0 + 45);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshBasicMaterial({ map: textTexture('THE GARDEN'), transparent: true }));
  sign.position.set(0, 9, z0 + 26.8);
  sign.rotation.y = Math.PI; // face the camera (-z)
  g.add(plaza, arena, sign);

  NUMBERS.forEach((num, i) => {
    const x = (i - 2) * 1.8, jersey = i % 2 ? PALETTE.jerseyB : PALETTE.jerseyA;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 6, 12), toon(jersey));
    body.position.set(x, 1.1, z0 + 18);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), toon(SKIN[i]));
    head.position.set(x, 2.15, z0 + 18);
    const number = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: textTexture(String(num), { w: 256, h: 256, font: '900 170px system-ui, sans-serif' }), transparent: true }));
    number.position.set(x, 1.3, z0 + 18 - 0.42);
    number.rotation.y = Math.PI;
    g.add(body, head, number);
  });
  engine.scene.add(g);

  const start = milkshake.position.clone();
  milkshake.rotation.set(0, 0, 0);
  await animate(engine, 1800, (t, time) => {
    milkshake.position.set(start.x * (1 - t), 0, start.z + ease(t) * (z0 + 15 - start.z));
    milkshake.pose(time);
    engine.camera.position.set(0, 4, milkshake.position.z - 7);
    engine.camera.lookAt(0, 1.5, z0 + 18);
  });

  const center = new THREE.Vector3(0, 1.5, z0 + 16.5);
  const pts = confetti(center);
  g.add(pts);
  const card = hud.card('Season tip-off. Brought to you by Milkshake.', 4000);
  await animate(engine, 4000, (t) => {
    const a = -Math.PI / 2 + t * Math.PI * 2; // start behind Milkshake, circle once
    engine.camera.position.set(center.x + Math.cos(a) * 9, 4, center.z + Math.sin(a) * 9);
    engine.camera.lookAt(center);
    pts.fall(1 / 60);
  });
  await card;
  engine.scene.remove(g);
  g.traverse((n) => { n.geometry?.dispose(); n.material?.map?.dispose(); });
}

const CUTSCENES = { arena_five: arenaFive };

export async function playEnding(ending, ctx) {
  const type = ending?.type ?? 'finish';
  if (type === 'transition') return transition(ctx);
  if (type === 'cutscene') return CUTSCENES[ending.scene](ctx);
  await ctx.hud.banner('FINISH!', 1200);
}
```
`CUTSCENES` keys must match `catalog.SCENES`. To add a cutscene, add it to both.

- [ ] **Step 2: Check it in the browser.** Temporarily set `"length_m": 300` in both built-in levels to reach the endings fast.
  - Level 1 ends with Milkshake turning left (screen-left), the camera swinging to the side, and the glow ring, then level 2 starts.
  - Level 2 ends at the plaza: THE GARDEN sign, 5 numbered stand-ins, Milkshake walking up, the camera circling once, confetti, and the card.
  - Then the results screen shows, and Endless is unlocked on the menu.

  Tune `TRANSITION_CAM` if the side shot frames badly. Screenshot both endings and send them to Caedon. **Revert `length_m`** and run `npm test`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Broadway turn transition and arena_five season tip-off cutscene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Real Milkshake model and Paper palette (GATE: credits)

**Files:**
- Create: `public/milkshake.glb`
- Modify: `src/catalog.js` (`PALETTE` values), `src/style.css` (`:root` vars), and `MODEL_YAW` in `src/milkshake.js` if needed

**Interfaces:** No new names. Values only.

- [ ] **Step 1: Quote the cost.** Load the Higgsfield `balance` and `generate_3d` tools with ToolSearch. Read the balance. Get the front image URL from the Milkshake-3D master render (job `97ba0692-9968-468c-8357-61e4bcd049ab`) with `show_generation_by_ids`. Use `models_explore` (`action: "recommend"`) to see the `generate_3d` credit cost.

- [ ] **Step 2: STOP and ask Caedon:** "generate_3d on the Milkshake-3D front render costs N credits (balance M). Run it and download the GLB (about X MB) into `public/milkshake.glb`?" Wait for a yes.
  - **If no:** skip to Step 5. The shape cow stays.

- [ ] **Step 3: Run `generate_3d`, wait with `jobs_wait`, then download the result**

```bash
curl -fL -o public/milkshake.glb "<GLB URL from the job result>" && ls -lh public/milkshake.glb
```
If the file is over 8 MB, shrink it, then check the size again:
```bash
npx -y @gltf-transform/cli optimize public/milkshake.glb public/milkshake.glb --texture-compress webp
```

- [ ] **Step 4: Check the model in the browser.**
  - Milkshake should face away from the camera. If not, set `MODEL_YAW` to `Math.PI`, `Math.PI / 2`, or `-Math.PI / 2` until it does.
  - Check that the bob and lean look right and that the height is about the same as the shape cow.
  - If the mesh is unusable (broken, wrong character), delete `public/milkshake.glb`, which falls back to the shape cow, and tell Caedon.

- [ ] **Step 5: Apply the Paper-approved palette.**
  - Copy every hex from Task 0's approved table into `PALETTE` in `src/catalog.js`.
  - Set `--ink`, `--paper`, `--accent` in `src/style.css` `:root`, and set `--ring` to `--accent` at 0.95 alpha.
  - Keep `jerseyA`/`jerseyB` away from the Knicks' exact `#f58426`/`#006bb6`. If Paper landed on those, nudge them.

- [ ] **Step 6: Run `npm test`, play level 1 briefly, and send a screenshot to Caedon.** Expected: tests PASS and no console errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: generated Milkshake model and Paper-approved palette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: CONTRIBUTING.md and an example community level

**Files:**
- Create: `CONTRIBUTING.md`, `README.md`
- Create (local only, removed before commit): `levels/canal-street-dash.json`

**Interfaces:** Documents Task 2's schema. Must list exactly the keys in `OBSTACLES`, `THEMES`, `POWERUPS`, `SCENES`.

- [ ] **Step 1: Write `CONTRIBUTING.md`**

````markdown
# Add a level to Milkshake Runner

Every level after level 2 comes from the community. A level is **one JSON file**. No code.

## Steps

1. Fork this repo.
2. Add `levels/<your-level-id>.json`. The id uses only `a-z`, `0-9`, `-` and must match the file name.
3. Add your id to the end of `levels/index.json`.
4. Check it locally: `npm ci && npm test`, then `npm run dev` and play it from **Levels**.
5. Open a pull request. CI runs the same checks. A broken level can't merge.

## Example

```json
{
  "id": "canal-street-dash",
  "title": "Canal Street Dash",
  "author": "your-github-name",
  "length_m": 1200,
  "theme": { "sky": "#ffb38a", "buildings": "downtown", "fog": 0.5 },
  "obstacles": { "hot_dog_cart": 3, "delivery_bike": 2, "pigeons": 2, "taxi": 1 },
  "density": { "start": 0.3, "end": 0.6 },
  "jugs": { "per_100m": 15, "powerups": ["magnet", "x2"] },
  "ending": { "type": "finish" }
}
```

## Fields

| Field | Rule |
|---|---|
| `id` | `a-z 0-9 -`, same as the file name |
| `title`, `author` | 1 to 60 characters |
| `length_m` | whole number 300 to 5000. (`null` = endless, built-in only in practice, and no `ending`) |
| `theme.sky` | hex colour, e.g. `"#ffb38a"` |
| `theme.buildings` | `downtown`, `midtown` or `uptown` |
| `theme.fog` | 0 to 1 |
| `obstacles` | weights above 0, from the list below; at least one |
| `density.start`, `density.end` | 0.1 to 1: how busy the street is at the start and the end |
| `jugs.per_100m` | 0 to 30 |
| `jugs.powerups` | any of `magnet`, `shield`, `x2` (can be empty) |
| `ending` | optional. `{ "type": "finish" }` (default), `{ "type": "transition", "next": "<level id>" }`, or `{ "type": "cutscene", "scene": "arena_five" }` |

## Obstacles

| id | How to get past it |
|---|---|
| `taxi` | change lanes |
| `barrier_low` | jump |
| `scaffold_beam` | slide |
| `hot_dog_cart` | change lanes or jump |
| `manhole_steam` | timing: it bursts every 1.5 s |
| `pigeons` | slide |
| `delivery_bike` | change lanes; it swerves into a free lane as you get close |

The game never blocks all three lanes unless one of them can be jumped or slid.

## Want a new obstacle, theme or ending?

Open an issue or an engine PR that changes `src/catalog.js`. Level files can only use what's listed here.

Please keep it friendly: no real people, brands, team names or logos in titles or levels.
````

- [ ] **Step 2: Write a short `README.md`**

```markdown
# Milkshake Runner

PulsePoint's mascot Milkshake runs through Manhattan. Play: https://mrchopme.github.io/milkshake-runner/

- Levels 1 and 2 are built in. Every level after that comes from the community. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Dev: `npm ci && npm run dev`. Tests: `npm test`.
- Design: [docs/specs/](docs/specs/).
```

- [ ] **Step 3: Prove the contributor flow locally.**
  - Add `levels/canal-street-dash.json` with the example above, and append `"canal-street-dash"` to `levels/index.json`.
  - Run `npm test`. Expected: PASS.
  - Play it from **Levels** in the browser and check it isn't locked.
  - Then change `"taxi"` to `"tank"`, run `npm test`, and expect FAIL with `unknown obstacle "tank"`.
  - **Remove the example file and its index entry.** The real community PR comes after v1 merges (Task 10, Step 6).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: contributor guide for community levels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Manual pass, PR, community PR demo

**Files:** none, unless the pass finds bugs. Fix those in their owning file, with a test if the logic is pure.

- [ ] **Step 1: Desktop pass in the browser pane.** Use `/milkshake-runner/` on a fresh profile: run `localStorage.clear()` via `javascript_tool`, then reload. Check:
  - Menu → Run → level 1 → the Broadway turn plus ring → level 2 (jugs carried) → the arena cutscene → results → Endless is unlocked → Endless runs for a minute with no lag. Play it for real rather than speeding the game up with `javascript_tool`, and check `renderer.info.memory.geometries` stays flat by exposing `engine` on `window` temporarily.
  - Each power-up is picked up at least once.
  - Esc pauses and resumes, and so does the pause button.
  - Console errors: none.

- [ ] **Step 2: Phone pass.** Run `resize_window({ preset: "mobile" })` and reload. Check:
  - All 3 lanes are visible in portrait.
  - The HUD sits clear of the notch area.
  - Buttons are at least 44 px.
  - Swipe via touch events works. Use `javascript_tool` to dispatch `touchstart`/`touchmove` on `#game` and confirm the lane changes without the page scrolling.
  - Resize to a landscape size (812×375) mid-run: no stretching.
  - Switch tabs: the game is Paused.

  Then reset with `resize_window({ preset: "desktop" })`.

- [ ] **Step 3: Review Focus check.** Go through each of the five Review Focus lines at the top of this plan and record pass or fail for each in the PR body.

- [ ] **Step 4: Run `npm test && npm run build`.** Expected: PASS, and `dist/` is built.

- [ ] **Step 5: Ask Caedon for a yes, then push and open the PR**

```bash
git push -u origin feat/v1
gh pr create --title "Milkshake Runner v1" --body "$(cat <<'EOF'
Levels 1–2, Broadway transition, arena_five cutscene (generic stand-ins), endless mode, power-ups, community level validation + CONTRIBUTING.

Spec: docs/specs/2026-10-02-milkshake-runner-design.md
Manual pass + Review Focus results: <fill from Steps 1–3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Then bind it with `mcp__ccd_pr__get_status` / `bind_pr`. **Do not merge.** Caedon reviews and merges. Once merged, the Pages deploy runs, and the URL is `https://mrchopme.github.io/milkshake-runner/`.

- [ ] **Step 6 (after Caedon merges): community PR demo.** Ask Caedon for a yes first. Then:
  - Branch `level/canal-street-dash` from the updated `main`.
  - Add the CONTRIBUTING example level and its index entry, and open a PR titled "Example community level: Canal Street Dash".
  - Confirm CI is green, and tell Caedon it's ready to merge as the first community level, or to close.
