// The level lab: plays a level headless over the pure generator and rules, so a level can be judged without a browser.
import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, normalizeLevel, rng, passable } from '../src/generator.js';
import { DEFAULT_RULES, RULE_RANGES, resolveRules, speedAt, createRun, act, step, playerBox, obstacleBox, overlaps, hit, updateObstacle } from '../src/rules.js';
import { buildRegistry } from '../src/registry.js';
import { validateLevel } from '../src/validate.js';
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

// ponytail: bands are fixed numbers from four hand-made levels. Upgrade: recompute from the corpus when it has ten.
export const GATES = { survival: 0.95, windowMin: 0.35 };
export const BANDS = { speedRatio: 1.8, densityRise: 0.25, actionsPerMin: [15, 40], idleMax: 16, finish: [45, 180], jugsPer100m: [10, 16], stagingEvery_m: 300 };

// Seconds to run a finite level end to end at the game's speed curve.
export function finishTime(level, rules, from) {
  if (level.length_m == null) return NaN;
  let t = 0;
  for (let z = 0; z < level.length_m; z++) t += 1 / speedAt(level, z, rules, from);
  return t;
}

const mean = (xs, f) => xs.reduce((a, x) => a + f(x), 0) / xs.length;

// Plays seeds 1..seeds and sums up what a player would meet: who dies where, the tightest gap, how busy and how long.
export function playtest(level, registry, { seeds = 100, notice = NOTICE, from } = {}) {
  const runs = Array.from({ length: seeds }, (_, i) => {
    const seed = i + 1, { rows, pickups } = street(level, registry, { seed, from });
    return { seed, rows, pickups, ...simulate(level, registry, { seed, notice, from }) };
  });
  const rules = resolveRules(level.rules ?? {}), finish = finishTime(level, rules, from), live = runs.filter((r) => r.survived);
  const deaths = runs.filter((r) => !r.survived).map((r) => ({ seed: r.seed, ...r.death }));
  let windowAt = { window: Infinity };
  for (const r of runs) r.windows.forEach((w, i) => { if (w < windowAt.window) windowAt = { window: w, z: r.rows[i + 1].z, seed: r.seed }; });
  const all = runs.flatMap((r) => r.windows).sort((a, b) => a - b);
  const idle = live.reduce((m, r) => r.idle.seconds > m.seconds ? { ...r.idle, seed: r.seed } : m, { seconds: 0, from_m: 0, to_m: 0 });
  // ponytail: the ship seed maximises the minimum window only. Upgrade: also prefer seeds with a wider action mix.
  let shipSeed = null, best = -Infinity;
  for (const r of live) if (Math.min(...r.windows) > best) { best = Math.min(...r.windows); shipSeed = r.seed; }
  const own = level.seed == null ? null : simulate(level, registry, { seed: level.seed, notice, from });
  return {
    seeds, survival: live.length / seeds, deaths, luckDeaths: deaths.filter((d) => d.kind === 'wall-luck').length,
    windowMin: windowAt.window, windowAt, windowP10: all[Math.floor(all.length * 0.1)] ?? Infinity,
    actionsPerMin: mean(live, (r) => Object.values(r.actions).reduce((a, b) => a + b, 0) / r.time * 60),
    idle, idleMean: mean(live, (r) => r.idle.seconds), rowsPerMin: mean(live, (r) => r.rows.length / (level.length_m == null ? r.time : finish) * 60), finish,
    jugsPer100m: mean(runs, (r) => r.pickups.filter((p) => p.id === 'jug').length / (level.length_m ?? ENDLESS_M) * 100),
    powerupsPerRun: mean(runs, (r) => r.pickups.filter((p) => p.id !== 'jug').length),
    shipSeed, fileSeed: own && { seed: level.seed, survived: own.survived, windowMin: Math.min(...own.windows) },
  };
}

const STAGING = ['curve', 'camera', 'theme', 'props', 'placements'];

// Gates must pass to ship (fairness); bands only warn (pacing, against the hand-made levels). Does not validate: `check` does.
export function scorecard(level, registry, { seeds = 100, notice = NOTICE, from } = {}) {
  const stats = playtest(level, registry, { seeds, notice, from }), rules = resolveRules(level.rules ?? {}), endless = level.length_m == null;
  const at = (d) => `${d.kind ?? d.id} at ${d.z} m (seed ${d.seed})`, s2 = (x) => x.toFixed(2), inside = (x, [lo, hi]) => x >= lo && x <= hi;
  const { windowAt: w, idle, fileSeed: fs } = stats;
  const gates = [
    { id: 'G-survival', ok: stats.survival >= GATES.survival, text: `survival ${Math.round(stats.survival * 100)}% under ${GATES.survival * 100}%: ${stats.deaths.slice(0, 5).map(at).join(', ')}` },
    { id: 'G-luck', ok: stats.luckDeaths === 0, text: stats.deaths.filter((d) => d.kind === 'wall-luck').map(at).join(', ') },
    { id: 'G-window', ok: stats.windowMin >= GATES.windowMin, text: `window ${s2(w.window)} s under ${GATES.windowMin} s at ${w.z} m (seed ${w.seed})` },
    ...(fs ? [{ id: 'G-seed', ok: fs.survived && fs.windowMin >= GATES.windowMin, text: `file seed ${fs.seed} ${fs.survived ? 'survives' : 'dies'} with a ${s2(fs.windowMin)} s window` }] : []),
  ];
  const staged = (level.sections ?? []).filter((s) => STAGING.some((k) => s[k])).length, d = level.density;
  const bands = [
    endless ? { id: 'B-speed', ok: rules.speed.ramp > 0, text: 'speed never ramps' }
      : { id: 'B-speed', ok: rules.speed.end / rules.speed.start >= BANDS.speedRatio, text: `speed rises ×${s2(rules.speed.end / rules.speed.start)}, under ×${BANDS.speedRatio}` },
    { id: 'B-density', ok: d.end - d.start >= BANDS.densityRise, text: `density rises ${s2(d.end - d.start)}, under ${BANDS.densityRise}` },
    { id: 'B-actions', ok: inside(stats.actionsPerMin, BANDS.actionsPerMin), text: `${Math.round(stats.actionsPerMin)} actions a minute, outside ${BANDS.actionsPerMin.join('–')}` },
    { id: 'B-idle', ok: stats.idleMean <= BANDS.idleMax, text: `idle ${stats.idleMean.toFixed(1)} s on average, band <= ${BANDS.idleMax} s; longest ${Math.round(idle.seconds)} s without a row to play at ${idle.from_m}–${idle.to_m} m (seed ${idle.seed})` },
    ...(endless ? [] : [{ id: 'B-finish', ok: inside(stats.finish, BANDS.finish), text: `finishes in ${Math.round(stats.finish)} s, outside ${BANDS.finish.join('–')} s` }]),
    { id: 'B-jugs', ok: inside(level.jugs.per_100m, BANDS.jugsPer100m) && level.jugs.powerups.length >= 1, text: `${level.jugs.per_100m} jugs per 100 m and ${level.jugs.powerups.length} power-ups, want ${BANDS.jugsPer100m.join('–')} and at least one` },
    endless ? { id: 'B-staging', ok: !!level.curve || staged >= 1, text: 'no curve and no staged section' }
      : { id: 'B-staging', ok: staged >= Math.floor(level.length_m / BANDS.stagingEvery_m), text: `${staged} staged sections, want one per ${BANDS.stagingEvery_m} m` },
    { id: 'B-theme-lines', ok: (level.sections ?? []).every((s) => !s.theme || (s.from_m % 120 === 0 && s.to_m % 120 === 0)), text: 'a theme section is off the 120 m chunk lines' },
  ];
  const lines = [...gates, ...bands].filter((x) => !x.ok).map((x) => x.text);
  lines.push(stats.shipSeed === null ? 'no seed survived, so no ship seed' : `ship seed ${stats.shipSeed}`);
  return { ok: gates.every((x) => x.ok), gates, bands, stats, shipSeed: stats.shipSeed, lines };
}

// What an author may use, as markdown. CONTRIBUTING.md §1 is the prose; this is only the numbers.
export function contentSheet(registry) {
  const table = (title, note, head, rows) => `## ${title}\n${note}\n\n| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
  const of = (kind, f) => Object.values(registry[kind]).map(f);
  const ranges = Object.entries(RULE_RANGES).flatMap(([k, v]) => Array.isArray(v) ? [[k, v, DEFAULT_RULES[k]]] : Object.entries(v).map(([s, r]) => [`speed.${s}`, r, DEFAULT_RULES.speed[s]]));
  return [
    table('Obstacles', 'move: what clears it (lane, jump, slide, timing); h, y, d: box height, bottom and depth in metres; moves: it changes lane; cycle: period/on seconds.',
      ['id', 'move', 'h', 'y', 'd', 'moves', 'cycle'], of('obstacle', (o) => [o.id, o.avoid, o.box.h, o.box.y ?? 0, o.box.d, o.moves ? 'yes' : '', o.cycle ? `${o.cycle.period}/${o.cycle.on}` : ''])),
    table('Pickups', 'value: jugs; effect: what it does while it lasts; duration: seconds or untilHit.',
      ['id', 'name', 'value', 'effect', 'duration', 'blurb'], of('pickup', (p) => [p.id, p.name ?? '', p.value ?? '', p.effect ? JSON.stringify(p.effect) : '', p.duration ?? '', p.blurb ?? ''])),
    table('Props', 'length: metres of street it takes.', ['id', 'length'], of('prop', (p) => [p.id, p.length])),
    table('Themes', 'sky and fog as the theme sets them; buildings: minimum and maximum height in metres.',
      ['id', 'sky', 'fog', 'buildings'], of('theme', (t) => [t.id, t.sky, t.fog, `${t.buildings.minH}-${t.buildings.maxH}`])),
    table('Characters', 'height and width in metres.', ['id', 'height', 'width'], of('character', (c) => [c.id, c.height, c.width])),
    table('Endings', 'params: name: type, with max and default where set; streetAfter: metres of street past the finish line.',
      ['id', 'params', 'streetAfter'], of('ending', (e) => [e.id, Object.entries(e.params ?? {}).map(([k, s]) => `${k}: ${s.type}${s.max != null ? ` max ${s.max}` : ''}${s.default != null ? ` default ${s.default}` : ''}`).join(', '), e.streetAfter ?? ''])),
    `## Rules\nname min..max (default): ${ranges.map(([k, [lo, hi], d]) => `${k} ${lo}..${hi} (${d})`).join(', ')}\n`,
    `## Band\nGATES (must pass): ${JSON.stringify(GATES)}\nBANDS (warn only): ${JSON.stringify(BANDS)}\n`,
  ].join('\n');
}

export function loadLevelFile(path) {
  const id = basename(path, '.json');
  const ids = readdirSync(new URL('../levels/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  return { id, level: JSON.parse(readFileSync(path, 'utf8')), allIds: [...new Set([...ids.filter((i) => i !== 'index' && i !== 'campaign'), id])] };
}

export function check(path, registry) {
  const { id, level, allIds } = loadLevelFile(path);
  return validateLevel(level, { fileId: id, allIds, registry });
}

async function main() {
  const { positionals: [cmd, file], values: v } = parseArgs({ allowPositionals: true, options: { seeds: { type: 'string' }, notice: { type: 'string' }, from: { type: 'string' }, json: { type: 'boolean' } } });
  if (cmd !== 'sheet' && !((cmd === 'check' || cmd === 'play') && file)) { console.error('usage: level-lab sheet | check <file> | play <file> [--seeds N] [--notice S] [--from V] [--json]'); process.exitCode = 1; return; }
  const registry = await loadRegistry();
  if (cmd === 'sheet') return void console.log(contentSheet(registry));
  const errors = check(file, registry);
  if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; return; }
  if (cmd === 'check') return void console.log('ok');
  const n = (x) => x === undefined ? undefined : Number(x);
  const card = scorecard(loadLevelFile(file).level, registry, { seeds: n(v.seeds), notice: n(v.notice), from: n(v.from) });
  console.log(v.json ? JSON.stringify(card, null, 2) : card.lines.join('\n'));
  if (!card.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
