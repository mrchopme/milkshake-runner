// The level lab: plays a level headless over the pure generator and rules, so a level can be judged without a browser.
import { fileURLToPath } from 'node:url';
import { generate, normalizeLevel, rng, passable } from '../src/generator.js';
import { resolveRules, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit, updateObstacle } from '../src/rules.js';
import { buildRegistry } from '../src/registry.js';
import { discover } from '../test/helpers.js';

export const NOTICE = 0.45, ENDLESS_M = 3000;
const CHUNK = 120; // mirrors src/world.js (which imports three.js): the game builds the street in 120 m chunks on one rng
const DT = 1 / 60;

export async function loadRegistry() {
  return buildRegistry(await discover(fileURLToPath(new URL('../content/', import.meta.url))));
}

// The street the game builds for this seed, with its obstacles grouped into rows by exact z.
export function street(level, registry, { seed, from } = {}) {
  const rules = resolveRules(level.rules ?? {}), length = level.length_m ?? ENDLESS_M, norm = normalizeLevel(level), r = rng(seed);
  const state = { lastRow: -Infinity, speedFrom: from ?? rules.speed.start, propEnd: -Infinity };
  const obstacles = [], pickups = [], props = [];
  for (let z0 = 0; z0 < length; z0 += CHUNK) {
    const c = generate(norm, r, z0, Math.min(z0 + CHUNK, length), registry, rules, state);
    obstacles.push(...c.obstacles); pickups.push(...c.pickups); props.push(...c.props);
  }
  for (const o of obstacles) o.def = registry.obstacle[o.id];
  const rows = [...Map.groupBy(obstacles, (o) => o.z)].sort(([a], [b]) => a - b).map(([z, obs]) => {
    const escapes = new Set(obs.filter((o) => passable(o.def, rules)).map((o) => o.def.avoid));
    const kind = obs.length < 3 ? `dodge${obs.length}` : escapes.size ? `wall-${[...escapes].sort().join('+')}` : 'wall-luck';
    return { z, obs, halfD: Math.max(...obs.map((o) => o.def.box.d / 2)), kind };
  });
  return { rules, length, obstacles, pickups, props, rows };
}

const eff = (o) => o.moveTo ?? o.lane; // a mover ends up in moveTo

// A reaction-limited bot plays the street: it sees a row only `notice` seconds ahead.
export function simulate(level, registry, { seed, notice = NOTICE, from } = {}) {
  const { rules, length, rows } = street(level, registry, { seed, from });
  const speedFrom = from ?? rules.speed.start, speedOf = (z) => speedAt(level, z, rules, speedFrom);
  const run = createRun(rules, registry.character[level.character?.id] ?? registry.character.milkshake, 0, speedFrom);
  // windows[i] is the clear road before rows[i + 1]; the first row's is measured from the start line.
  const windows = rows.slice(1).map((row, i) => ((row.z - row.halfD - 0.4) - (rows[i].z + rows[i].halfD + 0.4)) / speedOf(row.z));
  const actions = { left: 0, right: 0, jump: 0, slide: 0 }, idle = { seconds: 0, from_m: 0, to_m: 0 };
  const doAct = (a) => { act(run, a); actions[a]++; };
  let next = 0, plan = null, lastBusy = null, death = null;
  // ponytail: plans one row at a time with a one-row look-ahead; a human reads further. Upgrade: plan over a window of rows.
  while (!run.over && run.z < length) {
    const speed = speedOf(run.z);
    if (!plan && next < rows.length && rows[next].z - run.z <= speed * notice) {
      const row = rows[next], prev = rows[next - 1], after = rows[next + 1];
      const occ = new Map(row.obs.map((o) => [eff(o), o]));
      const blocked = new Set(prev && run.z < prev.z + prev.halfD + 0.4 ? prev.obs.map(eff) : []);
      const nextOcc = new Set(after && after.z - row.z <= speed * 1.0 ? after.obs.map(eff) : []);
      const cost = (l) => !occ.has(l) ? 0 : passable(occ.get(l).def, rules) ? 1 : Infinity;
      const reachable = (l) => [...blocked].every((b) => !(b === l || (b - run.lane) * (b - l) < 0));
      const best = [0, 1, 2].filter((l) => cost(l) < Infinity && reachable(l))
        .sort((a, b) => cost(a) - cost(b) || nextOcc.has(a) - nextOcc.has(b) || Math.abs(a - run.lane) - Math.abs(b - run.lane))[0];
      const wait = best === undefined || (cost(best) > 0 && blocked.size && row.z - run.z > speed * 0.35);
      if (!wait) {
        const o = occ.get(best);
        plan = { target: best, action: o ? o.def.avoid : null, obstacle: o };
        if (best !== run.lane || o) {
          if (lastBusy && run.time - lastBusy.time > idle.seconds) Object.assign(idle, { seconds: run.time - lastBusy.time, from_m: lastBusy.z, to_m: row.z });
          lastBusy = { time: run.time, z: row.z };
        }
        next++;
      }
    }
    if (plan) {
      if (run.lane !== plan.target) doAct(plan.target < run.lane ? 'left' : 'right');
      else if (plan.action) {
        const o = plan.obstacle, lead = (o.z - o.def.box.d / 2 - 0.4) - run.z;
        if (lead <= speed * (plan.action === 'jump' ? 0.2 : 0.1)) { doAct(plan.action); plan.action = null; }
      }
      if (run.lane === plan.target && !plan.action) plan = null;
    }
    step(run, DT, speed);
    const me = playerBox(run);
    for (const row of rows) {
      if (row.z < run.z - 12 || row.z > run.z + 40) continue;
      for (const o of row.obs) {
        updateObstacle(o, o.def, run, DT);
        const box = obstacleBox(o, o.def, run.time, rules);
        if (box && overlaps(me, box) && hit(run) === 'dead' && !death) {
          const i = rows.indexOf(row);
          death = { id: o.id, avoid: o.def.avoid, kind: row.kind, z: Math.round(run.z), speed, window: i ? windows[i - 1] : (row.z - row.halfD - 0.4) / speedOf(row.z) };
        }
      }
    }
  }
  return { survived: !run.over, death, time: run.time, z: run.z, actions, idle, windows };
}
