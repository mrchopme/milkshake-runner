---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner HiFi test, round 2 (the city, Milkshake, the hero assets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (a fresh implementer and a reviewer per
> task), with superpowers:dispatching-parallel-agents for the lanes that run side by side. Steps use checkbox (`- [ ]`) syntax.
> Tasks marked **[Main]** are the coordinating session's own work (gates, Higgsfield, downloads, the browser pane, Paper);
> never hand them to a subagent.

> Point-in-time snapshot, written 2026-10-09 against `hi-fi-city` at ed73799 (9132bae plus the approved spec). Read the
> current code before trusting a line number here; knobs marked `ponytail:` are first guesses meant to be tuned by eye.

**Goal:** Every asset left except the endings, at HiFi: a seeded, generated city with a skyline at the horizon, a remodelled
glossy Milkshake, and HiFi overlays for the 14 other shipped obstacles, pickups and props, built concurrently by subagents
behind Caedon's wave gates, while low-fi stays byte-identical.

**Architecture:** The engine gains generic hooks only (an instancing-safe bend, image assets, pack helper folders, a time
uniform, a horizon ring and sun knob in the HiFi look, per-level preload and freeing, worn looks for power-ups). Everything
HiFi lives in `packs/hifi/`: the city generator in `packs/hifi/lib/`, called from the four theme overlays' `createChunk`;
one overlay per generated model. Generated files come through the taxi pipeline (concept, views, Tripo, optimise).

**Tech Stack:** three 0.186.1 (WebGL2, InstancedMesh, BufferGeometryUtils, EffectComposer, CSM addon only if the probe
picks it), Vite 8, `node --test`; Higgsfield MCP (GPT Image 2.5, Nano Banana Pro, Nano Banana 2.1, Tripo H3.1); Paper MCP;
`@gltf-transform/cli` (already a devDependency); the system Python's Pillow for the image tiling dev script (not a repo dependency).

**Spec:** `docs/specs/2026-10-09-hifi-round2-design.md` (approved by Caedon 2026-10-09). Read it before any task.

## Global Constraints

- Branch `hi-fi-city`, local. Never push, open a pull request or merge into any other branch without Caedon's OK. Never push to `hi-fi-test` (the sub-project 1 session owns it and PR #5's Auto-fix). If `origin/hi-fi-test` gains commits, the main session merges it into `hi-fi-city`.
- Gates (the main session stops and asks Caedon first): every credit spend (quoted per wave from known prices; `get_cost` is blocked, so read the charge off `balance` after), every concept or design pick, every download (file names, source, sizes), any new dependency, any push or pull request. With three or more decisions at once, use AskUserQuestion pickers (the /triage pattern).
- Subagents never spend credits, download, install, push, merge, rebase, check out another branch, drive the browser pane or edit Paper. They hand those back.
- Credits: about 750 for the round; above about 1,000 ask again. Known prices (2026-10-08): GPT Image 2.5 0.25 an image (1k, low); Nano Banana Pro 2; Tripo H3.1 multi-view or single image, detailed, PBR 18; Hunyuan3D v3 18; Meshy 7 38; Seedance 2.5 5 s 35. Balance 2,979.75 on 2026-10-09.
- `?lofi` stays byte-identical to the baseline still Task 1 shoots on 9132bae. Everything HiFi stays out of the low-fi path.
- Content and pack modules never import `three` at the top of a file; they use `gfx.three`. Pack helpers live in `packs/<pack>/lib/` and may import `src/generator.js` and `content/` helpers by relative path.
- `src/` never names a content id in quotes (`test/fixtures.test.js`); `jug`, `milkshake` and `finish` are the allowed defaults.
- Every overlay keeps its shipped box: a module whose `avoid` is `jump`, `slide` or `timing` keeps its whole silhouette inside the box; `avoid: 'lane'` keeps the footprint and may stand taller (Caedon's taxi ruling, 2026-10-09).
- Glow comes from the asset's own shape: emissive maps or masks from its own texels or meshes, never plates or quads laid over it (Caedon, 2026-10-09). Show a crop before calling a glow done.
- No logos, brand names, readable trademarks, real landmarks, real teams or real people in anything generated. Sign words only from: TAXI, PIZZA, DELI, HOTEL, CAFE.
- Generated models: `public/hifi/<name>.glb`, optimised with `npm run assets:optimize -- in.glb out.glb` (meshopt, WebP at most 2048 px). Images: `public/hifi/city/{facades,shops,signs,sky}/<theme>-<nn>.webp`, facade tiles 1024 px.
- Desktop bar: 16.7 ms a frame at 3024×1964 on Caedon's M4 Pro.
- Every `src/` change is a row in `docs/specs/2026-10-09-hifi-round2-ledger.md`; every deviation from this plan is a `Ruling:` line there with its cost if wrong.
- Docs are point-in-time snapshots; knowledge files carry `provenance: agent-generated` / `last-verified: never`.
- Commits: conventional prefix, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A generated file fails to load** (a 404 on a facade tile, a corrupt GLB). Expected: that part falls back to its placeholder (procedural tile, code-built furniture, pink block for an overlay), the chunk still has its road, the run starts. Tests: Task 9 "a city chunk builds its street even when every kit file is missing"; Task 24 "a missing facade tile falls back to the placeholder tile".
2. **A level switches theme mid-run** (level 1 enters `bridge` at 1080 m, level 2 at 840 m) **under per-level freeing.** Expected: the bridge's files are in the level's set, the skyline switches with the look, nothing the street still shows is freed. Test: Task 16 "a level's files include every section theme's".
3. **The campaign chains into level 2, or a level restarts.** Expected: Milkshake's files survive every release, the previous world is disposed before anything is freed, a second click on LOADING… starts nothing. Tests: Task 16 "release keeps what the next level needs" and "a second start while loading is dropped".
4. **A long endless run.** Expected: GPU memory stays flat: instanced meshes free their buffers, shared materials and textures survive every dropped chunk. Test: Task 11 "two hundred dropped chunks free every instanced mesh they made and no shared material".
5. **A turn or hill with furniture and buildings in view.** Expected: lamps, trees and shells stay on their sidewalk and walls through the bend (no collapsed instances, no floating windows). Tests: Task 6's shader-order test and Task 11 "furniture stands only on the sidewalk band"; check: Task 14's probe frames on a turn.

---

## How to run things in this environment

Learned in earlier rounds (memory notes "Dev testing quirks", "HiFi glow own shape"):

- **Dev server.** Start Vite yourself in the background with a long limit: Bash `run_in_background: true`, `timeout: 7200000`, command `npm run dev -- --port 5177 --strictPort`. Background servers die at their limit, including while an AskUserQuestion is open; restart when the pane goes dead. Open the pane with `preview_start({ url: "http://localhost:5177/milkshake-runner/?fixtures&hifi" })` (`preview_start({ name })` reads the wrong folder).
- **Drop server.** `node scripts/drop-server.mjs <scratchpad>/shots 5174` (Bash background). It needs its folder and takes posts only from localhost pages.
- **Dev scripts.** Load from Vite, never paste: `(0, eval)(await (await fetch('/milkshake-runner/scripts/hifi-shot.js')).text())`, then `await hifiShot(name, opts)`, `await hifiProbe(opts)`, `await hifiLineup(name, opts)`.
- **Frozen frames.** The pane freezes `requestAnimationFrame` while hidden; `scripts/hifi-shot.js` installs a timer shim. While hidden `innerWidth` is 0: render stills through `engine.resize(w, h)` and `toBlob`, never the live canvas.
- **Dev hook.** `window.__milkshake = { run, world, level, engine, character }` while a level runs (dev builds only). Set `run.graceT = 1e9` right after a level starts; `#pause.click()` freezes the run while `engine.render()` keeps drawing. The pane's `computer` screenshot sometimes returns the previous frame: take two when one matters.
- **Downloads.** The Bash hook redirects `curl`. After Caedon approves, download through the context-mode `ctx_execute` shell to an absolute scratchpad path (`curl -fL -o "<scratchpad>/raw/<name>" "<url>"`), then `ls -la` in Bash. Read sizes first with `curl -sIL` through the same tool.
- **Higgsfield.** `get_cost` is blocked by the classifier: quote from the prices above, ask, then read the charge off `balance`. Preference `auto_create_project: false`: omit `folder_id`. Reference jobs: teaser keyframes `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` (16:9) and `854c98cf-81b2-40f4-8022-ac87b5a89a06` (9:16); Milkshake-3D element `eb91a157-e317-4233-ad5c-7658465fa7f4`, its render job `97ba0692-9968-468c-8357-61e4bcd049ab`. Tripo multi-view takes views in the order front, left, back, right. GPT Image can turn a requested front into a rear view: check every view before a 3D job. Tripo may lay the long axis along x (the taxi needed `YAW = −π/2`).
- **Paper.** Call `get_guide({ topic: "paper-mcp-instructions" })` once per session first. File `01M46QWM611CXK4WQSBTH6FJK3`; board 01 "Reference" (keyframes F-0 9:16, 9-0 16:9), board 02 palette. New boards: 15 "City layout", 16 "Wave 1 concepts", 17 "Wave 4 finals". Call `finish_working_on_nodes` when done.
- **Shell.** `od` is the Open Design CLI, `grep` is ugrep, `timeout` does not exist.
- **Tests.** `npm test` (118 at 9132bae) and `npm run build`.

## Orchestration

- **Roles.** The main session (Opus 5.5) coordinates: gates, Higgsfield, downloads, the browser pane, Paper, merges, the ledger's credit and download rows. Subagents implement, review and draft prompts.
- **Sizing** (Caedon: "a medium opus or high sonnet should do"): Agent tool `subagent_type: "general-purpose"` with `model: "opus"` for engine, city and Milkshake tasks and their reviewers; `model: "sonnet"` for tooling, prompts and per-asset modules and their reviewers; `model: "fable"` for the final whole-branch review only.
- **Isolation.** Every implementer runs with `isolation: "worktree"`, starts from the current `hi-fi-city` head, commits on its own branch and reports the branch name. The main session reviews (a reviewer subagent per task), merges the branch into `hi-fi-city` with `git merge --no-ff <branch>`, runs `npm test`, and only then dispatches tasks that depend on it.
- **Every implementer prompt carries:** the task text verbatim, the Global Constraints, the "How to run things" section, the spec path, and the hard limits (no credits, downloads, installs, pushes, merges, browser pane or Paper).
- **Ledger rows** for `src/` changes are written by the implementer in its own commit; credit, download and still rows by the main session.

### Lanes and order

```
Main:    T1 ─ T4 (board 15) ─ T5 (wave 1) ──────────── T14 (probe, gate) ─ T20 (wave 2) ─ T21 (wave 3) ─ T22 (downloads) ─ T25 ─ T26 ─ T27 ─ T28
Tooling: T2, T3 (from the start, in parallel)
Engine:  T6 ─ T7 ─ T8 ─ T13 ─────────────── T15 ─ T16 ─ T17 ─ T18 ─ T19
City:                   T9 ─ T10 ─ T11 ─ T12 ───────────────────────────────── T24
Assets:                                                                  T23 (one agent per asset, in parallel)
```

T9 starts when T8 is merged; T13 runs beside T9–T12; T14 needs T12 and T13; T15 needs T14's picks; T23 needs T18, T19 and T22; T24 needs T22 and T23's kit files.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `docs/specs/2026-10-09-hifi-round2-ledger.md` | Ledger | 1, all |
| `docs/specs/2026-10-09-hifi-round2-prompts.md` | Prompt book: every concept, view and image prompt | 3 |
| `test/fixtures/levels/hifi-shot-{midtown,uptown,bridge}.json` | Shot levels for the other themes | 2 |
| `scripts/hifi-shot.js` | Stills (9:16 and 16:9, any shot level), probe, lineup | 2 |
| `scripts/tile-image.py` | Crop, resize and WebP a generated image | 2 |
| `scripts/placeholder-skyline.py` | A code-drawn skyline PNG for the probe | 13 |
| `src/gfx.js` | Instancing-safe bend, re-patched clones, shared-aware dispose, `texture` re-export, `time` | 6, 7, 8, 15 |
| `src/assets.js` | Shared flags on parts, images, `texture`, `release`, `levelAssets`, `gateLoads` | 6, 7, 16 |
| `src/registry.js` | Image assets, pack `lib/`, `look.skyline`, `look.sun.dir`, `createWorn` | 7, 8, 13, 17 |
| `src/world.js` | Sets `gfx.time` | 8 |
| `src/look.js` | Horizon ring, sun direction, the probe's fog and shadow choices, deferred minors | 13, 15, 18 |
| `src/engine.js` | `sunDir` | 13 |
| `src/main.js` | Per-level preload and freeing | 16 |
| `src/worn.js`, `src/game.js` | Worn looks for power-ups; the dev hook carries `gfx` and `assets` | 2, 17 |
| `test/helpers.js` | `discover` skips a pack's `lib/` | 8 |
| `packs/hifi/lib/*.js` | City generator, kit, materials, fitting and paint helpers | 8–12, 18, 24 |
| `packs/hifi/themes/*.js` | `createChunk`, `assets`, retuned looks | 9, 12, 13, 24 |
| `packs/hifi/{obstacles,pickups,props,characters}/*.js` | One overlay per generated model; the shield's worn bubble | 17, 23 |
| `content/characters/milkshake.js` | `cowView` so the overlay reuses the view and v4's skinning | 19 |
| `public/hifi/**` | Generated files | 20–22 |
| `test/{logic,assets,packs,look,world,city,content}.test.js` | Tests | each task |

---

### Task 1 [Main]: Ledger, servers and the low-fi baseline

**Files:** Create `docs/specs/2026-10-09-hifi-round2-ledger.md`.

- [ ] **Step 1: Baseline checks**

```bash
git log --oneline -3
npm test
npm run build
```
Expected: ed73799 on top; 118 pass, 0 fail; the build succeeds.

- [ ] **Step 2: Create the ledger**

```markdown
---
provenance: agent-generated
last-verified: never
---

# HiFi test ledger, round 2 (the city, Milkshake, the hero assets)

> Point-in-time log, started 2026-10-09 on `hi-fi-city`. Spec: `2026-10-09-hifi-round2-design.md`; plan:
> `2026-10-09-hifi-round2-plan.md`. One line per `src/` change, credit spend, download, still and ruling, written as the work happens.

## Engine changes (the modularity measurement)

| Task | File | Change | Why | Generic hook or HiFi-only | Could a module have done it without this? |
|---|---|---|---|---|---|

## Assets

| Asset | Wave | Job ids | Credits | File | Size | Caedon's approval |
|---|---|---|---|---|---|---|

## Credits

Budget for the round: about 750 (ask again above about 1,000). Balance at the start: 2,979.75 (Ultra, 2026-10-09).

| Task | Job ids | Model | What | Credits (balance before → after) |
|---|---|---|---|---|

## Downloads and dependencies

| Task | What | Source | Size | Approved by Caedon |
|---|---|---|---|---|

## Stills and measurements

| Task | Still or probe | Query | Result | SHA-256 |
|---|---|---|---|---|

## Rulings

## Progress

## Final review

## Gap to the reference

## Close-out (round 2)
```

- [ ] **Step 3: Servers**

Start Vite (5177) and the drop server (5174, folder `<scratchpad>/shots`) as in "How to run things". Open the pane at `http://localhost:5177/milkshake-runner/?fixtures&lofi`.

- [ ] **Step 4: The low-fi baseline**

In the pane: load `scripts/hifi-shot.js` from Vite, then `await hifiShot('baseline-lofi-r2')`. Reload, load the script again, shoot `baseline-lofi-r2b`. Expected: both hashes equal. Ledger Stills row: this hash is the round's low-fi invariant (v4's merge retired c97c809e… on purpose). Also shoot `?fixtures&hifi` `hifi-r2-start` for the before/after record.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-10-09-hifi-round2-ledger.md
git commit -m "docs: round 2 ledger and the low-fi baseline on 9132bae

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 [Tooling, sonnet]: Shot levels per theme, a 16:9 framing, the lineup and the tiling script

**Files:**
- Create: `test/fixtures/levels/hifi-shot-midtown.json`, `hifi-shot-uptown.json`, `hifi-shot-bridge.json`, `scripts/tile-image.py`
- Modify: `scripts/hifi-shot.js`, `test/fixtures.test.js`, `src/game.js` (the dev hook only)

**Interfaces:**
- Produces: the dev hook also carries `gfx` and `assets` (the page's own module instances); `hifiShot(name, { w, h, level, frame })` with `level` one of `hifi-shot`, `hifi-shot-midtown`, `hifi-shot-uptown`, `hifi-shot-bridge` (default `hifi-shot`) and `frame` `'9:16'` (default, today's SHOT) or `'16:9'`; `hifiProbe({ frames, w, h, dpr, level })`; `hifiLineup(name, { paths, w, h })` renders the GLBs in `paths` (already loaded through `gfx.asset` by the page) side by side on a grey floor and saves a still; `python3 scripts/tile-image.py in out.webp --crop x,y,w,h --size 1024`.

- [ ] **Step 1: The fixtures.** Copy `test/fixtures/levels/hifi-shot.json` three times, changing only `id` (`hifi-shot-midtown`, `hifi-shot-uptown`, `hifi-shot-bridge`), `title` (`HiFi shot midtown (dev)` and so on) and `theme`: midtown `{ "id": "midtown", "sky": "#f4b26a", "fog": 0.4 }`, uptown `{ "id": "uptown", "sky": "#c98bd8", "fog": 0.35 }`, bridge `{ "id": "bridge", "sky": "#9fd3f5", "fog": 0.3 }`.

- [ ] **Step 2: The failing test.** In `test/fixtures.test.js` replace the HiFi shot test with:

```js
test('every HiFi shot fixture validates against the shipped content', async () => {
  const reg = buildRegistry(await discover(fileURLToPath(here('../content/'))));
  for (const id of ['hifi-shot', 'hifi-shot-midtown', 'hifi-shot-uptown', 'hifi-shot-bridge']) {
    assert.deepEqual(validateAll({ [id]: read(here(`./fixtures/levels/${id}.json`)) }, [], reg), {}, id);
  }
});
```

Run `npm test`. Expected before Step 1: fails reading the missing files; after: passes.

- [ ] **Step 3: The script.** In `scripts/hifi-shot.js`:

```js
  // ponytail: calibration knobs — the teaser's framings (Paper board 01), tuned by eye; metres and degrees
  const SHOTS = {
    '9:16': { runZ: 62.5, runY: 1.8, speed: 12, camUp: 7.8, camBack: 14, lookAhead: 9, lookY: 0.8, fov: 52, w: 2160, h: 3840 },
    '16:9': { runZ: 62.5, runY: 1.8, speed: 12, camUp: 4.2, camBack: 9, lookAhead: 40, lookY: 6, fov: 50, w: 3840, h: 2160 }, // keyframe 9-0: the skyline at the end of the avenue
  };
```

`shotLevel(id = 'hifi-shot')` finds the button whose text includes the level's title (`HiFi shot`, `HiFi shot midtown`, …; match the full title so `HiFi shot` does not pick `HiFi shot midtown`: compare `b.querySelector('span').textContent === title`), and returns early only if `m.level.id === id`. `pose(m, S)` takes the framing. `hifiShot(name, { level, frame = '9:16', w, h })` uses `SHOTS[frame]` for size defaults. `hifiProbe` gains `level`.

Add the lineup. A dynamic `import()` of `src/assets.js` from the page would load a second module instance with an empty cache, so the dev hook hands the page's own modules over: in `src/game.js` add `import * as gfx from './gfx.js'; import * as assets from './assets.js';` and extend the hook to `window.__milkshake = { run, world, level, engine, character, gfx, assets };` (dev only, stripped from builds; a ledger row "Dev only").

```js
  // Every model of a wave, side by side on the road in front of the camera, for the main session's visual check.
  // paths must be loaded: await __milkshake.assets.preload(paths) first if no level lists them yet.
  window.hifiLineup = async (name, { paths, w = 3840, h = 2160, gap = 1.5 } = {}) => {
    const m = await shotLevel(), row = new m.gfx.three.Group();
    let x = 0;
    for (const p of paths) { const o = m.gfx.asset(p); o.position.set(x, 0, SHOTS['9:16'].runZ + 12); row.add(o); x += gap + 2.5; }
    row.position.x = -x / 2;
    m.engine.scene.add(row);
    const r = m.engine.renderer, dpr = r.getPixelRatio();
    r.setPixelRatio(1); m.engine.resize(w, h); pose(m, SHOTS['16:9']); m.engine.render();
    const blob = await new Promise((res) => r.domElement.toBlob(res, 'image/png'));
    m.engine.scene.remove(row); r.setPixelRatio(dpr); m.engine.resize();
    await fetch(`http://127.0.0.1:5174/?name=${encodeURIComponent(name)}.png`, { method: 'POST', body: blob });
    return { name, bytes: blob.size };
  };
```

- [ ] **Step 4: The tiling script** `scripts/tile-image.py`:

```python
#!/usr/bin/env python3
"""Crops, resizes and WebPs a generated image for the HiFi pack (dev only; uses the system Pillow, not a repo dependency).
Usage: python3 scripts/tile-image.py in.png public/hifi/city/facades/downtown-01.webp --crop x,y,w,h --size 1024 [--mirror]"""
import argparse
from PIL import Image, ImageOps

p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst')
p.add_argument('--crop', help='x,y,w,h in source pixels')
p.add_argument('--size', type=int, default=1024, help='longest side in pixels')
p.add_argument('--mirror', action='store_true', help='append a mirrored copy (a skyline that loops seamlessly)')
p.add_argument('--quality', type=int, default=86)
a = p.parse_args()
im = Image.open(a.src).convert('RGBA')
if a.crop:
    x, y, w, h = map(int, a.crop.split(','))
    im = im.crop((x, y, x + w, y + h))
if a.mirror:
    both = Image.new('RGBA', (im.width * 2, im.height))
    both.paste(im, (0, 0)); both.paste(ImageOps.mirror(im), (im.width, 0))
    im = both
im.thumbnail((a.size, a.size), Image.LANCZOS)
im.save(a.dst, 'WEBP', quality=a.quality, method=6)
print(a.dst, im.size)
```

Run `python3 scripts/tile-image.py public/milkshake.glb /dev/null 2>&1 | tail -1` (expect a PIL error: the script runs) and `python3 -c "from PIL import features; print(features.check('webp'))"` (expect True).

- [ ] **Step 5: Check and commit.** Main session check (the subagent hands back here): load the script in the pane, `await hifiShot('t2-16x9', { frame: '16:9' })` and `await hifiShot('t2-midtown', { level: 'hifi-shot-midtown' })`, `await hifiLineup('t2-lineup', { paths: ['hifi/taxi.glb'] })` on `?fixtures&hifi`; read the PNGs. Re-shoot `baseline-lofi-r2` on `?fixtures&lofi`: same hash as Task 1. Then:

```bash
npm test
git add test/fixtures scripts/hifi-shot.js scripts/tile-image.py test/fixtures.test.js src/game.js docs/specs/2026-10-09-hifi-round2-ledger.md
git commit -m "chore: HiFi shot levels per theme, a 16:9 framing, the model lineup and the image tiling script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 [Prompts, sonnet]: The prompt book

**Files:** Create `docs/specs/2026-10-09-hifi-round2-prompts.md` (frontmatter `provenance: agent-generated`, `last-verified: never`).

**Interfaces:** Produces one section per asset, each with its concept prompt (four variants share it), its four view prompts, and its Tripo parameters; one section per image set (style frames, facades, storefronts, party walls, trims, posters, blade signs, LED faces, skylines). Task 5, 20 and 21 paste from it verbatim.

- [ ] **Step 1: The templates** (verbatim at the top of the file):

Concept (GPT Image 2.5, 1:1, quality low, `image_references`: the two teaser keyframe jobs and the Milkshake-3D render job):

```text
A {subject}, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette {palette}, a slight clearcoat sheen. {details}. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text except {words}, no people.
```

View (GPT Image 2.5, 1:1, `image_references`: the picked concept job only; `{view}` in front, left side, rear, right side):

```text
The same {subject} as the reference image, with exactly the same design, colours, proportions and details, seen straight from the {view}, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

Facade tile (GPT Image 2.5, 2k, 1:1, `image_references`: the theme's picked style frame):

```text
A flat orthographic front elevation of a {style} facade in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette {palette}. No logos, no text, no people.
```

Storefront strip (GPT Image 2.5, 2k, 21:9): ground-floor shop front 10 m wide and 4.3 m tall, flat orthographic, awning in the theme palette, a sign reading only one of TAXI, PIZZA, DELI, HOTEL, CAFE or no words, no logos. Poster (16:9), blade sign (2:3), LED face (21:9): bold flat colour blocks or simple pictograms (milk bottle, star, arrow, heart), no words. Skyline (GPT Image 2.5, 21:9, `background: transparent`): a distant hazy skyline of generic towers and stepped spires in the theme's light, ground line at the bottom tenth, transparent sky, nothing that resembles the Empire State Building, the Chrysler Building or any real landmark.

- [ ] **Step 2: Fill in every asset** from this table (`subject` · `details` · `words` · Tripo route and `face_limit`):

| Asset (file) | Subject and details | Words | Tripo |
|---|---|---|---|
| `furniture/lamp.glb` | NYC cobra-head street lamp post, dark green, glowing warm lamp head | none | single image, 6000 |
| `furniture/lamp_double.glb` | twin-arm street lamp, dark green | none | single image, 6000 |
| `furniture/traffic_light.glb` | traffic light on a pole with a short arm, yellow housing, red, amber and green lenses | none | multi-view, 8000 |
| `furniture/hydrant.glb` | chunky red fire hydrant with silver caps | none | single image, 4000 |
| `furniture/bench.glb` | slatted park bench, green iron frame, wooden slats | none | single image, 6000 |
| `furniture/bin.glb` | round wire-mesh litter basket, green | none | single image, 4000 |
| `furniture/bin_box.glb` | square public litter bin, dark green with a lid | none | single image, 4000 |
| `furniture/planter.glb` | concrete planter box with a rounded shrub | none | single image, 6000 |
| `furniture/tree.glb` | street tree in a square iron tree guard, round leafy crown | none | single image, 8000 |
| `furniture/newsstand.glb` | small sidewalk newsstand kiosk with awning and magazine racks (no titles) | none | multi-view, 8000 |
| `furniture/bus_shelter.glb` | glass bus shelter with a slim roof and a bench | none | multi-view, 8000 |
| `furniture/subway.glb` | subway stair entrance with railings and two globe lamps (plain white globes) | none | multi-view, 8000 |
| `barrier_low.glb` | orange-and-white jersey barrier, stepped profile, two white stripes | none | multi-view, 12000 |
| `delivery_bike.glb` | delivery bicycle with a front cargo box, a toy rider in a cap | none | multi-view, 15000 |
| `hot_dog_cart.glb` | hot-dog cart with a striped umbrella, steel body, two wheels | none | multi-view, 15000 |
| `manhole_steam.glb` | round cast-iron manhole cover with a raised grid pattern, slightly raised rim | none | single image, 4000 |
| `pigeon.glb` | one plump grey city pigeon with an iridescent neck, wings folded | none | single image, 4000 |
| `scaffold_beam.glb` | sidewalk scaffold frame: grey uprights, crossed braces, a caution yellow-and-black plank at head height, open underneath | none | multi-view, 15000 |
| `jug.glb` | glowing milk bottle with a rounded shoulder and a cap, milky white glass | none | single image, 6000 |
| `magnet.glb` | horseshoe magnet, pink with silver tips | none | single image, 4000 |
| `shield.glb` | rounded heater shield badge, sky blue with a white rim | none | single image, 4000 |
| `x2.glb` | chunky purple coin token with a raised 2× mark | 2× | single image, 4000 |
| `overpass.glb` | short steel road overpass span on four round pillars, the deck seen from below and the side | none | multi-view, 20000 |
| `railings.glb` | one 4 m section of bridge railing, steel posts and two rails | none | single image, 4000 |
| `tunnel.glb` | rounded tiled tunnel portal with a 60 m tube behind it, lamps along the ceiling | none | multi-view, 20000 |
| `vehicles/sedan.glb` | compact toy sedan, teal | none | multi-view, 15000 |
| `vehicles/van.glb` | boxy delivery van, white with a coloured stripe (no text) | none | multi-view, 15000 |
| `milkshake.glb` | Milkshake, the cow mascot of the reference images: white with black spots, lavender muzzle and hooves, standing upright in a neutral T-pose, arms out, legs apart | none | multi-view, 20000 |

The palette for each is board 02's tokens (the shipped `src/palette.js` hex values plus the theme colours in `content/themes/*.js`).

- [ ] **Step 3: The image sets.** Style frames: per theme (downtown, midtown, uptown, bridge) four GPT Image 2.5 1k frames from the 16:9 keyframe's camera, describing that theme's light (downtown clear blue day; midtown low orange sun; uptown purple dusk with lit windows; bridge clear day over water) and one Nano Banana Pro hero frame each. Facades: 5 per city theme (downtown: blue curtain wall with white mullions, dark glass, brick with punched windows, limestone with pilasters, big-window loft; midtown: deco piers, glass slab, limestone setback, prewar brick, mirrored glass; uptown: brownstone with arched windows, brick walk-up with fire escapes, townhouse stone, pastel mid-rise, warm-lit loft). Storefronts: 4 per city theme. Party walls: 1 per city theme. Trims: 1 per city theme (cornice, pilaster, window frame, awning on one sheet). Posters: 12, blade signs: 6, LED faces: 3 (shared). Skylines: 2 per theme (far haze, nearer towers).

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-10-09-hifi-round2-prompts.md
git commit -m "docs: round 2 prompt book: every concept, view and image prompt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 [Main]: Board 15 "City layout" (wave 0)

- [ ] **Step 1:** `get_guide({ topic: "paper-mcp-instructions" })`, `get_basic_info` for the file, `get_font_family_info` before any text.
- [ ] **Step 2:** On a new board "15 City layout", draw with `write_html`, one visual group per call: (a) a street cross-section to scale (road 9 m with three 2.5 m lanes, kerbs, 3 m sidewalks with the furniture band from x = 4.8 to 7.3 m, facade line at 7.5 m, building shells: podium, body, setback, cornice, storefront band 4.3 m, LED and billboard stacks); (b) a 120 m plan of one chunk with the furniture rhythm (lamp posts every 24 m alternating sides, trees every 18 m, hydrant every 40 m, bins every 30 m, one bench and one newsstand per chunk on average, a bus shelter or subway entrance at most once per chunk, traffic lights at the cross street, the cross street 12 m wide with crosswalks and side-street traffic that never enters the avenue's lanes); (c) the shell types per theme with height bands (downtown 18–70 m, midtown 30–110 m, uptown 12–35 m) and the bridge (deck, towers, cables, waterfront low-rises, water); (d) the horizon ring (a skyline at 340 m, unbent) and the placeholder palette from board 02. Screenshot and `finish_working_on_nodes`.
- [ ] **Step 3: Gate.** AskUserQuestion: "Board 15 shows the city layout and furniture rhythm. Approve it?" options "Approve", "Change it (say what)". Record the answer (and every number he changes) as a Ruling; Tasks 9–12 use the approved numbers.

---

### Task 5 [Main]: Wave 1 — the price probe, style frames and concepts

**Interfaces:** Consumes Task 3's prompts. Produces Caedon's picks (job ids) per theme and per model, recorded in the ledger's Assets table.

- [ ] **Step 1: Quote and ask.** 6 (price probe: one GPT Image 2.5 at 2k quality medium, one GPT Image 2.5 21:9 at 4k, one Nano Banana 2.1 at 8:1 4k; ceiling 2 each) + 12 (16 GPT style frames at 0.25, 4 Nano Banana Pro at 2) + 28 (4 concept variants × 28 models × 0.25) = 46 credits. AskUserQuestion: "Spend about 46 credits on wave 1 (price probe, 20 style frames, 112 concept images)?" options "Approve", "Not now".
- [ ] **Step 2: Generate.** Read `balance`. The probe first, one at a time, reading `balance` after each: the real prices for 2k/medium, 21:9 4k and Nano Banana 2.1 go in the ledger and re-price waves 2–3 (if wave 2 then exceeds its quote by more than 20%, re-quote before it). Then `generate_image_batch` (load with ToolSearch) for the style frames and concepts, prompts verbatim from the prompt book, without `folder_id`. Ledger Credits rows with every job id.
- [ ] **Step 3: Review** every image for brands, landmarks and readable text; regenerate offenders (0.25 each, inside the approval).
- [ ] **Step 4: Board 16 "Wave 1 concepts".** One row per theme (4 frames + the hero) and one row per model (4 variants), images by URL (`<img src="…">` with the job's result URL). If Paper cannot show remote images, use Higgsfield `show_generation_by_ids` in chat, grouped by asset, instead. Then picks: AskUserQuestion pickers, four questions per call, options "Variant 1" to "Variant 4" (and "Again" through Other). Record each pick in the Assets table. "Again" means a fresh set of four for that asset (1 credit, inside the approval while the wave stays under 46 + 20%).

---

### Task 6 [Engine, opus]: An instancing-safe bend, re-patched clones and a dispose that knows what is shared

**Files:**
- Modify: `src/gfx.js` (BEND, `bendable`, `dispose`), `src/assets.js` (`adopt`)
- Test: `test/logic.test.js`, `test/assets.test.js`

**Interfaces:**
- Produces: instanced and batched meshes render in place under the bend; `gfx.dispose(object)` frees an instanced or batched mesh's own buffers and never a geometry, material or texture flagged `userData.shared`; `adopt(path, scene)` flags every node, geometry, material and material texture of a loaded scene as shared.

- [ ] **Step 1: The failing tests.** Append to `test/logic.test.js`:

```js
test('the bend keeps instanced and batched copies where three puts them: batching, then instancing, then the model, then the street', () => {
  const shader = { uniforms: {}, vertexShader: gfx.three.ShaderLib.standard.vertexShader };
  gfx.bendable(new gfx.three.MeshStandardMaterial()).onBeforeCompile(shader, null);
  const v = shader.vertexShader;
  assert.ok(!v.includes('#include <project_vertex>'), 'three\'s projection is replaced');
  const at = ['bentWorld = batchingMatrix * bentWorld', 'bentWorld = instanceMatrix * bentWorld', 'bentWorld = modelMatrix * bentWorld', 'bendOffset( bentWorld.z )'].map((s) => v.indexOf(s));
  assert.ok(at.every((i, k) => i > 0 && (k === 0 || i > at[k - 1])), `in three's order: ${at}`);
  assert.deepEqual(gfx.three.ShaderChunk.project_vertex.match(/\w+Matrix(?= \*)/g), ['batchingMatrix', 'instanceMatrix', 'modelViewMatrix', 'projectionMatrix'], 'three applies the same matrices in the same order; a three upgrade that changes them fails here');
});

test('a clone of a bent material is bent too, instead of silently rendering straight', () => {
  const clone = gfx.bendable(new gfx.three.MeshStandardMaterial()).clone();
  const shader = { uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}' };
  gfx.bendable(clone).onBeforeCompile(shader, null);
  assert.ok(shader.vertexShader.includes('bendOffset'), 'the clone is patched');
});
```

Append to `test/assets.test.js`:

```js
test('dropping an instanced copy frees its instance buffers, never the shared model or a shared texture', () => {
  adopt('test/i.glb', model());
  const src = asset('test/i.glb').children[0];
  const inst = new THREE.InstancedMesh(src.geometry, src.material, 4);
  const own = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: src.material.map }));
  const freed = [];
  inst.dispose = () => freed.push('instances');
  src.geometry.dispose = () => freed.push('shared geometry');
  src.material.dispose = () => freed.push('shared material');
  src.material.map.dispose = () => freed.push('shared texture');
  own.geometry.dispose = () => freed.push('own geometry');
  own.material.dispose = () => freed.push('own material');
  gfx.dispose(gfx.group(inst, own));
  assert.deepEqual(freed.sort(), ['instances', 'own geometry', 'own material']);
});
```

Run `npm test`. Expected: the three new tests fail (no `batchingMatrix * bentWorld`; the clone is not patched; the shared geometry is freed through the instanced mesh).

- [ ] **Step 2: The bend.** In `src/gfx.js` replace `BEND`:

```js
// three's own order (project_vertex): a batched copy's matrix, then an instance's, then the mesh's; the street's offset last.
const BEND = `
  vec4 bentWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    bentWorld = batchingMatrix * bentWorld;
  #endif
  #ifdef USE_INSTANCING
    bentWorld = instanceMatrix * bentWorld;
  #endif
  bentWorld = modelMatrix * bentWorld;
  bentWorld.xyz += bendOffset( bentWorld.z );
  vec4 mvPosition = viewMatrix * bentWorld;
  gl_Position = projectionMatrix * mvPosition;
`;
```

- [ ] **Step 3: Re-patched clones.** Replace the first two lines of `bendable`:

```js
const patched = new WeakSet(); // by material, not userData: a clone copies userData but not the hook, and must be patched again
export function bendable(material) {
  if (!material || patched.has(material)) return material;
  patched.add(material);
  material.userData.bent = true;
```

- [ ] **Step 4: Dispose.** Replace `dispose`:

```js
// Frees geometry, per-object textures and instance buffers. Shared toon materials from mat() stay alive on purpose, and so
// does anything flagged userData.shared: a preloaded asset's nodes, geometry, materials and textures, which every copy uses.
export function dispose(object) {
  object.traverse((n) => {
    if (n.userData.shared) return;
    if (!n.geometry?.userData.shared) n.geometry?.dispose();
    if (n.isInstancedMesh || n.isBatchedMesh) n.dispose(); // the instance matrices and colours (and a batched mesh's textures)
    for (const m of [].concat(n.material ?? [])) {
      if (m.userData.shared || !(n.isSprite || n.isPoints || m.map)) continue;
      if (!m.map?.userData.shared) m.map?.dispose();
      m.dispose();
    }
  });
}
```

- [ ] **Step 5: Shared parts.** In `src/assets.js` replace `adopt`:

```js
const share = (o) => { if (o) o.userData.shared = true; };
// Flags every node and every part a copy shares (geometry, materials, their textures), so gfx.dispose leaves them alone
// even when a module rebuilds them into its own meshes (an InstancedMesh over a model's geometry).
export function adopt(path, scene) {
  scene.traverse((n) => {
    share(n); share(n.geometry);
    for (const m of [].concat(n.material ?? [])) { share(m); for (const v of Object.values(m)) if (v?.isTexture) share(v); }
  });
  cache.set(path, scene);
}
```

- [ ] **Step 6:** `npm test`. Expected: all pass (121).
- [ ] **Step 7: Ledger rows** (Engine changes): `src/gfx.js` BEND applies batching and instance matrices before the model matrix (Generic hook; No: the bend owns the vertex projection); `bendable` keys on a WeakSet (Generic hook; No); `dispose` frees instanced meshes and spares shared parts (Generic hook; No); `src/assets.js` `adopt` flags parts (Generic hook; No).
- [ ] **Step 8: Commit**

```bash
git add src/gfx.js src/assets.js test/logic.test.js test/assets.test.js docs/specs/2026-10-09-hifi-round2-ledger.md
git commit -m "feat: the bend keeps instanced and batched copies in place, a cloned material bends too, dispose frees instance buffers and spares shared parts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 [Engine, opus]: Images as assets, `gfx.texture` and `release`

**Files:**
- Modify: `src/registry.js` (ASSET, message), `src/assets.js`, `src/gfx.js` (re-export)
- Test: `test/assets.test.js`, `test/packs.test.js`

**Interfaces:**
- Consumes: Task 6's `adopt`.
- Produces: `assets` entries may end in `.glb`, `.webp` or `.png`; `preload(paths, load?)` loads images as sRGB textures; `gfx.texture(path)` returns the shared cached texture or throws `texture "<path>" is not loaded: list it in the module's assets`; `gfx.asset(path)` on an image throws `asset "<path>" is an image: use gfx.texture`; `release(keep)` frees every cached file not in `keep` (an array of paths).

- [ ] **Step 1: The failing tests.** In `test/packs.test.js` change line 56's expectation to `/assets must be a list of \.glb, \.webp or \.png files/` and add:

```js
test('a module may list .webp and .png images as well as .glb models', () => {
  assert.equal(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/taxi.glb', 'hifi/city/sky/downtown-01.webp', 'hifi/x.png'] }).length, 0);
  assert.match(checkModule({ ...shipped.obstacle.taxi, assets: ['hifi/x.jpg'] }).join(), /assets must be a list of \.glb, \.webp or \.png files/);
});
```

In `test/assets.test.js` (import `release` too):

```js
test('an image asset is one shared texture; asking for it as a model, or for a missing one, fails loudly', async () => {
  const tex = new THREE.Texture();
  await preload(['test/sky.webp'], async () => tex);
  assert.equal(gfx.texture('test/sky.webp'), tex);
  assert.ok(tex.userData.shared, 'flagged shared, so dropping a chunk never frees it');
  assert.throws(() => asset('test/sky.webp'), /asset "test\/sky.webp" is an image: use gfx.texture/);
  assert.throws(() => gfx.texture('test/none.webp'), /texture "test\/none.webp" is not loaded: list it in the module's assets/);
});

test('release frees every cached file a level does not keep, and keeps the rest', () => {
  adopt('test/keep.glb', model()); adopt('test/drop.glb', model());
  const t = new THREE.Texture(); adopt('test/drop.webp', t);
  const d = asset('test/drop.glb').children[0], freed = [];
  d.geometry.dispose = () => freed.push('geometry'); d.material.dispose = () => freed.push('material');
  d.material.map.dispose = () => freed.push('map'); t.dispose = () => freed.push('texture');
  release(['test/keep.glb']);
  assert.deepEqual(freed.sort(), ['geometry', 'map', 'material', 'texture']);
  assert.ok(asset('test/keep.glb'));
  assert.throws(() => asset('test/drop.glb'), /not loaded/);
});
```

Run `npm test`. Expected: these fail (`.webp` rejected; `gfx.texture` and `release` missing).

- [ ] **Step 2: Registry.** In `src/registry.js`:

```js
const ASSET = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:glb|webp|png)$/; // a model or an image under public/: lowercase, no leading slash, no ..
```

and in `checkModule` the comment and message: `// Any module may list files the game preloads before play (src/assets.js): .glb models, .webp and .png images.` / `'assets must be a list of .glb, .webp or .png files under public/, like "hifi/model.glb" (lowercase)'`.

- [ ] **Step 3: Assets.** In `src/assets.js` add at the top `import { TextureLoader, SRGBColorSpace } from 'three';`, let `adopt` take a texture as well:

```js
export function adopt(path, value) {
  if (value.isTexture) share(value);
  else value.traverse((n) => {
    share(n); share(n.geometry);
    for (const m of [].concat(n.material ?? [])) { share(m); for (const v of Object.values(m)) if (v?.isTexture) share(v); }
  });
  cache.set(path, value);
}
```

and add:

```js
let images;
async function loadImage(url) {
  images ??= new TextureLoader();
  const t = await images.loadAsync(url);
  t.colorSpace = SRGBColorSpace;
  return t;
}
const load = (p) => (/\.(?:webp|png)$/.test(p) ? loadImage : loadGlb)(`${import.meta.env.BASE_URL}${p}`);
```

with `preload(paths, loader = load)` using `loader`. Then:

```js
export function asset(path) {
  const scene = cache.get(path);
  if (scene?.isTexture) throw new Error(`asset "${path}" is an image: use gfx.texture`);
  if (!scene) throw new Error(`asset "${path}" is not loaded: list it in the module's assets`);
  return scene.clone(); // shares geometry and materials; userData (the shared flag) is copied
}

// A preloaded image: one texture every user shares (the caller may set wrap and repeat once, for everyone).
export function texture(path) {
  const t = cache.get(path);
  if (!t?.isTexture) throw new Error(`texture "${path}" is not loaded: list it in the module's assets`);
  return t;
}

// Frees every cached file not in `keep` (the next level's set), so GPU memory follows the level. Call it only after the
// previous world is disposed: nothing still drawn may use a freed file.
export function release(keep) {
  const k = new Set(keep);
  for (const [path, v] of cache) {
    if (k.has(path)) continue;
    cache.delete(path);
    if (v.isTexture) { v.dispose(); continue; }
    v.traverse((n) => {
      n.geometry?.dispose();
      for (const m of [].concat(n.material ?? [])) { for (const x of Object.values(m)) if (x?.isTexture) x.dispose(); m.dispose(); }
    });
  }
}
```

In `src/gfx.js`: `export { asset, texture } from './assets.js'; // a preloaded GLB as a synchronous copy, a preloaded image as a shared texture`.

- [ ] **Step 4:** `npm test` (expected all pass, 124) and `npm run build`.
- [ ] **Step 5: Ledger rows** (`src/registry.js` images in `assets`; `src/assets.js` image loading, `texture`, `release`; `src/gfx.js` re-export: Generic hooks; No: the loader and the asset rule live in the engine) and **commit**:

```bash
git add src/registry.js src/assets.js src/gfx.js test/assets.test.js test/packs.test.js docs/specs/2026-10-09-hifi-round2-ledger.md
git commit -m "feat: modules may list .webp and .png images; gfx.texture hands out a shared texture; release frees what a level does not keep

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 [Engine, sonnet]: Pack helper folders and the time uniform

**Files:**
- Modify: `src/registry.js` (`loadPack`), `test/helpers.js` (`discover`), `src/gfx.js` (`time`), `src/world.js` (`update`)
- Create: `packs/hifi/lib/rand.js`
- Test: `test/packs.test.js`, `test/world.test.js`

**Interfaces:**
- Produces: files under `packs/<pack>/lib/` are never loaded as overlays; `chunkRng(scenery)` returns a mulberry32 generator seeded from one draw of `scenery`; `gfx.time = { value }` holds the run's clock in seconds, set by `world.update`.

- [ ] **Step 1: The failing tests.** In `test/packs.test.js`:

```js
test('files under packs/<pack>/lib/ are helpers, never loaded as overlays', async () => {
  const files = {
    '../packs/hifi/lib/city.js': async () => { throw new Error('a helper must not be loaded as an overlay'); },
    '../packs/hifi/themes/downtown.js': async () => ({ kind: 'theme', id: 'downtown', look: {} }),
  };
  assert.deepEqual((await loadPack('hifi', files)).map((e) => e.path), ['packs/hifi/themes/downtown.js']);
});
```

In `test/world.test.js`:

```js
test('the world hands shaders the run clock, so pause freezes animation and stills pin it', () => {
  const registry = { obstacle: {}, pickup: {}, prop: {}, theme: { t: theme }, character: {}, ending: {} };
  const world = createWorld(new THREE.Scene(), { ...level, obstacles: {} }, { registry, rules, seed: 1, end: 600 });
  const run = createRun(rules, { height: 1.9, width: 1 });
  run.time = 12.5;
  world.update(run, 0);
  assert.equal(gfx.time.value, 12.5);
  world.dispose();
});
```

Run `npm test`: both fail.

- [ ] **Step 2: Code.** `src/registry.js` `loadPack`:

```js
  const mine = Object.entries(files).filter(([p]) => p.startsWith(`../packs/${name}/`) && !p.startsWith(`../packs/${name}/lib/`)); // lib/ holds the pack's helpers
```

`test/helpers.js` `discover`, inside the directory branch:

```js
    if (statSync(p).isDirectory()) { if (!(prefix.startsWith('packs/') && dir === root && name === 'lib')) entries.push(...(await discover(root, prefix, p))); } // a pack's lib/ holds helpers, not overlays
```

`src/gfx.js`, after `bendOffset`:

```js
// Seconds of run time for shader animation (LED faces, marquees, blinking signs, traffic): world.update sets it, so pause
// freezes it and a still (run.time = 0) pins it.
export const time = { value: 0 };
```

`src/world.js`, first line of `update`: `gfx.time.value = run.time;`

`packs/hifi/lib/rand.js`:

```js
import { rng } from '../../../src/generator.js';
// One chunk, one generator, seeded from a single draw of the scenery stream: a chunk's city never depends on how many
// numbers the chunk before it used, and the same level seed always builds the same city.
export const chunkRng = (scenery) => rng(Math.floor(scenery() * 2 ** 32));
```

- [ ] **Step 3:** `npm test` (expected all pass, 126; "the HiFi pack applies cleanly" now proves `discover` skips `lib/`).
- [ ] **Step 4: Ledger rows** (`src/registry.js` pack `lib/`: Generic hook, No; `src/gfx.js` + `src/world.js` `time`: Generic hook, No: no module has a per-frame hook for a chunk) and **commit** (`feat: a pack's lib/ holds helpers; gfx.time hands shaders the run clock`).

---

### Task 9 [City, opus]: The HiFi street, deterministic and inside its chunk

**Files:**
- Create: `packs/hifi/lib/shapes.js`, `packs/hifi/lib/materials.js`, `packs/hifi/lib/street.js`, `packs/hifi/lib/city.js`, `test/city.test.js`
- Modify: `packs/hifi/themes/{downtown,midtown,uptown}.js` (add `createChunk`)

**Interfaces:**
- Consumes: `chunkRng` (Task 8), instancing under the bend (Task 6), board 15's numbers (Task 4).
- Produces: `box(T, w, h, d, material, x, y, z)` (z-subdivided every 4 m), `wall(T, d, h, side, tw, th, v0)`, `instanced(T, geometry, material, matrices)`; `material(key, make)` (cached for the session, flagged shared); `street(gfx, args, style)`; `cityChunk(gfx, args, style)` returning a `Group` in world coordinates; `style = { id, road, walk, paint, buildings, facades: [], shops: [], lit, signs, furniture }` per theme.

- [ ] **Step 1: The failing tests** `test/city.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as gfx from '../src/gfx.js';
import { rng } from '../src/generator.js';
import downtown from '../packs/hifi/themes/downtown.js';
import shipped from '../content/themes/downtown.js';

const lanes = { count: 3, width: 2.5, roadHalf: 4.5 };
const chunk = (seed, z0 = 0, length = 120) => downtown.createChunk.call({ ...shipped, ...downtown }, gfx, { z0, length, lanes, rng: rng(seed), theme: { ...shipped, ...downtown } });
const zSpan = (g) => { // world z extent of everything, instances included
  let lo = Infinity, hi = -Infinity;
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    if (!n.geometry) return;
    n.geometry.computeBoundingBox();
    const each = n.isInstancedMesh ? Array.from({ length: n.count }, (_, i) => { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); return m.premultiply(n.matrixWorld); }) : [n.matrixWorld];
    for (const m of each) { const b = n.geometry.boundingBox.clone().applyMatrix4(m); lo = Math.min(lo, b.min.z); hi = Math.max(hi, b.max.z); }
  });
  return [lo, hi];
};
const fingerprint = (g) => { const out = []; g.traverse((n) => { if (n.geometry) out.push(n.type, n.geometry.attributes.position.count, ...(n.isInstancedMesh ? n.instanceMatrix.array.slice(0, 32) : [])); }); return out.join(','); };

test('the same seed builds the same city chunk, and another seed a different one', () => {
  assert.equal(fingerprint(chunk(7)), fingerprint(chunk(7)));
  assert.notEqual(fingerprint(chunk(7)), fingerprint(chunk(8)));
});

test('nothing a city chunk builds leaves its stretch of street', () => {
  for (let seed = 1; seed <= 30; seed++) for (const [z0, length] of [[0, 120], [120, 120], [240, 80]]) {
    const [lo, hi] = zSpan(chunk(seed, z0, length));
    assert.ok(lo >= z0 - 1e-6 && hi <= z0 + length + 1e-6, `seed ${seed}, chunk ${z0}: ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  }
});

test('a city chunk builds its street even when every kit file is missing', () => {
  const g = chunk(3);
  assert.ok(g.children.length > 0);
  let road = false; g.traverse((n) => { if (n.userData.road) road = true; });
  assert.ok(road, 'the road is there');
});
```

Run `node --test test/city.test.js`: fails (no `createChunk`).

- [ ] **Step 2: Shapes and materials.** `packs/hifi/lib/shapes.js`:

```js
// Geometry helpers for the HiFi city. Everything is subdivided along z every 4 m so it bends with the street.
const SEG = 4;
export function box(T, w, h, d, material, x = 0, y = h / 2, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / SEG))), material);
  m.position.set(x, y, z);
  return m;
}
// A wall plane facing ±x, `d` long along z and `h` tall, its UVs in units of one tile (tw by th metres), so a repeating
// facade texture keeps its scale on any wall. side = +1 faces +x (a building on the -x side of the road faces +x).
export function wall(T, d, h, side, tw, th, v0 = 0) {
  const g = new T.PlaneGeometry(d, h, Math.max(1, Math.ceil(d / SEG)), 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * d / tw, v0 + uv.getY(i) * h / th);
  g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  return g;
}
// One InstancedMesh for many copies; matrices are world matrices (the chunk group stays at the origin).
export function instanced(T, geometry, material, matrices) {
  const m = new T.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = matrices.length;
  m.computeBoundingSphere();
  return m;
}
```

`packs/hifi/lib/materials.js`:

```js
// One material per key for the whole session, flagged shared: dropping a chunk never frees it, and every chunk draws with it.
const cache = new Map();
export function material(key, make) {
  if (!cache.has(key)) { const m = make(); m.userData.shared = true; cache.set(key, m); }
  return cache.get(key);
}
```

- [ ] **Step 3: The street.** `packs/hifi/lib/street.js`:

```js
import { box, instanced } from './shapes.js';
import { material } from './materials.js';
// ponytail: calibration knobs, metres (board 15)
export const KERB = 0.18, WALK = 3, DASH = { w: 0.12, len: 3, every: 6 }, CROSS = { width: 12, stripe: 0.6 };

export function street(gfx, { z0, length, lanes }, style, cross) {
  const T = gfx.three, g = gfx.group(), half = lanes.roadHalf, zc = z0 + length / 2;
  const std = (key, color, rough) => material(`${style.id}/${key}`, () => new T.MeshStandardMaterial({ color, roughness: rough }));
  const road = box(T, half * 2, 0.1, length, std('road', style.road, 0.85), 0, -0.05, zc);
  road.userData.road = true;
  g.add(road);
  for (const side of [-1, 1]) g.add(box(T, WALK, KERB, length, std('walk', style.walk, 0.9), side * (half + WALK / 2), KERB / 2, zc));
  const dashes = [];
  for (let z = z0; z + DASH.len <= z0 + length; z += DASH.every) for (const x of [lanes.width / 2, -lanes.width / 2]) {
    if (cross && z + DASH.len > cross.z && z < cross.z + CROSS.width) continue; // no lane dashes across the crosswalk
    dashes.push(new T.Matrix4().makeTranslation(x, 0.011, z + DASH.len / 2));
  }
  const paint = std('paint', style.paint, 0.6);
  g.add(instanced(T, new T.BoxGeometry(DASH.w, 0.02, DASH.len), paint, dashes));
  if (cross) { // zebra stripes across the road at both edges of the cross street
    const stripes = [];
    for (const zEdge of [cross.z + 1, cross.z + CROSS.width - 1]) for (let x = -half + 0.4; x < half - 0.3; x += CROSS.stripe * 2) stripes.push(new T.Matrix4().makeTranslation(x + CROSS.stripe / 2, 0.012, zEdge));
    g.add(instanced(T, new T.BoxGeometry(CROSS.stripe, 0.02, 2), paint, stripes));
  }
  return g;
}
```

- [ ] **Step 4: The chunk entry point.** `packs/hifi/lib/city.js`:

```js
import { chunkRng } from './rand.js';
import { street, CROSS } from './street.js';
// The HiFi city (round 2 spec): one chunk of street, buildings, signs and furniture, all inside [z0, z0 + length].
// Each later task adds its part here; a part that throws is skipped, so the street is always there.
export function cityChunk(gfx, args, style) {
  const r = chunkRng(args.rng), g = gfx.group();
  const cross = args.length >= 100 ? { z: args.z0 + 30 + Math.floor(r() * (args.length - 60 - CROSS.width)) } : null; // one cross street in a full chunk
  g.add(street(gfx, args, style, cross));
  for (const part of style.parts ?? []) {
    try { g.add(part(gfx, args, style, r, cross)); } catch (err) { console.warn(`city ${style.id}: ${part.name} failed:`, err); }
  }
  return g;
}
```

- [ ] **Step 5: The themes.** In `packs/hifi/themes/downtown.js` (midtown and uptown alike, with their own colours from board 02 and `content/themes/*.js`):

```js
import { cityChunk } from '../lib/city.js';
// HiFi downtown (level 1, a clear blue day): the generated city (round 2) under the look. ponytail: calibration knobs.
const STYLE = { id: 'downtown', road: '#5a5c72', walk: '#a3a0ab', paint: '#f2f2f2', parts: [] };
export default {
  kind: 'theme', id: 'downtown',
  look: { exposure: 1.0, sun: { color: '#fff3e0', intensity: 2.4 }, ambient: 2.0, env: 0.4, skyTop: '#5ea9ec', bloom: { strength: 0.4, threshold: 0.9, radius: 0.4 } },
  createChunk(gfx, args) { return cityChunk(gfx, args, { ...STYLE, buildings: args.theme.buildings }); },
};
```

- [ ] **Step 6:** `npm test` (city tests pass; all others still pass). Probe in the pane (main session): `?fixtures&hifi` shows the HiFi street with no buildings yet; `?fixtures&lofi` hash unchanged.
- [ ] **Step 7: Ledger** (no `src/` change: say so in Progress) and **commit** (`feat: HiFi city street: deterministic per chunk, inside its seams, instanced lane dashes and crosswalks`).

---

### Task 10 [City, opus]: Building shells, facades and storefronts

**Files:**
- Create: `packs/hifi/lib/facade.js`, `packs/hifi/lib/buildings.js`
- Modify: the three city theme overlays (`parts: [buildings]`, style colours), `test/city.test.js`

**Interfaces:**
- Consumes: `box`, `wall`, `material` (Task 9).
- Produces: `buildings(gfx, args, style, r, cross)` → a group of merged meshes, at most one per material; `facadeMaterial(gfx, style, i)` and `shopMaterial(gfx, style, i)`: a generated tile when `style.facades[i]` is loaded, else `placeholderTile`; `placeholderTile(T, wall, glass)` (Node-safe `DataTexture`).

- [ ] **Step 1: The failing tests** (append to `test/city.test.js`):

```js
test('a city chunk stays inside its draw-call budget', () => {
  for (const seed of [1, 2, 3]) { let meshes = 0; chunk(seed).traverse((n) => { if (n.isMesh) meshes++; }); assert.ok(meshes <= 45, `seed ${seed}: ${meshes} meshes`); }
});

test('buildings stand on the facade line, never on the sidewalk or the road', () => {
  const g = chunk(5);
  g.traverse((n) => { if (n.userData.building) { n.geometry.computeBoundingBox(); const b = n.geometry.boundingBox; assert.ok(Math.min(Math.abs(b.min.x), Math.abs(b.max.x)) >= 7.5 - 0.4 - 1e-6, `${b.min.x}..${b.max.x}`); } }); // cornices may overhang the sidewalk by 0.35 m, high up
});

test('a missing facade tile falls back to the placeholder tile', () => {
  const g = chunk(4); let tiles = 0;
  g.traverse((n) => { if (n.userData.building && n.material.map?.isDataTexture) tiles++; });
  assert.ok(tiles > 0, 'placeholder tiles in use');
});
```

- [ ] **Step 2: Facades.** `packs/hifi/lib/facade.js`:

```js
import { material } from './materials.js';
export const TILE = { w: 5, h: 7 }, SHOP_H = 4.3; // ponytail: metres per facade tile (2 bays x 2 floors) and the storefront band
const rgb = (T, hex) => new T.Color(hex).toArray().map((v) => Math.round(v * 255));
// A Node-safe stand-in for a generated tile: two bays by two floors of glass in a wall colour.
export function placeholderTile(T, wallHex, glassHex, n = 64) {
  const px = new Uint8Array(n * n * 4), w = rgb(T, wallHex), gl = rgb(T, glassHex);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const bx = (x % (n / 2)) / (n / 2), fy = (y % (n / 2)) / (n / 2), glass = bx > 0.18 && bx < 0.82 && fy > 0.25 && fy < 0.85;
    px.set([...(glass ? gl : w), 255], (y * n + x) * 4);
  }
  const t = new T.DataTexture(px, n, n);
  Object.assign(t, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, colorSpace: T.SRGBColorSpace, needsUpdate: true });
  t.userData.shared = true;
  return t;
}
const tile = (gfx, path) => { try { const t = gfx.texture(path); t.wrapS = t.wrapT = gfx.three.RepeatWrapping; return t; } catch { return null; } };
export function facadeMaterial(gfx, style, i) {
  const T = gfx.three, path = style.facades?.[i], colors = style.buildings.colors;
  return material(`${style.id}/facade/${path ?? i}`, () => new T.MeshStandardMaterial({
    map: (path && tile(gfx, path)) || placeholderTile(T, colors[i % colors.length], '#2c3a63'), roughness: 0.5, metalness: 0.05,
  }));
}
export function shopMaterial(gfx, style, i) {
  const T = gfx.three, path = style.shops?.[i];
  return material(`${style.id}/shop/${path ?? i}`, () => new T.MeshStandardMaterial({
    map: (path && tile(gfx, path)) || placeholderTile(T, '#3b3f55', '#9ad0ff', 32), roughness: 0.4, metalness: 0.1,
  }));
}
```

(Task 24 adds the window mask that turns glass glossy and lights windows; the placeholder stays matte.)

- [ ] **Step 3: Shells.** `packs/hifi/lib/buildings.js`:

```js
import { wall, instanced } from './shapes.js';
import { material } from './materials.js';
import { facadeMaterial, shopMaterial, TILE, SHOP_H } from './facade.js';
// ponytail: calibration knobs, metres (board 15)
export const FACADE_X = 7.5, DEPTH = [8, 14], GAP = 0.5, CORNICE = { h: 0.6, out: 0.35 }, SETBACK = { above: 0.6, inset: 2 }, ROOF = { maxH: 40, tower: 0.35 };

// Shells along both sides, merged into one mesh per material, so a chunk is a handful of draw calls.
export function buildings(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, groups = new Map(); // material -> geometries
  const put = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const body = material(`${style.id}/body`, () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const { minH, maxH, colors } = style.buildings, roofs = { tower: [], ac: [] };
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    if (cross && z >= cross.z && z < cross.z + 12) { z = cross.z + 12; continue; }
    const end = Math.min(cross && z < cross.z ? cross.z : z0 + length, z0 + length);
    const depth = Math.min(DEPTH[0] + r() * (DEPTH[1] - DEPTH[0]), end - z);
    const h = minH + r() * (maxH - minH), f = Math.floor(r() * 5), s = Math.floor(r() * 4), color = new T.Color(colors[Math.floor(r() * colors.length)]);
    if (depth < 3) { z = end; continue; }
    const d = depth - GAP, zc = z + depth / 2, x = side * FACADE_X, face = -side; // the facade looks at the road
    const setAt = h > 40 ? h * SETBACK.above : h;
    const facade = (geo, x0) => geo.translate(x0, 0, zc);
    // storefront band, then the facade tile up to the setback, then the upper facade set back
    put(shopMaterial(gfx, style, s), facade(wall(T, d, SHOP_H, face, d, SHOP_H).translate(0, SHOP_H / 2, 0), x));
    put(facadeMaterial(gfx, style, f), facade(wall(T, d, setAt - SHOP_H, face, TILE.w, TILE.h).translate(0, SHOP_H + (setAt - SHOP_H) / 2, 0), x));
    if (setAt < h) put(facadeMaterial(gfx, style, f), facade(wall(T, d, h - setAt, face, TILE.w, TILE.h).translate(0, setAt + (h - setAt) / 2, 0), x + side * SETBACK.inset));
    // the body behind (roof, sides, back) and a cornice at the top of the facade, vertex-coloured
    const box = (w, hh, dd, cx, cy) => { const b = new T.BoxGeometry(w, hh, dd, 1, 1, Math.max(1, Math.ceil(dd / 4))).translate(cx, cy, zc); paint(T, b, color); return b; };
    put(body, box(10, setAt, d, side * (FACADE_X + 5.02), setAt / 2));
    if (setAt < h) put(body, box(10 - SETBACK.inset, h - setAt, d, side * (FACADE_X + SETBACK.inset + (10 - SETBACK.inset) / 2 + 0.02), setAt + (h - setAt) / 2));
    put(body, box(CORNICE.out + 0.2, CORNICE.h, d, x - side * CORNICE.out / 2 + side * 0.1, setAt - CORNICE.h / 2));
    if (h < ROOF.maxH && r() < ROOF.tower) roofs.tower.push(new T.Matrix4().makeTranslation(side * (FACADE_X + 6), h, zc)); // a water tower on a low roof
    for (let k = Math.floor(r() * 3); k > 0; k--) roofs.ac.push(new T.Matrix4().makeTranslation(side * (FACADE_X + 3 + r() * 5), h, z + 1.5 + r() * (d - 3)));
    z += depth;
  }
  const g = gfx.group();
  for (const [mat, geos] of groups) {
    const merged = merge(T, geos);
    const m = new T.Mesh(merged, mat);
    m.userData.building = true;
    g.add(m);
  }
  // Rooftop props in code (spec: water towers and AC units), two instanced meshes a chunk; a tank on legs, a box with a fan top
  const roofMat = material(`${style.id}/roof`, () => new T.MeshStandardMaterial({ color: '#7a5a43', roughness: 0.7 }));
  const steel = material('roof/steel', () => new T.MeshStandardMaterial({ color: '#b9bec8', roughness: 0.35, metalness: 0.6 }));
  if (roofs.tower.length) g.add(instanced(T, mergeGeometries([new T.CylinderGeometry(1.6, 1.6, 3.2, 16).translate(0, 4.6, 0), new T.ConeGeometry(1.8, 1.2, 16).translate(0, 6.8, 0), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => new T.CylinderGeometry(0.08, 0.08, 3, 6).translate(a * 1.1, 1.5, b * 1.1))].map((x) => x.toNonIndexed())), roofMat, roofs.tower));
  if (roofs.ac.length) g.add(instanced(T, new T.BoxGeometry(1.4, 0.9, 1.1).translate(0, 0.45, 0), steel, roofs.ac));
  return g;
}
function paint(T, geo, color) { const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) color.toArray(c, i * 3); geo.setAttribute('color', new T.BufferAttribute(c, 3)); }
```

`merge` is three's `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`; a pack helper may not import three at the top, so `buildings.js` takes it through a tiny shim:

```js
// three/addons is safe to import in a pack helper: it does not register anything, and Vite bundles it with the pack chunk.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const merge = (T, geos) => { const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)), false); geos.forEach((x) => x.dispose()); return g; };
```

Seam check for the rooftops: towers sit at the block's centre (radius 1.8 m, blocks at least 3 m deep: clamp the tower to blocks deeper than 4 m) and AC units 1.5 m inside the block's ends. Ruling to record if the reviewer objects to the addon import: the "no top-level three" rule exists so content imports in Node without a renderer; `three/addons/utils/BufferGeometryUtils.js` imports only `three` core, which Node loads (the tests already do), so the rule's purpose holds. Facade walls have `uv` and `normal`; boxes have `uv`, `normal` and `color`; `mergeGeometries` needs the same attribute set per merged list, which holds because each material's list is all walls or all boxes.

`wall()` with `side = face`: the geometry is translated by `x` (the facade line), the facade's normal points at the road. The storefront's UVs span one image across the block (`tw = d`, `th = SHOP_H`), stretched to the block's width.

- [ ] **Step 4:** Add `buildings` to each city theme's `parts` and the facade and shop lists (empty until Task 24). `npm test`; fix until the four city tests and everything else pass. Main session: probe frames on `?fixtures&hifi` (downtown, midtown via the new shot level), low-fi hash unchanged.
- [ ] **Step 5: Commit** (`feat: HiFi city buildings: merged shells with storefront bands, setbacks and cornices on placeholder facade tiles`).

---

### Task 11 [City, opus]: LED and billboard stacks, furniture and side-street traffic

**Files:**
- Create: `packs/hifi/lib/signs.js`, `packs/hifi/lib/kit.js`, `packs/hifi/lib/furniture.js`, `packs/hifi/lib/traffic.js`
- Modify: the city theme overlays (`parts`), `test/city.test.js`

**Interfaces:**
- Consumes: Task 9–10 helpers, `gfx.time`, board 15's rhythm.
- Produces: `signs(gfx, args, style, r, cross)`; `KIT` (furniture and vehicle entries `{ path, h, yaw, glow }`); `kitParts(gfx, entry)` → `[{ geometry, material, matrix }]` from the GLB when loaded, else a code placeholder; `furniture(gfx, args, style, r, cross)`; `traffic(gfx, args, style, r, cross)`.

- [ ] **Step 1: The failing tests:**

```js
test('furniture stands only on the sidewalk band, never in a lane', () => {
  for (const seed of [1, 2, 3, 4]) chunk(seed).traverse((n) => {
    if (!n.userData.furniture) return;
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) >= 4.8 - 1e-6 && Math.abs(p.x) <= 7.3 + 1e-6, `seed ${seed}: x = ${p.x.toFixed(2)}`); }
  });
});

test('side-street traffic never enters the avenue', () => {
  chunk(6).traverse((n) => { if (n.userData.traffic) { const m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(Math.abs(p.x) >= 9, `x = ${p.x}`); } } });
});

test('two hundred dropped chunks free every instanced mesh they made and no shared material', () => {
  const made = [], freedShared = [];
  const orig = THREE.InstancedMesh.prototype.dispose;
  THREE.InstancedMesh.prototype.dispose = function () { made.push(this); return orig.call(this); };
  try {
    let instancedBuilt = 0;
    for (let i = 0; i < 200; i++) {
      const g = chunk(i, (i % 10) * 120);
      g.traverse((n) => { if (n.isInstancedMesh) instancedBuilt++; if (n.material?.userData?.shared) { const d = n.material.dispose; n.material.dispose = () => { freedShared.push(n.material); d.call(n.material); }; } });
      gfx.dispose(g);
    }
    assert.equal(made.length, instancedBuilt, 'every instanced mesh freed its buffers');
    assert.equal(freedShared.length, 0, 'no shared material freed');
  } finally { THREE.InstancedMesh.prototype.dispose = orig; }
});
```

- [ ] **Step 2: Signs.** `packs/hifi/lib/signs.js`: LED panels (flat colour blocks in dark bezels, per board 01) as one `InstancedMesh` of quads with per-instance colours from the theme's sign palette and a blink driven by `gfx.time`; poster panels (Task 24 swaps in the generated posters as an atlas) as a second `InstancedMesh`:

```js
import { instanced } from './shapes.js';
import { material } from './materials.js';
const LED = { glow: 2.4, rate: 0.8 }; // ponytail: brightness past the bloom threshold, blinks per second
export function ledMaterial(gfx) {
  const T = gfx.three;
  return material('led', () => {
    const m = new T.MeshBasicMaterial({ color: new T.Color(LED.glow, LED.glow, LED.glow) });
    m.onBeforeCompile = (s) => { // each panel blinks on its own beat; the glow is the panel's own face, never a plate over it
      s.uniforms.uTime = gfx.time;
      s.vertexShader = 'varying float vBeat;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBeat = fract( float( gl_InstanceID ) * 0.618 );');
      s.fragmentShader = 'uniform float uTime;\nvarying float vBeat;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n  diffuseColor.rgb *= 0.65 + 0.35 * step( 0.5, fract( uTime * ${LED.rate.toFixed(2)} + vBeat ) );`);
    };
    return m;
  });
}
export function signs(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, panels = [], bezels = [], colors = [], g = gfx.group();
  for (const side of [-1, 1]) for (let z = z0 + 4; z + 6 <= z0 + length; z += 9 + r() * 14) {
    if (cross && z + 6 > cross.z && z < cross.z + 12) continue;
    const stack = 1 + Math.floor(r() * 3), x = side * 7.42, w = 3 + r() * 3;
    for (let k = 0; k < stack; k++) {
      const y = 6 + k * 3.4 + r(), h = 2.2 + r() * 0.8;
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z + w / 2), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -side * Math.PI / 2), new T.Vector3(w, h, 1));
      panels.push(m); bezels.push(m.clone().multiply(new T.Matrix4().makeScale(1.08, 1.1, 1)).setPosition(x + side * 0.03, y, z + w / 2));
      colors.push(new T.Color(style.signs[Math.floor(r() * style.signs.length)]));
    }
  }
  const led = instanced(T, new T.PlaneGeometry(1, 1), ledMaterial(gfx), panels);
  colors.forEach((c, i) => led.setColorAt(i, c));
  g.add(led, instanced(T, new T.PlaneGeometry(1, 1), material('bezel', () => new T.MeshStandardMaterial({ color: '#1b1d2a', roughness: 0.35 })), bezels));
  return g;
}
```

Seam check: a panel spans `z .. z + w` with `z + 6 <= z0 + length` and `w <= 6`. Style gains `signs: ['#ff3b3b', '#2f7cff', '#ffd23f', '#2ecc71', '#ff4fd8', '#ff8a1f', '#ffffff']` (board 01's LED colours).

- [ ] **Step 3: The kit.** `packs/hifi/lib/kit.js`:

```js
// Furniture and side-street vehicles. path: the generated model (Task 23 sets yaw, h and glow from the real file);
// until it is loaded, a code placeholder of the same height stands in. ponytail: calibration knobs.
export const KIT = {
  lamp: { path: 'hifi/furniture/lamp.glb', h: 6.5, yaw: 0, glow: null },
  lamp_double: { path: 'hifi/furniture/lamp_double.glb', h: 6.5, yaw: 0, glow: null },
  traffic_light: { path: 'hifi/furniture/traffic_light.glb', h: 5.5, yaw: 0, glow: null },
  hydrant: { path: 'hifi/furniture/hydrant.glb', h: 0.8, yaw: 0, glow: null },
  bench: { path: 'hifi/furniture/bench.glb', h: 0.9, yaw: 0, glow: null },
  bin: { path: 'hifi/furniture/bin.glb', h: 0.9, yaw: 0, glow: null },
  bin_box: { path: 'hifi/furniture/bin_box.glb', h: 1.0, yaw: 0, glow: null },
  planter: { path: 'hifi/furniture/planter.glb', h: 1.0, yaw: 0, glow: null },
  tree: { path: 'hifi/furniture/tree.glb', h: 6.0, yaw: 0, glow: null },
  newsstand: { path: 'hifi/furniture/newsstand.glb', h: 2.6, yaw: 0, glow: null },
  bus_shelter: { path: 'hifi/furniture/bus_shelter.glb', h: 2.7, yaw: 0, glow: null },
  subway: { path: 'hifi/furniture/subway.glb', h: 2.4, yaw: 0, glow: null },
  sedan: { path: 'hifi/vehicles/sedan.glb', h: 1.5, yaw: 0, glow: null },
  van: { path: 'hifi/vehicles/van.glb', h: 2.2, yaw: 0, glow: null },
  taxi: { path: 'hifi/taxi.glb', h: 2.08, yaw: -Math.PI / 2, glow: null },
};
const parts = new Map(); // entry -> [{ geometry, material, matrix }]: the model fitted to its height, its base at y = 0, centred
export function kitParts(gfx, entry, placeholder) {
  if (parts.has(entry)) return parts.get(entry);
  const T = gfx.three;
  let model;
  try { model = gfx.asset(entry.path); } catch { return placeholder(T); } // not generated or not loaded yet: not cached, so the model replaces it once it lands
  model.rotation.y = entry.yaw;
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const s = entry.h / size.y, fit = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
  const list = [];
  model.traverse((n) => { if (n.isMesh) list.push({ geometry: n.geometry, material: n.material, matrix: fit.clone().multiply(n.matrixWorld) }); });
  parts.set(entry, list);
  return list;
}
```

- [ ] **Step 4: Furniture.** `packs/hifi/lib/furniture.js` places the kit on board 15's rhythm and builds one `InstancedMesh` per part per kind:

```js
import { KIT, kitParts } from './kit.js';
import { instanced } from './shapes.js';
import { material } from './materials.js';
// ponytail: calibration knobs from board 15: metres between copies along each side, x from the road's centre line
export const RHYTHM = [
  { kind: 'lamp', every: 24, x: 4.95, alternate: true },
  { kind: 'tree', every: 18, x: 6.6, offset: 9 },
  { kind: 'hydrant', every: 40, x: 4.95, offset: 13 },
  { kind: 'bin', every: 30, x: 5.1, offset: 5 },
  { kind: 'bench', every: 60, x: 6.9, offset: 31 },
  { kind: 'newsstand', every: 120, x: 6.5, offset: 47, chance: 0.6 },
  { kind: 'bus_shelter', every: 120, x: 6.3, offset: 83, chance: 0.3 },
  { kind: 'subway', every: 120, x: 6.4, offset: 101, chance: 0.3 },
];
const placeholders = { // code stand-ins until the generated models land, roughly the right size and colour
  default: (T, entry) => [{ geometry: new T.BoxGeometry(0.5, entry.h, 0.5).translate(0, entry.h / 2, 0), material: material('kit/placeholder', () => new T.MeshStandardMaterial({ color: '#2f5d4a', roughness: 0.6 })), matrix: new T.Matrix4() }],
};
export function furniture(gfx, { z0, length }, style, r, cross) {
  const T = gfx.three, g = gfx.group();
  const at = (kind, x, z, side) => { (byKind[kind] ??= []).push(new T.Matrix4().compose(new T.Vector3(x, 0.18, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side > 0 ? -Math.PI / 2 : Math.PI / 2), new T.Vector3(1, 1, 1))); };
  const byKind = {};
  for (const rule of RHYTHM) for (const side of [-1, 1]) {
    const start = z0 + ((rule.offset ?? 0) + (rule.alternate && side > 0 ? rule.every / 2 : 0)) % rule.every;
    for (let z = start; z < z0 + length - 1; z += rule.every) {
      if (cross && z > cross.z - 2 && z < cross.z + 14) continue;
      if (rule.chance !== undefined && r() > rule.chance) continue;
      at(rule.kind, side * rule.x, z + (r() - 0.5) * 0.6, side);
    }
  }
  if (cross) for (const side of [-1, 1]) at('traffic_light', side * 4.95, cross.z - 0.5, side); // at the corner before the crosswalk
  for (const [kind, mats] of Object.entries(byKind)) for (const p of kitParts(gfx, KIT[kind], (T) => placeholders.default(T, KIT[kind]))) {
    const m = instanced(T, p.geometry, p.material, mats.map((x) => x.clone().multiply(p.matrix)));
    m.userData.furniture = kind;
    g.add(m);
  }
  return g;
}
```

Seam: `z < z0 + length - 1` and the largest footprint (bus shelter, about 3 m along z) must stay inside: clamp `z` to `[z0 + 2, z0 + length - 2]` for kinds wider than 1 m (the seam test enforces it; fix by clamping, not by skipping the test).

- [ ] **Step 5: Traffic.** `packs/hifi/lib/traffic.js`: in a chunk with a cross street, two to four vehicles from `KIT.sedan`, `KIT.van`, `KIT.taxi` drive along the cross street, never into the avenue (|x| ≥ 9). Their materials are clones of the kit's (one clone per entry, cached through `material()`; Task 6 makes the clone bend) whose vertex stage adds a drive offset `mod(uTime * speed + phase, span)` along the car's own forward axis before the instance matrix, so a car slides from x = ±9 to ±40 and wraps. The instance matrices place each car at the side-street lane centre (`cross.z + 3` or `cross.z + 9`), facing ±x. `userData.traffic = true` on each `InstancedMesh`. Write the shader patch like `ledMaterial`'s (`#include <begin_vertex>` gains `transformed.z += mod( uTime * ${speed} + vPhase, ${span} );`), with `vPhase` from `gl_InstanceID`.
- [ ] **Step 6:** Add `signs`, `furniture`, `traffic` to the city themes' `parts` and `signs` colours to their styles. `npm test` until all pass. Main session: probe frames on a turn (`?fixtures&hifi`, level 1 at 300 m) for the bend; low-fi hash unchanged.
- [ ] **Step 7: Commit** (`feat: HiFi city signs, furniture and side-street traffic, instanced, on board 15's rhythm, with code stand-ins until the models land`).

---

### Task 12 [City, opus]: The HiFi bridge

**Files:** Create `packs/hifi/lib/bridge.js`; modify `packs/hifi/themes/bridge.js` (`createChunk`), `test/city.test.js`.

**Interfaces:** Produces `bridgeChunk(gfx, args, style)`: deck, water, towers and cables, waterfront low-rises, all inside the chunk.

- [ ] **Step 1: The failing test:**

```js
import bridge from '../packs/hifi/themes/bridge.js';
import shippedBridge from '../content/themes/bridge.js';
test('the HiFi bridge stays inside its chunk and keeps a road', () => {
  for (const seed of [1, 2, 3]) {
    const g = bridge.createChunk.call({ ...shippedBridge, ...bridge }, gfx, { z0: 1080, length: 120, lanes, rng: rng(seed), theme: { ...shippedBridge, ...bridge } });
    const [lo, hi] = zSpan(g);
    assert.ok(lo >= 1080 - 1e-6 && hi <= 1200 + 1e-6, `${lo}..${hi}`);
    let road = false; g.traverse((n) => { if (n.userData.road) road = true; });
    assert.ok(road);
  }
});
```

- [ ] **Step 2: Code.** `bridge.js` builds: the deck `box(10, 1, length)` at y −0.5 flagged `userData.road`; lane dashes as in `street.js` (import `DASH`); water: a `PlaneGeometry(400, length, 8, ceil(length/4))` at y −6 with a `MeshStandardMaterial({ color: '#8ccfe0', roughness: 0.08, metalness: 0 })` whose `normalMap` is a Node-safe ripple `DataTexture` scrolled by `gfx.time` in `onBeforeCompile` (`vNormalMapUv += vec2( 0.0, uTime * 0.03 )` after `#include <normal_fragment_maps>`'s uv is read: patch `#include <normal_fragment_maps>` to offset the uv it samples); a tower pair at `z0 + 60` when `z0 % 240 === 0` (two pylons `box(1.6, 38, 1.6)` at x ±6.2 and a crossbeam), cables from each tower top down to the deck at the chunk edges as thin `box` segments (8 per side, stepping down a catenary, clipped to the chunk); waterfront low-rises at |x| 30.5–50.5 with downtown's facade material (`facadeMaterial(gfx, WATERFRONT, i)` where `const WATERFRONT = { id: 'downtown', facades: [], buildings: { colors: ['#8a8f9c', '#a3714f', '#5d6273', '#c2b8a3'] } }`, and Task 24 points its `facades` at downtown's tiles), heights 2–8 m, bases at y −6. No sidewalks.
- [ ] **Step 3:** `npm test`; main session frames at level 1, 1100 m, and at the bridge shot level. **Commit** (`feat: HiFi bridge: deck, rippling water, towers and cables, waterfront blocks`).

---

### Task 13 [Engine, opus]: The horizon ring and the sun's direction as a look knob

**Files:**
- Modify: `src/registry.js` (`checkLook`), `src/look.js` (`lookState`, ring, sun), `src/engine.js` (`sunDir`), `packs/hifi/themes/*.js` (`look.skyline`, `assets`)
- Create: `scripts/placeholder-skyline.py`, `public/hifi/city/sky/placeholder.png`
- Test: `test/look.test.js`, `test/packs.test.js`

**Interfaces:**
- Produces: `look.skyline`: a path or a list of one or two paths (near last), each also in the theme's `assets`; `look.sun.dir`: `[x, y, z]` with y < 0 (the direction the light travels); `lookState(theme).skyline` (array) and `.sun.dir` (array or null); `engine.sunDir` (a `Vector3` reset to the low-fi direction by `setSky`).

- [ ] **Step 1: The failing tests.** `test/look.test.js`:

```js
test('a look may name its skyline and the sun\'s direction', () => {
  assert.deepEqual(checkLook({ skyline: 'hifi/city/sky/downtown-01.webp', sun: { dir: [6, -16, 12] } }), []);
  assert.deepEqual(checkLook({ skyline: ['hifi/city/sky/downtown-01.webp', 'hifi/city/sky/downtown-02.webp'] }), []);
  assert.match(checkLook({ skyline: ['a.webp', 'b.webp', 'c.webp'] }).join(), /look.skyline must be one or two image paths/);
  assert.match(checkLook({ skyline: 'sky.jpg' }).join(), /look.skyline must be one or two image paths/);
  assert.match(checkLook({ sun: { dir: [0, 1, 0] } }).join(), /look.sun.dir must be \[x, y, z\] pointing down/);
  const s = lookState({ sky: '#9fd3f5', look: { skyline: 'hifi/city/sky/downtown-01.webp', sun: { dir: [1, -2, 1] } } });
  assert.deepEqual(s.skyline, ['hifi/city/sky/downtown-01.webp']);
  assert.deepEqual(s.sun.dir, [1, -2, 1]);
  assert.equal(lookState({ sky: '#000000', look: {} }).sun.dir, null);
});
```

`test/packs.test.js`:

```js
test('every skyline a HiFi look names is in that theme\'s assets', async () => {
  const { registry } = applyPack(shipped, await discover(PACK, 'packs/hifi'));
  for (const t of Object.values(registry.theme)) for (const p of [].concat(t.look?.skyline ?? [])) assert.ok(t.assets?.includes(p), `theme "${t.id}" names ${p} but does not list it`);
});
```

- [ ] **Step 2: `checkLook`.** Allow `skyline` among the keys and add:

```js
  const IMAGE = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:webp|png)$/;
  if (l.skyline !== undefined) { const s = [].concat(l.skyline); if (!(s.length >= 1 && s.length <= 2 && s.every((p) => typeof p === 'string' && IMAGE.test(p)))) e.push('look.skyline must be one or two image paths under public/'); }
```

and in the `sun` branch allow `dir`: `if (l.sun.dir !== undefined && !(Array.isArray(l.sun.dir) && l.sun.dir.length === 3 && l.sun.dir.every((v) => Number.isFinite(v)) && l.sun.dir[1] < 0)) e.push('look.sun.dir must be [x, y, z] pointing down (y < 0)');` (and the "may only set" list becomes color, intensity and dir).

- [ ] **Step 3: `lookState`:** `sun: { color, intensity, dir: l.sun?.dir ?? null }`, `skyline: [].concat(l.skyline ?? [])`.
- [ ] **Step 4: The engine.** In `src/engine.js`: `const sunDir = SUN_DIR.clone();` inside `createEngine`, `follow` uses `sunDir` instead of `SUN_DIR`, `setSky` starts with `sunDir.copy(SUN_DIR);`, and the returned object exposes `sunDir`. Low-fi never changes it, so its frames are unchanged.
- [ ] **Step 5: The ring.** In `src/look.js`, `createLook({ renderer, scene, camera, sun, hemi, sunDir })` and:

```js
import { texture } from './assets.js';
// The skyline (round 2): up to two camera-centred open cylinders wearing look.skyline, far side first, between the dome and
// the far plane; unbent, unfogged, no shadows. A missing image hides its ring. ponytail: calibration knobs.
const RING = { radius: [360, 330], base: -14, yaw: 0 };
const rings = RING.radius.map((r, i) => {
  const geo = new THREE.CylinderGeometry(r, r, 1, 96, 1, true).translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.renderOrder = -0.9 + i * 0.1; m.frustumCulled = false; m.visible = false; m.rotation.y = RING.yaw;
  scene.add(m);
  return m;
});
```

In `apply(theme)`: `if (s?.sun.dir) sunDir.set(...s.sun.dir).normalize();` and

```js
      rings.forEach((ring, i) => {
        const list = s?.skyline ?? [], path = list.length === 2 ? list[i] : i === 1 ? list[0] : undefined; // two images: far, near; one: the near ring
        let map = null;
        try { if (path) map = texture(path); } catch { /* not loaded: no ring */ }
        ring.visible = !!map;
        if (!map) return;
        map.wrapS = THREE.MirroredRepeatWrapping; map.repeat.x = 2; // the image covers half the ring, mirrored round the back
        ring.material.map = map; ring.material.needsUpdate = true;
        ring.scale.y = (Math.PI * RING.radius[i] * map.image.height) / map.image.width; // the image keeps its aspect over half the ring
      });
```

and in `render()`: `for (const r of rings) r.position.set(camera.position.x, camera.position.y + RING.base, camera.position.z);`. `engine.js` passes `sunDir` in the object `createLook` receives (`useLook(createLook(engine))` already passes the engine, so expose `sunDir` on it).

- [ ] **Step 6: A placeholder skyline** `scripts/placeholder-skyline.py` (Pillow): a 3072×1316 RGBA PNG, transparent sky, a seeded row of grey-blue tower silhouettes (heights 15–60% of the image, a few stepped tops, no recognisable landmark) with a haze gradient toward the bottom; write `public/hifi/city/sky/placeholder.png`. Every theme overlay gets `assets: ['hifi/city/sky/placeholder.png']` and `look.skyline: 'hifi/city/sky/placeholder.png'` until Task 24.
- [ ] **Step 7:** `npm test`, `npm run build`. Main session: frames at the 16:9 shot per theme; low-fi hash unchanged.
- [ ] **Step 8: Ledger rows** (`src/registry.js` `look.skyline` and `look.sun.dir`; `src/look.js` the rings and sun; `src/engine.js` `sunDir`: Generic hooks (the ring is HiFi-only code in the HiFi-only file); No: nothing could live at the horizon) and **commit** (`feat: a HiFi look may name its skyline, drawn on camera-centred rings, and the sun's direction`).

---

### Task 14 [Main]: The zero-cost probe (gate before wave 3)

- [ ] **Step 1: Frames.** On `?fixtures&hifi`: `hifiShot` at 9:16 and 16:9 for all four shot levels; then level 1 at 300 m (on the first turn) and 470 m (the dip) and level 2 at 900 m (the bridge), each paused with the run teleported (`run.z`, `graceT`), saved with `toBlob` through the drop server.
- [ ] **Step 2: The two choices, measured.**
  - Fog over the skyline: compare (a) dropping fully fogged pixels: a material's shader hook cannot be changed from the console, so build a throwaway branch `probe/fog-cut` with Task 15's option-A code in a temporary worktree (`node_modules` symlinked), serve it on port 5178, and shoot the same 16:9 frames; (b) `scene.fog.far *= 1.6` and `near *= 1.6` in the console on the main build. Look for chunk pop-in at the build edge (200–320 m) and for sky-coloured blocks over the skyline.
  - Shadow reach: (a) in the console `sun.shadow.mapSize.set(8192, 8192)`, `Object.assign(sun.shadow.camera, { top: 90, bottom: -90 })`, `sun.shadow.map.dispose(); sun.shadow.map = null`, and engine `SUN_AHEAD` 60 (patch `engine.follow` on the hook to move the target 60 m ahead); (b) the throwaway branch `probe/csm` with three's `CSM` (`three/addons/csm/CSM.js`, 2 cascades, `maxFar` 220, 4096 maps), its `setupMaterial` called on every material before `bendable` wraps it. Measure `hifiProbe` for each and look at the far canyon's shade.
- [ ] **Step 3: Measure** `hifiProbe` per theme at 3024×1964 (mean, p95, calls, triangles) and texture memory (`renderer.info.memory`). Ledger rows.
- [ ] **Step 4: Gate.** SendUserFile the frames (status `proactive`), then AskUserQuestion with three questions: "Fog over the skyline: drop fully fogged pixels, or push the HiFi fog out?" ("Drop fogged pixels", "Push fog out"); "Shadow reach: longer 8192 box, or two cascades?" ("Longer box", "Cascades"); "The probe holds: go ahead with wave 2 and 3 (about 570 credits)?" ("Go ahead", "Not yet"). Recommend from the measurements. Delete the throwaway branches afterwards (`git branch -D probe/fog-cut probe/csm`, after confirming they were only probes).

---

### Task 15 [Engine, opus]: The probe's choices

**Files:** Modify `src/gfx.js` (option A fog), `src/look.js`, `src/engine.js` (shadow reach), `test/logic.test.js`.

- [ ] **Fog, option A (drop fully fogged pixels in HiFi).** `src/gfx.js`: `export const fogCut = { value: 0 };`; `patch` also edits the fragment shader:

```js
  shader.uniforms.uFogCut = fogCut;
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform float uFogCut;\nvoid main() {').replace('#include <fog_fragment>', '#include <fog_fragment>\n#ifdef USE_FOG\n  if ( uFogCut > 0.5 && fogFactor > 0.999 ) discard; // HiFi: what the fog has fully hidden lets the skyline through\n#endif');
```

`src/look.js` `apply`: `fogCut.value = s ? 1 : 0` (import from `./gfx.js`). Test: the patched toon fragment shader contains `fogFactor > 0.999` after `fog_fragment` and `uFogCut` is the shared uniform; low-fi leaves it at 0 (the low-fi still hash proves the pixels).
- [ ] **Fog, option B (push the HiFi fog out).** `look.fogFar` (0.5–3, default 1) validated in `checkLook`; `apply` multiplies `scene.fog.near` and `scene.fog.far` by it; the four looks get the probe's value. Test: `checkLook` range and `lookState` default.
- [ ] **Shadows, option A (longer box).** `src/look.js`: map 8192, box `top: 90, bottom: -90`; `src/engine.js`: `SUN_AHEAD` becomes a value the look can raise (`engine.sunAhead`, reset to 25 by `setSky`, set to 60 by the look). Ruling with the measured cost.
- [ ] **Shadows, option B (cascades).** `src/look.js` creates `new CSM({ maxFar: 220, cascades: 2, shadowMapSize: 4096, lightDirection: sunDir, camera, parent: scene })`, updates it in `render()`, and `src/gfx.js` `bendable` calls a hook `beforeBend(material)` that the look sets to `csm.setupMaterial`, so CSM patches the material before the bend wraps it (the bend must stay last in the chain). The default sun's shadow stays off while CSM is on. Test: `bendable` calls `beforeBend` before wrapping.
- [ ] Implement only the chosen options, `npm test`, frames for Caedon, ledger rows, commit (`feat: <the choices>, from the probe`).

---

### Task 16 [Engine, opus]: Per-level preload and freeing

**Files:** Modify `src/assets.js` (`levelAssets`, `gateLoads`; remove `gate`), `src/main.js`; test `test/assets.test.js`.

**Interfaces:**
- Consumes: `release` (Task 7).
- Produces: `levelAssets(level, registry)` → array of paths; `gateLoads(load = preload)` → `async (paths) => boolean` (false while a load is already running).

- [ ] **Step 1: The failing tests** (replace the `gate` test):

```js
test('a level\'s files include every module it names, section themes, the default jug and its character', () => {
  const reg = {
    theme: { a: { assets: ['t/a.webp'] }, b: { assets: ['t/b.webp'] } }, obstacle: { o: { assets: ['o.glb'] }, unused: { assets: ['no.glb'] } },
    pickup: { jug: { assets: ['jug.glb'] }, s: { assets: ['s.glb'] } }, prop: { p: { assets: ['p.glb'] }, q: { assets: ['q.glb'] } },
    character: { milkshake: { assets: ['m.glb'] } }, ending: { finish: {} },
  };
  const level = { theme: { id: 'a' }, obstacles: { o: 1 }, jugs: { powerups: ['s'] }, props: { ids: { p: 1 } }, sections: [{ theme: { id: 'b' }, placements: [{ kind: 'prop', id: 'q' }] }] };
  assert.deepEqual(levelAssets(level, reg).sort(), ['jug.glb', 'm.glb', 'o.glb', 'p.glb', 'q.glb', 's.glb', 't/a.webp', 't/b.webp']);
});

test('a second start while a level\'s files load is dropped', async () => {
  let done;
  const start = gateLoads(() => new Promise((r) => { done = r; }));
  const first = start(['x.glb']), second = start(['x.glb']);
  done();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(await gateLoads(async () => {})(['y.glb']), true);
});

test('release keeps what the next level needs', () => {
  adopt('test/next.glb', model()); adopt('test/old.glb', model());
  release(levelAssets({ theme: { id: 'a' } }, { theme: { a: { assets: ['test/next.glb'] } }, obstacle: {}, pickup: {}, prop: {}, character: {}, ending: {} }));
  assert.ok(asset('test/next.glb'));
  assert.throws(() => asset('test/old.glb'), /not loaded/);
});
```

- [ ] **Step 2: Code** in `src/assets.js`:

```js
// Every file a level needs, from what its JSON names (round 2 spec §7): section themes, obstacles, power-ups and the default
// jug, props, placements, its character and its ending. Pure, so Node tests it; the generator only ever draws from these lists.
export function levelAssets(level, registry) {
  const ids = { theme: new Set(), obstacle: new Set(), pickup: new Set(['jug']), prop: new Set(), character: new Set([level.character?.id ?? 'milkshake']), ending: new Set([level.ending?.id ?? 'finish']) };
  for (const s of [level, ...(level.sections ?? [])]) {
    if (s.theme?.id) ids.theme.add(s.theme.id);
    for (const id of Object.keys(s.obstacles ?? {})) ids.obstacle.add(id);
    for (const id of s.jugs?.powerups ?? []) ids.pickup.add(id);
    for (const id of Object.keys(s.props?.ids ?? {})) ids.prop.add(id);
    for (const p of s.placements ?? []) ids[p.kind]?.add(p.id);
  }
  return [...new Set(Object.entries(ids).flatMap(([kind, set]) => [...set].flatMap((id) => registry[kind]?.[id]?.assets ?? [])))];
}

// A level's start waits on its files; while they load, a second start is dropped (a double click on LOADING…).
export function gateLoads(load = preload) {
  let busy = false;
  return async (paths) => {
    if (busy) return false;
    busy = true;
    try { await load(paths); return true; } finally { busy = false; }
  };
}
```

Remove `gate` (its only caller goes in Step 3).

- [ ] **Step 3: `src/main.js`.** Remove the boot-time `paths`, `loaded`, `ready` and the LOADING line. Add:

```js
  // Per level (round 2): a level's files load before it starts, behind LOADING…; the previous level's leave once its world is gone.
  const loads = gateLoads();
  async function prepare(id) {
    const paths = levelAssets(levels[id], registry), play = $('play');
    play.textContent = 'LOADING…';
    try { return await loads(paths); } finally { play.textContent = 'RUN'; }
  }
```

`menu()`: the buttons show first (move `$('endless').hidden = …` and `show('menu')` to the top), then, when there is no backdrop, `if (!(await prepare(campaign.start))) return;` before `createWorld` (the menu's own load counts as the one running load); the street appears when its files land. `startLevel(id, carry)`: first line `if (!(await prepare(id))) return;`; after `if (backdrop) { backdrop.dispose(); backdrop = null; }` add `release(levelAssets(levels[id], registry));`. Imports: `preload` and `gate` go, `gateLoads`, `levelAssets`, `release` come in. A low-fi registry lists no files, so `prepare` resolves at once and the label flicks back to RUN: check the low-fi still hash.
- [ ] **Step 4:** `npm test`, `npm run build`; main session: level 1 → transition → level 2 in the pane with `renderer.info.memory.textures` read before and after the chain (it must not grow without bound), and a double click on RUN while LOADING… starts one level. Ledger rows (`src/assets.js`, `src/main.js`: Generic hooks; No) and **commit** (`feat: per-level preload and freeing: a level loads its own files and releases the last one's`).

---

### Task 17 [Engine, sonnet]: Worn looks for power-ups, and the shield bubble

**Files:**
- Create: `src/worn.js`, `packs/hifi/pickups/shield.js`
- Modify: `src/registry.js` (`SKIN_FIELDS.pickup`, `CHECKS.pickup`), `src/game.js`
- Test: `test/content.test.js` (or a new `test/worn.test.js`)

**Interfaces:** Produces `wornLooks(registry, gfx)` → `{ update(run, parent), dispose() }`; a pickup module may set `createWorn(gfx)` → `{ object, update?(run), dispose?() }`.

- [ ] **Step 1: The failing test** `test/worn.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import { wornLooks } from '../src/worn.js';
import { checkModule } from '../src/registry.js';

test('a power-up\'s worn look rides on the character while its effect lasts, and leaves when it ends', () => {
  let disposed = 0;
  const bubble = { kind: 'pickup', id: 'bubble', color: '#4dc3ff', duration: 'untilHit', effect: { shield: true }, createWorn: (g) => ({ object: g.group(), dispose: () => disposed++ }) };
  assert.deepEqual(checkModule(bubble), []);
  assert.match(checkModule({ ...bubble, createWorn: 1 }).join(), /createWorn must be a function/);
  const parent = gfx.group(), worn = wornLooks({ pickup: { bubble } }, gfx), run = { effects: { bubble: { t: Infinity, shield: true } } };
  worn.update(run, parent);
  assert.equal(parent.children.length, 1);
  worn.update(run, parent);
  assert.equal(parent.children.length, 1, 'once, not every frame');
  delete run.effects.bubble;
  worn.update(run, parent);
  assert.equal(parent.children.length, 0);
  assert.equal(disposed, 1);
});

test('a power-up without a worn look, or one whose createWorn throws, changes nothing', () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const parent = gfx.group(), worn = wornLooks({ pickup: { a: {}, b: { createWorn() { throw new Error('x'); } } } }, gfx);
    worn.update({ effects: { a: {}, b: {} } }, parent);
    assert.equal(parent.children.length, 0);
  } finally { console.warn = warn; }
});
```

- [ ] **Step 2: Code.** `src/worn.js`:

```js
import { safeCall } from './registry.js';
// A power-up's worn look (round 2): while its effect lasts, the pickup's createWorn view rides on the character.
export function wornLooks(registry, gfx) {
  const on = new Map(); // pickup id -> its view, or null when it has none or createWorn failed
  const drop = (id, view) => { view.object.removeFromParent(); if (view.dispose) safeCall(`pickup ${id} worn dispose`, () => view.dispose()); gfx.dispose(view.object); };
  return {
    update(run, parent) {
      for (const id of Object.keys(run.effects)) if (!on.has(id)) {
        const def = registry.pickup[id], view = def?.createWorn ? safeCall(`pickup ${id} createWorn`, () => def.createWorn(gfx), null) : null;
        on.set(id, view);
        if (view) parent.add(gfx.bend(view.object));
      }
      for (const [id, view] of on) if (!(id in run.effects)) { on.delete(id); if (view) drop(id, view); }
      for (const [id, view] of on) if (view?.update) safeCall(`pickup ${id} worn update`, () => view.update(run));
    },
    dispose() { for (const [id, view] of on) if (view) drop(id, view); on.clear(); },
  };
}
```

`src/registry.js`: `CHECKS.pickup` gains `if (m.createWorn !== undefined && !fn(m.createWorn)) e.push('createWorn must be a function');`; `SKIN_FIELDS.pickup` becomes `['createView', 'createWorn']`. `src/game.js` (which imports `gfx` since Task 2): `import { wornLooks } from './worn.js';`, `const worn = wornLooks(registry, gfx);` beside `run`, `worn.update(run, character.object);` after `character.update(run);` in `tick`, `worn.dispose();` first in `end`.

- [ ] **Step 3: The bubble** `packs/hifi/pickups/shield.js` (shipped look kept for the pickup until Task 23 adds its model):

```js
// HiFi shield: the bubble Milkshake wears while the shield holds (board 04), a code shader, 0 credits. ponytail: knobs.
const BUBBLE = { r: 1.25, y: 1.0, opacity: 0.22, rim: 2.2, pulse: 0.03 };
export default {
  kind: 'pickup', id: 'shield',
  createWorn(gfx) {
    const T = gfx.three;
    const m = new T.MeshPhysicalMaterial({ color: '#4dc3ff', transparent: true, opacity: BUBBLE.opacity, roughness: 0.05, clearcoat: 1, iridescence: 1, depthWrite: false });
    m.onBeforeCompile = (s) => { // a fresnel rim that glows past the bloom threshold: the bubble's own edge, not a ring laid over it
      s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `float rim = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 3.0 );\n  outgoingLight += vec3( 0.3, 0.76, 1.0 ) * rim * ${BUBBLE.rim.toFixed(2)};\n  #include <opaque_fragment>`);
    };
    const object = new T.Mesh(new T.SphereGeometry(BUBBLE.r, 32, 24), m);
    object.position.y = BUBBLE.y;
    return { object, update: (run) => object.scale.setScalar(1 + Math.sin(run.time * 3) * BUBBLE.pulse), dispose: () => m.dispose() };
  },
};
```

- [ ] **Step 4:** `npm test` (the content-agnostic engine check must still pass: `src/worn.js` names no id); main session: frames of the bubble in HiFi (a crop of its rim, per the glow rule); low-fi hash unchanged (low-fi registers no `createWorn`). Ledger rows (`src/worn.js`, `src/game.js`, `src/registry.js`: Generic hooks; No: a power-up had no way to show on the character) and **commit** (`feat: a power-up may wear a look on the character while it lasts; the HiFi shield bubble`).

---

### Task 18 [Engine, sonnet]: The deferred minors, and the paint and fit helpers every overlay uses

**Files:** Modify `src/look.js`, `packs/hifi/obstacles/taxi.js`; create `packs/hifi/lib/paint.js`, `packs/hifi/lib/fit.js`; test `test/packs.test.js`.

**Interfaces:** Produces `gloss(T, source, extra)` (a `MeshPhysicalMaterial` with every standard field of `source` copied, then `extra`); `glowMap(T, map, test)` (an emissive map keeping only the texels `test(r, g, b)` accepts; null without a canvas); `fitBox(T, model, box, inside)` → `{ scale, offset }`.

- [ ] **Step 1: The failing test:**

```js
test('gloss copies every standard field of a generated material, then adds the gloss', async () => {
  const { gloss } = await import('../packs/hifi/lib/paint.js');
  const T = gfx.three, src = new T.MeshStandardMaterial({ color: '#ff0000', aoMapIntensity: 0.5, side: T.DoubleSide, vertexColors: true });
  src.normalScale.set(0.3, 0.3);
  const p = gloss(T, src, { clearcoat: 1 });
  assert.ok(p.isMeshPhysicalMaterial && p.clearcoat === 1);
  assert.equal(p.color.getHexString(), 'ff0000'); assert.equal(p.aoMapIntensity, 0.5); assert.equal(p.side, T.DoubleSide); assert.equal(p.vertexColors, true); assert.equal(p.normalScale.x, 0.3);
});
test('fitBox keeps a jumpable model inside its box and lets a lane blocker stand taller', async () => {
  const { fitBox } = await import('../packs/hifi/lib/fit.js');
  const T = gfx.three, tall = () => new T.Mesh(new T.BoxGeometry(1, 3, 2), new T.MeshStandardMaterial());
  assert.ok(Math.abs(fitBox(T, tall(), { w: 2, h: 1, d: 4 }, true).scale - 1 / 3) < 1e-9, 'inside: the height decides');
  assert.ok(Math.abs(fitBox(T, tall(), { w: 2, h: 1, d: 4 }, false).scale - 2) < 1e-9, 'lane: the footprint decides');
});
```

- [ ] **Step 2: Helpers.** `packs/hifi/lib/paint.js`:

```js
// A glossy copy of a generated material: every standard field (maps, colour, normal scale, AO, side, alpha, vertex colours),
// then the extras. Sub-project 1's taxi copied a subset; this is the rule for every generated model (final review, minor).
export function gloss(T, source, extra = {}) {
  const p = new T.MeshPhysicalMaterial();
  T.MeshStandardMaterial.prototype.copy.call(p, source);
  return Object.assign(p, extra);
}
// The colour map with only the texels `test` accepts, as an emissive map: a lamp glows in its own shape (Caedon, 2026-10-09).
export function glowMap(T, map, test, size = 1024) {
  if (!map?.image || typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(size, size), ctx = canvas.getContext('2d');
  ctx.drawImage(map.image, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size), px = img.data;
  for (let i = 0; i < px.length; i += 4) if (!test(px[i], px[i + 1], px[i + 2])) px[i] = px[i + 1] = px[i + 2] = 0;
  ctx.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(canvas);
  Object.assign(t, { flipY: map.flipY, colorSpace: map.colorSpace, channel: map.channel });
  return t;
}
```

`packs/hifi/lib/fit.js`:

```js
// Scale and offset that fit a generated model into a shipped box: centred, on the ground (or at the box's y), its footprint
// filled. inside = true also fits the height (jump, slide and timing obstacles); a lane blocker may stand taller (the taxi ruling).
export function fitBox(T, model, { w, h, d, y = 0 }, inside) {
  model.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(model), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
  const scale = Math.min(w / size.x, d / size.z, inside ? h / size.y : Infinity);
  return { scale, offset: new T.Vector3(-c.x * scale, y - b.min.y * scale, -c.z * scale) };
}
```

The taxi overlay switches to `gloss` (its `paint` map builds `gloss(T, m, { clearcoat: 1, clearcoatRoughness: 0.12, emissive: lamps ? '#ffffff' : '#000000', emissiveMap: lamps, emissiveIntensity: LAMP_GLOW })`) and `glowMap` with its `lampMask` test (`(r, g, b) => r > 150 && g < 90 && b < 90`); its existing tests keep passing.

- [ ] **Step 3: The minors in `src/look.js`:**

```js
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose(); // final review, minor: the bake's scene is not needed afterwards
  pmrem.dispose();
```

```js
  const output = new OutputPass();
  output.needsSwap = false; // the last pass draws to the screen: no swap after it, so the scene always lands in the same target
  composer.addPass(output);
  composer.renderTarget1.samples = 0; // only the target the scene renders into keeps 4x MSAA (about 190 MB saved at 3024x1964)
```

Before writing the second block, verify in the browser that with `output.needsSwap = false` `composer.readBuffer` is the same target on consecutive frames (log `composer.readBuffer === composer.renderTarget2` for four frames) and that it is the multisampled one; if not, set `samples = 0` on the other target instead. `resize`:

```js
    resize(w, h) {
      const pr = renderer.getPixelRatio();
      if (pr !== lastRatio) { lastRatio = pr; composer.setPixelRatio(pr); } // setPixelRatio reallocates; only when it changed
      composer.setSize(w, h);
    },
```

with `let lastRatio = 0;` above.

- [ ] **Step 4:** `npm test`; main session: HiFi stills before and after the MSAA change compared by eye (edges stay smooth), low-fi hash unchanged. Ledger rows (`src/look.js`: HiFi-only; No) and **commit** (`fix: deferred minors: one MSAA target, one reallocation per resize, the room environment disposed; gloss and fit helpers for every generated model`).

---

### Task 19 [Content, opus]: Milkshake's view takes its model, skin knobs and paint from the caller

**Files:** Modify `content/characters/milkshake.js`; test `test/content.test.js`.

**Interfaces:** Produces `cowView(gfx, def, { load, skin = SKIN, bones = BONES, dress = toon, yaw = def.yaw, blob = true })` (what `createView` returns today); `fitModel(THREE, model, def, { skin, bones, dress, yaw } = {})`; `skinWeights(y, z, K)` unchanged.

- [ ] **Step 1: The failing test** (append):

```js
test('the HiFi pack can reuse Milkshake\'s view with its own model, skin knobs and paint', async () => {
  const { cowView, SKIN } = await import('../content/characters/milkshake.js');
  const T = gfx.three, def = { height: 1.9, width: 1, yaw: 0 };
  const scene = new T.Group(); scene.add(new T.Mesh(new T.BoxGeometry(0.6, 1, 0.4, 2, 8, 2), new T.MeshStandardMaterial()));
  let dressed = 0;
  const view = await cowView(gfx, def, { load: async () => scene, skin: { ...SKIN, crotch: -0.4 }, dress: (T2, m) => { dressed++; return new T2.MeshPhysicalMaterial({ map: m.map }); }, blob: false });
  assert.ok(dressed > 0, 'the caller dresses the model');
  let skinned = 0, blobs = 0; view.object.traverse((n) => { if (n.isSkinnedMesh) skinned++; if (n.geometry?.type === 'CircleGeometry') blobs++; });
  assert.equal(skinned, 1, 'skinned with v4\'s code'); assert.equal(blobs, 0, 'no blob shadow when the caller says so');
  assert.doesNotThrow(() => view.update({ x: 0, y: 0, z: 0, lane: 1, time: 0.3, slideT: 0, over: false, speed: 12, rules: { laneWidth: 2.5 } }));
});
```

- [ ] **Step 2: Refactor.** Move the body of `createView` into `export async function cowView(gfx, def, { load, skin = SKIN, bones = BONES, dress = toon, yaw = def.yaw, blob = true } = {})`; `createView(gfx)` becomes `return cowView(gfx, this, { load: async () => (await new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${this.model}`)).scene });`. Inside, `({ model, arms, legs, head, limbAxis } = fitModel(gfx.three, await load(), def, { skin, bones, dress, yaw }))`; the blob shadow is added only when `blob`, and `update` moves it only when it exists. `fitModel` passes `skin`, `bones` to `skin(THREE, mesh, K, B)` (which uses `B` where it used `BONES` and `skinWeights(y, z, K)`), uses `dress(THREE, n.material)` where it built the toon material (`const toon = (T, m) => new T.MeshToonMaterial({ map: m.map, color: m.color });`), and `yaw` where it used `def.yaw`. Export `BONES`.
- [ ] **Step 3:** `npm test` (the existing Milkshake tests unchanged); main session: low-fi hash unchanged (this is the low-fi character), HiFi still unchanged. **Commit** (`refactor: Milkshake's view takes its model, skin knobs and paint, so the HiFi remodel reuses v4's skinning`).

---

### Task 20 [Main]: Wave 2 — views and the city's images

- [ ] **Step 1: Re-price** from Task 5's probe readings: views for the 13 multi-view assets (traffic light, newsstand, bus shelter, subway entrance, barrier, delivery bike, hot-dog cart, scaffold, overpass, tunnel, sedan, van, Milkshake) × 4 × 0.25 = 13, plus 0.5 each of redo allowance (about 20); facades 15 × 3 candidates, storefronts 12 × 3, party walls 3 × 2, trims 3 × 2, posters 12 × 2, blade signs 6 × 2, LED faces 3 × 2, skylines 8 × 2 at the measured 2k (or 21:9 4k) price. **Gate:** AskUserQuestion with the total.
- [ ] **Step 2: Generate** from the prompt book, the picked concept as the only image reference for views; the picked style frame for each theme's images. Ledger rows.
- [ ] **Step 3: Check every view** (`job_display` or `show_generation_by_ids`): same object, the requested side, in Tripo's order front, left, back, right. Redo drifted views (inside the allowance).
- [ ] **Step 4: Contact sheet and picks.** Show the images grouped by set; AskUserQuestion pickers (four questions per call) for the facade, storefront, sign and skyline candidates.
- [ ] **Step 5: Download gate for the picked images.** `curl -sIL` sizes through `ctx_execute`, then AskUserQuestion: "Download N images (total X MB) from <host> into the scratchpad?" On approval, download to `<scratchpad>/raw/images/`, `ls -la`. Ledger Downloads rows.
- [ ] **Step 6: Tile.** For each picked image, read it (Read tool), choose the crop (whole bays and floors for facades; the shop front for storefronts; the skyline band for skylines, `--mirror`), run `python3 scripts/tile-image.py … --crop x,y,w,h --size 1024` (2048 for skylines and the sign atlas) into `public/hifi/city/…`. Commit the WebPs (`chore: generated city images for round 2, tiled to WebP`).

---

### Task 21 [Main]: Wave 3 — models (pilot first)

- [ ] **Step 1: Pilot gate.** "Spend 54 credits on the furniture pilot (lamp post, tree, hydrant: Tripo single image)?" Generate with the prompt book's Tripo parameters (`generate_3d`, `tripo_h3_1_image_to_3d` for single image with the picked concept, `geometry_quality` and `texture_quality` "detailed", `pbr` true, `face_limit` from the prompt book). Look at each in `job_display`; show Caedon the three viewer links; AskUserQuestion "The pilot holds (thin poles intact): run the other 25 models (450 credits)?" If a pole fused or broke, propose the code fallback for that kind and say what it saves.
- [ ] **Step 2: The rest.** Multi-view assets with `tripo_h3_1_multiview_to_3d` and their four checked views in order; single-image assets with their picked concept. Check each result; one retry each is inside the approval (a new seed or a cleaner view). Ledger rows.

---

### Task 22 [Main]: Wave 4 — downloads and optimisation

- [ ] **Step 1: Download gate** for every approved model: sizes first, then one AskUserQuestion listing the 28 file names, the host and the total. Download into `<scratchpad>/raw/models/<name>_raw.glb`; `ls -la`; ledger rows.
- [ ] **Step 2: Optimise** each: `npm run assets:optimize -- "<scratchpad>/raw/models/<name>_raw.glb" public/hifi/<path>.glb`, then `npx gltf-transform inspect public/hifi/<path>.glb` (meshopt, WebP ≤ 2048, triangles near the face limit). Furniture above 1 MB: re-run with `--texture-size 1024` by hand and record a Ruling. Commit the GLBs (`chore: generated models for round 2, optimised with gltf-transform`).
- [ ] **Step 3: Lineup.** `await __milkshake.assets.preload(paths)` then `await hifiLineup('wave4-<group>', { paths })` per group of eight; read the stills; note each model's yaw (which way is front) and pass it to the asset agents in Task 23.

---

### Task 23 [Assets, one sonnet agent per asset, in parallel; Milkshake on opus]: The overlays and kit entries

**Files (per asset):** an overlay `packs/hifi/<kind>s/<id>.js` (obstacles, pickups, props, Milkshake) or the asset's entry in `packs/hifi/lib/kit.js` (furniture, vehicles); a test in `test/packs.test.js` (or `test/city.test.js` for kit entries).

**Interfaces:** Consumes `gfx.asset`, `fitBox`, `gloss`, `glowMap` (Task 18), `cowView` (Task 19), `KIT` (Task 11), Task 22's yaw notes.

Dispatch one agent per row, each with `isolation: "worktree"`, the task text, the row, Task 22's yaw note for its file, the Global Constraints and "How to run things". Agents cannot see the browser: they fit by bounds in Node and return the knob values; the main session checks every result in a lineup or in game and sends corrections back with SendMessage.

| Asset | File | Kind of work | Box rule and notes |
|---|---|---|---|
| barrier_low | `hifi/barrier_low.glb` | obstacle overlay | `jump`: inside its box |
| delivery_bike | `hifi/delivery_bike.glb` | obstacle overlay | `lane`, `moves`: footprint, may stand taller; the shipped `update` stays (overlays only replace `createView`) |
| hot_dog_cart | `hifi/hot_dog_cart.glb` | obstacle overlay | `jump`: inside its box, umbrella included |
| manhole_steam | `hifi/manhole_steam.glb` | obstacle overlay | `timing`: the cover is the model; the steam column is code (a `Points` cloud or stacked soft spheres) that follows the shipped cycle through the view's `update(o, run, dt, active)` |
| pigeons | `hifi/pigeon.glb` | obstacle overlay | `slide` (box at y 1.1): one bird, an `InstancedMesh` of the shipped flock's positions, wings flap through `gfx.time` in the vertex stage; inside the box |
| scaffold_beam | `hifi/scaffold_beam.glb` | obstacle overlay | `slide`: inside its box, daylight under the plank |
| jug | `hifi/jug.glb` | pickup overlay | fits a 0.8 m sphere centred at y 0.9; the bottle glows from its own milky texels (`glowMap`) |
| magnet, shield, x2 | `hifi/{magnet,shield,x2}.glb` | pickup overlays | as the jug; `shield.js` keeps Task 17's `createWorn` and gains `createView` and `assets` |
| billboard | none (no model) | prop overlay | a code panel (bezel, frame, two posts) wearing one poster from the city's sign atlas, picked by `z`; the shipped side rule (`floor(z / 40) % 2`) and size kept |
| overpass | `hifi/overpass.glb` | prop overlay | fitted to the shipped deck: 15 m wide (road + 6), 5 m clearance, `length` 8 |
| railings | `hifi/railings.glb` | prop overlay | one segment instanced every 4 m along the prop's 40 m, both sides at x ±5.0 |
| tunnel | `hifi/tunnel.glb` | prop overlay | fitted to the shipped 60 m tube (x ±5.5, 6 m tall) |
| 12 furniture, 2 vehicles | `hifi/furniture/*.glb`, `hifi/vehicles/*.glb` | `KIT` entries | real `yaw`, `h` from board 15 (a lamp post 6.5 m), and `glow` (a texel test) for the lamp heads, signals and subway globes |
| milkshake | `hifi/milkshake.glb` | character overlay (opus) | `cowView` with `load: async () => gfx.asset('hifi/milkshake.glb')`, `SKIN` and `BONES` re-measured on the new mesh (print the mesh's bounds per height slice in Node with `gltf-transform inspect` output and a small script over the optimised file), `dress` = `gloss(T, m, { clearcoat: 1, clearcoatRoughness: 0.15 })`, `blob: false`, `yaw` from Task 22 |

**An obstacle overlay, the template** (each agent adapts the knobs and the test):

```js
// HiFi <id>: the generated model in public/hifi/<id>.glb, fitted to the shipped box (content/obstacles/<id>.js).
import { fitBox } from '../lib/fit.js';
import { gloss, glowMap } from '../lib/paint.js';
const YAW = 0; // ponytail: calibration knob — turns the model so its face looks at the player (-z); from Task 22's lineup
let parts; // { scale, offset, paint }, measured from the first copy
export default {
  kind: 'obstacle', id: '<id>', assets: ['hifi/<id>.glb'],
  createView(gfx) {
    const T = gfx.three, model = gfx.asset('hifi/<id>.glb');
    model.rotation.y = YAW;
    parts ??= build(T, model, this.box, this.avoid !== 'lane');
    model.traverse((n) => { if (n.isMesh) n.material = parts.paint.get(n.material) ?? n.material; });
    model.scale.setScalar(parts.scale);
    model.position.copy(parts.offset);
    return { object: gfx.group(model) };
  },
};
function build(T, model, box, inside) {
  const { scale, offset } = fitBox(T, model, box, inside), paint = new Map();
  model.traverse((n) => { if (n.isMesh && !paint.has(n.material)) paint.set(n.material, gloss(T, n.material, { clearcoat: 0.6, clearcoatRoughness: 0.2 })); });
  return { scale, offset, paint };
}
```

Its test (each agent writes its own, the shape of the taxi's): adopt a stand-in box under `hifi/<id>.glb`, build two views, assert the model sits inside (or, for `lane`, on the footprint of) the shipped box, wheels or feet at the box's `y`, centred, and both copies share one paint material.

- [ ] **Per agent: Step 1** write the failing test; **Step 2** the overlay or kit entry; **Step 3** `npm test`; **Step 4** commit on its branch (`feat: HiFi <asset>: the generated model fitted to the shipped box`) and report the branch, the knob values and anything it could not verify.
- [ ] **Main: Step 5** merge each branch after its reviewer passes; lineup or in-game check; corrections through SendMessage; ledger Assets rows.

---

### Task 24 [City, opus]: The city on its real kit, and the looks retuned

**Files:** Modify `packs/hifi/lib/facade.js` (window mask), the four theme overlays (`facades`, `shops`, signs atlas, `look.skyline`, `assets`, looks), `test/city.test.js`; remove `public/hifi/city/sky/placeholder.png` and `scripts/placeholder-skyline.py` once no look names it.

- [ ] **Step 1:** Each city theme's style lists its five facade tiles and four storefronts, its sign atlas, its skyline (one or two images) in `look.skyline`, and every one of those in `assets`. The facade material gains the window mask: `glowMap(T, map, (r, g, b) => b > r + 18 && r + g + b < 330)` as `emissiveMap` (at `style.lit`, 0 for the daylight themes, about 0.8 for uptown's dusk) and as a roughness hint (windows 0.12, wall 0.6) through a second `CanvasTexture` built the same way. Test: with every listed file adopted as a stand-in texture, the facade meshes use them (`material.map` is the adopted texture), and with one missing, the placeholder tile.
- [ ] **Step 2: Retune** the four looks for the physical street (spec §11): ambient down from about 2 toward 0.6–0.9, `env` up toward 0.8–1.0, `sun.dir` toward the teaser's high upper-right sun, exposure and bloom so LED faces and lamp heads bloom and windows do not. Tune by eye on the 9:16 and 16:9 shots per theme against board 01; each value change is a Ruling with the before and after.
- [ ] **Step 3:** `npm test`, `npm run build`; main session frames per theme. **Commit** (`feat: the HiFi city on its generated facades, storefronts, signs and skylines; looks retuned for the physical street`).

---

### Task 25 [Main]: Board 17 "Wave 4 finals"

- [ ] Shoot in-game crops of every asset (lineup stills, close-ups through `hifiShot` poses, glow crops for every lamp, sign and LED face) and the city per theme. Lay them out on board 17 with each asset's name. AskUserQuestion pickers, four per call: "Approve <asset>?" ("Approve", "Fix (say what)"). Send each fix to its agent (SendMessage) or task owner; re-check; ledger Assets rows record each approval.

---

### Task 26 [Main]: Stills, the probe and the close-out

- [ ] **Stills:** `lofi-final-r2` (hash equals Task 1's baseline: if not, find the difference before closing); HiFi 9:16 and 16:9 per shot level. Send them with board 01's keyframes (SendUserFile, `proactive`).
- [ ] **Probe:** `hifiProbe` per theme at 3024×1964 and low-fi; texture memory per level (level 1, level 2, endless) through `renderer.info.memory`. If the HiFi mean passes 16.7 ms, record it and tell Caedon with the biggest costs (draw calls, shadow map, MSAA) before closing.
- [ ] **Ledger close-out:** `git diff --stat 9132bae..HEAD -- src/`; generic hooks vs HiFi-only; credits against about 750; the gap to the reference; the modularity read in three sentences. **Commit** (`docs: round 2 close-out: stills, frame cost, credits, the modularity read`).

---

### Task 27 [Main]: Whole-branch review

- [ ] Use superpowers:requesting-code-review for one review of `9132bae..HEAD` by a fresh reviewer on `model: "fable"`. Fix what it confirms (each fix through a subagent with its own test, RED then GREEN), re-run `npm test` and `npm run build`, re-shoot the low-fi still, and log each finding and fix in the ledger's Final review.

---

### Task 28 [Main]: Hand back

- [ ] Update the memory note `milkshake-hifi-test.md` (round 2 state, head commit, credits, what sub-project 5 needs) and `MEMORY.md`'s line for it.
- [ ] superpowers:finishing-a-development-branch, offering the push and PR gate with AskUserQuestion: "Push `hi-fi-city` and open a draft PR?" with options "Stack on hi-fi-test (PR #5's branch)", "Onto feat/v1 after PR #5 merges", "Not yet". Nothing is pushed without his answer; never merge.
