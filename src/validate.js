import { RULE_RANGES, resolveRules, speedAt } from './rules.js';
import { passable, ROW_GAP } from './generator.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isName = (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 60;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LEVEL_KEYS = ['id', 'title', 'author', 'length_m', 'seed', 'character', 'theme', 'rules', 'obstacles', 'density', 'jugs', 'sections', 'ending', 'curve', 'camera', 'props'];
const SECTION_KEYS = ['from_m', 'to_m', 'obstacles', 'density', 'jugs', 'theme', 'generation', 'placements', 'curve', 'camera', 'props'];

// Every object is checked against an allow-list, so a typo can never pass as a working option.
const keys = (obj, allowed, path, e) => { for (const k of Object.keys(obj)) if (!allowed.includes(k)) e.push(`${path}: unknown key "${k}"`); };

function checkObstacles(o, path, registry, e) {
  if (!isObj(o)) return e.push(`${path} must be an object of {id: weight}`);
  for (const [id, w] of Object.entries(o)) {
    if (!registry.obstacle[id]) e.push(`${path}: unknown obstacle "${id}" (known: ${Object.keys(registry.obstacle).join(', ')})`);
    else if (!inRange(w, Number.MIN_VALUE, 1e6)) e.push(`${path}: weight for "${id}" must be a number above 0`);
  }
}
function checkDensity(d, path, e) {
  if (!isObj(d) || !inRange(d.start, 0, 1) || !inRange(d.end, 0, 1)) return e.push(`${path} needs start and end from 0 to 1`);
  keys(d, ['start', 'end'], path, e);
}
function checkJugs(j, path, registry, e) {
  if (!isObj(j)) return e.push(`${path} must be an object`);
  keys(j, ['per_100m', 'powerups'], path, e);
  if (!inRange(j.per_100m, 0, 30)) e.push(`${path}.per_100m must be 0 to 30`);
  if (!Array.isArray(j.powerups)) return e.push(`${path}.powerups must be a list of pickup ids`);
  for (const p of j.powerups) {
    const def = registry.pickup[p];
    if (!def) e.push(`${path}.powerups: unknown pickup "${p}"`);
    else if (!def.effect) e.push(`${path}.powerups: "${p}" is not a power-up (it has no effect)`);
  }
}
function checkTheme(t, path, registry, e, requireId) {
  if (!isObj(t)) return e.push(`${path} must be an object`);
  keys(t, ['id', 'sky', 'fog'], path, e);
  if (requireId || t.id !== undefined) { if (!registry.theme[t.id]) e.push(`${path}.id: unknown theme "${t.id}" (known: ${Object.keys(registry.theme).join(', ')})`); }
  if (t.sky !== undefined && !HEX.test(t.sky)) e.push(`${path}.sky must be a hex colour like "#f4b26a"`);
  if (t.fog !== undefined && !inRange(t.fog, 0, 1)) e.push(`${path}.fog must be 0 to 1`);
}
function checkCurve(c, path, e) {
  if (c === 'random') return;
  if (!isObj(c)) return e.push(`${path} must be an object with turn and hill (-1 to 1), or "random"`);
  keys(c, ['turn', 'hill'], path, e);
  for (const k of ['turn', 'hill']) if (c[k] !== undefined && !inRange(c[k], -1, 1)) e.push(`${path}.${k} must be -1 to 1`);
}
const CAMERA_RANGES = { height: [1.5, 8], distance: [3, 12], fov: [45, 100] };
function checkCamera(c, path, e) {
  if (!isObj(c)) return e.push(`${path} must be an object with height, distance and fov`);
  keys(c, Object.keys(CAMERA_RANGES), path, e);
  for (const [k, [lo, hi]] of Object.entries(CAMERA_RANGES)) if (c[k] !== undefined && !inRange(c[k], lo, hi)) e.push(`${path}.${k} must be ${lo} to ${hi}`);
}
function checkProps(p, path, registry, e) {
  if (!isObj(p)) return e.push(`${path} must be an object with per_100m and ids`);
  keys(p, ['per_100m', 'ids'], path, e);
  if (!inRange(p.per_100m, 0, 5)) e.push(`${path}.per_100m must be 0 to 5`);
  if (!isObj(p.ids)) return e.push(`${path}.ids must be an object of {id: weight}`);
  for (const [id, w] of Object.entries(p.ids)) {
    if (!registry.prop[id]) e.push(`${path}.ids: unknown prop "${id}" (known: ${Object.keys(registry.prop).join(', ')})`);
    else if (!inRange(w, Number.MIN_VALUE, 1e6)) e.push(`${path}.ids: weight for "${id}" must be a number above 0`);
  }
}
function checkRules(r, path, e) {
  if (!isObj(r)) return e.push(`${path} must be an object`);
  for (const [k, v] of Object.entries(r)) {
    const range = RULE_RANGES[k];
    if (!range) e.push(`${path}: unknown rule "${k}"`);
    else if (Array.isArray(range)) { if (!inRange(v, range[0], range[1])) e.push(`${path}.${k} must be ${range[0]} to ${range[1]}`); }
    else if (!isObj(v)) e.push(`${path}.${k} must be an object`);
    else for (const [k2, v2] of Object.entries(v)) {
      if (!range[k2]) e.push(`${path}.${k}: unknown rule "${k2}"`);
      else if (!inRange(v2, range[k2][0], range[k2][1])) e.push(`${path}.${k}.${k2} must be ${range[k2][0]} to ${range[k2][1]}`);
    }
  }
}
function checkEnding(en, level, registry, allIds, e) {
  if (!isObj(en)) return e.push('ending must be an object');
  keys(en, ['id', 'params'], 'ending', e);
  const def = registry.ending[en.id];
  if (!def) return e.push(`ending: unknown ending "${en.id}" (known: ${Object.keys(registry.ending).join(', ')})`);
  const params = en.params ?? {};
  if (!isObj(params)) return e.push('ending.params must be an object');
  const schema = def.params ?? {};
  for (const k of Object.keys(params)) if (!schema[k]) e.push(`ending.params: unknown param "${k}" for "${en.id}"`);
  for (const [k, s] of Object.entries(schema)) {
    const v = params[k];
    if (v === undefined) { if (s.default === undefined) e.push(`ending.params.${k} is required for "${en.id}"`); continue; }
    if (s.type === 'string' && !(typeof v === 'string' && v.length <= (s.max ?? 200))) e.push(`ending.params.${k} must be text of at most ${s.max ?? 200} characters`);
    if (s.type === 'number' && !inRange(v, s.min ?? -Infinity, s.max ?? Infinity)) e.push(`ending.params.${k} must be a number${s.min !== undefined ? ` from ${s.min}` : ''}${s.max !== undefined ? ` to ${s.max}` : ''}`);
    if (s.type === 'level') { if (!allIds.includes(v)) e.push(`ending.params.${k} ("next") must name an existing level`); else if (v === level.id) e.push(`ending.params.${k} cannot point at the level itself`); }
  }
}
function checkSections(level, registry, rules, e) {
  const sections = level.sections;
  if (!Array.isArray(sections)) return e.push('sections must be a list');
  const end = level.length_m ?? Infinity;
  let cursor = 0;
  const allRows = [];
  sections.forEach((s, i) => {
    const path = `sections[${i}]`;
    if (!isObj(s)) return e.push(`${path} must be an object`);
    keys(s, SECTION_KEYS, path, e);
    if (!inRange(s.from_m, 0, Infinity) || !inRange(s.to_m, 0, Infinity) || s.to_m <= s.from_m) return e.push(`${path}: from_m must be less than to_m, both 0 or more`);
    if (s.to_m > end) e.push(`${path}: must sit inside the level (length ${level.length_m} m)`);
    if (s.from_m < cursor) e.push(`${path}: sections overlap (starts at ${s.from_m} m, previous ended at ${cursor} m)`);
    cursor = s.to_m;
    if (s.obstacles !== undefined) checkObstacles(s.obstacles, `${path}.obstacles`, registry, e);
    if (s.density !== undefined) checkDensity(s.density, `${path}.density`, e);
    if (s.jugs !== undefined) checkJugs(s.jugs, `${path}.jugs`, registry, e);
    if (s.theme !== undefined) checkTheme(s.theme, `${path}.theme`, registry, e, false);
    if (s.curve !== undefined) checkCurve(s.curve, `${path}.curve`, e);
    if (s.camera !== undefined) checkCamera(s.camera, `${path}.camera`, e);
    if (s.props !== undefined) checkProps(s.props, `${path}.props`, registry, e);
    if (s.generation !== undefined && typeof s.generation !== 'boolean') e.push(`${path}.generation must be true or false`);
    if (s.placements === undefined) return;
    if (!Array.isArray(s.placements)) return e.push(`${path}.placements must be a list`);
    const placed = [];
    s.placements.forEach((p, j) => {
      const pp = `${path}.placements[${j}]`;
      if (!isObj(p)) return e.push(`${pp} must be an object`);
      keys(p, ['at_m', 'lane', 'kind', 'id'], pp, e);
      if (!inRange(p.at_m, s.from_m, s.to_m - 1e-9)) e.push(`${pp}.at_m must be inside its section (${s.from_m} to ${s.to_m} m)`);
      if (!['obstacle', 'pickup', 'prop'].includes(p.kind)) return e.push(`${pp}.kind must be obstacle, pickup or prop`);
      if (p.kind === 'prop') { if (p.lane !== undefined) e.push(`${pp}: a prop spans the street and has no lane`); }
      else if (![0, 1, 2].includes(p.lane)) e.push(`${pp}.lane must be 0, 1 or 2`);
      const def = registry[p.kind][p.id];
      if (!def) return e.push(`${pp}: unknown ${p.kind} "${p.id}"`);
      if (p.kind === 'prop' && level.length_m !== null && p.at_m + def.length > level.length_m) e.push(`${pp}: the prop runs past the end of the level (${p.at_m} + ${def.length} m)`);
      if (p.kind === 'obstacle') { placed.push({ at: p.at_m, lane: p.lane, def }); allRows.push(p.at_m); }
    });
    // Obstacles within half a row of each other are one row: three lanes with nothing to jump or slide is a wall.
    const walls = new Set();
    for (const p of placed) {
      const row = placed.filter((q) => Math.abs(q.at - p.at) <= ROW_GAP / 2);
      if (new Set(row.map((r) => r.lane)).size === 3 && !row.some((r) => passable(r.def, rules))) walls.add(Math.min(...row.map((r) => r.at)));
    }
    for (const z of walls) e.push(`${path}: placements at ${z} m block every lane with nothing to jump or slide`);
  });
  // Placed obstacle rows closer than the reaction floor at that point of the level fail: the author lowers rules.reaction or
  // spreads them out. Validation uses the level's own ramp; a speed carried in from a previous level is not known here.
  const rows = [...new Set(allRows)].sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i] - rows[i - 1];
    if (gap <= ROW_GAP / 2) continue; // one row, the wall rule covers it
    const floor = speedAt(level, rows[i], rules) * rules.reaction;
    if (gap < floor) e.push(`placements at ${rows[i - 1]} m and ${rows[i]} m are ${gap} m apart, under the reaction floor of ${floor.toFixed(1)} m at that speed`);
  }
}

// The single source of truth for "is this level OK?". Runs in the browser and in CI.
export function validateLevel(level, { fileId, allIds, registry }) {
  if (!isObj(level)) return ['level must be a JSON object'];
  const e = [];
  keys(level, LEVEL_KEYS, 'level', e);
  if (typeof level.id !== 'string' || !/^[a-z0-9-]+$/.test(level.id)) e.push('id must use only a-z, 0-9 and -');
  else if (level.id !== fileId) e.push(`id "${level.id}" must match the file name "${fileId}.json"`);
  if (!isName(level.title)) e.push('title must be 1-60 characters');
  if (!isName(level.author)) e.push('author must be 1-60 characters');
  const L = level.length_m;
  if (L === null) { if ('ending' in level) e.push('an endless level (length_m: null) cannot have an ending'); }
  else if (!Number.isInteger(L) || L < 100 || L > 10000) e.push('length_m must be a whole number from 100 to 10000, or null for endless');
  if (level.seed !== undefined && !Number.isInteger(level.seed)) e.push('seed must be a whole number');
  if (level.character !== undefined) {
    if (!isObj(level.character)) e.push('character must be an object');
    else { keys(level.character, ['id'], 'character', e); if (!registry.character[level.character.id]) e.push(`character: unknown character "${level.character.id}"`); }
  }
  if (level.theme === undefined) e.push('theme is required'); else checkTheme(level.theme, 'theme', registry, e, true);
  if (level.rules !== undefined) checkRules(level.rules, 'rules', e);
  if (level.curve !== undefined) checkCurve(level.curve, 'curve', e);
  if (level.camera !== undefined) checkCamera(level.camera, 'camera', e);
  if (level.props !== undefined) checkProps(level.props, 'props', registry, e);
  if (!isObj(level.obstacles)) e.push('obstacles must be an object of {id: weight}'); else checkObstacles(level.obstacles, 'obstacles', registry, e);
  if (level.density === undefined) e.push('density is required'); else checkDensity(level.density, 'density', e);
  if (level.jugs === undefined) e.push('jugs is required'); else checkJugs(level.jugs, 'jugs', registry, e);
  const rules = resolveRules(isObj(level.rules) ? level.rules : {});
  if (level.sections !== undefined) checkSections(level, registry, rules, e);
  if ('ending' in level && L !== null) checkEnding(level.ending, level, registry, allIds, e);
  // Empty obstacles are fine only when nothing would ever be generated from them.
  if (isObj(level.obstacles) && Object.keys(level.obstacles).length === 0) {
    const sections = Array.isArray(level.sections) ? level.sections.filter(isObj) : [];
    const dens = (d) => isObj(d) && (d.start > 0 || d.end > 0);
    const covered = sections.reduce((m, s) => Math.max(m, s.to_m || 0), 0);
    const baseGenerates = covered < (level.length_m ?? Infinity) && dens(level.density);
    const sectionGenerates = sections.some((s) => s.generation !== false && s.obstacles === undefined && dens(s.density ?? level.density));
    if (baseGenerates || sectionGenerates) e.push('obstacles may be empty only when every generated section has density 0');
  }
  return e;
}

export function validateAll(levels, index, registry) {
  const errors = {};
  const add = (file, msg) => (errors[file] ??= []).push(msg);
  if (!Array.isArray(index)) { add('index.json', 'must be a list of level ids'); return errors; }
  const allIds = Object.keys(levels);
  index.forEach((id, i) => {
    if (!allIds.includes(id)) add('index.json', `lists "${id}" but levels/${id}.json does not exist`);
    if (index.indexOf(id) !== i) add('index.json', `lists "${id}" twice`);
  });
  for (const id of allIds) for (const msg of validateLevel(levels[id], { fileId: id, allIds, registry })) add(`${id}.json`, msg);
  return errors;
}

export function validateCampaign(c, levelIds) {
  const e = [];
  if (!isObj(c)) return ['campaign must be a JSON object'];
  keys(c, ['start', 'locked'], 'campaign', e);
  if (!levelIds.includes(c.start)) e.push(`campaign.start "${c.start}" is not a level`);
  if (c.locked !== undefined) {
    if (!isObj(c.locked)) e.push('campaign.locked must be an object of {level: unlockedBy}');
    else for (const [id, by] of Object.entries(c.locked)) {
      if (!levelIds.includes(id)) e.push(`campaign.locked: "${id}" is not a level`);
      if (!levelIds.includes(by)) e.push(`campaign.locked: "${id}" is unlocked by "${by}", which is not a level`);
      if (id === by) e.push(`campaign.locked: "${id}" cannot be unlocked by itself`);
    }
  }
  return e;
}
