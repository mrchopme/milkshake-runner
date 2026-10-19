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
