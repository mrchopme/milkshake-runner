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
    const parent = gfx.group(), worn = wornLooks({ pickup: { a: {}, b: { createWorn() { throw new Error('x'); } }, c: { createWorn: (g) => g.group() } } }, gfx);
    worn.update({ effects: { a: {}, b: {}, c: {} } }, parent);
    assert.equal(parent.children.length, 0);
    worn.update({ effects: {} }, parent);
    worn.dispose(); // a bare Group (no .object) from createWorn must not make either throw
  } finally { console.warn = warn; }
});
