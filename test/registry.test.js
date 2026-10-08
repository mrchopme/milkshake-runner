import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildRegistry, tryBuildRegistry, checkModule, safeCall } from '../src/registry.js';
import { discover } from './helpers.js';

const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));

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

test('tryBuildRegistry keeps the good modules and lists the bad ones', () => {
  const { registry, problems } = tryBuildRegistry([...at('content/obstacles/ari/rock.js', ok), ...at('content/pickups/ari/gem.js', { kind: 'pickup', id: 'ari/gem' })]);
  assert.deepEqual(Object.keys(registry.obstacle), ['ari/rock']);
  assert.deepEqual(Object.keys(registry.pickup), []);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ari\/gem/);
});
