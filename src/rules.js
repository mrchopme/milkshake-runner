// Rules are parameters. A level may override any default within RULE_RANGES; nothing in here names content.
export const MAX_DT = 0.05;          // longest frame the physics will accept (a backgrounded tab must not teleport)
export const BIKE_TRIGGER = 30;      // metres ahead at which a moving obstacle starts to swerve
export const BIKE_SPEED = 4;         // its lateral speed, m/s
export const PULL_ACROSS = 12;       // m/s a pulled pickup slides sideways
export const PULL_ALONG = 2;         // times the run speed a pulled pickup comes back along the street

export const DEFAULT_RULES = {
  laneWidth: 2.5, laneTime: 0.15, gravity: -30, jumpSpeed: 9, fastFall: -15, slideTime: 0.6, slideHeight: 0.8, grace: 1,
  reaction: 0.6,                                  // seconds: a row never comes closer than speed × reaction behind the previous one
  speed: { start: 12, end: 24, cap: 30, ramp: 0.006 },
};
export const RULE_RANGES = {
  laneWidth: [1.5, 4], laneTime: [0.05, 0.5], gravity: [-60, -10], jumpSpeed: [5, 15], fastFall: [-40, -5], slideTime: [0.3, 2], slideHeight: [0.4, 1.5], grace: [0, 3],
  reaction: [0.2, 1.5],
  speed: { start: [4, 40], end: [4, 40], cap: [4, 60], ramp: [0, 0.05] },
};

export function resolveRules(overrides = {}) {
  return { ...DEFAULT_RULES, ...overrides, speed: { ...DEFAULT_RULES.speed, ...(overrides.speed ?? {}) } };
}

// The camera looks down +z, so screen-left is +x: lane 0 = +laneWidth, lane 2 = -laneWidth.
export const laneX = (lane, rules) => (1 - lane) * rules.laneWidth;
export const jumpHeight = (rules) => rules.jumpSpeed ** 2 / (2 * -rules.gravity);

// `from` is the speed carried in from the previous level (default: the start speed): a finite level ramps on from there by
// the same amount its file asks for, so level 2 starts where level 1 finished. Everything is capped at speed.cap.
export function speedAt(level, z, rules, from = rules.speed.start) {
  const s = rules.speed;
  if (level.length_m === null) return Math.min(s.cap, from + z * s.ramp);
  return Math.min(s.cap, from + (s.end - s.start) * Math.min(1, z / level.length_m));
}

export function createRun(rules, character, jugs = 0, speedFrom = rules.speed.start) {
  return {
    rules, dims: { height: character.height, width: character.width },
    lane: 1, x: 0, y: 0, vy: 0, slideT: 0, z: 0, time: 0, jugs, effects: {}, graceT: 0, over: false,
    speed: speedFrom, speedFrom, // speed is what step() was last given; content reads it (stride, dust, streaks)
  };
}

export function act(run, action) {
  const R = run.rules;
  if (run.over) return;
  if (action === 'left') run.lane = Math.max(0, run.lane - 1);
  else if (action === 'right') run.lane = Math.min(2, run.lane + 1);
  else if (action === 'jump' && run.y === 0 && run.vy === 0) { run.vy = R.jumpSpeed; run.slideT = 0; }
  else if (action === 'slide') { run.slideT = R.slideTime; if (run.y > 0) run.vy = Math.min(run.vy, R.fastFall); }
}

export function step(run, rawDt, speed) {
  const R = run.rules;
  const dt = Math.min(rawDt, MAX_DT);
  run.time += dt;
  run.speed = speed;
  run.z += speed * dt;
  const maxMove = (R.laneWidth / R.laneTime) * dt;
  run.x += Math.max(-maxMove, Math.min(maxMove, laneX(run.lane, R) - run.x));
  if (run.y > 0 || run.vy !== 0) {
    run.vy += R.gravity * dt;
    run.y += run.vy * dt;
    if (run.y <= 0) { run.y = 0; run.vy = 0; }
  }
  run.slideT = Math.max(0, run.slideT - dt);
  run.graceT = Math.max(0, run.graceT - dt);
  for (const [id, e] of Object.entries(run.effects)) {
    if (!Number.isFinite(e.t)) continue;
    e.t -= dt;
    if (e.t <= 0) delete run.effects[id];
  }
  return dt;
}

export function playerBox(run) {
  const h = run.slideT > 0 ? Math.min(run.rules.slideHeight, run.dims.height) : run.dims.height;
  const hw = run.dims.width / 2;
  return { x0: run.x - hw, x1: run.x + hw, y0: run.y, y1: run.y + h, z0: run.z - 0.4, z1: run.z + 0.4 };
}

export function obstacleBox(o, def, time, rules) {
  if (def.cycle && time % def.cycle.period >= def.cycle.on) return null; // a timing obstacle is "off"
  const x = o.x ?? laneX(o.lane, rules), y = def.box.y ?? 0, b = def.box;
  return { x0: x - b.w / 2, x1: x + b.w / 2, y0: y, y1: y + b.h, z0: o.z - b.d / 2, z1: o.z + b.d / 2 };
}

export const overlaps = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;

export function hit(run) {
  if (run.graceT > 0) return 'grace';
  const shield = Object.entries(run.effects).find(([, e]) => e.shield);
  if (shield) { delete run.effects[shield[0]]; run.graceT = run.rules.grace; return 'shield'; }
  run.over = true;
  return 'dead';
}

export function multiplier(run) { let m = 1; for (const e of Object.values(run.effects)) if (e.multiplier) m *= e.multiplier; return m; }
export function reach(run) { let r = 0; for (const e of Object.values(run.effects)) if (e.reach) r = Math.max(r, e.reach); return r; }

// A pickup inside the magnet's reach is pulled, not collected: it slides toward Milkshake over a few frames and inReach
// picks it up at arm's length. p.x is the pickup's logical x once a pull has moved it (lane centre until then).
export function pulled(run, p) { const dz = p.z - run.z, r = reach(run); return r > 0 && dz > -1 && dz < r; }
export function pull(run, p, dt) {
  if (!pulled(run, p)) return;
  const x = p.x ?? laneX(p.lane, run.rules), sx = PULL_ACROSS * dt, sz = PULL_ALONG * run.speed * dt;
  p.x = x + Math.max(-sx, Math.min(sx, run.x - x));
  p.z -= Math.min(sz, Math.max(0, p.z - run.z - 0.3));
}
export function inReach(run, p) {
  const dz = p.z - run.z, x = p.x ?? laneX(p.lane, run.rules);
  return Math.abs(dz) < 0.8 && Math.abs(x - run.x) < 1;
}

// def is a pickup module: value adds jugs now; effect starts a timed (or until-hit) capability.
export function collect(run, def) {
  if (def.value) run.jugs += def.value * multiplier(run);
  if (def.effect) run.effects[def.id] = { t: def.duration === 'untilHit' ? Infinity : def.duration, ...def.effect };
}

export function updateObstacle(o, def, run, dt) {
  if (!def.moves || o.moveTo == null || o.z - run.z > BIKE_TRIGGER) return;
  const x = o.x ?? laneX(o.lane, run.rules), target = laneX(o.moveTo, run.rules), s = BIKE_SPEED * dt;
  o.x = x + Math.max(-s, Math.min(s, target - x));
}
