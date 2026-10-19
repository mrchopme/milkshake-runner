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
