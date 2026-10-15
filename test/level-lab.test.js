import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { street, simulate, loadRegistry, NOTICE, playtest, scorecard, finishTime, GATES, contentSheet, check, loadLevelFile } from '../scripts/level-lab.js';
import { generate, normalizeLevel, rng } from '../src/generator.js';
import { resolveRules } from '../src/rules.js';
import { buildRegistry } from '../src/registry.js';
import { validateLevel } from '../src/validate.js';
import { discover } from './helpers.js';

let registry, pack;
before(async () => {
  registry = await loadRegistry();
  pack = buildRegistry([...(await discover(fileURLToPath(new URL('../content/', import.meta.url)))), ...(await discover(fileURLToPath(new URL('./fixtures/content/', import.meta.url))))]);
});
const broadway = JSON.parse(readFileSync(new URL('../levels/01-broadway.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/levels/demo-canal-street-dash.json', import.meta.url), 'utf8'));
const setPiece = (placements) => ({ ...broadway, sections: [...broadway.sections, { from_m: 1340, to_m: 1420, generation: false, placements }] });
const ob = (at_m, lane, id) => ({ at_m, lane, kind: 'obstacle', id });
const allIds = ['01-broadway', '02-garden', 'endless', 'fifth-avenue-dusk', 'last-train-newark'];

test('street groups obstacles into rows and names what each row asks for', () => {
  const s = street(broadway, registry, { seed: 7 });
  assert.ok(s.rows.length > 20 && s.rows.every((r) => r.obs.length >= 1 && r.obs.length <= 3));
  for (const r of s.rows) assert.ok(['dodge1', 'dodge2', 'wall-jump', 'wall-slide', 'wall-jump+slide'].includes(r.kind), r.kind);
  assert.deepEqual(street(broadway, registry, { seed: 7 }).rows.map((r) => r.z), s.rows.map((r) => r.z), 'same seed, same street');
  // A seed names the game's street: the game builds 120 m chunks on one rng and one generator state (src/world.js).
  const rules = resolveRules(broadway.rules), norm = normalizeLevel(broadway), r = rng(7), state = { lastRow: -Infinity, speedFrom: rules.speed.start, propEnd: -Infinity };
  const game = [];
  for (let z0 = 0; z0 < broadway.length_m; z0 += 120) game.push(...generate(norm, r, z0, Math.min(z0 + 120, broadway.length_m), registry, rules, state).obstacles);
  assert.deepEqual(s.obstacles.map(({ def, ...o }) => o), game);
});

test('the bot clears Broadway at a 0.45 s notice and dies with a 0.2 s one', () => {
  assert.equal(NOTICE, 0.45);
  for (let seed = 1; seed <= 20; seed++) assert.equal(simulate(broadway, registry, { seed }).survived, true, `seed ${seed}`);
  const dead = Array.from({ length: 20 }, (_, i) => simulate(broadway, registry, { seed: i + 1, notice: 0.2 })).filter((r) => !r.survived);
  assert.ok(dead.length >= 10);
  assert.ok(dead.every((r) => r.death && r.death.id && r.death.z > 0 && typeof r.death.window === 'number'));
});

test('a run is deterministic and reports actions, windows and the longest idle stretch', () => {
  const a = simulate(broadway, registry, { seed: 3 }), b = simulate(broadway, registry, { seed: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.actions.left + a.actions.right + a.actions.jump + a.actions.slide > 10);
  assert.ok(a.windows.length > 10 && Math.min(...a.windows) > 0.3);
  assert.ok(a.idle.seconds > 0 && a.idle.to_m > a.idle.from_m);
});

test('placed rows off the grid are played like generated ones', () => {
  const s = street(fixture, pack, { seed: fixture.seed });
  assert.ok(s.rows.some((r) => r.z === 210 && r.obs.length === 2 && r.kind === 'dodge2'));
  assert.equal(simulate(fixture, pack, { seed: fixture.seed }).survived, true);
});

test('a placed mover stays in its lane and its row is played', () => {
  const level = setPiece([ob(1380, 0, 'taxi'), ob(1380, 1, 'delivery_bike')]);
  assert.deepEqual(validateLevel(level, { fileId: '01-broadway', allIds, registry }), []);
  const row = street(level, registry, { seed: 1 }).rows.find((r) => r.z === 1380);
  assert.equal(row.kind, 'dodge2');
  assert.equal(row.obs.find((o) => o.id === 'delivery_bike').moveTo, null);
  assert.equal(simulate(level, registry, { seed: 1 }).survived, true);
});

test('a staggered set piece is one row, as the validator reads it, and keeps a positive window', () => {
  const level = setPiece([ob(1380, 0, 'taxi'), ob(1384, 1, 'taxi')]);
  assert.deepEqual(validateLevel(level, { fileId: '01-broadway', allIds, registry }), []);
  const row = street(level, registry, { seed: 1 }).rows.find((r) => r.obs.some((o) => o.z === 1384));
  assert.deepEqual([row.z, row.obs.length, row.kind], [1382, 2, 'dodge2']);
  assert.ok(Math.min(...simulate(level, registry, { seed: 1 }).windows) > 0);
  assert.equal(scorecard(level, registry, { seeds: 10 }).gates.find((g) => g.id === 'G-window').ok, true);
});

test('finish time is the integral of the speed curve', () => {
  const rules = { ...resolveRules(), speed: { start: 12, end: 24, cap: 30, ramp: 0.006 } };
  assert.ok(Math.abs(finishTime({ length_m: 1500 }, rules) - 1500 / 12 * Math.log(2)) < 1);
  assert.ok(Number.isNaN(finishTime({ length_m: null }, rules)));
});

test('the shipped levels pass every gate and sit inside the band', () => {
  const card = scorecard(broadway, registry, { seeds: 20 });
  assert.equal(card.ok, true, card.lines.join('\n'));
  assert.ok(card.bands.every((b) => b.ok), card.lines.join('\n'));
  assert.ok(Number.isInteger(card.shipSeed) && card.shipSeed >= 1);
});

test('a level that leaves no time to react fails the survival and window gates', () => {
  const tight = { ...broadway, rules: { reaction: 0.2, speed: { start: 30, end: 30 } }, density: { start: 1, end: 1 } };
  const card = scorecard(tight, registry, { seeds: 20 });
  assert.equal(card.ok, false);
  assert.ok(card.gates.find((g) => g.id === 'G-window').ok === false);
  assert.ok(card.lines.some((l) => /window/.test(l)));
});

test('a flat level passes the gates but gets pacing and staging warnings', () => {
  const flat = { ...broadway, rules: { speed: { start: 12, end: 12 } }, density: { start: 0.3, end: 0.3 }, sections: undefined };
  const card = scorecard(flat, registry, { seeds: 20 });
  assert.equal(card.ok, true);
  for (const id of ['B-speed', 'B-density', 'B-staging']) assert.equal(card.bands.find((b) => b.id === id).ok, false, id);
});

test('an endless level is played to 3000 m and finite-only bands are skipped', () => {
  const endless = JSON.parse(readFileSync(new URL('../levels/endless.json', import.meta.url), 'utf8'));
  const card = scorecard(endless, registry, { seeds: 10 });
  assert.equal(card.ok, true, card.lines.join('\n'));
  assert.ok(!card.bands.some((b) => b.id === 'B-finish'));
  assert.ok(Number.isNaN(card.stats.finish));
});

test('a file seed is judged on its own and a ship seed is proposed', () => {
  const seeded = { ...broadway, seed: 5 };
  const card = scorecard(seeded, registry, { seeds: 10 });
  assert.equal(card.stats.fileSeed.seed, 5);
  assert.equal(card.gates.find((g) => g.id === 'G-seed').ok, true);
  assert.ok(card.lines.at(-1).includes(`ship seed ${card.shipSeed}`));
  assert.equal(playtest({ ...broadway, seed: 3 }, registry, { seeds: 3, notice: 0.1 }).fileSeed.survived, false, 'the file seed plays at the sweep notice');
});

test('a file seed that dies fails the card even when the sweep survives', () => {
  // Broadway seed 118 dies at a 0.43 s notice while seeds 1..10 all live (found by a search, 2026-10-15).
  const card = scorecard({ ...broadway, seed: 118 }, registry, { seeds: 10, notice: 0.43 });
  assert.equal(card.gates.find((g) => g.id === 'G-survival').ok, true);
  assert.equal(card.gates.find((g) => g.id === 'G-seed').ok, false);
  assert.equal(card.ok, false);
  assert.ok(card.lines.some((l) => /file seed/.test(l)), card.lines.join('\n'));
  assert.notEqual(card.shipSeed, null);
});

test('a lane-and-timing-only obstacle set never builds a full row and still scores', () => {
  const card = scorecard({ ...broadway, obstacles: { taxi: 2, manhole_steam: 1 } }, registry, { seeds: 10 });
  assert.equal(card.stats.luckDeaths, 0);
  assert.equal(card.gates.find((g) => g.id === 'G-luck').ok, true);
});

test('the content sheet names every registered id with the facts an author needs', () => {
  const sheet = contentSheet(registry);
  for (const id of Object.keys(registry.obstacle)) assert.ok(sheet.includes(`| ${id} |`), id);
  assert.match(sheet, /taxi \| lane \| 2(\.0)? /);
  assert.match(sheet, /manhole_steam \| timing/);
  for (const id of Object.keys(registry.ending)) assert.ok(sheet.includes(`| ${id} |`), id);
  assert.match(sheet, /transition .*next.*level/);
  assert.match(sheet, /reaction/);
  assert.match(sheet, /survival/);
});

test('check runs the validator on a file by its name', () => {
  const file = fileURLToPath(new URL('../levels/01-broadway.json', import.meta.url));
  assert.deepEqual(check(file, registry), []);
  assert.deepEqual(loadLevelFile(file).allIds.sort(), ['01-broadway', '02-garden', 'endless', 'fifth-avenue-dusk', 'last-train-newark']);
});

test('the CLI checks, refuses to play an invalid file, and plays a valid one', async () => {
  const { spawnSync } = await import('node:child_process');
  const lab = fileURLToPath(new URL('../scripts/level-lab.js', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [lab, ...args], { encoding: 'utf8' });
  assert.equal(run('check', 'levels/01-broadway.json').status, 0);
  const { writeFileSync, mkdtempSync, rmSync } = await import('node:fs');
  const dir = mkdtempSync(`${(await import('node:os')).tmpdir()}/lab-`);
  writeFileSync(`${dir}/bad-one.json`, JSON.stringify({ ...broadway, id: 'bad-one', obstacles: { tank: 1 } }));
  const bad = run('play', `${dir}/bad-one.json`);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout + bad.stderr, /unknown obstacle "tank"/);
  const good = run('play', 'levels/01-broadway.json', '--seeds', '5');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /ship seed/);
  const nan = run('play', 'levels/01-broadway.json', '--seeds', 'abc');
  assert.equal(nan.status, 1);
  assert.match(nan.stdout + nan.stderr, /seeds/);
  for (const args of [['--seeds', '2.5'], ['--from', '0'], ['--notice', '']]) {
    const r = run('play', 'levels/01-broadway.json', ...args);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /^usage: .*\n$/, args.join(' '));
  }
  writeFileSync(`${dir}/broken.json`, '{"id":');
  const broken = run('play', `${dir}/broken.json`);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /broken\.json: .*JSON/);
  const missing = run('check', 'nope.json');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /nope\.json/);
  assert.doesNotMatch(missing.stdout + missing.stderr, /\n    at /);
  rmSync(dir, { recursive: true, force: true });
});
