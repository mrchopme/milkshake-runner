---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-16
---

# Contribution Interface (levels and assets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Point-in-time plan written 2026-10-16 on `plan/contribution-interface` (base `main` b601511). Patterns may have
> moved since; read the current `src/`, `scripts/` and `test/` before acting. The chip "Fix validator lane-escape gap
> for stacked placements" may land in `src/validate.js` and `scripts/level-lab.js` meanwhile; this plan touches neither.

**Goal:** A friend with any Claude and a GitHub account makes a level from a prompt, plays it in the live game before it merges, and submits it through an issue form that a bot checks and turns into a pull request; a coding agent in the repo gets the same recipe; a vibe-coded content module gets automatic feedback before a human reads it.

**Architecture:** Documents carry the recipe (CONTRIBUTING §0, a §2 paragraph, README, `AGENTS.md`); the live game grows one data path, `?try=<url>` (a pure function in `src/levels.js`, six lines of wiring in `src/main.js`); GitHub carries the inbox (an issue form, a workflow, a 30-line Node script) and the gates (the lab's `play` on every changed level in CI); the test suite grows one file that calls every content module the way `src/world.js` does. The validator and the lab are called, never re-implemented.

**Tech Stack:** Node 22+ ES modules, `node:test`, GitHub Actions (`actions/checkout`, `actions/setup-node`, the runner's `gh`). No new dependencies.

**Spec:** `docs/specs/2026-10-16-contribution-interface-design.md` (§2 holes and checked facts, §3 goals and anti-goals, §4 the three pieces, §5 constraints, §7 decisions to veto).

## Global Constraints

- No new npm dependencies (`package.json` has `three` and `vite` only); no GitHub Action beyond `actions/checkout@v4` and `actions/setup-node@v4`, already in use.
- `src/` changes limited to `tryLevel` in `src/levels.js` and its wiring in `src/main.js`; `src/validate.js`, `src/generator.js`, `src/rules.js`, `src/registry.js` and `scripts/level-lab.js` are untouched.
- The validator stays the single source of truth: nothing re-implements a validation rule; the lab's gates and bands are not changed.
- Contributed code never runs in a job that holds a write token; the issue form takes levels (data) only.
- Level ids `a-z0-9-`, 1–60 characters, file name equals id; `levels/index.json` and `levels/campaign.json` are not edited.
- Docs carry `provenance: agent-generated`, `last-verified: never`, and are written as point-in-time snapshots.
- Deliberate shortcuts carry a `// ponytail:` (or `# ponytail:`) comment naming the ceiling and the upgrade path.
- Tests first; one commit per task; `npm test` and `npm run build` green at every commit; commit messages end with the session's `Co-Authored-By` trailer.
- Gates that stay with Caedon: push, pull request, the `level` label, the Actions pull-request setting, the first test issue, any install beyond `npm ci`.

## Review Focus

1. An issue body with CRLF line endings, or a textarea left empty (`_No response_`): the bot must find the JSON block or say "no JSON block", never print a stack trace. Test in Task 3.
2. A `?try` URL whose level reuses a shipped id (someone copies Broadway and changes the sky): refused with "already a level"; the shipped level is never overwritten in memory. Test in Task 2.
3. A new file under `levels/` while the suite runs: nothing may pin the list of level files (Task 1), and no test may write into the real `levels/` directory, because `node --test` runs files in parallel (Task 3's CLI test takes a directory argument and uses a temp dir).
4. A content module whose `createView` needs the DOM (`content/props/billboard.js` draws a canvas glyph): the smoke test skips it with a reason instead of failing the shipped build; a module that throws for any other reason fails. Test in Task 4.
5. A pull request that only edits `index.json` or `campaign.json`, or deletes a level: the CI scoring step must score nothing and pass. No unit test can run a workflow; Task 1 pins it by construction (`--diff-filter=AM`, the index/campaign filter, `exit $status`) and the first pull request after the merge is the check.

---

### Task 1: CI treats a contributed level as first-class

**Files:**
- Modify: `test/level-lab.test.js:3` (import) and `:154` (the pinned list)
- Modify: `.github/workflows/ci.yml` (one step after `npm test`)
- Modify: `package.json` (the `build` script)

**Interfaces:**
- Produces: `dist/content-sheet.txt`, the lab's `sheet` output, in every build and so on the live site at `https://mrchopme.github.io/milkshake-runner/content-sheet.txt` (Task 5 links it).

- [ ] **Step 1: Show the hole.** Create a scratch level and run the suite:

```bash
node -e "const f=require('fs');const l=JSON.parse(f.readFileSync('levels/fifth-avenue-dusk.json','utf8'));l.id='zz-scratch';f.writeFileSync('levels/zz-scratch.json',JSON.stringify(l,null,2)+'\n')"
npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]|✖'
```
Expected: `✖` on `check runs the validator on a file by its name`, `fail 1`, everything else passing (the copy validates: Fifth Avenue's theme sections sit on 120 m lines).

- [ ] **Step 2: Replace the pinned list** at `test/level-lab.test.js:154` with the directory listing, and add `readdirSync` to the `node:fs` import on line 3:

```js
  const onDisk = readdirSync(fileURLToPath(new URL('../levels/', import.meta.url))).filter((f) => f.endsWith('.json') && !['index.json', 'campaign.json'].includes(f)).map((f) => f.slice(0, -5)).sort();
  assert.deepEqual(loadLevelFile(file).allIds.sort(), onDisk); // every file under levels/: a contributed level must never break the suite
  assert.ok(onDisk.includes('01-broadway') && onDisk.includes('fifth-avenue-dusk'));
```

- [ ] **Step 3: Run the suite with the scratch level, then without it**

```bash
npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]'
rm levels/zz-scratch.json
npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]'
```
Expected: `fail 0` both times (`pass 120` the second time).

- [ ] **Step 4: Score changed levels in CI.** In `.github/workflows/ci.yml`, after the `- run: npm test` step and before `- run: npm run build`, add:

```yaml
      - name: Score changed levels
        if: github.event_name == 'pull_request'
        env:
          BASE: ${{ github.base_ref }}
        run: |
          git fetch --no-tags --depth=1 origin "$BASE"
          status=0
          for f in $(git diff --name-only --diff-filter=AM "origin/$BASE" HEAD -- 'levels/*.json' | grep -Ev '/(index|campaign)\.json$' || true); do
            node scripts/level-lab.js play "$f" > card.txt 2>&1 || status=1
            { echo "### $f"; echo '```'; cat card.txt; echo '```'; } | tee -a "$GITHUB_STEP_SUMMARY"
          done
          exit $status
```
(`HEAD` on a `pull_request` run is the merge of the branch into the base, so the two-dot diff is exactly the pull request's change; a failed gate fails the job and the card is in the log and the summary either way.)

- [ ] **Step 5: Publish the content sheet with the build.** In `package.json`, change the `build` script to:

```json
    "build": "vite build && node scripts/level-lab.js sheet > dist/content-sheet.txt",
```

- [ ] **Step 6: Verify the YAML and the build**

```bash
ruby -ryaml -e 'YAML.load_file(ARGV[0]); puts "yaml ok"' .github/workflows/ci.yml
npm run build 2>&1 | tail -2 && head -3 dist/content-sheet.txt && ls dist/content-sheet.txt
```
Expected: `yaml ok`; the build ends cleanly; the first line of the sheet is `## Obstacles`.

- [ ] **Step 7: Commit**

```bash
git add test/level-lab.test.js .github/workflows/ci.yml package.json
git commit -m "fix: a contributed level never breaks the suite; CI scores every level a pull request changes; the content sheet ships with the build"
```

---

### Task 2: `?try=<url>` plays a level from GitHub before it is merged

**Files:**
- Modify: `src/levels.js` (import `validateLevel`; add `TRY_HOSTS`, `TRY_MAX`, `tryLevel`)
- Modify: `src/main.js` (import `tryLevel`; six lines before `const { level } = params();`, currently line 141)
- Test: `test/try.test.js` (new)

**Interfaces:**
- Produces: `tryLevel(url, { levels, registry, fetch = globalThis.fetch }) → Promise<{ id, level, errors }>`. `errors` is `[]` when the level may be played; otherwise one message per problem (the validator's list, or one line for a bad URL, host, fetch, size or JSON). `id` and `level` are `null` until the JSON parsed; `levels` is the loaded map (ids are its keys). Never throws. `TRY_HOSTS = ['raw.githubusercontent.com', 'gist.githubusercontent.com']`, `TRY_MAX = 65536` (characters).
- Task 3's bot and Task 5's docs build the play link as `https://mrchopme.github.io/milkshake-runner/?try=<raw URL>`.

- [ ] **Step 1: Write the failing tests** in `test/try.test.js`:

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from '../src/registry.js';
import { tryLevel, TRY_HOSTS, TRY_MAX } from '../src/levels.js';
import { discover } from './helpers.js';

let registry;
before(async () => { registry = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url)))); });
const fifth = JSON.parse(readFileSync(new URL('../levels/fifth-avenue-dusk.json', import.meta.url), 'utf8'));
const levels = { '01-broadway': { id: '01-broadway', title: 'Broadway' }, 'fifth-avenue-dusk': fifth };
const RAW = 'https://raw.githubusercontent.com/someone/levels/main/park.json';
const serve = (body, status = 200) => async () => ({ ok: status < 400, status, text: async () => body });
const park = { ...fifth, id: 'park-dash' };
const json = (level) => JSON.stringify(level);

test('a level by URL plays under its own id when it validates', async () => {
  const r = await tryLevel(RAW, { levels, registry, fetch: serve(json(park)) });
  assert.deepEqual(r.errors, []);
  assert.equal(r.id, 'park-dash');
  assert.equal(r.level.title, fifth.title);
});

test('only GitHub raw and gist hosts, over https', async () => {
  assert.deepEqual(TRY_HOSTS, ['raw.githubusercontent.com', 'gist.githubusercontent.com']);
  for (const url of ['https://example.com/park.json', 'http://raw.githubusercontent.com/x/y/main/park.json', 'not a url']) {
    const r = await tryLevel(url, { levels, registry, fetch: serve(json(park)) });
    assert.equal(r.errors.length, 1, url);
    assert.equal(r.id, null, url);
  }
  assert.match((await tryLevel('https://example.com/park.json', { levels, registry, fetch: serve(json(park)) })).errors[0], /raw\.githubusercontent\.com/);
  const gist = await tryLevel('https://gist.githubusercontent.com/someone/abc123/raw/park.json', { levels, registry, fetch: serve(json(park)) });
  assert.deepEqual(gist.errors, []);
});

test('a failed fetch, broken JSON and an oversize file are reported, never thrown', async () => {
  assert.match((await tryLevel(RAW, { levels, registry, fetch: serve('', 404) })).errors[0], /404/);
  assert.match((await tryLevel(RAW, { levels, registry, fetch: serve('{ "id": "park-dash", ') })).errors[0], /JSON/);
  assert.match((await tryLevel(RAW, { levels, registry, fetch: serve(' '.repeat(TRY_MAX + 1)) })).errors[0], /KB/);
  assert.match((await tryLevel(RAW, { levels, registry, fetch: async () => { throw new Error('offline'); } })).errors[0], /offline/);
});

test('an id already in the game is refused, and the loaded level is untouched', async () => {
  const r = await tryLevel(RAW, { levels, registry, fetch: serve(json({ ...park, id: '01-broadway' })) });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /already a level/);
  assert.equal(levels['01-broadway'].title, 'Broadway');
});

test('validation errors come through whole, with the id', async () => {
  const r = await tryLevel(RAW, { levels, registry, fetch: serve(json({ ...park, obstacles: { unicorn: 1 }, density: { start: 2, end: 0 } })) });
  assert.ok(r.errors.length >= 2);
  assert.ok(r.errors.some((e) => /unicorn/.test(e)) && r.errors.some((e) => /density/.test(e)));
  assert.equal(r.id, 'park-dash');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/try.test.js 2>&1 | grep -E 'pass [0-9]|fail [0-9]|✖|SyntaxError'`
Expected: a SyntaxError on the import (`tryLevel` is not exported), so every test fails.

- [ ] **Step 3: Implement `tryLevel` in `src/levels.js`** with the signature above. Order of checks, each producing one message: `new URL(url)` fails → `not a URL`; protocol not `https:` or hostname not in `TRY_HOSTS` → a message naming both hosts; `fetch(u.href)` throws or `!res.ok` → `could not fetch it (<status or message>)`; `text.length > TRY_MAX` → `the file is over 64 KB`; `JSON.parse` fails → `not valid JSON (<message>)`. Then `id = typeof level?.id === 'string' ? level.id : ''`; if `levels[id]` → `"<id>" is already a level in the game; give yours another id`; else `errors = validateLevel(level, { fileId: id, allIds: [...Object.keys(levels), id], registry })` and return `{ id: id || null, level, errors }`. Comment `TRY_HOSTS` with `// ponytail: GitHub only, so every shared level sits where Caedon can moderate and a URL names an account; widen when another host earns it`.

- [ ] **Step 4: Run the tests**

Run: `node --test test/try.test.js 2>&1 | grep -E 'pass [0-9]|fail [0-9]|✖'`
Expected: `pass 5`, `fail 0`.

- [ ] **Step 5: Wire it in `src/main.js`.** Import `tryLevel` from `./levels.js`. Immediately before `const { level } = params();` add:

```js
  const tryUrl = new URLSearchParams(location.search).get('try');
  if (tryUrl) { // a level by URL, played before it merges (CONTRIBUTING §0): its own id, which must be free in this build
    const tried = await tryLevel(tryUrl, { levels, registry });
    if (tried.errors.length) return showErrors({ [tryUrl]: tried.errors });
    levels[tried.id] = tried.level;
    return startLevel(tried.id);
  }
```
(`valid(tried.id)` is true because no `<id>.json` error exists; `startLevel` records the best score under that id like any other level; the Hatch `params()` still returns `try` inside its opaque `context`.)

- [ ] **Step 6: Whole suite and build**

Run: `npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]' && npm run build 2>&1 | tail -1`
Expected: `pass 125`, `fail 0`; the build ends cleanly.

- [ ] **Step 7: Check it in the browser pane** (dev server from `.claude/launch.json`, or Vite on a strict port). Load, in turn:
  1. `/milkshake-runner/?try=https://raw.githubusercontent.com/mrchopme/milkshake-runner/main/test/fixtures/levels/demo-canal-street-dash.json` → the error screen, the URL as the file name, unknown ids `demo/boulder`, `demo/forest` and friends listed.
  2. `/milkshake-runner/?fixtures&try=` + the same URL (dev only: the fixture pack joins the registry) → the help screen on a fresh browser, then the level starts; `read_console_messages` shows no error.
  3. `/milkshake-runner/?try=https://raw.githubusercontent.com/mrchopme/milkshake-runner/main/levels/fifth-avenue-dusk.json` → the error screen, `"fifth-avenue-dusk" is already a level in the game`.
  4. `/milkshake-runner/?try=https://example.com/x.json` → the error screen naming the two allowed hosts.
  Take one screenshot of 1 and one of 2 for the report.

- [ ] **Step 8: Commit**

```bash
git add src/levels.js src/main.js test/try.test.js
git commit -m "feat: ?try=<url> plays a level from GitHub before it is merged"
```

---

### Task 3: The submission bot: script, issue form, workflow

**Files:**
- Create: `scripts/submit-level.js`
- Create: `.github/ISSUE_TEMPLATE/level.yml`
- Create: `.github/workflows/level-submission.yml`
- Test: `test/submit-level.test.js` (new)

**Interfaces:**
- Produces: `extractLevel(body) → level` (the parsed object; throws an `Error` with a one-line message: `no JSON block found…`, `the level is not valid JSON: …`, `the level must be a JSON object`, `id must be 1-60 characters of a-z, 0-9 and -`); `writeLevel(body, dir) → { path, level }` (writes `<dir>/<id>.json`, two-space indented, trailing newline; throws `id "<id>" is already a level in the game; pick another` when the file exists); CLI `node scripts/submit-level.js [dir]` reads `ISSUE_BODY` from the environment, defaults `dir` to the repo's `levels/`, prints `id=<id>` and `title=<title on one line, 60 chars max>` on stdout for `$GITHUB_OUTPUT`, or the message on stderr with exit code 1.
- Consumes: Task 2's play link shape; the lab CLI `node scripts/level-lab.js play <file>` (exit 1 on a failed gate, the card on stdout).

- [ ] **Step 1: Write the failing tests** in `test/submit-level.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractLevel, writeLevel } from '../scripts/submit-level.js';

const level = { id: 'park-dash', title: 'Park Dash', author: 'ari', length_m: 600 };
// What GitHub writes for a textarea with `render: json`, then the checkbox.
const form = (json) => `### Level JSON\n\n\`\`\`json\n${json}\n\`\`\`\n\n### House rules\n\n- [X] No real people, brands, team names or logos`;

test('the JSON block comes out of the issue form, CRLF included', () => {
  assert.deepEqual(extractLevel(form(JSON.stringify(level, null, 2))), level);
  assert.deepEqual(extractLevel(form(JSON.stringify(level, null, 2)).replace(/\n/g, '\r\n')), level);
  assert.throws(() => extractLevel('### Level JSON\n\n_No response_\n'), /no JSON block/);
  assert.throws(() => extractLevel(form('{ "id": "park-dash", ')), /not valid JSON/);
  assert.throws(() => extractLevel(form('[1, 2]')), /JSON object/);
  for (const id of ['Park Dash', '../../etc', 'a'.repeat(61), '', 42]) assert.throws(() => extractLevel(form(JSON.stringify({ ...level, id }))), /id must be/, String(id));
});

test('writeLevel writes <dir>/<id>.json once and refuses a taken id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'submit-'));
  try {
    const { path, level: written } = writeLevel(form(JSON.stringify(level)), dir);
    assert.equal(path, join(dir, 'park-dash.json'));
    assert.deepEqual(written, level);
    const text = readFileSync(path, 'utf8');
    assert.deepEqual(JSON.parse(text), level);
    assert.equal(text, JSON.stringify(level, null, 2) + '\n');
    assert.throws(() => writeLevel(form(JSON.stringify(level)), dir), /already a level/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the CLI prints id and title for the workflow, or one line on stderr and exit 1', () => {
  const script = fileURLToPath(new URL('../scripts/submit-level.js', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'submit-cli-'));
  const run = (body) => spawnSync(process.execPath, [script, dir], { encoding: 'utf8', env: { ...process.env, ISSUE_BODY: body } });
  try {
    const ok = run(form(JSON.stringify({ ...level, title: 'Two\nlines  here' })));
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, 'id=park-dash\ntitle=Two lines here\n');
    assert.ok(existsSync(join(dir, 'park-dash.json')));
    const taken = run(form(JSON.stringify(level)));
    assert.equal(taken.status, 1);
    assert.match(taken.stderr, /already a level/);
    const bad = run(form('{ "id": "park-dash", '));
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not valid JSON/);
    assert.ok(!/\n\s+at /.test(bad.stderr), 'no stack trace');
    const empty = spawnSync(process.execPath, [script, dir], { encoding: 'utf8', env: { ...process.env, ISSUE_BODY: '' } });
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /no JSON block/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/submit-level.test.js 2>&1 | grep -E 'pass [0-9]|fail [0-9]|✖|Cannot find'`
Expected: the import fails (`Cannot find module … submit-level.js`).

- [ ] **Step 3: Implement `scripts/submit-level.js`** with the exports and CLI above. The fence regex is `/```json\s*\n([\s\S]*?)\n\s*```/` (the `\s*` on both sides absorbs `\r`); the id rule is `/^[a-z0-9-]{1,60}$/` applied to `level.id` as a string; the title line is `String(level.title ?? level.id).replace(/\s+/g, ' ').trim().slice(0, 60)`; the CLI guard is the lab's (`process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`), the default directory `fileURLToPath(new URL('../levels', import.meta.url))`, errors go through `console.error(e.message); process.exitCode = 1`. Head comment: the script decides a safe file name; validation proper is the lab's, in the workflow.

- [ ] **Step 4: Run the tests**

Run: `node --test test/submit-level.test.js 2>&1 | grep -E 'pass [0-9]|fail [0-9]|✖'`
Expected: `pass 3`, `fail 0`.

- [ ] **Step 5: Write the issue form** `.github/ISSUE_TEMPLATE/level.yml`:

```yaml
name: Submit a level
description: Add a level you made with Claude (or by hand). A bot checks it, lets you play it, and opens the pull request for you.
title: "Level: "
labels: [level]
body:
  - type: markdown
    attributes:
      value: |
        Paste the whole level file below. The bot validates it, plays it a hundred times, and replies here with a link to play it in the live game and a pull request. If a check fails, edit this issue and the checks run again. How to make one: [CONTRIBUTING.md §0](https://github.com/mrchopme/milkshake-runner/blob/main/CONTRIBUTING.md#0-make-a-level-with-claude).
  - type: textarea
    id: level
    attributes:
      label: Level JSON
      description: The complete contents of your levels/<id>.json
      render: json
    validations:
      required: true
  - type: checkboxes
    id: rules
    attributes:
      label: House rules
      options:
        - label: No real people, brands, team names or logos; this level is mine to give and may ship in the game
          required: true
```

- [ ] **Step 6: Write the workflow** `.github/workflows/level-submission.yml`:

```yaml
name: level submission
on:
  issues:
    types: [opened, edited]
permissions:
  contents: write
  pull-requests: write
  issues: write
concurrency:
  group: level-${{ github.event.issue.number }}
  cancel-in-progress: true

# ponytail: one job holds the write token because a level is data and nothing contributed executes (the code that runs is
# main's own); if a form for content modules is ever added, split the step that runs contributed code from the step that
# holds the token.
jobs:
  submit:
    if: contains(github.event.issue.labels.*.name, 'level')
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ github.token }}
      ISSUE: ${{ github.event.issue.number }}
      LOGIN: ${{ github.event.issue.user.login }}
      USER_ID: ${{ github.event.issue.user.id }}
      SITE: https://mrchopme.github.io/milkshake-runner/
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - id: level
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: node scripts/submit-level.js > out.txt 2> log.txt && cat out.txt >> "$GITHUB_OUTPUT"
      - env:
          ID: ${{ steps.level.outputs.id }}
        run: node scripts/level-lab.js play "levels/$ID.json" 2>&1 | tee card.txt | tee -a log.txt
      - run: npm test 2>&1 | tee -a log.txt | tail -3
      - name: Branch, pull request, reply
        env:
          ID: ${{ steps.level.outputs.id }}
          TITLE: ${{ steps.level.outputs.title }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git switch -c "level/$ID"
          git add "levels/$ID.json"
          git commit --author="$LOGIN <$USER_ID+$LOGIN@users.noreply.github.com>" -m "level: $TITLE (#$ISSUE, by @$LOGIN)"
          git push --force origin "level/$ID"
          PLAY="${SITE}?try=https://raw.githubusercontent.com/$GITHUB_REPOSITORY/level/$ID/levels/$ID.json"
          { echo "**$TITLE** by @$LOGIN, submitted in #$ISSUE. Play it before merging: $PLAY"; echo; echo '```'; cat card.txt; echo '```'; echo; echo "Closes #$ISSUE"; } > body.md
          PR=$(gh pr list --head "level/$ID" --state open --json url --jq '.[0].url // empty')
          if [ -n "$PR" ]; then gh pr edit "$PR" --body-file body.md
          else PR=$(gh pr create --head "level/$ID" --title "Level: $TITLE" --body-file body.md 2>>log.txt) || PR="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/compare/main...level/$ID?expand=1 (Actions may not open pull requests in this repo yet; open it from this link)"
          fi
          { echo "Your level passed every check. Play it now: $PLAY"; echo; echo "Pull request: $PR"; echo; echo '```'; cat card.txt; echo '```'; } | gh issue comment "$ISSUE" --body-file -
      - if: failure()
        run: |
          { echo "The checks did not pass. Edit this issue to fix the level and they run again. The last lines:"; echo; echo '```'; tail -40 log.txt 2>/dev/null || echo "(no log)"; echo '```'; echo; echo "Full log: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"; } | gh issue comment "$ISSUE" --body-file -
```
(GitHub's `run` shell is `bash -eo pipefail`: a failed gate or a failed suite fails its step and the failure comment carries the log's tail. A pull request opened with the token does not trigger `ci.yml`; the bot already ran the same checks, and the merge to `main` runs them again before anything deploys.)

- [ ] **Step 7: Verify the YAML and the whole suite**

```bash
ruby -ryaml -e 'ARGV.each { |f| YAML.load_file(f) }; puts "yaml ok"' .github/ISSUE_TEMPLATE/level.yml .github/workflows/level-submission.yml
npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]'
```
Expected: `yaml ok`; `pass 128`, `fail 0`.

- [ ] **Step 8: Commit**

```bash
git add scripts/submit-level.js test/submit-level.test.js .github/ISSUE_TEMPLATE/level.yml .github/workflows/level-submission.yml
git commit -m "feat: Submit a level issue form, and the bot that checks it, branches it and opens the pull request"
```

A workflow runs only from `main`, so the live check is Caedon's after the merge: create the `level` label, allow Actions to open pull requests (both one-liners in the handoff section), open a test issue with `levels/fifth-avenue-dusk.json` under a new id, and watch the bot reply.

---

### Task 4: Every content module draws in Node, and every obstacle's box agrees with its move

**Files:**
- Test: `test/content-smoke.test.js` (new; no source change)

**Interfaces:**
- Consumes: `buildRegistry`, `discover`, `gfx`, `resolveRules`, `passable`, `rng`, `ROAD_HALF` from `src/world.js`, and the call shapes in `src/world.js:48-71`: obstacle `createView(gfx, o)`, pickup `createView(gfx)`, prop `createView(gfx, { z, length, lanes })`, theme `createChunk(gfx, { z0, length, lanes, rng, theme })`, character `await createView(gfx)`.

- [ ] **Step 1: Write the tests** in `test/content-smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as gfx from '../src/gfx.js';
import { buildRegistry } from '../src/registry.js';
import { resolveRules } from '../src/rules.js';
import { passable, rng } from '../src/generator.js';
import { ROAD_HALF } from '../src/world.js';
import { discover } from './helpers.js';

// Every registered module (shipped, Newark and the fixture pack) is called the way src/world.js calls it. A vibe-coded module that
// throws, returns no object, or declares a box its move cannot clear fails here, before anyone opens the game.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const registry = buildRegistry([...(await discover(here('../content/'))), ...(await discover(here('./fixtures/content/')))]);
const R = resolveRules();
const lanes = { count: 3, width: R.laneWidth, roadHalf: ROAD_HALF };
const needsDom = (e) => e instanceof ReferenceError && /\b(document|window|navigator|Path2D|OffscreenCanvas)\b/.test(e.message);
async function draws(t, make) {
  let view;
  try { view = await make(); } catch (e) { if (needsDom(e)) return t.skip('needs the DOM: checked in the browser, not here'); throw e; } // ponytail: Node has no canvas; a module that labels itself is only checked where one exists
  assert.ok(view && view.object && view.object.isObject3D, 'createView returns { object: an Object3D }');
  view.dispose?.();
}

for (const def of Object.values(registry.obstacle)) test(`obstacle "${def.id}" draws, and its box agrees with its move`, async (t) => {
  assert.equal(passable(def, R), def.avoid === 'jump' || def.avoid === 'slide', `avoid "${def.avoid}" with box ${JSON.stringify(def.box)}: a jump box stands on the ground and fits under a jump, a slide box leaves ${R.slideHeight} m to slide under, a lane or timing box does neither`);
  await draws(t, () => def.createView(gfx, { id: def.id, lane: 1, z: 120, moveTo: null, def }));
});
for (const def of Object.values(registry.pickup)) if (def.createView) test(`pickup "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx)));
for (const def of Object.values(registry.prop)) test(`prop "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx, { z: 120, length: def.length, lanes })));
for (const def of Object.values(registry.theme)) if (def.createChunk) test(`theme "${def.id}" builds a chunk`, (t) => draws(t, () => ({ object: def.createChunk(gfx, { z0: 0, length: 120, lanes, rng: rng(1), theme: def }) })));
for (const def of Object.values(registry.character)) test(`character "${def.id}" draws`, (t) => draws(t, () => def.createView(gfx)));
```

- [ ] **Step 2: Run it**

Run: `node --test test/content-smoke.test.js 2>&1 | grep -E 'pass [0-9]|fail [0-9]|skipped [0-9]|✖|SKIP'`
Expected: `fail 0`; `prop "billboard" draws` is skipped (its canvas glyph needs the DOM); everything else passes. If a shipped or Newark module fails the box rule, stop and report: that is a finding about the module, not a reason to loosen the rule.

- [ ] **Step 3: Prove it catches a bad module.** Create `content/obstacles/zz/wall.js` with `{ kind: 'obstacle', id: 'zz/wall', avoid: 'jump', box: { w: 1, h: 3, d: 1 }, createView() { return {}; } }`, run the file, expect `✖` on `obstacle "zz/wall"` on the box line; delete the file; run again, expect `fail 0`.

- [ ] **Step 4: Whole suite**

Run: `npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]|skipped [0-9]'`
Expected: `fail 0`, `skipped 1` or more, pass count above 150.

- [ ] **Step 5: Commit**

```bash
git add test/content-smoke.test.js
git commit -m "test: every content module draws in Node and every obstacle's box agrees with its move"
```

---

### Task 5: The author kit: CONTRIBUTING §0, a §2 paragraph, README, agent notes

**Files:**
- Modify: `CONTRIBUTING.md` (new §0 before `## 1. Add a level`; §1 steps 3 and 4; a new subsection at the end of §2's introduction, before `### Obstacle`)
- Modify: `README.md` (one bullet)
- Create: `AGENTS.md`, `CLAUDE.md` (repo root)
- Modify: `docs/specs/2026-10-15-level-learning-loop-model.md` (one line under `## 10`)

**Interfaces:**
- Consumes: the content sheet URL (Task 1), `?try=` (Task 2), the issue form name "Submit a level" and the CI scoring step (Tasks 1 and 3), the smoke test's three checks (Task 4).

- [ ] **Step 1: Add §0 to `CONTRIBUTING.md`**, between the intro paragraphs and `## 1. Add a level`, verbatim:

````markdown
## 0. Make a level with Claude

You need nothing installed. Give Claude (or any coding agent) this prompt, with your idea in the last line:

> You are writing a level for Milkshake Runner, a three-lane endless runner. Read the format in §1 of
> https://github.com/mrchopme/milkshake-runner/blob/main/CONTRIBUTING.md and the content you may name (obstacles,
> pickups, props, themes, endings, rules) in https://mrchopme.github.io/milkshake-runner/content-sheet.txt. Write one
> JSON file, `levels/<id>.json`, id in a-z 0-9 and -, `author` set to my GitHub handle. Make it fun: speed `end` at
> least 1.8 × `start`; density rising by 0.25 or more; a mix of jump, slide and lane obstacles so the player acts 15 to
> 40 times a minute; a set piece every 300 m or so (a turn, a dip with an overpass, a tunnel with a low camera, a bridge
> theme with railings on 120 m lines, a sprint at fixed density); 10 to 16 jugs per 100 m and a power-up or two; 45 to
> 180 seconds long at those speeds. If you can run `npm run lab -- check` and `npm run lab -- play` on the file, do:
> fix every failed gate and every warning my idea does not justify, then set `seed` to the ship seed it proposes. If you
> cannot run them, leave `seed` out and tell me. No real people, brands, team names or logos. My idea: <your idea here>

Then open **Submit a level** under [Issues](https://github.com/mrchopme/milkshake-runner/issues/new/choose) and paste
the JSON. A bot validates it, plays it a hundred times with a reaction-limited bot, and replies with a link to play it
in the live game and a pull request. If a check fails it says which; edit the issue and the checks run again. Once
merged, the level is listed under **Levels** with your name.

With the repo cloned (`npm ci`), the same loop is `npm run lab -- sheet`, `npm run lab -- check levels/<id>.json`,
`npm run lab -- play levels/<id>.json`, then `npm run dev` and `?level=<id>`, then a pull request; CI scores every
level a pull request adds or changes. Any level file on GitHub plays in the live game before it merges:
`https://mrchopme.github.io/milkshake-runner/?try=<its raw.githubusercontent.com or gist.githubusercontent.com URL>`
(a raw URL lags an edit by up to five minutes).
````

- [ ] **Step 2: Update §1 steps 3 and 4** to:

```markdown
3. Check it: `npm ci && npm test`, then `npm run lab -- check levels/<id>.json` and `npm run lab -- play levels/<id>.json` (the gates CI runs), then `npm run dev` and play it from **Levels**.
4. Open a pull request. No fork and no install: the **Submit a level** issue form does the same (§0).
```

- [ ] **Step 3: Add the vibe-coding subsection to §2**, after the paragraph that begins "Complete, working examples live in" and before `### Obstacle`, verbatim:

```markdown
### Vibe-coding a module

Give Claude this section and the examples in `test/fixtures/content/`, and ask for one file at
`content/<kind>s/<handle>/<name>.js`. `npm test` is the gate: the module registers (shape, folder, id), it draws in
Node with the game's `gfx` and returns `{ object }` (a module that labels itself with a canvas texture is checked in
the browser instead), and an obstacle's box agrees with its move (a `jump` box stands on the ground and fits under a
jump, a `slide` box leaves room to slide under, a `lane` box does neither). See it with `npm run dev` in any level that
names its id. Modules are code, so they arrive as a pull request from a fork (GitHub's web editor is enough: add the
file, open the pull request), CI runs the checks, and a person reads the code before it merges. The issue form takes
levels only.
```

- [ ] **Step 4: README.** After the bullet that begins "- Levels 1 and 2 are built in", add:

```markdown
- Make a level with Claude, nothing installed: [CONTRIBUTING.md §0](CONTRIBUTING.md#0-make-a-level-with-claude), then the **Submit a level** issue form. Any level file on GitHub plays live with `?try=<raw URL>`.
```

- [ ] **Step 5: Agent notes.** Create `AGENTS.md`:

```markdown
# Working in this repo as an agent

Milkshake Runner is a three.js endless runner. Levels are JSON files in `levels/`; content (obstacles, pickups, props,
themes, characters, endings) is one-file modules in `content/`; `src/` is the engine, and a contribution never edits it.

- To make or check a level: CONTRIBUTING.md §0 and §1, then `npm run lab -- check levels/<id>.json` and
  `npm run lab -- play levels/<id>.json`; every gate must pass, and a band warning stands only if the idea justifies it;
  set `seed` to the proposed ship seed; `npm run dev` and `?level=<id>` to play it.
- To make a content module: CONTRIBUTING.md §2 and the examples in `test/fixtures/content/`; `npm test` is the gate.
- `npm test` and `npm run build` stay green. No new dependencies. A level goes in through a pull request or the
  **Submit a level** issue form; a module goes in through a pull request.
```
and `CLAUDE.md` containing the single line `@AGENTS.md`.

- [ ] **Step 6: Mark §10 of the model doc superseded.** Under `## 10. How to run the loop …` in `docs/specs/2026-10-15-level-learning-loop-model.md`, add as the first line of the section:

```markdown
> Superseded 2026-10-16 by CONTRIBUTING §0 ("Make a level with Claude") and the Submit a level bot; kept as the record of the first run.
```

- [ ] **Step 7: Check the links and the anchor**

```bash
grep -c "content-sheet.txt\|?try=\|Submit a level" CONTRIBUTING.md README.md AGENTS.md
grep -n "^## 0. Make a level with Claude" CONTRIBUTING.md
npm test 2>&1 | grep -E 'pass [0-9]|fail [0-9]'
```
Expected: counts above 0 for each file; the §0 heading present (GitHub's anchor for it is `#0-make-a-level-with-claude`); `fail 0`.

- [ ] **Step 8: Commit**

```bash
git add CONTRIBUTING.md README.md AGENTS.md CLAUDE.md docs/specs/2026-10-15-level-learning-loop-model.md
git commit -m "docs: make a level with Claude (CONTRIBUTING §0), vibe-coding a module, README, agent notes"
```

---

## Handoff and Caedon's gates

After Task 5 and the whole-branch review: push and pull request on Caedon's word, never before. After the merge, three
one-liners that are his (the bot cannot run without the first, and opens pull requests only with the second):

```bash
gh label create level --color 5319e7 --description "A level submitted through the Submit a level form"
```

```bash
gh api -X PUT repos/mrchopme/milkshake-runner/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true
```

Then a test issue: **Submit a level** with the contents of `levels/fifth-avenue-dusk.json` under a new id (say
`fifth-avenue-test`); expected within two minutes: a comment with the card, a play link that works, and a pull request
(or the compare link if the setting is off). Close the test pull request without merging; delete its branch.

Noticed, not in scope: the repo has no LICENSE file, so what a contributor grants is undefined; the form's checkbox says
"mine to give and may ship in the game" until Caedon picks a license.

## Self-review notes (2026-10-16)

- Spec coverage: §4.1 → Task 5 (and Task 1 for the sheet); §4.2 → Task 2; §4.3 → Task 3 (form, workflow, script) and Task 1 (CI scoring step); §4.4 → Task 4 and Task 5's §2 paragraph; §2's pinned-list hole → Task 1; §7 decisions appear in the tasks as written.
- Review Focus: 1 → Task 3 tests (CRLF, `_No response_`, empty body); 2 → Task 2 test "an id already in the game is refused"; 3 → Task 1 (listing) and Task 3 (temp dir, `[dir]` argument); 4 → Task 4 (`needsDom`, the billboard); 5 → Task 1 by construction, checked by the first pull request after the merge.
- Names used consistently: `tryLevel`, `TRY_HOSTS`, `TRY_MAX` (Task 2, Task 3's link, Task 5's text); `extractLevel`, `writeLevel`, the `id=`/`title=` output (Task 3's script, tests and workflow); `content-sheet.txt` (Tasks 1 and 5); the `level` label (Task 3 form, workflow, handoff).
- Test counts (120 before): Task 2 adds 5, Task 3 adds 3, Task 4 adds one per module with a view (about 40, one skipped). The counts in the steps are the minimum expected; `fail 0` is what matters.
- Proportion: the plan's code is the tests, two YAML files and the exact copy for the documents, which the spec fixes; the three implementations (`tryLevel`, `submit-level.js`, the wiring) are given as signatures and ordered checks.
