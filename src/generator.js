import { jumpHeight, speedAt } from './rules.js';

export const ROW_GAP = 12;          // metres between generated obstacle rows
export const START_CLEAR = 40;      // empty road at the start of every level
export const END_CLEAR = 60;        // empty road before a finite level's end
export const SPECIAL_CHANCE = 1 / 40;
export const ENDLESS_RAMP_M = 2000; // endless density reaches density.end here
export const JUG_CLEARANCE = 3;     // no pickup within this many metres of an obstacle in its lane

// mulberry32: tiny seeded PRNG, so a seed always builds the same street.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Can the player get past this obstacle in its own lane under these rules? Dimensions decide, not the label alone.
export function passable(def, rules) {
  if (def.avoid === 'timing') return true;
  const bottom = def.box.y ?? 0;
  if (def.avoid === 'jump') return bottom === 0 && def.box.h <= jumpHeight(rules);
  if (def.avoid === 'slide') return bottom >= rules.slideHeight;
  return false;
}

// Turns a level file into ordered sections that cover the whole level. Base sections (no override)
// interpolate density across the whole level, so a level without sections behaves exactly as before.
export function normalizeLevel(level) {
  const length = level.length_m;
  const end = length ?? Infinity;
  const levelSpan = [0, length ?? ENDLESS_RAMP_M];
  const base = (from, to) => ({ from, to, obstacles: level.obstacles, density: level.density, densitySpan: levelSpan, jugs: level.jugs, theme: level.theme, curve: level.curve ?? null, camera: level.camera ?? null, props: level.props ?? null, generation: true, placements: [] });
  const sections = [];
  let cursor = 0;
  for (const s of level.sections ?? []) {
    if (s.from_m > cursor) sections.push(base(cursor, s.from_m));
    sections.push({
      ...base(s.from_m, s.to_m),
      obstacles: s.obstacles ?? level.obstacles,
      density: s.density ?? level.density,
      densitySpan: s.density ? [s.from_m, s.to_m] : levelSpan,
      jugs: s.jugs ?? level.jugs,
      theme: s.theme ? { ...level.theme, ...s.theme } : level.theme,
      curve: s.curve ?? level.curve ?? null,
      camera: s.camera ? { ...(level.camera ?? {}), ...s.camera } : level.camera ?? null,
      props: s.props ?? level.props ?? null,
      generation: s.generation !== false,
      placements: s.placements ?? [],
    });
    cursor = s.to_m;
  }
  if (cursor < end) sections.push(base(cursor, end));
  return { length, seed: level.seed, sections };
}

export const sectionAt = (norm, z) => norm.sections.find((s) => z >= s.from && z < s.to) ?? norm.sections[norm.sections.length - 1];
export const cameraAt = (norm, z) => sectionAt(norm, z).camera ?? {}; // the section's camera override, merged over the level's

export function densityAt(section, z) {
  const [z0, z1] = section.densitySpan;
  const t = z1 > z0 ? Math.min(1, Math.max(0, (z - z0) / (z1 - z0))) : 1;
  return section.density.start + (section.density.end - section.density.start) * t;
}

export const RANDOM_CURVE_M = 240; // "random" curves pick a new target every this many metres
export const FINISH_STRAIGHT_M = 120; // a finite level's last metres are straight, so endings play on the street they were built for

// The stretches of street in [fromZ, toZ) that bend, { from, to, turn, hill } ordered by from, each with its real start and end lines.
// A section's curve is one stretch; "random" is one stretch per RANDOM_CURVE_M with a seeded pick; nothing runs into the finish straight.
export function curveSegments(norm, fromZ, toZ, seed = 0) {
  const end = norm.length == null ? Infinity : norm.length - FINISH_STRAIGHT_M;
  const out = [];
  const push = (from, to, turn, hill) => {
    to = Math.min(to, end);
    if (!(from < to && from < toZ && to > fromZ && (turn || hill))) return;
    const last = out.at(-1);
    if (last && last.to === from && last.turn === turn && last.hill === hill) last.to = to; // one bend over touching stretches is one stretch: the formula is exact under splitting, and the shader has four slots
    else out.push({ from, to, turn, hill });
  };
  for (const s of norm.sections) {
    if (!s.curve || s.to <= fromZ || s.from >= Math.min(toZ, end)) continue;
    if (s.curve === 'random') {
      for (let k = Math.floor(Math.max(s.from, fromZ) / RANDOM_CURVE_M); k * RANDOM_CURVE_M < Math.min(s.to, toZ, end); k++) {
        const pick = rng((seed + 0x9e3779b9 * (k + 1)) >>> 0);
        push(Math.max(s.from, k * RANDOM_CURVE_M), Math.min(s.to, (k + 1) * RANDOM_CURVE_M), [-1, -0.5, 0, 0.5, 1][Math.floor(pick() * 5)], [-0.6, 0, 0.6][Math.floor(pick() * 3)]);
      }
    } else push(s.from, s.to, s.curve.turn ?? 0, s.curve.hill ?? 0);
  }
  return out;
}

function pick(weights, r) {
  const entries = Object.entries(weights);
  let x = r() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of entries) if ((x -= w) < 0) return id;
  return entries[entries.length - 1][0];
}

function shuffledLanes(r) {
  const lanes = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

// Obstacles, pickups (and later props) for z in [fromZ, toZ). Call with consecutive ranges on one rng and one `state`:
// state.lastRow remembers the previous generated row across chunks, state.speedFrom is the speed carried into the level.
export function generate(norm, r, fromZ, toZ, registry, rules, state = { lastRow: -Infinity, speedFrom: rules.speed.start, propEnd: -Infinity }) {
  const obstacles = [], pickups = [], props = [];
  const lastRow = norm.length == null ? Infinity : norm.length - END_CLEAR;
  const firstRow = Math.ceil(Math.max(fromZ, START_CLEAR) / ROW_GAP) * ROW_GAP;
  const level = { length_m: norm.length ?? null };
  const placedRows = norm.sections.flatMap((s) => s.placements.filter((p) => p.kind === 'obstacle').map((p) => p.at_m));

  for (let z = firstRow; z < Math.min(toZ, lastRow); z += ROW_GAP) {
    const s = sectionAt(norm, z);
    if (!s.generation || s.placements.some((p) => p.kind === 'obstacle' && Math.abs(p.at_m - z) < ROW_GAP)) continue; // placements own their row
    // Reaction floor: at speed v a row never comes closer than v × reaction metres to the previous row (generated or placed)
    // or to the next placed row ahead, which the generator cannot move.
    const prev = Math.max(state.lastRow, ...placedRows.filter((a) => a < z)), next = Math.min(...placedRows.filter((a) => a > z));
    if (z - prev < speedAt(level, z, rules, state.speedFrom) * rules.reaction) continue;
    if (next - z < speedAt(level, next, rules, state.speedFrom) * rules.reaction) continue;
    if (r() >= densityAt(s, z)) continue;
    const ids = Object.keys(s.obstacles);
    if (!ids.length) continue;
    const roll = r();
    const lanes = shuffledLanes(r).slice(0, roll < 0.15 ? 3 : roll < 0.5 ? 2 : 1);
    const picked = lanes.map(() => pick(s.obstacles, r));
    if (lanes.length === 3 && !picked.some((id) => passable(registry.obstacle[id], rules))) {
      const passIds = ids.filter((id) => passable(registry.obstacle[id], rules));
      if (passIds.length) picked[0] = passIds[Math.floor(r() * passIds.length)];
      else { lanes.pop(); picked.pop(); }
    }
    lanes.forEach((lane, i) => {
      const def = registry.obstacle[picked[i]];
      const o = { id: picked[i], lane, z };
      if (def.moves) {
        const free = [lane - 1, lane + 1].filter((l) => l >= 0 && l <= 2 && !lanes.includes(l));
        o.moveTo = free.length ? free[Math.floor(r() * free.length)] : null;
      }
      obstacles.push(o);
    });
    state.lastRow = z;
  }

  for (const s of norm.sections) for (const p of s.placements) {
    if (p.at_m < fromZ || p.at_m >= toZ) continue;
    const item = { id: p.id, lane: p.lane, z: p.at_m, placed: true };
    if (p.kind === 'obstacle') { if (registry.obstacle[p.id].moves) item.moveTo = null; obstacles.push(item); }
    else if (p.kind === 'prop') props.push({ id: p.id, z: p.at_m, length: registry.prop[p.id].length, placed: true });
    else pickups.push(item);
  }

  for (const s of norm.sections) {
    if (!s.jugs.per_100m) continue;
    const gap = 100 / s.jugs.per_100m;
    const z0 = Math.max(fromZ, s.from, START_CLEAR / 2);
    const z1 = Math.min(toZ, s.to, norm.length == null ? Infinity : norm.length - END_CLEAR / 2);
    // ponytail: clearance only checks this chunk's obstacles; a pickup at a chunk edge can sit beside the
    // next chunk's first row. Harmless (pickups never hurt); check neighbours if it ever looks wrong.
    for (let k = Math.ceil(z0 / gap); k * gap < z1; k++) {
      const z = k * gap;
      const free = [0, 1, 2].filter((l) => !obstacles.some((o) => o.lane === l && Math.abs(o.z - z) < JUG_CLEARANCE));
      if (!free.length) continue;
      const lane = free[Math.floor(r() * free.length)];
      const specials = s.jugs.powerups;
      const id = specials.length && r() < SPECIAL_CHANCE ? specials[Math.floor(r() * specials.length)] : 'jug';
      pickups.push({ id, lane, z });
    }
  }

  // Props: on a grid like jugs, by weight, never overlapping another prop (generated or placed), never past the level's end.
  const placedProps = norm.sections.flatMap((s) => s.placements.filter((p) => p.kind === 'prop').map((p) => ({ z: p.at_m, end: p.at_m + registry.prop[p.id].length })));
  let propEnd = state.propEnd ?? -Infinity;
  for (const s of norm.sections) {
    if (!s.props?.per_100m || !Object.keys(s.props.ids).length) continue;
    const gap = 100 / s.props.per_100m;
    const z0 = Math.max(fromZ, s.from, START_CLEAR), z1 = Math.min(toZ, s.to);
    for (let k = Math.ceil(z0 / gap); k * gap < z1; k++) {
      const z = k * gap, id = pick(s.props.ids, r), len = registry.prop[id].length;
      if (z < propEnd || (norm.length != null && z + len > norm.length)) continue;
      if (placedProps.some((pp) => z < pp.end && z + len > pp.z)) continue;
      props.push({ id, z, length: len });
      propEnd = z + len;
    }
  }
  state.propEnd = propEnd;
  return { obstacles, pickups, props };
}
