import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLevel, validateAll, validateCampaign } from '../src/validate.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from './helpers.js';

const dir = new URL('../levels/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
let registry;
before(async () => { registry = buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url)))); });

const shipped = () => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'campaign.json'].includes(f)).map((f) => [f.slice(0, -5), read(f)]));

test('every shipped level and the campaign are valid', () => {
  const levels = shipped();
  assert.deepEqual(validateAll(levels, read('index.json'), registry), {});
  assert.deepEqual(validateCampaign(read('campaign.json'), Object.keys(levels)), []);
});

const good = {
  id: 'x', title: 'X', author: 'A', length_m: 600,
  theme: { id: 'downtown' }, obstacles: { taxi: 1, barrier_low: 1 }, density: { start: 0.3, end: 0.5 },
  jugs: { per_100m: 10, powerups: [] },
};
const errs = (patch) => validateLevel({ ...good, ...patch }, { fileId: 'x', allIds: ['x', 'y'], registry }).join(' | ');

test('a minimal level is valid', () => assert.equal(errs({}), ''));
test('rejects a non-object', () => assert.match(validateLevel([], { fileId: 'x', allIds: ['x'], registry }).join(), /JSON object/));
test('rejects unknown keys at every level', () => {
  assert.match(errs({ colour: 'red' }), /unknown key "colour"/);
  assert.match(errs({ theme: { id: 'downtown', road: '#000000' } }), /theme: unknown key "road"/);
  assert.match(errs({ density: { start: 0.3, end: 0.5, middle: 0.4 } }), /density: unknown key "middle"/);
});
test('ids must exist in the registry', () => {
  assert.match(errs({ obstacles: { tank: 1 } }), /unknown obstacle "tank"/);
  assert.match(errs({ theme: { id: 'forest' } }), /unknown theme "forest"/);
  assert.match(errs({ character: { id: 'robot' } }), /unknown character "robot"/);
  assert.match(errs({ jugs: { per_100m: 5, powerups: ['jetpack'] } }), /unknown pickup "jetpack"/);
  assert.match(errs({ jugs: { per_100m: 5, powerups: ['jug'] } }), /not a power-up/);
  assert.match(errs({ ending: { id: 'parade' } }), /unknown ending "parade"/);
});
test('numbers stay in range', () => {
  assert.match(errs({ length_m: 50 }), /100 to 10000/);
  assert.match(errs({ length_m: 20000 }), /100 to 10000/);
  assert.match(errs({ seed: 1.5 }), /seed/);
  assert.match(errs({ obstacles: { taxi: 0 } }), /above 0/);
  assert.match(errs({ theme: { id: 'downtown', sky: 'blue' } }), /hex/);
  assert.equal(errs({ density: { start: 0, end: 0 }, obstacles: {} }), '');
  assert.match(errs({ obstacles: {} }), /obstacles may be empty only/);
});
test('rules are known and in range', () => {
  assert.equal(errs({ rules: { gravity: -24, speed: { start: 10 } } }), '');
  assert.match(errs({ rules: { friction: 1 } }), /unknown rule "friction"/);
  assert.match(errs({ rules: { gravity: -5 } }), /gravity must be -60 to -10/);
  assert.match(errs({ rules: { speed: { warp: 1 } } }), /unknown rule "warp"/);
  assert.match(errs({ rules: { reaction: 2 } }), /reaction must be 0.2 to 1.5/);
  assert.equal(errs({ rules: { reaction: 0.4 } }), '');
});
test('endings and their params', () => {
  assert.match(errs({ length_m: null, ending: { id: 'finish' } }), /cannot have an ending/);
  assert.match(errs({ ending: { id: 'transition' } }), /next/);
  assert.match(errs({ ending: { id: 'transition', params: { next: 'nope' } } }), /next/);
  assert.match(errs({ ending: { id: 'transition', params: { next: 'x' } } }), /itself/);
  assert.equal(errs({ ending: { id: 'transition', params: { next: 'y' } } }), '');
  assert.match(errs({ ending: { id: 'finish', params: { colour: 'red' } } }), /unknown param "colour"/);
  assert.match(errs({ ending: { id: 'finish', params: { text: 'x'.repeat(41) } } }), /at most 40/);
});
test('sections and placements', () => {
  const s = (sections) => errs({ sections });
  assert.equal(s([{ from_m: 0, to_m: 100, density: { start: 0, end: 0 } }, { from_m: 100, to_m: 200, generation: false, placements: [{ at_m: 150, lane: 1, kind: 'obstacle', id: 'barrier_low' }] }]), '');
  assert.match(s([{ from_m: 100, to_m: 50 }]), /from_m/);
  assert.match(s([{ from_m: 0, to_m: 700 }]), /inside the level/);
  assert.match(s([{ from_m: 0, to_m: 100 }, { from_m: 50, to_m: 150 }]), /overlap/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 150, lane: 0, kind: 'obstacle', id: 'taxi' }] }]), /inside its section/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 3, kind: 'obstacle', id: 'taxi' }] }]), /lane/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 0, kind: 'drone', id: 'taxi' }] }]), /kind/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 0, kind: 'pickup', id: 'taxi' }] }]), /unknown pickup/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [0, 1, 2].map((lane) => ({ at_m: 50, lane, kind: 'obstacle', id: 'taxi' })) }]), /block every lane/);
  assert.equal(s([{ from_m: 0, to_m: 100, placements: [0, 1, 2].map((lane) => ({ at_m: 50, lane, kind: 'obstacle', id: lane === 1 ? 'barrier_low' : 'taxi' })) }]), '');
  assert.match(s([{ from_m: 0, to_m: 100, rows: 3 }]), /unknown key "rows"/);
  assert.match(s([{ from_m: 0, to_m: 100, placements: [[50, 0], [51, 1], [52, 2]].map(([at_m, lane]) => ({ at_m, lane, kind: 'obstacle', id: 'taxi' })) }]), /block every lane/);
});
test('ids that are object prototype keys are unknown, not inherited', () => {
  assert.match(errs({ obstacles: { constructor: 1 } }), /unknown obstacle "constructor"/);
  assert.match(errs({ theme: { id: 'constructor' } }), /unknown theme "constructor"/);
  assert.match(errs({ character: { id: 'hasOwnProperty' } }), /unknown character "hasOwnProperty"/);
  assert.match(errs({ ending: { id: 'constructor' } }), /unknown ending "constructor"/);
  assert.match(errs({ sections: [{ from_m: 0, to_m: 100, placements: [{ at_m: 50, lane: 0, kind: 'obstacle', id: 'toString' }] }] }), /unknown obstacle "toString"/);
});
test('the file name is the id', () => assert.match(errs({ id: 'y' }), /file name/));
test('index lists real files, once each; unlisted levels are fine', () => {
  const out = validateAll({ x: good, z: { ...good, id: 'z' } }, ['x', 'ghost', 'x'], registry);
  assert.match(out['index.json'].join(), /ghost.*does not exist/);
  assert.match(out['index.json'].join(), /twice/);
  assert.equal(out['z.json'], undefined);
});
test('campaign points at real levels', () => {
  assert.match(validateCampaign({ start: 'nope', locked: {} }, ['x']).join(), /start/);
  assert.match(validateCampaign({ start: 'x', locked: { x: 'x' } }, ['x']).join(), /itself/);
  assert.match(validateCampaign({ start: 'x', locked: { y: 'x' } }, ['x']).join(), /"y"/);
  assert.match(validateCampaign({ start: 'x', extra: 1 }, ['x']).join(), /unknown key/);
});

test('placed obstacle rows closer than the reaction floor are rejected', () => {
  const two = (gap, rules = { speed: { start: 30, end: 30 } }) => errs({ rules, sections: [{ from_m: 0, to_m: 600, placements: [
    { at_m: 100, lane: 0, kind: 'obstacle', id: 'taxi' }, { at_m: 100 + gap, lane: 1, kind: 'obstacle', id: 'taxi' }] }] });
  assert.match(two(12), /reaction floor/);
  assert.equal(two(24), '');
  assert.equal(two(3), '', 'placements within half a row are one row, checked by the wall rule instead');
  assert.equal(two(12, { speed: { start: 30, end: 30 }, reaction: 0.3 }), '', 'a lower reaction rule allows it');
});

test('curve is turn and hill in -1..1, or "random"', () => {
  assert.equal(errs({ curve: { turn: 0.5, hill: -1 } }), '');
  assert.equal(errs({ curve: 'random' }), '');
  assert.match(errs({ curve: { turn: 2 } }), /turn must be -1 to 1/);
  assert.match(errs({ curve: { bend: 1 } }), /curve: unknown key "bend"/);
  assert.match(errs({ curve: 'wobbly' }), /turn and hill/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, curve: { hill: -0.5 } }] }), '');
  assert.match(errs({ sections: [{ from_m: 0, to_m: 100, curve: { hill: 3 } }] }), /sections\[0\]\.curve\.hill/);
});

test('camera overrides are known and in range', () => {
  assert.equal(errs({ camera: { height: 5, distance: 8, fov: 70 } }), '');
  assert.match(errs({ camera: { height: 9 } }), /camera\.height must be 1.5 to 8/);
  assert.match(errs({ camera: { distance: 2 } }), /distance must be 3 to 12/);
  assert.match(errs({ camera: { fov: 120 } }), /fov must be 45 to 100/);
  assert.match(errs({ camera: { tilt: 1 } }), /unknown key "tilt"/);
  assert.match(errs({ camera: 'low' }), /camera must be an object/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, camera: { fov: 65 } }] }), '');
});

test('props: weights, grid and placements', () => {
  assert.equal(errs({ props: { per_100m: 1, ids: { overpass: 1, billboard: 2 } } }), '');
  assert.match(errs({ props: { per_100m: 6, ids: {} } }), /per_100m must be 0 to 5/);
  assert.match(errs({ props: { per_100m: 1, ids: { tree: 1 } } }), /unknown prop "tree"/);
  assert.match(errs({ props: { per_100m: 1, ids: { overpass: 0 } } }), /above 0/);
  assert.match(errs({ props: { per_100m: 1 } }), /ids must be an object/);
  assert.match(errs({ props: { per_100m: 1, ids: {}, every: 3 } }), /unknown key "every"/);
  const s = (placements) => errs({ sections: [{ from_m: 0, to_m: 600, placements }] });
  assert.equal(s([{ at_m: 100, kind: 'prop', id: 'tunnel' }]), '');
  assert.match(s([{ at_m: 100, lane: 1, kind: 'prop', id: 'tunnel' }]), /no lane/);
  assert.match(s([{ at_m: 580, kind: 'prop', id: 'tunnel' }]), /past the end/);
  assert.match(s([{ at_m: 100, kind: 'prop', id: 'gate' }]), /unknown prop "gate"/);
  assert.match(s([{ at_m: 100, kind: 'obstacle', id: 'taxi' }]), /lane must be 0, 1 or 2/);
  assert.equal(errs({ sections: [{ from_m: 0, to_m: 100, props: { per_100m: 2, ids: { billboard: 1 } } }] }), '');
});
