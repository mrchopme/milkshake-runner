import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import milkshake from '../content/characters/milkshake.js';
import { createRun, resolveRules, step } from '../src/rules.js';
import { footstep } from '../src/audio.js';

test('Milkshake counts a footfall for every dust puff, and none in the air', async () => {
  const view = await milkshake.createView(gfx);
  const puffs = view.object.children.find((c) => c.children.length === 6);
  const run = createRun(resolveRules(), milkshake);
  let born = 0, shown = new Set();
  for (let i = 0; i < 90; i++) { step(run, 1 / 60, 12); view.update(run); for (const p of puffs.children) if (p.visible && !shown.has(p.userData.born)) { shown.add(p.userData.born); born++; } }
  assert.ok(born >= 3 && view.steps === born, `${view.steps} steps for ${born} puffs`);
  run.y = 1;
  const before = view.steps;
  for (let i = 0; i < 30; i++) { run.time += 1 / 60; view.update(run); }
  assert.equal(view.steps, before, 'no steps while airborne');
});

// Web Audio is absent in Node, so a footstep is a no-op; with a counting fake it is one layered voice per call, panned by foot.
test('a footstep is silent in Node and one layered voice in a browser', () => {
  footstep();
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class FakeAudio {
    constructor() { FakeAudio.last = this; this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 48000; this.destination = {}; this.started = 0; this.pans = []; }
    node() { return { type: '', buffer: null, frequency: param(), gain: param(), Q: param(), connect() {}, start: () => { this.started++; }, stop() {} }; }
    createOscillator() { return this.node(); } createGain() { return this.node(); } createBiquadFilter() { return this.node(); } createBufferSource() { return this.node(); }
    createStereoPanner() { const n = this.node(); n.pan = { set value(v) { FakeAudio.last.pans.push(v); } }; return n; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { this.state = 'running'; }
  }
  globalThis.AudioContext = FakeAudio;
  try {
    footstep(1, 12); footstep(-1, 24);
    const c = FakeAudio.last;
    assert.equal(c.state, 'running', 'a suspended context is resumed');
    assert.equal(c.started, 6, 'two bursts and a thud per step');
    assert.deepEqual(c.pans, [0.2, -0.2], 'left and right feet');
  } finally { delete globalThis.AudioContext; }
});
