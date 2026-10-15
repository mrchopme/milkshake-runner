import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { street, simulate, loadRegistry, NOTICE } from '../scripts/level-lab.js';
import { generate, normalizeLevel, rng } from '../src/generator.js';
import { resolveRules } from '../src/rules.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from './helpers.js';

let registry, pack;
before(async () => {
  registry = await loadRegistry();
  pack = buildRegistry([...(await discover(fileURLToPath(new URL('../content/', import.meta.url)))), ...(await discover(fileURLToPath(new URL('./fixtures/content/', import.meta.url))))]);
});
const broadway = JSON.parse(readFileSync(new URL('../levels/01-broadway.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/levels/demo-canal-street-dash.json', import.meta.url), 'utf8'));

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

test('placed rows off the grid and a placed mover are played like generated ones', () => {
  const s = street(fixture, pack, { seed: fixture.seed });
  assert.ok(s.rows.some((r) => r.z === 210 && r.obs.length === 2 && r.kind === 'dodge2'));
  assert.equal(simulate(fixture, pack, { seed: fixture.seed }).survived, true);
});
