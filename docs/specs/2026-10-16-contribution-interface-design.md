---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-16
---

# Contribution interface for vibe-coded levels and assets: design (2026-10-16)

> Point-in-time snapshot, written 2026-10-16 in the planning session that followed the level learning loop
> (PR #15, `main` b601511). Caedon skipped the brainstorm ("lets skip the questions"), so every call below is the
> agent's unless it is marked **Caedon**. Code pointers are to b601511; patterns may have moved since. Read the
> current code before acting on this document.

## Build notes (2026-10-19)

> Point-in-time notes from the build (PR #17, `feat/contribution-interface` at 96cfa82), written 2026-10-19. The
> sections below are the historical record and were not rewritten; where they and the code differ, the code is the
> authority: `.github/workflows/level-submission.yml`, `.github/workflows/ci.yml`, `src/levels.js`,
> `scripts/submit-level.js`, `test/content-smoke.test.js` and CONTRIBUTING.md.

- **R8** (§4.3 item 4): the bot's branch is `level/<issue number>` (`level/$ISSUE`), not `level/<id>`: an id-keyed
  `--force` push let any issue overwrite another contributor's pending branch and PR body. `gh pr edit` refreshes
  the title as well as the body; the play link is `…/level/<issue>/levels/<id>.json`.
- **R9** (§4.3): the `submit` job runs only while the issue is open
  (`github.event.issue.state == 'open' && contains(github.event.issue.labels.*.name, 'level')`), so later edits to a
  merged or declined issue do nothing.
- **R6** (§4.3, `ci.yml`): "Score changed levels" uses `git diff --no-renames --name-only --diff-filter=AM …`, so a
  level that replaces a similar deleted one is scored instead of hidden as a rename.
- **R7** (§2, §4.2): `src/levels.js` imports its two JSON files `with { type: 'json' }` and calls `import.meta.glob`
  inside `loadLevels`, so Node can import the module for `test/try.test.js`.
- **R2/R5** (§4.3 item 1): `scripts/submit-level.js` rejects a non-string `id` and treats a missing body as
  "no JSON block".
- **R3** (§5): CONTRIBUTING.md, README.md, AGENTS.md and CLAUDE.md carry no YAML frontmatter; the `provenance` and
  `last-verified` lines stay on the `docs/specs/` snapshots.
- **R1** (§4.2): in dev, `src/main.js` detects fixtures mode by substring on the whole query string, so any `?try`
  URL containing "fixtures" turns the pack on (production unaffected); with the pack on, the demo level's id is
  already taken, so `?fixtures&try=<demo URL>` is refused. The success path was checked with a stubbed `fetch`
  under a free id (`test/try.test.js`).
- Tests after the build: 153 pass, 1 skipped (`prop "billboard" draws`, needs the DOM).

## 1. Intent

**Caedon:** "improve and help create the interface for people to create and contribute vibe coded assets and levels
to the game." The first contributor, in his words: "a friend using Claude to vibe code a level from a prompt."

The moment to design for: the friend tells Claude what they want, Claude hands back a level, and within minutes
they are playing it in the live game and Caedon has a pull request with a scorecard he can merge without checking
anything out. The same path, with the repo cloned, is what a coding agent follows.

## 2. What exists (read at b601511)

- **Levels** are JSON files in `levels/`, bundled by a Vite glob at build time (`src/levels.js:6`); an unlisted
  file appears after the shipped ones, unlocked, by title (`src/campaign.js:6-10`); `?level=<id>` starts any valid
  loaded level (the Hatch adapter, `src/hatch.js`, `src/main.js:141`). `validateLevel` is the single source of
  truth; the lab (`npm run lab -- sheet | check | play`) prints the content sheet, validates a file and scores it
  over 100 seeds in about a third of a second (gates: survival, luck, window, file seed; bands warn).
- **Content** (an obstacle, pickup, prop, theme, character or ending) is a one-file ES module under
  `content/<kind>s/<handle>/<name>.js` with a namespaced id; `src/registry.js` checks shape, folder and id, the
  browser keeps good modules and lists broken ones on the Levels screen, and the tests build the same registry
  through `test/helpers.js`. A complete example pack sits in `test/fixtures/content/`.
- **Publishing**: GitHub Pages from `main` only (`.github/workflows/ci.yml`: `npm test`, `npm run build`, deploy).
  Pull requests run the tests and the build, nothing from the lab.
- **CONTRIBUTING.md** is the format reference for humans: fork, add the file, `npm test`, `npm run dev`, PR. It
  mentions neither the lab nor Claude. The fun model (model doc §3) and the recipe used for Fifth Avenue (§10) live
  only in an agent-generated snapshot under `docs/specs/`.
- **Repo settings** (read with `gh` on 2026-10-16): public, issues on, no branch protection, the Actions token is
  read-only by default and "allow GitHub Actions to create and approve pull requests" is off. There is no LICENSE
  file.
- **Holes**: `test/level-lab.test.js:154` pins the exact list of level files, so a new level file fails `npm test`
  and therefore CI today; a level cannot be played before it is merged; the content sheet exists only for someone
  with a Node checkout; CI does not run the lab's gates, so a PR's level is merged on trust.
- **Checked facts the design leans on**: `raw.githubusercontent.com` and `gist.githubusercontent.com` answer with
  `Access-Control-Allow-Origin: *` (fetched 2026-10-16), so the live game can fetch a level from either; every
  community string already renders through `textContent` (`src/main.js`, `src/hud.js`); GitHub's default `run`
  shell is `bash -eo pipefail`; a pull request opened with the workflow token does not trigger other workflows.

## 3. Goals, non-goals, anti-goals

Goals:

1. A person with any Claude and a GitHub account submits a level without installing anything, and plays it in the
   live game before it merges.
2. A person with Claude Code or another coding agent in the repo gets the same recipe automatically.
3. Caedon can merge a stranger's level on the scorecard alone: CI blocks what the lab blocks, on both paths.
4. A vibe-coded content module gets automatic feedback (it registers, it draws in Node, its box matches its move)
   before a human reads the code.

Non-goals: a level editor or a paste-to-play page inside the game; a "Community" heading in the level list (unlisted
levels already show with their author); taking code through the issue form; GLB or other 3D assets (that is the
HiFi track, draft PRs #5 and #10); changing the lab's gates or bands; the MCP app (its own research note);
moderation beyond the house rules.

Anti-goals, which would make this a failure even if it worked: contributed code running where a write token is;
`src/` growing a contribution system (the engine stays an engine); a second validator anywhere; a new npm
dependency; anything that needs a server.

## 4. The interface, in three pieces

### 4.1 The author kit (documents)

CONTRIBUTING gains a **§0 "Make a level with Claude"** ahead of the format reference, with:

- the prompt a friend pastes into Claude, with one slot for their idea: it names CONTRIBUTING §1 for the format,
  the content sheet on the live site for the ids, the fun model in six lines (speed `end` at least 1.8 × `start`,
  density rising 0.25 or more, a move mix that keeps the player acting 15–40 times a minute, a set piece every
  300 m or so, 10–16 jugs per 100 m plus a power-up, 45–180 s long), `author` = their GitHub handle, the house
  rules, and "run the lab if you can; if you cannot, leave `seed` out and say so";
- the two ways to submit: the **Submit a level** issue form, or a pull request with the repo cloned;
- the local loop in one line (`sheet`, `check`, `play`, `npm run dev`, `?level=<id>`);
- the try-by-URL line (§4.2).

The content sheet is published with every build (`npm run build` writes `dist/content-sheet.txt` from the lab's
`sheet`), so the live site always carries the current ids and nothing generated is committed. README gets a
three-line "Make a level with Claude" pointing at §0 and the form. A root `AGENTS.md`, imported by a root
`CLAUDE.md`, tells a coding agent working in the repo: levels are JSON in `levels/`, content is a module in
`content/`, follow CONTRIBUTING §0, check with `npm run lab`, never edit `src/` for a contribution. §10 of the model
doc gets one line saying CONTRIBUTING §0 superseded it.

### 4.2 Try-by-URL in the live game (`src/levels.js`, `src/main.js`)

`?try=<url>` fetches a level JSON from `raw.githubusercontent.com` or `gist.githubusercontent.com` (https only, at
most 64 KB), validates it with `validateLevel` against the full registry and the loaded level ids, and starts it.
Any failure (bad host, 404, broken JSON, an id already in the game, validation errors) shows on the existing error
screen with the URL as the file name, which is the author's feedback loop. The level is added under its own id,
which must be free; its best score is saved under that id like any other. The Hatch `?level` path is untouched;
`params()` keeps returning `try` inside its opaque `context`. Raw URLs lag an edit by up to five minutes; the kit
says so.

Why this exists: it is the one feature that makes the no-tooling path feel alive (the bot's reply says "play it
now"), it lets Caedon play a PR's level without checking it out, and anyone can share a level from a gist. About
twenty lines: the pure part in `src/levels.js`, six lines of wiring in `src/main.js`.

Security: a level is data; every string it carries renders through `textContent`; ids resolve only against the
registry; the host allow-list keeps shared levels on GitHub, where Caedon can moderate and where a URL names an
account; the fetch carries no credentials.

### 4.3 The submission bot (GitHub)

An issue form `.github/ISSUE_TEMPLATE/level.yml` ("Submit a level", label `level`): a textarea rendered as JSON
and a required checkbox for the house rules ("no real people, brands, team names or logos; this level is mine to
give and may ship in the game").

A workflow `.github/workflows/level-submission.yml` on `issues: [opened, edited]` for issues labelled `level`:

1. `scripts/submit-level.js` takes the issue body from the environment, finds the fenced JSON block, parses it,
   checks that `id` is 1–60 characters of `a-z0-9-` and not already a level in the game, writes
   `levels/<id>.json`, and prints `id=` and `title=` for the later steps. It decides a safe file name; validation
   proper stays the lab's.
2. `node scripts/level-lab.js play levels/<id>.json`: the validator, then the gates; the card is kept.
3. `npm test`: the suite's own rules (the 120 m theme-boundary rule among them).
4. Branch `level/<id>`, one commit authored to the submitter (`<login> <login@users.noreply.github.com>`),
   force-pushed; a pull request titled "Level: <title>" whose body is the card, the play link
   (`<site>?try=<raw URL of the branch's file>`) and `Closes #<issue>`; if a PR for the branch already exists its
   body is refreshed; if the repo does not let Actions open pull requests, the compare link is used instead.
5. A comment on the issue with the play link, the pull request and the card; on any failure, a comment with the
   last forty lines of the log and a link to the run, and the words "edit this issue and the checks run again".

One job holds the write token: a level is data and nothing contributed executes (the code that runs is `main`'s
own). `// ponytail:` note in the workflow: if a form for content modules is ever added, split the step that runs
contributed code from the step that holds the token. The bot's pull request does not trigger CI (token-opened PRs
never do); the bot already ran the same checks, and the merge to `main` runs them again before anything deploys.

`ci.yml` also gains one step on pull requests: `node scripts/level-lab.js play` on every added or modified
`levels/*.json` (not `index.json`, not `campaign.json`), card into the job summary, a failed gate fails the job.
The coding-agent path gets the same gates as the form.

**Caedon's one-time repo actions** (his gate, each one line): create the `level` label; allow Actions to create
pull requests under Settings → Actions → General (or live with the compare link); open the first test issue after
the merge, since an issue workflow runs only from `main`.

### 4.4 Assets (content modules)

Modules stay code and arrive as a pull request from a fork; GitHub's web editor is enough, no git needed. Fork
PRs run CI with a read-only token, and a human reads the code before it merges (CONTRIBUTING already says so).

What changes is the feedback. A new test file runs every registered module the way `src/world.js` does: an
obstacle's `createView(gfx, o)`, a pickup's `createView(gfx)` when it has one, a prop's
`createView(gfx, { z, length, lanes })`, a theme's `createChunk(gfx, { z0, length, lanes, rng, theme })` when it
has one, a character's awaited `createView(gfx)`; each must return `{ object }` with an `Object3D`. Every
obstacle's box must agree with its move under the default rules: `passable(def, rules)` is true exactly when
`avoid` is `jump` or `slide` (a jump box stands on the ground and fits under a jump, a slide box leaves room to
slide, a lane box does neither; timing is never passable). This generalises the shipped-three test in
`test/content.test.js`. CONTRIBUTING §2 gets a "vibe-coding a module" paragraph: the prompt (this section plus the
fixtures pack as examples), the checks, how to see it (`npm run dev` and a level that names the id), and the PR.

## 5. Constraints

- No new npm dependencies; GitHub Actions used: `actions/checkout`, `actions/setup-node` (already in use) and
  `gh`, which the runner ships.
- `src/` changes limited to the try-by-URL function in `src/levels.js` and its wiring in `src/main.js`; the
  validator, generator, rules and registry are untouched; the lab's gates and bands are untouched.
- Tests first, one commit per task, `npm test` and `npm run build` green at every commit; ponytail applies
  (`// ponytail:` on deliberate ceilings).
- Docs carry `provenance: agent-generated`, `last-verified: never`, written as point-in-time snapshots.
- Gates that stay with Caedon: push, pull request, the `level` label, the Actions setting, the first test issue,
  any install beyond `npm ci`.
- The chip "Fix validator lane-escape gap for stacked placements" (task_bcb5d5b1) is running in another session
  and touches `src/validate.js` and `scripts/level-lab.js`; this work touches neither, so a rebase should be clean.

## 6. Left to the builder

The exact wording of the kit, the form and the bot's comments; the test harness for `scripts/submit-level.js`
(the lab's CLI tests show the pattern: `spawnSync` on the script, a temp directory, `rmSync` after); how to trim
`npm test` output in the failure comment; whether the error screen's heading ("This build has problems") earns a
variant for a tried level, which it probably does not.

## 7. Decisions made without Caedon, to veto

1. Levels come in through a GitHub issue form; code comes in only through pull requests.
2. `?try=` fetches from GitHub raw and gist hosts only.
3. The bot needs one repo setting from Caedon to open pull requests itself; until then it posts a compare link.
4. The author kit lives in CONTRIBUTING (§0 and a §2 paragraph), not in a new document; the content sheet lives on
   the live site, generated at build time, never committed.
5. `src/` changes are the try-by-URL function and its wiring, nothing else.
6. No "Community" heading in the level list; no in-game editor; no code through the form.
7. Noticed, not fixed: the repo has no LICENSE file, so what a contributor grants is undefined; the form's checkbox
   says "mine to give and may ship in the game" until Caedon picks a license.
