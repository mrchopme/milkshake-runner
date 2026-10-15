import { test } from 'node:test';
import assert from 'node:assert/strict';
import { params, report } from '../src/hatch.js';

test('params in: the level id is picked out, everything else stays an opaque context', () => {
  assert.deepEqual(params('?level=02-garden&user=u1&memories=x'), { level: '02-garden', context: { user: 'u1', memories: 'x' } });
  assert.deepEqual(params(''), { level: null, context: {} });
});

test('result out: posted to the parent only when framed', () => {
  const sent = [];
  const parent = { postMessage: (...a) => sent.push(a) };
  const result = { levelId: '02-garden', outcome: 'dead', jugs: 7, time: 12.5 };
  report(result, { parent });
  assert.deepEqual(sent, [[result, '*']]);
  const alone = { postMessage: () => assert.fail('standalone must not post') };
  alone.parent = alone;
  report(result, alone);
  report(result, undefined); // no window at all (Node)
});
