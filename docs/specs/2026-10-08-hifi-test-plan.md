---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner HiFi test, sub-project 1 (foundation + the taxi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here: the tasks share
> `src/engine.js` and `src/main.js`, and four of them stop for Caedon) or superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Point-in-time snapshot, written 2026-10-08 against `hi-fi-test` at 7d949e0 (the approved spec on top of
> `feat/v3-feedback` at e3742bc). Read the current code before trusting a line number here.

**Goal:** A HiFi mode that lays a looks-only pack over the shipped content, renders it with tone mapping, sun shadows, reflections, a gradient sky and bloom, and shows one generated asset (the taxi) end to end, while low-fi stays exactly as it is.

**Architecture:** A pack (`packs/hifi/<kind>s/<id>.js`) overlays registered modules with presentation fields only (`createView`, `createChunk`, `look`, `assets`); `applyPack` merges it and re-checks every merged module. A quality switch loads the pack on mouse/trackpad devices (`?hifi` / `?lofi` force it). `src/assets.js` preloads the GLBs modules list, and `gfx.asset` hands out synchronous shared copies. `src/look.js` (loaded only in HiFi) applies a theme's `look` through an EffectComposer; with no look the engine runs its old path.

**Tech Stack:** three 0.186.1 (WebGL2, GLTFLoader + meshopt, EffectComposer, UnrealBloomPass, OutputPass, RoomEnvironment), Vite 8, `node --test`; Higgsfield MCP (GPT Image 2.5, Tripo H3.1 multi-view); `@gltf-transform/cli` (new devDependency, gated).

**Spec:** `docs/specs/2026-10-08-hifi-test-design.md` (approved by Caedon 2026-10-08). Read it before Task 1.

## Global Constraints

- Branch `hi-fi-test`, local. Never push or open a pull request without Caedon's OK.
- Gates (stop and ask Caedon first): every credit spend (quoted with `get_cost` first), the concept-art choice, every download (file name, source, size), installing `@gltf-transform/cli`, any push or pull request.
- Sub-project 1 spends at most 40 credits.
- `?lofi`, and every touch device by default, render exactly as `feat/v3-feedback` (e3742bc) does today.
- A pack module may set only `createView`, `createChunk`, `look` and `assets`, besides `kind` and `id`.
- Every HiFi obstacle keeps the shipped collision box and silhouette: detail goes inside the box, never above it.
- Content and pack modules never import `three` at the top of the file; they use `gfx.three`.
- `src/` never names a content id in quotes (`test/fixtures.test.js` enforces it).
- Every `src/` change gets a line in `docs/specs/2026-10-08-hifi-ledger.md`; every deviation from this plan is a `Ruling:` line there.
- `public/hifi/taxi.glb`: 3 MB or less, meshopt geometry, WebP textures capped at 2048 px.
- No new runtime dependency. `@gltf-transform/cli` is the only new devDependency.
- No logos, brand names, real people or team names in anything generated.
- Desktop bar: 16.7 ms a frame at 3024×1964 on Caedon's M4 Pro.
- Docs you write are point-in-time snapshots; knowledge files carry `provenance: agent-generated` / `last-verified: never`.
- Commits: conventional prefix (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A pack lists a file that is not in `public/`** (a typo, a GLB never committed). In HiFi the taxi would turn into the pink fallback block. Expected: CI fails before that can merge. Test: Task 5, "every file the HiFi pack lists is in public/".
2. **A GLB fails to load at runtime** (offline, a 404, a corrupt file). Expected: RUN still starts; only that module falls back to the pink block. Test: Task 4, "preload loads each file once and never rejects when one fails".
3. **A level switches theme mid-run** (level 1 enters `bridge` at 1080 m, level 2 at 840 m). Expected: the look follows the section and HiFi never drops to the low-fi renderer mid-run. Tests: Task 5, "the look follows the section theme" and "every shipped theme has a HiFi look".
4. **The window is resized or rotated in HiFi.** Expected: the post-processed frame follows the canvas, with no stretching or blur. Check: Task 5, Step 14 (pane resize to the mobile preset with `?hifi`).
5. **Streaming drops chunks and obstacles behind the player.** Expected: a dropped taxi never frees the shared GLB, so later taxis still render. Test: Task 4, "dropping a copy leaves the shared asset alone"; check: Task 7, Step 7 (play past 300 m).

---

## How to run things in this environment

Learned in earlier rounds (see the memory note "Dev testing quirks"):

- **Branch.** The planning session's worktree gives up `hi-fi-test` when it hands off. In your worktree: `git checkout hi-fi-test`. If git says the branch is checked out elsewhere, run `git worktree list`, and in the other worktree `git checkout --detach`.
- **Dev server.** Start Vite yourself in the background on a free port (5173 may be held by the main checkout): `npm run dev -- --port 5177 --strictPort`. Open the pane with `preview_start({ url: "http://localhost:5177/milkshake-runner/?fixtures" })`; `preview_start({ name })` reads the wrong folder.
- **Frozen frames.** The browser pane freezes `requestAnimationFrame` while hidden. `scripts/hifi-shot.js` (Task 2) installs a timer shim; paste it before driving the game.
- **Dev hook.** `window.__milkshake = { run, world, level, engine, character }` exists while a level runs (dev builds only). A fresh run dies on its first row about 1.5 s in, so set `run.graceT = 1e9` right after the level starts; `#pause.click()` freezes it while `engine.render()` keeps drawing.
- **Downloads.** The Bash hook redirects `curl`. Download through the context-mode `ctx_execute` shell tool to an absolute path, then check the file with `ls -la` in Bash. Only after Caedon approves the download.
- **Reference art.** Paper file `01M46QWM611CXK4WQSBTH6FJK3`, board "01 Reference". Call Paper's `get_guide({ topic: "paper-mcp-instructions" })` once, then `get_screenshot({ fileId, nodeId: "F-0" })` for the 9:16 keyframe and `nodeId: "9-0"` for the 16:9 one.
- **Higgsfield ids.** Teaser keyframes: jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`. Milkshake-3D element `eb91a157-e317-4233-ad5c-7658465fa7f4`; its render image is job `97ba0692-9968-468c-8357-61e4bcd049ab`. Balance on 2026-10-08: 3,000 credits (Ultra).
- **Scratchpad.** Keep raw downloads and stills in your session's scratchpad directory, never in the repo (except the final `public/hifi/taxi.glb`).

## File structure

| File | Responsibility | Task |
|---|---|---|
| `docs/specs/2026-10-08-hifi-ledger.md` | Ledger: engine changes, credits, downloads, stills, rulings | 1 |
| `test/fixtures/levels/hifi-shot.json` | Fixture level that stages the teaser's 9:16 shot | 2 |
| `scripts/drop-server.mjs` | Saves files POSTed by dev scripts to a folder | 2 |
| `scripts/hifi-shot.js` | Browser snippet: stills (`hifiShot`) and frame cost (`hifiProbe`) | 2 |
| `src/engine.js` | `resize(w, h)`; the HiFi look hook (`useLook`), light reset in `setSky`, sun aimed ahead | 2, 5 |
| `src/game.js` | Dev hook adds `character`; sky-change key adds the theme id | 2, 5 |
| `src/registry.js` | `applyPack`, `SKIN_FIELDS`, `loadPack`, `assets` check, `checkLook` | 3, 5 |
| `test/helpers.js` | `discover(root, prefix)` walks packs as well as content | 3 |
| `src/main.js` | Quality switch, pack load, preload and LOADING, `useLook` | 3, 4, 5 |
| `src/assets.js` | `adopt`, `preload`, `asset`: the shared GLB cache | 4 |
| `src/gfx.js` | Re-exports `asset`; `dispose` skips shared; `bend` marks shadow casters | 4, 5 |
| `src/look.js` | `lookState` (pure) and `createLook` (env, sky dome, shadows, composer) | 5 |
| `src/world.js` | `skyAt` returns the theme id and look | 5 |
| `packs/hifi/themes/{downtown,midtown,uptown,bridge}.js` | The four looks | 5 |
| `scripts/optimize-glb.sh`, `package.json` | `npm run assets:optimize` | 6 |
| `public/hifi/taxi.glb` | The generated, optimised taxi | 6 |
| `packs/hifi/obstacles/taxi.js` | The HiFi taxi view | 7 |
| `test/packs.test.js`, `test/assets.test.js`, `test/look.test.js` | Tests for the above | 3, 4, 5, 7 |
| `CONTRIBUTING.md` | Packs, `assets`, `look` | 3, 4, 5 |

---

### Task 1: Workspace, ledger and concept art (gated)

**Files:**
- Create: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Produces: the ledger every later task appends to; Caedon's pick among four taxi concept images (a Higgsfield job id), which Task 6 needs.

- [ ] **Step 1: Check out the branch and take the baseline**

```bash
git checkout hi-fi-test
git log --oneline -3
[ -d node_modules ] || npm ci
npm test
npm run build
```

Expected: the log shows the plan commit on top of 7d949e0 and e3742bc; `npm test` reports 85 passing, 0 failing; the build succeeds.

- [ ] **Step 2: Create the ledger**

Create `docs/specs/2026-10-08-hifi-ledger.md`:

```markdown
---
provenance: agent-generated
last-verified: never
---

# HiFi test ledger (sub-project 1)

> Point-in-time log, started 2026-10-08 on `hi-fi-test`. Spec: `2026-10-08-hifi-test-design.md`; plan:
> `2026-10-08-hifi-test-plan.md`. One line per `src/` change and per credit spend, written as the work happens.

## Engine changes (the modularity measurement)

| Task | File | Change | Why | Generic hook or HiFi-only | Could a module have done it without this? |
|---|---|---|---|---|---|

## Credits

Budget for sub-project 1: 40. Balance at the start: 3,000 (Ultra, 2026-10-08).

| Task | Job id | Model | What | Credits |
|---|---|---|---|---|

## Downloads and dependencies

| Task | What | Source | Size | Approved by Caedon |
|---|---|---|---|---|

## Stills and measurements

| Task | Still or probe | Query | Result | SHA-256 |
|---|---|---|---|---|

## Rulings

- Ruling (plan): packs/hifi/themes/ carries a look for all four shipped themes, not only downtown (spec §4 named downtown), because levels 1 and 2 switch to `bridge` mid-run and HiFi must not drop to the low-fi renderer there.
- Ruling (plan): only opaque meshes cast and receive shadows (spec §4 said everything the engine adds), so glows, blob shadows and sprites never cast hard shadows.
```

- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-10-08-hifi-ledger.md
git commit -m "docs: HiFi test ledger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Identify the keyframes**

Load `mcp__fe7dd859-6ded-4f46-ac28-8bfc861c54ab__show_generation_by_ids` with ToolSearch and call it with both teaser keyframe ids. Note which job is the 16:9 frame and which is the 9:16 frame, and add a "Reference" line to the ledger's Rulings section, for example `- Reference: 16:9 keyframe is job …, 9:16 is job ….`

- [ ] **Step 5: Check Higgsfield's generation destination**

Call `mcp__fe7dd859-6ded-4f46-ac28-8bfc861c54ab__get_preferences` (Higgsfield's rule before a first generation without a destination) and follow what it says about projects. Reuse that destination for every generation in this plan.

- [ ] **Step 6: Quote the concept art**

Call `generate_image` with `get_cost: true` and these params (the same ones Step 8 submits):

```json
{
  "model": "gpt_image_2_5",
  "count": 4,
  "aspect_ratio": "1:1",
  "medias": [
    { "value": "<the 16:9 keyframe job id from Step 4>", "role": "image_references" },
    { "value": "97ba0692-9968-468c-8357-61e4bcd049ab", "role": "image_references" }
  ],
  "prompt": "Concept art for a game asset, in the art style of the reference images: a glossy toy yellow taxi cab with chunky rounded proportions like a vinyl toy, smooth glossy paint with clear studio highlights, a white roof sign that reads TAXI, black rubber tyres, light-blue tinted windows, red tail lights. Rear three-quarter view from slightly above, the whole car in frame and centred, on a plain light grey background. No logos, no brand names, no other text, no people."
}
```

Expected: about 1 credit (0.25 each). If the model rejects two references, drop the second one and quote again.

- [ ] **Step 7: Gate: ask Caedon to approve the spend**

Ask with AskUserQuestion: "Spend about 1 credit on four taxi concept variants (GPT Image 2.5)?" with options "Approve" and "Not now". Do not generate before he approves.

- [ ] **Step 8: Generate the four variants**

Call `generate_image` with the Step 6 params minus `get_cost`. Add a ledger Credits line: Task 1, the job id, `gpt_image_2_5`, "4 taxi concept variants", the credits charged.

- [ ] **Step 9: Ask Caedon to pick, and keep going**

The generation widget shows the four images. Write one line asking Caedon to reply with the number of his pick (1 to 4), or "again" for a new set. Do not wait: continue with Task 2. Task 6 starts by collecting the pick.

- [ ] **Step 10: Commit the ledger**

```bash
git add docs/specs/2026-10-08-hifi-ledger.md
git commit -m "docs: ledger records the reference keyframes and the taxi concept spend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Comparison stills: `engine.resize(w, h)`, the shot fixture, dev scripts and the low-fi baseline

**Files:**
- Modify: `src/engine.js` (the `resize` function and the returned object)
- Modify: `src/game.js:16` (dev hook)
- Create: `test/fixtures/levels/hifi-shot.json`
- Modify: `test/fixtures.test.js` (one new test at the end)
- Create: `scripts/drop-server.mjs`, `scripts/hifi-shot.js`
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Produces: `engine.resize(w = innerWidth, h = innerHeight)`; `window.__milkshake.character` (dev); `window.hifiShot(name, { w = 2160, h = 3840 })` → `{ name, w, h, bytes, hash }`; `window.hifiProbe({ frames = 300, w = 1512, h = 982, dpr = 2 })` → `{ size, meanMs, p95Ms, calls, triangles }`; a baseline low-fi still and its SHA-256 in the ledger.

- [ ] **Step 1: Write the failing test**

Append to `test/fixtures.test.js`:

```js
test('the HiFi shot fixture validates against the shipped content', async () => {
  const reg = buildRegistry(await discover(fileURLToPath(here('../content/'))));
  assert.deepEqual(validateAll({ 'hifi-shot': read(here('./fixtures/levels/hifi-shot.json')) }, [], reg), {});
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/fixtures.test.js`
Expected: FAIL with `ENOENT` for `hifi-shot.json`.

- [ ] **Step 3: Create the fixture**

Create `test/fixtures/levels/hifi-shot.json`. It stages board 01's 9:16 keyframe: a taxi in the middle lane, jug columns in the outer lanes, a few jugs past the taxi, nothing generated:

```json
{
  "id": "hifi-shot",
  "title": "HiFi shot (dev)",
  "author": "hifi-test",
  "length_m": 300,
  "seed": 7,
  "character": { "id": "milkshake" },
  "theme": { "id": "downtown", "sky": "#9fd3f5", "fog": 0.3 },
  "obstacles": { "taxi": 1 },
  "density": { "start": 0, "end": 0 },
  "jugs": { "per_100m": 0, "powerups": [] },
  "sections": [
    { "from_m": 0, "to_m": 200, "generation": false, "placements": [
      { "at_m": 60, "lane": 1, "kind": "obstacle", "id": "taxi" },
      { "at_m": 30, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 30, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 36, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 36, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 42, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 42, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 48, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 48, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 54, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 54, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 60, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 60, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 66, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 66, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 72, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 72, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 78, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 78, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 84, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 84, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 90, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 90, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 96, "lane": 0, "kind": "pickup", "id": "jug" }, { "at_m": 96, "lane": 2, "kind": "pickup", "id": "jug" },
      { "at_m": 72, "lane": 1, "kind": "pickup", "id": "jug" }, { "at_m": 78, "lane": 1, "kind": "pickup", "id": "jug" },
      { "at_m": 84, "lane": 1, "kind": "pickup", "id": "jug" }, { "at_m": 90, "lane": 1, "kind": "pickup", "id": "jug" }
    ] }
  ]
}
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `node --test test/fixtures.test.js`
Expected: PASS, all four tests. If validation reports a problem, fix the fixture (not the validator) and record a `Ruling:` line.

- [ ] **Step 5: Let `engine.resize` take an explicit size**

In `src/engine.js`, replace the `resize` function and its listener (currently lines 53–63) with:

```js
  // Fits the canvas to the window, or to an explicit size (scripts/hifi-shot.js renders stills at 2160x3840).
  function resize(w = innerWidth, h = innerHeight) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    portrait = w < h; // portrait needs a wider view to see all 3 lanes
    camera.fov = live.fov + (portrait ? 15 : 0);
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', () => resize()); // not addEventListener('resize', resize): the event would arrive as the width
  resize();
```

and add `resize` to the returned object's first line: `scene, camera, renderer, render, resize,`.

- [ ] **Step 6: Expose the character on the dev hook**

In `src/game.js`, change the dev hook line to:

```js
    if (import.meta.env.DEV) window.__milkshake = { run, world, level, engine, character }; // dev-only hook for the manual pass and scripts/hifi-shot.js; stripped from builds
```

- [ ] **Step 7: Write the drop server**

Create `scripts/drop-server.mjs`:

```js
// Saves files POSTed by the dev scripts (scripts/hifi-shot.js) into a folder: node scripts/drop-server.mjs <folder> [port]
// Listens on 127.0.0.1 only. Dev tooling; nothing ships it.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.'), port = Number(process.argv[3] ?? 5174);
mkdirSync(dir, { recursive: true });
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method !== 'POST') return res.end(); // the browser's CORS preflight
  const name = basename(new URL(req.url, 'http://localhost').searchParams.get('name') ?? 'drop.bin'); // basename: nothing lands outside the folder
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { writeFileSync(join(dir, name), Buffer.concat(chunks)); console.log(`saved ${name}`); res.end('ok'); });
}).listen(port, '127.0.0.1', () => console.log(`drop server: http://127.0.0.1:${port} -> ${dir}`));
```

- [ ] **Step 8: Write the shot script**

Create `scripts/hifi-shot.js`:

```js
// Dev-only stills and frame-cost probe for the HiFi test. Paste this whole file into the page with the browser pane's
// javascript tool, on the dev server with ?fixtures (plus &hifi or &lofi once the quality switch exists), then:
//   await hifiShot('baseline-lofi')  -> saves baseline-lofi.png through scripts/drop-server.mjs; returns its size and SHA-256
//   await hifiProbe()                -> mean and p95 frame cost at 3024x1964, draw calls, triangles
// Nothing imports this file; it never ships.
(() => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // The desktop app's browser pane freezes requestAnimationFrame while hidden; a timer keeps the game loop running.
  if (!window.__rafShim) { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = clearTimeout; window.__rafShim = true; }

  // ponytail: calibration knob — the teaser's 9:16 framing (Paper board 01), tuned by eye; metres and degrees
  const SHOT = { runZ: 61.2, runY: 1.5, camUp: 5.4, camBack: 10.5, lookAhead: 16, lookY: 0.8, fov: 52 };

  async function shotLevel() {
    let m = window.__milkshake;
    if (m?.level.id === 'hifi-shot' && !m.run.over) return m;
    $('levels').click();
    const button = [...document.querySelectorAll('#level-list button')].find((b) => b.textContent.includes('HiFi shot'));
    if (!button) throw new Error('no "HiFi shot" level: open the page with ?fixtures');
    button.click();
    for (let i = 0; i < 200; i++) {
      if (!$('help').hidden) $('help-ok').click(); // HOW TO PLAY shows once per browser before the first run
      m = window.__milkshake;
      if (m?.level.id === 'hifi-shot' && !m.run.over) {
        m.run.graceT = 1e9;  // a fresh run would die on its first row
        $('pause').click();  // freeze the run; engine.render() still draws
        return m;
      }
      await wait(50);
    }
    throw new Error('the HiFi shot level did not start');
  }

  function pose({ run, world, engine, character }) {
    Object.assign(run, { x: 0, lane: 1, z: SHOT.runZ, y: SHOT.runY, time: 0 });
    world.update(run, 0);             // streams the street to the spot; pickups spin with run.time, held at 0
    character.update(run);
    engine.follow(run, {}, Infinity); // snaps the sun, and in HiFi its shadow box, to the spot
    const cam = engine.camera;
    cam.position.set(0, SHOT.camUp, SHOT.runZ - SHOT.camBack);
    cam.lookAt(0, SHOT.lookY, SHOT.runZ + SHOT.lookAhead);
    cam.fov = SHOT.fov;
    cam.updateProjectionMatrix();
  }

  const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');

  window.hifiShot = async (name, { w = 2160, h = 3840 } = {}) => {
    const m = await shotLevel(), r = m.engine.renderer, dpr = r.getPixelRatio();
    r.setPixelRatio(1);
    m.engine.resize(w, h); // resize resets the field of view, so pose after it
    pose(m);
    m.engine.render();
    const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png')); // the snapshot is taken at this call
    r.setPixelRatio(dpr);
    m.engine.resize();
    await fetch(`http://127.0.0.1:5174/?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
    return { name, w, h, bytes: blob.size, hash: await sha256(blob) };
  };

  // Frame cost without requestAnimationFrame (the pane throttles it): back-to-back renders, each waiting for the GPU.
  window.hifiProbe = async ({ frames = 300, w = 1512, h = 982, dpr = 2 } = {}) => {
    const m = await shotLevel(), r = m.engine.renderer, gl = r.getContext(), was = r.getPixelRatio();
    r.setPixelRatio(dpr);
    m.engine.resize(w, h);
    pose(m);
    const t = [];
    for (let i = 0; i < frames; i++) { const a = performance.now(); m.engine.render(); gl.finish(); t.push(performance.now() - a); }
    r.info.autoReset = false; r.info.reset(); m.engine.render(); // one frame's totals across every pass
    const { calls, triangles } = r.info.render;
    r.info.autoReset = true;
    r.setPixelRatio(was);
    m.engine.resize();
    t.sort((a, b) => a - b);
    return { size: `${w * dpr}x${h * dpr}`, meanMs: +(t.reduce((s, x) => s + x, 0) / frames).toFixed(2), p95Ms: +t[Math.floor(frames * 0.95)].toFixed(2), calls, triangles };
  };
})();
```

- [ ] **Step 9: Run the whole suite and the build**

Run: `npm test && npm run build`
Expected: every test passes (86 now); the build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/engine.js src/game.js test/fixtures.test.js test/fixtures/levels/hifi-shot.json scripts/drop-server.mjs scripts/hifi-shot.js
git commit -m "feat: engine.resize takes an explicit size; a shot fixture and dev scripts for HiFi comparison stills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Capture the low-fi baseline**

1. In the background: `npm run dev -- --port 5177 --strictPort` and `node scripts/drop-server.mjs <scratchpad>/shots 5174`.
2. `preview_start({ url: "http://localhost:5177/milkshake-runner/?fixtures" })`.
3. Read `scripts/hifi-shot.js` and run its contents through the pane's `javascript_tool`, then run `await hifiShot('baseline-lofi')`.
4. Open `<scratchpad>/shots/baseline-lofi.png` with the Read tool. Compare it with the 9:16 keyframe (Paper `get_screenshot`, node `F-0`): the taxi in the middle lane ahead of Milkshake, jug columns on both sides, the street running to a vanishing point. Tune `SHOT` in `scripts/hifi-shot.js` until the framing matches the reference, re-paste, re-shoot.
5. Ledger lines: one Stills row (Task 2, `baseline-lofi.png`, `?fixtures`, the size, the SHA-256), and one Engine changes row each for `src/engine.js` (resize takes a size; generic hook; a module could not have done it) and `src/game.js` (dev hook exposes the character; dev only; a module could not have done it).

- [ ] **Step 12: Commit the ledger and the tuned framing**

```bash
git add docs/specs/2026-10-08-hifi-ledger.md scripts/hifi-shot.js
git commit -m "docs: low-fi baseline still for the HiFi comparison

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Packs: `applyPack`, the `assets` field, the quality switch and the lazy pack load

**Files:**
- Modify: `src/registry.js` (new exports after `checkModule`; one line inside `checkModule`)
- Modify: `test/helpers.js`
- Create: `test/packs.test.js`
- Modify: `src/main.js` (quality switch, pack load)
- Modify: `CONTRIBUTING.md` (a "Packs" section after "Ending")
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: `buildRegistry`, `checkModule`, `KIND_DIR` from `src/registry.js`.
- Produces: `applyPack(registry, entries) → { registry, problems }` (pure; `entries` are `[{ path: 'packs/<pack>/<kind>s/<id>.js', module }]`); `SKIN_FIELDS`; `loadPack(name) → Promise<entries>` (browser); module field `assets: string[]` (lowercase `.glb` paths under `public/`), checked for every kind; `discover(root, prefix = 'content')` in `test/helpers.js`; `quality` (`'hifi' | 'lofi'`) in `src/main.js`.

- [ ] **Step 1: Let `discover` walk packs**

Replace `test/helpers.js` with:

```js
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Walks a content (or pack) directory the way Vite's import.meta.glob does, so tests build the same registry.
// prefix is the path the browser sees: 'content' for content/, 'packs/hifi' for packs/hifi/.
export async function discover(root, prefix = 'content', dir = root) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) entries.push(...(await discover(root, prefix, p)));
    else if (name.endsWith('.js')) {
      const rel = relative(root, p).split('\\').join('/');
      entries.push({ path: `${prefix}/${rel}`, module: (await import(pathToFileURL(p))).default });
    }
  }
  return entries;
}
```

Run: `npm test`
Expected: every test still passes (the existing callers pass one argument).

- [ ] **Step 2: Write the failing tests**

Create `test/packs.test.js`:

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, applyPack, checkModule } from '../src/registry.js';
import { discover } from './helpers.js';

const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
let shipped;
before(async () => { shipped = buildRegistry(await discover(CONTENT)); });
const at = (path, module) => [{ path, module }];
const view = () => ({ object: null });
const taxi = (extra = {}) => at('packs/hifi/obstacles/taxi.js', { kind: 'obstacle', id: 'taxi', createView: view, ...extra });

test('a pack re-skins a module and keeps how it plays', () => {
  const { registry, problems } = applyPack(shipped, taxi({ assets: ['hifi/taxi.glb'] }));
  assert.deepEqual(problems, []);
  assert.equal(registry.obstacle.taxi.createView, view);
  assert.deepEqual(registry.obstacle.taxi.assets, ['hifi/taxi.glb']);
  assert.equal(registry.obstacle.taxi.box, shipped.obstacle.taxi.box);
  assert.equal(registry.obstacle.taxi.avoid, shipped.obstacle.taxi.avoid);
  assert.notEqual(shipped.obstacle.taxi.createView, view, 'the registry it was given is not changed');
  assert.equal(registry.obstacle.barrier_low, shipped.obstacle.barrier_low, 'modules the pack does not name are untouched');
});

test('a pack cannot change how a module plays; the module underneath carries on', () => {
  const { registry, problems } = applyPack(shipped, taxi({ box: { w: 0.1, h: 0.1, d: 0.1 } }));
  assert.match(problems.join(), /"box" is not a looks-only field of obstacle modules: packs change how things look, not how they play/);
  assert.equal(registry.obstacle.taxi, shipped.obstacle.taxi);
});

test('only the looks fields of the module kind are allowed', () => {
  assert.match(applyPack(shipped, taxi({ look: {} })).problems.join(), /"look" is not a looks-only field of obstacle modules/);
  assert.match(applyPack(shipped, at('packs/hifi/endings/finish.js', { kind: 'ending', id: 'finish', run() {} })).problems.join(), /"run" is not a looks-only field of ending modules/);
});

test('an overlay must name a registered module and sit at its path', () => {
  assert.match(applyPack(shipped, at('packs/hifi/obstacles/rocket.js', { kind: 'obstacle', id: 'rocket', createView: view })).problems.join(), /no registered obstacle "rocket" to re-skin/);
  assert.match(applyPack(shipped, at('packs/hifi/obstacles/cab.js', { kind: 'obstacle', id: 'taxi', createView: view })).problems.join(), /must be saved as packs\/<pack>\/obstacles\/taxi\.js/);
  assert.match(applyPack(shipped, at('packs/hifi/props/taxi.js', { kind: 'obstacle', id: 'taxi', createView: view })).problems.join(), /must be saved as/);
  assert.match(applyPack(shipped, [...taxi(), ...taxi()]).problems.join(), /duplicate overlay/);
});

test('a community module is re-skinned at its namespaced path', () => {
  const rock = { kind: 'obstacle', id: 'ari/rock', avoid: 'lane', box: { w: 1, h: 1, d: 1 }, createView() {} };
  const reg = buildRegistry([{ path: 'content/obstacles/ari/rock.js', module: rock }]);
  const { registry, problems } = applyPack(reg, at('packs/hifi/obstacles/ari/rock.js', { kind: 'obstacle', id: 'ari/rock', createView: view }));
  assert.deepEqual(problems, []);
  assert.equal(registry.obstacle['ari/rock'].createView, view);
});

test('the merged module passes the same checks as any module', () => {
  assert.match(applyPack(shipped, taxi({ createView: 'nope' })).problems.join(), /createView/);
  assert.match(applyPack(shipped, taxi({ assets: ['/etc/passwd'] })).problems.join(), /assets must be a list of \.glb files/);
  assert.match(applyPack(shipped, taxi({ assets: 'hifi/taxi.glb' })).problems.join(), /assets must be a list/);
  assert.match(checkModule({ ...shipped.obstacle.taxi, assets: ['../secrets.glb'] }).join(), /assets/);
  assert.equal(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/taxi.glb'] }).length, 0);
});

test('no pack, no change', () => {
  const { registry, problems } = applyPack(shipped, []);
  assert.deepEqual(problems, []);
  for (const kind of Object.keys(shipped)) assert.deepEqual(Object.keys(registry[kind]), Object.keys(shipped[kind]));
  assert.equal(registry.obstacle.taxi, shipped.obstacle.taxi);
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test test/packs.test.js`
Expected: FAIL: `applyPack` is not exported by `src/registry.js`.

- [ ] **Step 4: Implement the `assets` check and `applyPack`**

In `src/registry.js`, add below the `HEX` line near the top:

```js
const ASSET = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.glb$/; // a .glb under public/: lowercase, no leading slash, no ..
```

Replace `checkModule` with:

```js
export function checkModule(m) {
  if (!isObj(m)) return ['the default export must be an object'];
  if (!KINDS.includes(m.kind)) return [`kind must be one of ${KINDS.join(', ')}`];
  if (typeof m.id !== 'string' || !(PLAIN.test(m.id) || NAMESPACED.test(m.id))) return ['id must be a-z0-9_- (built-in) or handle/name (community)'];
  const e = CHECKS[m.kind](m);
  // Any module may list files the game preloads before play (src/assets.js); only .glb loads today.
  if (m.assets !== undefined && !(Array.isArray(m.assets) && m.assets.every((a) => typeof a === 'string' && ASSET.test(a)))) e.push('assets must be a list of .glb files under public/, like "hifi/model.glb" (lowercase)');
  return e;
}
```

Then add, after `checkModule`:

```js
// Pack modules (packs/<pack>/<kind>s/<id>.js) re-skin a registered module: how it looks, never how it plays.
export const SKIN_FIELDS = { obstacle: ['createView'], pickup: ['createView'], prop: ['createView'], character: ['createView'], theme: ['createChunk', 'look'], ending: [] };
const PACK_PATH = /^packs\/[a-z0-9_-]+\/([a-z]+)\/(.+)\.js$/;

// entries: [{ path: 'packs/<pack>/<kind>s/<id>.js', module }]. Pure. Returns a new registry with each overlay merged over
// the module it names, plus the overlays that failed; a failed overlay leaves that module exactly as it was.
export function applyPack(registry, entries) {
  const reg = Object.fromEntries(KINDS.map((k) => [k, Object.assign(Object.create(null), registry[k])]));
  const problems = [], done = new Set();
  for (const { path, module: m } of entries) {
    const e = [], where = PACK_PATH.exec(path);
    if (!isObj(m)) e.push('the default export must be an object');
    else if (!KINDS.includes(m.kind)) e.push(`kind must be one of ${KINDS.join(', ')}`);
    else if (typeof m.id !== 'string' || !(PLAIN.test(m.id) || NAMESPACED.test(m.id))) e.push('id must name a registered module');
    else if (!where || where[1] !== KIND_DIR[m.kind] || where[2] !== m.id) e.push(`must be saved as packs/<pack>/${KIND_DIR[m.kind]}/${m.id}.js`);
    else if (!registry[m.kind]?.[m.id]) e.push(`no registered ${m.kind} "${m.id}" to re-skin`);
    else if (done.has(`${m.kind}:${m.id}`)) e.push('duplicate overlay');
    else {
      for (const k of Object.keys(m)) if (!['kind', 'id', 'assets', ...SKIN_FIELDS[m.kind]].includes(k)) e.push(`"${k}" is not a looks-only field of ${m.kind} modules: packs change how things look, not how they play`);
      const merged = { ...registry[m.kind][m.id], ...m };
      if (!e.length) e.push(...checkModule(merged));
      if (!e.length) { reg[m.kind][m.id] = merged; done.add(`${m.kind}:${m.id}`); }
    }
    if (e.length) problems.push(`${isObj(m) && m.id ? `${m.kind} "${m.id}" (${path})` : path}: ${e.join('; ')}`);
  }
  return { registry: reg, problems };
}

// Browser loader for one pack. Lazy: a low-fi session never downloads pack code.
export async function loadPack(name) {
  const files = import.meta.glob('../packs/**/*.js', { import: 'default' });
  const mine = Object.entries(files).filter(([p]) => p.startsWith(`../packs/${name}/`));
  return Promise.all(mine.map(async ([p, load]) => ({ path: p.replace(/^(\.\.\/)+/, ''), module: await load() })));
}
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `node --test test/packs.test.js && npm test`
Expected: PASS, and the whole suite passes.

- [ ] **Step 6: Wire the quality switch and the pack into `src/main.js`**

Change the registry import to `import { loadRegistry, applyPack, loadPack } from './registry.js';`. Add above `async function main()`:

```js
// HiFi is a looks-only pack over the shipped content: on with a mouse or trackpad, off on touch. ?hifi or ?lofi forces it.
const params = new URLSearchParams(location.search);
const quality = params.has('hifi') ? 'hifi' : params.has('lofi') ? 'lofi' : matchMedia('(pointer: fine)').matches ? 'hifi' : 'lofi';
```

Inside `main()`, replace the `loadRegistry` line and the warning after it with:

```js
  let { registry, problems } = loadRegistry({ fixtures }); // a broken content module disables only itself
  if (quality === 'hifi') {
    const pack = applyPack(registry, await loadPack('hifi')); // a broken overlay disables only itself; the module underneath carries on
    registry = pack.registry;
    problems = [...problems, ...pack.problems];
  }
  if (problems.length) console.warn('Some content files are disabled:', problems);
```

- [ ] **Step 7: Check it in the browser**

With the dev server running, load `http://localhost:5177/milkshake-runner/?hifi` and then `?lofi` in the pane. Expected: the menu appears both times; `read_console_messages({ onlyErrors: true })` is empty. There are no pack files yet, so both look the same.

- [ ] **Step 8: Document packs**

In `CONTRIBUTING.md`, after the "### Ending" section, add:

```markdown
### Packs: a new look for existing content

A pack re-skins modules that are already registered, without changing how they play. It lives at
`packs/<pack>/<kind>s/<id>.js`, mirrors the module's id, and may set only `createView` (obstacle, pickup, prop,
character), `createChunk` and `look` (theme), and `assets`. Anything else, a box, a speed or an effect, is rejected:
packs change how things look, not how they play. The game merges the `hifi` pack on devices with a mouse or trackpad;
add `?hifi` or `?lofi` to the address to force either. A broken overlay disables only itself, and the module
underneath carries on.
```

- [ ] **Step 9: Ledger and commit**

Ledger Engine changes rows: `src/registry.js` (applyPack, SKIN_FIELDS, loadPack, the assets check; generic hook; a module could not re-skin another module before this, finding 6 of the spec), `src/main.js` (quality switch and pack load; generic hook; no). Then:

```bash
npm test && npm run build
git add src/registry.js src/main.js test/helpers.js test/packs.test.js CONTRIBUTING.md docs/specs/2026-10-08-hifi-ledger.md
git commit -m "feat: looks-only packs overlay registered modules; a quality switch loads the hifi pack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Assets: preload, `gfx.asset`, a dispose that spares shared meshes, RUN waits

**Files:**
- Create: `src/assets.js`, `test/assets.test.js`
- Modify: `src/gfx.js` (re-export `asset`; `dispose`)
- Modify: `src/main.js` (preload, LOADING, `startLevel` waits)
- Modify: `CONTRIBUTING.md` (the "2. Add content" paragraph about `gfx`)
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: the merged `registry` and its modules' `assets` (Task 3).
- Produces: `adopt(path, scene)`; `preload(paths, load?) → Promise<void>` (never rejects; dedupes; skips cached paths); `asset(path) → Object3D` (a clone sharing geometry and materials, every node `userData.shared`; throws `asset "<path>" is not loaded: list it in the module's assets`); `gfx.asset`; `gfx.dispose` skips nodes with `userData.shared`.

- [ ] **Step 1: Write the failing tests**

Create `test/assets.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { adopt, preload, asset } from '../src/assets.js';

const model = () => gfx.group(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() })));

test('an asset copy shares its geometry and materials with every other copy', () => {
  adopt('test/a.glb', model());
  const a = asset('test/a.glb'), b = asset('test/a.glb');
  assert.notEqual(a, b);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
  assert.equal(a.children[0].material, b.children[0].material);
  assert.ok(a.children[0].userData.shared, 'copies carry the shared flag');
});

test('dropping a copy leaves the shared asset alone, and still frees what a module added to it', () => {
  adopt('test/b.glb', model());
  const copy = asset('test/b.glb'), own = gfx.box(1, 1, 1, '#ffffff');
  copy.add(own);
  const freed = [];
  copy.children[0].geometry.dispose = () => freed.push('shared geometry');
  copy.children[0].material.dispose = () => freed.push('shared material');
  own.geometry.dispose = () => freed.push('own geometry');
  gfx.dispose(copy);
  assert.deepEqual(freed, ['own geometry']);
});

test('an asset nobody preloaded fails loudly, naming the file', () => {
  assert.throws(() => asset('test/missing.glb'), /asset "test\/missing.glb" is not loaded: list it in the module's assets/);
});

test('preload loads each file once and never rejects when one fails', async () => {
  const asked = [];
  const load = async (p) => { asked.push(p); if (p.includes('bad')) throw new Error('404'); return model(); };
  const warn = console.warn;
  console.warn = () => {};
  try { await preload(['test/c.glb', 'test/bad.glb', 'test/c.glb'], load); } finally { console.warn = warn; }
  assert.deepEqual(asked.sort(), ['test/bad.glb', 'test/c.glb']);
  assert.ok(asset('test/c.glb'));
  assert.throws(() => asset('test/bad.glb'), /not loaded/);
  await preload(['test/c.glb'], load);
  assert.equal(asked.length, 2, 'a cached file is not loaded again');
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/assets.test.js`
Expected: FAIL: cannot find module `src/assets.js`.

- [ ] **Step 3: Write `src/assets.js`**

```js
// Files a content or pack module lists in `assets`, loaded once before play so views stay synchronous (spec §3).
// Every node of a loaded scene is flagged userData.shared: every copy uses its geometry and materials, so gfx.dispose
// leaves them alone. Skinned scenes (sub-project 3) will need SkeletonUtils.clone instead of clone().
const cache = new Map(); // path under public/ -> loaded scene

export function adopt(path, scene) {
  scene.traverse((n) => { n.userData.shared = true; });
  cache.set(path, scene);
}

let gltf; // one loader, built on first use, so Node tests and low-fi sessions never load it
async function loadGlb(url) {
  if (!gltf) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
    gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return (await gltf.loadAsync(url)).scene;
}

// Never rejects: a file that fails is reported and left out, so the module that needs it falls back to the pink block.
export async function preload(paths, load = (p) => loadGlb(`${import.meta.env.BASE_URL}${p}`)) {
  await Promise.all([...new Set(paths)].filter((p) => !cache.has(p)).map(async (p) => {
    try { adopt(p, await load(p)); } catch (err) { console.warn(`asset ${p} failed to load:`, err); }
  }));
}

export function asset(path) {
  const scene = cache.get(path);
  if (!scene) throw new Error(`asset "${path}" is not loaded: list it in the module's assets`);
  return scene.clone(); // shares geometry and materials; userData (the shared flag) is copied
}
```

- [ ] **Step 4: Re-export it from `gfx` and spare shared meshes in `dispose`**

In `src/gfx.js`, add after the imports:

```js
export { asset } from './assets.js'; // a preloaded GLB as a synchronous copy (src/assets.js)
```

and replace `dispose` with:

```js
// Frees geometry and per-object textures. Shared toon materials from mat() stay alive on purpose, and so does anything
// flagged userData.shared: a preloaded asset's meshes, which every copy of it uses.
export function dispose(object) {
  object.traverse((n) => {
    if (n.userData.shared) return;
    n.geometry?.dispose();
    if (n.isSprite || n.isPoints || n.material?.map) { n.material.map?.dispose(); n.material.dispose(); }
  });
}
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `node --test test/assets.test.js && npm test`
Expected: PASS, and the whole suite passes.

- [ ] **Step 6: Preload in `src/main.js` and make RUN wait**

Add `import { preload } from './assets.js';`. In `main()`, right after the `console.warn` for disabled content, add:

```js
  // Every file the registered modules list (low-fi lists none). ponytail: all at boot; per level once a pack passes ~30 MB.
  const paths = Object.values(registry).flatMap((byId) => Object.values(byId).flatMap((m) => m.assets ?? []));
  const ready = preload(paths);
  if (paths.length) { $('play').textContent = 'LOADING…'; ready.then(() => ($('play').textContent = 'RUN')); }
```

and make `startLevel` start with:

```js
  async function startLevel(id, carry = {}) {
    await ready; // a view needs its files before the street is built
```

- [ ] **Step 7: Document `assets`**

In `CONTRIBUTING.md`, append to the paragraph that starts "Modules receive `gfx` when they draw":

```markdown
A module may also list `.glb` files from `public/` in `assets` (for example `assets: ['hifi/taxi.glb']`). The game
loads them before play, and `gfx.asset(path)` returns a copy that shares geometry and materials with every other copy,
so your view stays synchronous. Do not dispose an asset's geometry or materials yourself; `gfx.dispose` leaves them alone.
```

- [ ] **Step 8: Check it, ledger, commit**

Reload `?hifi` and `?lofi`: the menu shows RUN (no pack lists assets yet) and RUN starts level 1; the console has no errors. Ledger Engine changes rows: `src/assets.js` (preload and shared copies; generic hook; no, obstacle views were sync-only, finding 4), `src/gfx.js` (`asset` re-export and the shared-safe dispose; generic hook; no, finding 3), `src/main.js` (preload before play; generic hook; no).

```bash
npm test && npm run build
git add src/assets.js src/gfx.js src/main.js test/assets.test.js CONTRIBUTING.md docs/specs/2026-10-08-hifi-ledger.md
git commit -m "feat: modules list GLB assets the game preloads; gfx.asset hands out shared copies dispose leaves alone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The look: `look` on themes, `src/look.js`, the engine hook and four theme looks

**Files:**
- Modify: `src/registry.js` (`checkLook`, one line in `CHECKS.theme`)
- Create: `src/look.js`, `test/look.test.js`
- Modify: `src/engine.js` (whole file below)
- Modify: `src/gfx.js` (`bend`)
- Modify: `src/world.js` (`skyAt`)
- Modify: `src/game.js` (the sky-change key)
- Modify: `src/main.js` (`useLook` in HiFi)
- Create: `packs/hifi/themes/downtown.js`, `midtown.js`, `uptown.js`, `bridge.js`
- Modify: `test/packs.test.js` (three tests about the shipped pack)
- Modify: `CONTRIBUTING.md` (the "### Theme" section)
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: `applyPack`, `discover(root, prefix)` (Task 3); `engine.resize` (Task 2).
- Produces: `checkLook(look) → string[]`; theme field `look: { exposure?, sun?: { color?, intensity? }, ambient?, env?, skyTop?, bloom?: { strength?, threshold?, radius? } }`; `lookState(theme) → null | { exposure, sun: { color, intensity }, ambient, env, skyTop, skyBottom, bloom: { strength, threshold, radius } }`; `createLook({ renderer, scene, camera, sun, hemi }) → { active, apply(theme), render(), resize(w, h) }`; `engine.useLook(look)`, `engine.sun`, `engine.hemi`; `world.skyAt(z) → { id, sky, fog, look }`.

- [ ] **Step 1: Write the failing tests**

Create `test/look.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { lookState } from '../src/look.js';
import { checkLook, checkModule } from '../src/registry.js';
import { createWorld } from '../src/world.js';
import { resolveRules } from '../src/rules.js';

const LOOK = { exposure: 1, sun: { color: '#fff3e0', intensity: 3 }, ambient: 0.5, env: 0.7, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 0.85, radius: 0.4 } };

test('a theme without a look keeps the low-fi path', () => {
  assert.equal(lookState({ sky: '#9fd3f5', fog: 0.3 }), null);
});

test('a look fills its defaults, and the sky fades to the level colour at the horizon', () => {
  const s = lookState({ sky: '#9fd3f5', look: { exposure: 1.2, bloom: { strength: 0.8 } } });
  assert.equal(s.exposure, 1.2);
  assert.deepEqual(s.bloom, { strength: 0.8, threshold: 0.85, radius: 0.4 });
  assert.deepEqual(s.sun, { color: '#ffffff', intensity: 3 });
  assert.equal(s.skyTop, '#9fd3f5', 'no skyTop: a flat sky in the level colour');
  assert.equal(s.skyBottom, '#9fd3f5');
  assert.equal(lookState({ sky: '#9fd3f5', look: LOOK }).skyTop, '#5ea9ec');
});

test('look values are checked on themes', () => {
  assert.deepEqual(checkLook(LOOK), []);
  assert.match(checkLook({ exposure: 9 }).join(), /look.exposure must be 0.2 to 3/);
  assert.match(checkLook({ sun: { color: 'warm' } }).join(), /look.sun.color must be a hex colour/);
  assert.match(checkLook({ sun: { tint: '#ffffff' } }).join(), /look.sun may only set color and intensity/);
  assert.match(checkLook({ bloom: { glow: 1 } }).join(), /look.bloom may only set strength, threshold and radius/);
  assert.match(checkLook({ fogColor: '#ffffff' }).join(), /look: unknown key "fogColor"/);
  assert.match(checkLook('bright').join(), /look must be an object/);
  const theme = { kind: 'theme', id: 'ari/sea', sky: '#9fd3f5', fog: 0.2, buildings: { colors: ['#ffffff'], minH: 5, maxH: 10 } };
  assert.equal(checkModule({ ...theme, look: LOOK }).length, 0);
  assert.match(checkModule({ ...theme, look: { env: 5 } }).join(), /look.env must be 0 to 3/);
});

test('the look follows the section theme, so a mid-level theme switch switches the look', () => {
  const base = { kind: 'theme', sky: '#000000', fog: 0.3, buildings: { colors: ['#000000'], minH: 1, maxH: 2 } };
  const registry = { obstacle: {}, pickup: {}, prop: {}, character: {}, ending: {}, theme: { lit: { ...base, id: 'lit', look: { exposure: 1.1 } }, plain: { ...base, id: 'plain' } } };
  const level = { id: 'w', length_m: 600, theme: { id: 'lit' }, obstacles: {}, density: { start: 0, end: 0 }, jugs: { per_100m: 0, powerups: [] }, sections: [{ from_m: 240, to_m: 480, theme: { id: 'plain' } }] };
  const world = createWorld(new THREE.Scene(), level, { registry, rules: resolveRules(), seed: 1, end: 600 });
  assert.equal(world.skyAt(10).id, 'lit');
  assert.deepEqual(world.skyAt(10).look, { exposure: 1.1 });
  assert.equal(world.skyAt(300).id, 'plain');
  assert.equal(world.skyAt(300).look, undefined);
  assert.equal(world.skyAt(500).id, 'lit');
  world.dispose();
});

test('opaque meshes cast and receive shadows; glows and blob shadows do not', () => {
  const g = gfx.bend(gfx.group(gfx.box(1, 1, 1, '#ffffff'), gfx.glow(0.5, '#ffffff'), gfx.blobShadow(0.5)));
  const [box, glow, blob] = g.children;
  assert.ok(box.castShadow && box.receiveShadow);
  assert.ok(!glow.castShadow && !glow.receiveShadow);
  assert.ok(!blob.castShadow && !blob.receiveShadow);
});
```

Append to `test/packs.test.js` (add `import { existsSync } from 'node:fs';` to its imports):

```js
const PACK = fileURLToPath(new URL('../packs/hifi/', import.meta.url));

test('the HiFi pack applies cleanly over the shipped content', async () => {
  assert.deepEqual(applyPack(shipped, await discover(PACK, 'packs/hifi')).problems, []);
});

test('every shipped theme has a HiFi look, so a mid-level theme switch never drops to the low-fi renderer', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const id of Object.keys(shipped.theme)) assert.ok(registry.theme[id].look, `theme "${id}" has no look in packs/hifi/themes/`);
});

test('every file the HiFi pack lists is in public/', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const byId of Object.values(registry)) for (const m of Object.values(byId)) for (const a of m.assets ?? []) {
    assert.ok(existsSync(new URL(`../public/${a}`, import.meta.url)), `${m.kind} "${m.id}" lists ${a}, which is not in public/`);
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/look.test.js test/packs.test.js`
Expected: FAIL: `src/look.js` does not exist, and `packs/hifi/` does not exist (`ENOENT`).

- [ ] **Step 3: Check `look` on themes**

In `src/registry.js`, add near the top:

```js
const LOOK_RANGES = { exposure: [0.2, 3], ambient: [0, 3], env: [0, 3] };
```

add inside `CHECKS.theme`, before `return e;`:

```js
    if (m.look !== undefined) e.push(...checkLook(m.look));
```

and add after `CHECKS`:

```js
// A theme's HiFi look (spec §4), every field optional. Used only when the engine has a look pipeline (src/look.js).
export function checkLook(l) {
  if (!isObj(l)) return ['look must be an object'];
  const e = [];
  for (const k of Object.keys(l)) if (!['exposure', 'sun', 'ambient', 'env', 'skyTop', 'bloom'].includes(k)) e.push(`look: unknown key "${k}"`);
  for (const [k, [lo, hi]] of Object.entries(LOOK_RANGES)) if (l[k] !== undefined && !num(l[k], lo, hi)) e.push(`look.${k} must be ${lo} to ${hi}`);
  if (l.skyTop !== undefined && !HEX.test(l.skyTop)) e.push('look.skyTop must be a hex colour');
  if (l.sun !== undefined) {
    if (!isObj(l.sun) || Object.keys(l.sun).some((k) => !['color', 'intensity'].includes(k))) e.push('look.sun may only set color and intensity');
    else {
      if (l.sun.color !== undefined && !HEX.test(l.sun.color)) e.push('look.sun.color must be a hex colour');
      if (l.sun.intensity !== undefined && !num(l.sun.intensity, 0, 10)) e.push('look.sun.intensity must be 0 to 10');
    }
  }
  if (l.bloom !== undefined) {
    if (!isObj(l.bloom) || Object.keys(l.bloom).some((k) => !['strength', 'threshold', 'radius'].includes(k))) e.push('look.bloom may only set strength, threshold and radius');
    else for (const [k, hi] of [['strength', 3], ['threshold', 1], ['radius', 1]]) if (l.bloom[k] !== undefined && !num(l.bloom[k], 0, hi)) e.push(`look.bloom.${k} must be 0 to ${hi}`);
  }
  return e;
}
```

- [ ] **Step 4: Write `src/look.js`**

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// The HiFi look (spec §4): tone mapping, sun shadows, studio reflections, a gradient sky and bloom, from a theme's `look`.
// main.js loads this file only in HiFi sessions; without a look the engine renders exactly as before.

// A look with its defaults filled in, or null for "no look". Pure, so it is tested in Node.
export function lookState(theme) {
  const l = theme.look;
  if (!l) return null;
  return {
    exposure: l.exposure ?? 1,
    sun: { color: l.sun?.color ?? '#ffffff', intensity: l.sun?.intensity ?? 3 },
    ambient: l.ambient ?? 0.5,
    env: l.env ?? 0.7,
    skyTop: l.skyTop ?? theme.sky,
    skyBottom: theme.sky,
    bloom: { strength: l.bloom?.strength ?? 0.5, threshold: l.bloom?.threshold ?? 0.85, radius: l.bloom?.radius ?? 0.4 },
  };
}

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz - cameraPosition );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;
const SKY_FRAG = /* glsl */`
  uniform vec3 top;
  uniform vec3 bottom;
  varying vec3 vDir;
  void main() {
    gl_FragColor = vec4( mix( bottom, top, smoothstep( 0.0, 0.45, vDir.y ) ), 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createLook({ renderer, scene, camera, sun, hemi }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // A camera-centred dome, drawn first and outside the fog; the horizon colour is the level's sky, so the fog meets it.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  dome.visible = false;
  scene.add(dome);

  // ponytail: calibration knobs — the shadow box around the sun's target (engine.js aims it 25 m ahead of the run)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let active = false;
  return {
    get active() { return active; },
    // engine.setSky calls this after setting the low-fi sky, fog and light: a look overrides them, no look switches itself off.
    apply(theme) {
      const s = lookState(theme);
      active = !!s;
      renderer.toneMapping = s ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = s?.exposure ?? 1;
      renderer.shadowMap.enabled = !!s;
      sun.castShadow = !!s; // toggled with the shadow map, so the light state changes and materials recompile once
      scene.environment = s ? env : null;
      dome.visible = !!s;
      if (!s) return;
      scene.environmentIntensity = s.env;
      sun.color.set(s.sun.color);
      sun.intensity = s.sun.intensity;
      hemi.intensity = s.ambient;
      dome.material.uniforms.top.value.set(s.skyTop);
      dome.material.uniforms.bottom.value.set(s.skyBottom);
      Object.assign(bloom, s.bloom);
    },
    render() {
      dome.position.copy(camera.position);
      composer.render();
    },
    resize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
```

- [ ] **Step 5: Give the engine its look hook**

Replace `src/engine.js` with (the camera functions and the streaks are unchanged; `resize` keeps Task 2's form and adds `look?.resize`):

```js
import * as THREE from 'three';

export const CAMERA = { height: 3.6, distance: 6.5, fov: 60 }; // the chase camera; a section may override within the validator's ranges
export const SPEED_BASE = 12;    // m/s below which the view does not widen
export const FOV_PER_MS = 0.6;   // degrees of extra field of view per m/s over SPEED_BASE
const CAMERA_EASE = 0.2;         // seconds; overrides are 92% of the way in half a second
const STREAKS = 14, STREAK_FROM = 16, STREAK_FULL = 30; // streaks fade in between these speeds (m/s)
const SUN = 2.2, HEMI = 1.2;     // the low-fi light; a HiFi look sets its own, and setSky puts these back first
// Sun from above, behind the camera and a little to the right, so faces toward the camera are lit and side faces take
// the one shade tone the style sheet shows. It sits far back along that line and aims ahead of the run, so a HiFi shadow
// box covers the street ahead and the tallest buildings; the direction, and so the low-fi shading, is unchanged.
const SUN_DIR = new THREE.Vector3(6, -16, 12).normalize(), SUN_BACK = 120, SUN_AHEAD = 25;

// Where the chase camera sits for a run. Pure, so it is testable: `cam` is a section's override, `speed` widens the view.
export function cameraFor(run, cam = {}, speed = 0) {
  const height = cam.height ?? CAMERA.height, distance = cam.distance ?? CAMERA.distance;
  return {
    x: run.x * 0.6, y: height + run.y * 0.3, z: run.z - distance,
    lookX: run.x * 0.8, lookY: 1.2, lookZ: run.z + 12,
    fov: (cam.fov ?? CAMERA.fov) + Math.max(0, speed - SPEED_BASE) * FOV_PER_MS,
  };
}

// Eases the live camera values toward a section's override, and the speed that widens the view toward the run's,
// so a level that opens at a carried speed widens over half a second instead of popping on its first frame. Pass dt = Infinity to snap.
export function easeCamera(live, cam = {}, speed = 0, dt = 1 / 60) {
  const a = 1 - Math.exp(-dt / CAMERA_EASE);
  for (const k of ['height', 'distance', 'fov']) live[k] += ((cam[k] ?? CAMERA[k]) - live[k]) * a;
  live.speed += (speed - live.speed) * a;
  return live;
}

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const sun = new THREE.DirectionalLight('#ffffff', SUN);
  const hemi = new THREE.HemisphereLight('#ffffff', '#55556a', HEMI);
  scene.add(sun, sun.target, hemi);

  // Speed streaks: thin bars parented to the camera, above and beside the lanes, fading in with speed.
  const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const streaks = new THREE.Group();
  for (let i = 0; i < STREAKS; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.5 + Math.random() * 2), streakMat);
    const side = i % 2 ? 1 : -1, x = side * (1.5 + Math.random() * 2.5), y = i % 3 ? 0.5 + Math.random() * 2 : 2 + Math.random() * 1.5;
    m.position.set(x, y, -4 - Math.random() * 14);
    streaks.add(m);
  }
  camera.add(streaks);
  scene.add(camera);

  const live = { ...CAMERA, speed: 0 }; // the eased camera values
  let portrait = false;
  let look = null; // the HiFi look (src/look.js), set by useLook; null keeps the low-fi renderer path
  const render = () => (look?.active ? look.render() : renderer.render(scene, camera));
  // Fits the canvas to the window, or to an explicit size (scripts/hifi-shot.js renders stills at 2160x3840).
  function resize(w = innerWidth, h = innerHeight) {
    renderer.setSize(w, h);
    look?.resize(w, h);
    camera.aspect = w / h;
    portrait = w < h; // portrait needs a wider view to see all 3 lanes
    camera.fov = live.fov + (portrait ? 15 : 0);
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', () => resize()); // not addEventListener('resize', resize): the event would arrive as the width
  resize();

  return {
    scene, camera, renderer, sun, hemi, render, resize,
    useLook(l) { look = l; resize(); },
    setSky(theme) {
      const sky = new THREE.Color(theme.sky);
      scene.background = sky;
      const far = 260 - theme.fog * 160;
      scene.fog = new THREE.Fog(sky, far * 0.3, far);
      sun.color.set('#ffffff'); sun.intensity = SUN; hemi.intensity = HEMI; // the low-fi light; a look may change it next
      look?.apply(theme);
    },
    // `cam` is the active section's override ({ height?, distance?, fov? }); dt eases toward it. Pass dt = Infinity to snap.
    follow(run, cam = {}, dt = 1 / 60) {
      const { speed } = easeCamera(live, cam, run.speed ?? 0, dt);
      const c = cameraFor(run, live, speed);
      camera.position.set(c.x, c.y, c.z);
      camera.lookAt(c.lookX, c.lookY, c.lookZ);
      const fov = c.fov + (portrait ? 15 : 0);
      if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      sun.target.position.set(run.x, 0, run.z + SUN_AHEAD);
      sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, -SUN_BACK);
      streakMat.opacity = Math.max(0, Math.min(0.6, ((speed - STREAK_FROM) / (STREAK_FULL - STREAK_FROM)) * 0.6));
      if (streakMat.opacity > 0 && Number.isFinite(dt)) for (const s of streaks.children) { s.position.z += speed * dt * 2; if (s.position.z > -2) s.position.z = -18 - Math.random() * 4; }
    },
  };
}
```

- [ ] **Step 6: Mark shadow casters in `gfx.bend`**

In `src/gfx.js`, replace `bend` with:

```js
// Every object the engine adds goes through here once, so it also marks opaque meshes as shadow casters and receivers.
// The flags do nothing while the shadow map is off (low-fi). Transparent glows, blob shadows and sprites stay out of it.
export function bend(object) {
  object.traverse((n) => {
    const mats = [].concat(n.material ?? []); // a mesh may carry a material array
    for (const m of mats) bendable(m);
    if (n.isMesh) n.castShadow = n.receiveShadow = mats.every((m) => !m.transparent);
  });
  return object;
}
```

- [ ] **Step 7: Return the theme id and look from `skyAt`, and key the sky on it**

In `src/world.js`, replace `skyAt` with:

```js
  const skyAt = (z) => {
    const s = sectionAt(norm, z), t = registry.theme[s.theme.id];
    return { id: s.theme.id, sky: s.theme.sky ?? t.sky, fog: s.theme.fog ?? t.fog, look: t.look }; // look: a HiFi theme's, or undefined
  };
```

In `src/game.js`, change the sky line to:

```js
      const sky = world.skyAt(run.z), key = `${sky.id}/${sky.sky}/${sky.fog}`; // the id too: a theme switch under the same sky still changes the look
```

- [ ] **Step 8: Use the look in HiFi**

In `src/main.js`, right after `const engine = createEngine($('game'));`, add:

```js
  if (quality === 'hifi') engine.useLook((await import('./look.js')).createLook(engine)); // the look's code loads only for HiFi
```

- [ ] **Step 9: Write the four looks**

Each value is a calibration knob for the manual pass. Create `packs/hifi/themes/downtown.js`:

```js
// HiFi look for downtown (level 1, a clear blue day). ponytail: calibration knobs, tuned against board 01's keyframes.
export default {
  kind: 'theme', id: 'downtown',
  look: { exposure: 1.0, sun: { color: '#fff3e0', intensity: 3 }, ambient: 0.5, env: 0.7, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 0.85, radius: 0.4 } },
};
```

`packs/hifi/themes/bridge.js` (the same day as downtown; levels 1 and 2 cross it mid-run):

```js
// HiFi look for the bridge stretch: the same day as downtown, so crossing it mid-run keeps the light. ponytail: calibration knobs.
export default {
  kind: 'theme', id: 'bridge',
  look: { exposure: 1.0, sun: { color: '#fff3e0', intensity: 3 }, ambient: 0.5, env: 0.7, skyTop: '#5ea9ec', bloom: { strength: 0.5, threshold: 0.85, radius: 0.4 } },
};
```

`packs/hifi/themes/midtown.js`:

```js
// HiFi look for midtown (level 2, a low orange sun). ponytail: calibration knobs.
export default {
  kind: 'theme', id: 'midtown',
  look: { exposure: 0.95, sun: { color: '#ffd2a1', intensity: 2.6 }, ambient: 0.45, env: 0.6, skyTop: '#e07b5a', bloom: { strength: 0.6, threshold: 0.8, radius: 0.45 } },
};
```

`packs/hifi/themes/uptown.js`:

```js
// HiFi look for uptown (endless, a purple dusk). ponytail: calibration knobs.
export default {
  kind: 'theme', id: 'uptown',
  look: { exposure: 0.9, sun: { color: '#f3d4ff', intensity: 2.2 }, ambient: 0.55, env: 0.6, skyTop: '#6d4fa8', bloom: { strength: 0.7, threshold: 0.8, radius: 0.5 } },
};
```

- [ ] **Step 10: Run the tests to make sure they pass**

Run: `node --test test/look.test.js test/packs.test.js && npm test`
Expected: PASS, and the whole suite passes (including "the engine never names content").

- [ ] **Step 11: Document `look`**

In `CONTRIBUTING.md`, at the end of the "### Theme" section, add:

```markdown
A theme may also carry a `look`, used only in HiFi: `{ exposure, sun: { color, intensity }, ambient, env, skyTop,
bloom: { strength, threshold, radius } }`, every field optional and range-checked like the rest. `skyTop` is the top of
the sky gradient; the horizon is the level's sky colour. Low-fi ignores it.
```

- [ ] **Step 12: Check HiFi in the browser**

Reload `?hifi`, press RUN, and in the same `javascript_tool` call set `__milkshake.run.graceT = 1e9` once the level starts. Expected: soft sun shadows under obstacles and buildings on the road; tone-mapped colours that still read as the palette; a sky that fades from deeper blue overhead to the level colour at the horizon; a soft bloom around the jug glows. Teleport to the bridge (`__milkshake.run.z = 1100`): the look stays on. `read_console_messages({ onlyErrors: true })` is empty. If something reads wrong, tune the look values (they are knobs) and note what changed in the ledger.

- [ ] **Step 13: Prove low-fi unchanged**

Load `?fixtures&lofi`, paste `scripts/hifi-shot.js`, run `await hifiShot('lofi-task5')`. Expected: the SHA-256 equals Task 2's `baseline-lofi` hash. If it differs, open both PNGs with the Read tool, find the difference, and fix it before going on; record what you found in the ledger.

- [ ] **Step 14: Resize check (Review Focus 4)**

`resize_window({ preset: "mobile" })`, load `?hifi` (forced: the mobile preset emulates touch, which would pick low-fi), start a run and screenshot: the frame fills the portrait canvas, sharp, not stretched. Then `resize_window({ preset: "desktop" })`.

- [ ] **Step 15: Ledger and commit**

Ledger Engine changes rows: `src/look.js` (the HiFi look pipeline; HiFi-only file loaded on demand; no, finding 1), `src/engine.js` (`useLook`, light reset in `setSky`, sun aimed ahead along the same direction; generic hook; no), `src/gfx.js` (`bend` marks opaque shadow casters; generic; no), `src/world.js` (`skyAt` returns id and look; generic; no), `src/game.js` (sky key includes the theme id; generic; no), `src/registry.js` (`checkLook`; generic; no), `src/main.js` (`useLook` in HiFi; generic; no). Stills row: `lofi-task5.png` with its hash.

```bash
npm test && npm run build
git add src packs test CONTRIBUTING.md docs/specs/2026-10-08-hifi-ledger.md
git commit -m "feat: the HiFi look: tone mapping, sun shadows, reflections, a gradient sky and bloom from a theme's look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The taxi model (gated: credits, download, install)

**Files:**
- Create: `public/hifi/taxi.glb`, `scripts/optimize-glb.sh`
- Modify: `package.json`, `package-lock.json`
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: Caedon's concept pick (Task 1).
- Produces: `public/hifi/taxi.glb` (≤ 3 MB, meshopt, WebP ≤ 2048 px); `npm run assets:optimize -- <in.glb> <out.glb>`.

- [ ] **Step 1: Collect the pick**

If Caedon has not replied with a pick, ask with AskUserQuestion ("Which taxi concept should become the 3D model?", options "Variant 1" to "Variant 4"; "Other" covers "again"). On "again", repeat Task 1 Steps 6 to 9 (gated).

- [ ] **Step 2: Read the multi-view model's rules**

Call `models_explore({ action: "get", model_id: "tripo_h3_1_multiview_to_3d" })` and note its view order (Tripo's convention is front, left, back, right) and media role.

- [ ] **Step 3: Quote the views and the model, then ask**

Quote four view images (`generate_image` with `get_cost: true`, model `gpt_image_2_5`, `aspect_ratio` "1:1", `medias: [{ value: "<picked variant job id>", role: "image_references" }]`), one per view, with this prompt where `{view}` is `front`, `left side`, `rear` or `right side`:

```text
The same taxi as the reference image, with exactly the same design, colours, proportions and roof sign, seen straight from the {view}, centred, the whole car in frame, on a plain light grey background. No logos, no brand names, no other text, no people.
```

Quote the model: `generate_3d` with `get_cost: true`, model `tripo_h3_1_multiview_to_3d`, `geometry_quality` "detailed", `texture_quality` "detailed", `pbr` true, `face_limit` 20000, and the four views as media in the order from Step 2 (use any four existing image job ids for the quote). Expected: about 1 credit for the views, 18 for the model. **Gate:** ask Caedon with AskUserQuestion: "Spend about 19 credits on four taxi views and the Tripo multi-view model (one retry would add 18)?" with options "Approve" and "Not now".

- [ ] **Step 4: Generate the views, then the model**

Generate the four views (load `generate_image_batch` with ToolSearch, or make four `generate_image` calls). Check each one shows the same taxi from the right side; regenerate any that drift (each regeneration is 0.25 credits, still inside the approval). Then submit `generate_3d` with the Step 3 params minus `get_cost`, wait with `jobs_wait`, and look at the result with `job_display`. Ledger Credits rows for every job.

If the mesh is lumpy, asymmetric or missing the sign, one retry is approved (a new seed or a cleaner view set). If the retry also fails, stop and ask Caedon (Meshy 5 remesh is the spec's fallback, and it needs a new quote).

- [ ] **Step 5: Gate: the download**

Read the file's size first without downloading it: `curl -sIL "<GLB URL>"` through the context-mode `ctx_execute` shell tool (the `Content-Length` header). Then ask Caedon with AskUserQuestion: "Download taxi_raw.glb (<size> MB) from <host of the job's GLB URL> into the scratchpad?" with options "Approve" and "Not now". On approval, download through the context-mode `ctx_execute` shell tool: `curl -fL -o "<scratchpad>/taxi_raw.glb" "<GLB URL>"`, then `ls -la "<scratchpad>/taxi_raw.glb"` in Bash. Ledger Downloads row.

- [ ] **Step 6: Gate: install the optimiser**

Ask Caedon with AskUserQuestion: "Install @gltf-transform/cli as a devDependency from npm (it brings sharp for WebP)?" with options "Approve" and "Not now". On approval:

```bash
npm install --save-dev @gltf-transform/cli
npx gltf-transform --version
npx gltf-transform optimize --help
```

Confirm the help lists `--compress` (with `meshopt`), `--texture-compress` (with `webp`) and `--texture-size`. If a flag name differs, use the real one in Step 7 and record a `Ruling:` line. Ledger Downloads row (package, version, npm registry).

- [ ] **Step 7: Write the optimise script**

Create `scripts/optimize-glb.sh`:

```sh
#!/bin/sh
# Compresses a generated GLB for the game: meshopt geometry, WebP textures at most 2048 px.
# Usage: npm run assets:optimize -- in.glb public/hifi/name.glb
set -e
npx gltf-transform optimize "$1" "$2" --compress meshopt --texture-compress webp --texture-size 2048
```

Add to `package.json` `scripts`: `"assets:optimize": "sh scripts/optimize-glb.sh"`.

- [ ] **Step 8: Optimise and inspect**

```bash
mkdir -p public/hifi
npm run assets:optimize -- "<scratchpad>/taxi_raw.glb" public/hifi/taxi.glb
npx gltf-transform inspect public/hifi/taxi.glb
ls -la public/hifi/taxi.glb
```

Expected: 3 MB or less; `EXT_meshopt_compression` and `EXT_texture_webp` in the extensions; textures at most 2048 px; about 20k triangles. If it is over 3 MB, re-run the optimise command by hand with `--texture-size 1024` and record a `Ruling:` line.

- [ ] **Step 9: Ledger and commit**

```bash
npm test
git add public/hifi/taxi.glb scripts/optimize-glb.sh package.json package-lock.json docs/specs/2026-10-08-hifi-ledger.md
git commit -m "chore: generated HiFi taxi model, optimised with gltf-transform (meshopt, WebP)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The HiFi taxi module

**Files:**
- Create: `packs/hifi/obstacles/taxi.js`
- Modify: `test/packs.test.js`
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: `gfx.asset` and `adopt` (Task 4), `applyPack` (Task 3), `public/hifi/taxi.glb` (Task 6).
- Produces: the `taxi` overlay: `{ kind: 'obstacle', id: 'taxi', assets: ['hifi/taxi.glb'], createView(gfx) }`.

- [ ] **Step 1: Write the failing test**

Add to the imports of `test/packs.test.js`:

```js
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';
```

and append:

```js
test('the HiFi taxi fits the shipped taxi footprint, sits on the road, and every taxi shares one glossy paint', async () => {
  const T = gfx.three;
  // A stand-in for the generated GLB: 1.1 x 0.9 x 2.6 units, off-centre and below the origin, as generators leave them.
  const raw = new T.Group(), body = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 2.6), new T.MeshStandardMaterial());
  body.position.set(0.3, -0.2, 0.5);
  raw.add(body);
  adopt('hifi/taxi.glb', raw);
  const { default: hifiTaxi } = await import('../packs/hifi/obstacles/taxi.js');
  const a = hifiTaxi.createView(gfx).object, b = hifiTaxi.createView(gfx).object;
  a.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(a.children[0]), size = box.getSize(new T.Vector3()); // the model, without the light plates
  const { w, d } = shipped.obstacle.taxi.box;
  assert.ok(size.x <= w + 1e-6 && size.z <= d + 1e-6, `footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m`);
  assert.ok(Math.abs(size.x - w) < 1e-6 || Math.abs(size.z - d) < 1e-6, 'fills the footprint along one side');
  assert.ok(Math.abs(box.min.y) < 1e-6, 'wheels on the road');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, 'centred on its lane');
  const paint = (o) => { let p; o.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };
  assert.ok(paint(a)?.clearcoat > 0, 'glossy clearcoat paint');
  assert.equal(paint(a), paint(b), 'every taxi shares one paint material');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/packs.test.js`
Expected: FAIL: cannot find `packs/hifi/obstacles/taxi.js`.

- [ ] **Step 3: Write the module**

Create `packs/hifi/obstacles/taxi.js`:

```js
// HiFi taxi: the generated toy taxi in public/hifi/taxi.glb, fitted to the shipped taxi's footprint (content/obstacles/taxi.js),
// so it still reads "change lane". Built once from the first copy; every taxi after that shares the paint and the light plates.
const FOOTPRINT = { w: 2.0, d: 4.0 }; // the shipped taxi's box, metres
const YAW = 0;                        // ponytail: calibration knob — turns the generated model so its rear faces the player (-z)
const SIGN = { w: 0.46, h: 0.14, d: 0.2, y: 0.02, z: 0 }; // ponytail: calibration knob — the glow plate inside the roof sign
const TAIL = { x: 0.36, y: 0.42 };                        // ponytail: calibration knob — tail lights, as fractions of width and height

let parts; // { scale, offset, paint, lights }, measured from the first copy

export default {
  kind: 'obstacle', id: 'taxi', assets: ['hifi/taxi.glb'],
  createView(gfx) {
    const model = gfx.asset('hifi/taxi.glb');
    model.rotation.y = YAW;
    parts ??= build(gfx, model);
    model.traverse((n) => { if (n.isMesh) n.material = parts.paint.get(n.material) ?? n.material; });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model, ...parts.lights.map((l) => l.clone())) };
  },
};

function build(gfx, model) {
  const T = gfx.three;
  const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
  const scale = Math.min(FOOTPRINT.w / size.x, FOOTPRINT.d / size.z);
  const offset = new T.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
  const paint = new Map(); // generated material -> the same maps under a glossy clearcoat
  model.traverse((n) => {
    if (!n.isMesh || paint.has(n.material)) return;
    const m = n.material;
    paint.set(m, new T.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, aoMap: m.aoMap, roughness: m.roughness, metalness: m.metalness, clearcoat: 1, clearcoatRoughness: 0.12 }));
  });
  const w = size.x * scale, h = size.y * scale, d = size.z * scale;
  const glow = (color, intensity) => new T.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity });
  const sign = new T.Mesh(new T.BoxGeometry(SIGN.w, SIGN.h, SIGN.d), glow('#fff4c2', 2.5));
  sign.position.set(0, h + SIGN.y - SIGN.h / 2, SIGN.z);
  const lights = [sign];
  const tailGeometry = new T.BoxGeometry(0.28, 0.1, 0.04), tailMaterial = glow('#ff3b30', 3);
  for (const side of [-1, 1]) {
    const tail = new T.Mesh(tailGeometry, tailMaterial);
    tail.position.set(side * w * TAIL.x, h * TAIL.y, -d / 2 - 0.01);
    lights.push(tail);
  }
  for (const l of lights) l.userData.shared = true; // every taxi uses these; gfx.dispose leaves them alone
  return { scale, offset, paint, lights };
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test test/packs.test.js && npm test`
Expected: PASS, including "every file the HiFi pack lists is in public/" (the GLB is there from Task 6).

- [ ] **Step 5: Calibrate in the browser**

Load `?fixtures&hifi`, paste `scripts/hifi-shot.js`, run `await hifiShot('hifi-taxi-calibrate')`, and open the PNG. Check: the taxi's rear (tail lights) faces the camera; it sits on the road in the middle lane at the size of the low-fi taxi; the glow plate sits inside the generated roof sign; the tail-light plates sit on the tail lights. Tune `YAW`, `SIGN` and `TAIL` (Math.PI or ±Math.PI / 2 for `YAW` if the model faces another way), re-paste nothing (the module hot-reloads on save; reload the page), re-shoot until it reads right.

- [ ] **Step 6: Play it**

Load `?hifi` and play level 1 for 30 s with `graceT = 1e9`. Expected: generated taxis wherever level 1 places taxis, glossy, with tail lights catching the bloom; they bend away in the distance with the street. `read_console_messages({ onlyErrors: true })` is empty.

- [ ] **Step 7: Past the first chunk drops (Review Focus 5)**

In the same run, teleport `__milkshake.run.z = 400`, wait a second, then `600`. Expected: taxis still render normally (dropped chunks did not free the shared GLB); no pink blocks.

- [ ] **Step 8: Ledger and commit**

Ledger: the module needed no `src/` change beyond Tasks 3 to 5 (write that in a Rulings line, it is the measurement), plus the calibrated knob values.

```bash
npm test && npm run build
git add packs/hifi/obstacles/taxi.js test/packs.test.js docs/specs/2026-10-08-hifi-ledger.md
git commit -m "feat: the HiFi taxi: the generated model fitted to the shipped box, glossy paint, glowing sign and tail lights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Proof and close-out

**Files:**
- Modify: `docs/specs/2026-10-08-hifi-ledger.md`

**Interfaces:**
- Consumes: everything above.
- Produces: low-fi and HiFi stills sent to Caedon; frame-cost numbers; the ledger's close-out section; an updated memory note.

- [ ] **Step 1: The stills**

With both servers running: load `?fixtures&hifi`, paste `scripts/hifi-shot.js`, run `await hifiShot('hifi-taxi')`. Load `?fixtures&lofi`, paste again, run `await hifiShot('lofi-final')`. Expected: `lofi-final`'s SHA-256 equals `baseline-lofi`'s. If it differs, compare the two PNGs with the Read tool and fix any visible difference before closing. Ledger Stills rows.

- [ ] **Step 2: Frame cost**

In each mode run `await hifiProbe()`. Ledger rows with the size, mean and p95 ms, draw calls and triangles. The HiFi mean should be under 16.7 ms; if it is not, record it as a finding for sub-project 2 (do not start optimising here) and tell Caedon.

- [ ] **Step 3: Compare with the reference**

Open `hifi-taxi.png` and the 9:16 keyframe (Paper `get_screenshot`, node `F-0`). Write a short "Gap to the reference" list in the ledger: what already reads like the teaser and what the later sub-projects must bring (the city, Milkshake, the other assets, sparkles).

- [ ] **Step 4: Close the ledger**

Add a "Close-out (sub-project 1)" section: the output of `git diff --stat e3742bc..HEAD -- src/`; how many engine changes were generic hooks and how many HiFi-only; the credits spent against the 40 budget; and the modularity read in two or three sentences (what a module could do once these hooks existed, what it still cannot do).

- [ ] **Step 5: Final checks and commit**

```bash
npm test
npm run build
git status
git add docs/specs/2026-10-08-hifi-ledger.md
git commit -m "docs: HiFi sub-project 1 close-out: stills, frame cost, credits, the modularity read

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: every test passes, the build succeeds, the tree is clean after the commit.

- [ ] **Step 6: Review**

Use superpowers:requesting-code-review for one whole-branch review (`e3742bc..HEAD`) on the most capable model. Fix what it confirms, re-run Step 5, and log each fix in the ledger.

- [ ] **Step 7: Send the stills and hand back**

SendUserFile with `<scratchpad>/shots/lofi-final.png` and `<scratchpad>/shots/hifi-taxi.png` (caption: low-fi vs HiFi from the teaser's 9:16 framing; reference is board 01's 9:16 keyframe), status `proactive`. Update the memory note `milkshake-hifi-test.md` (sub-project 1 state, head commit, credits spent, what sub-project 2 needs). Then ask Caedon with AskUserQuestion whether to push `hi-fi-test` and open a draft PR onto `feat/v3-feedback` (gate: nothing is pushed without his yes).
