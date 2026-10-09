// The one place that knows what a content module must look like. Pure: no three, no DOM.
export const KIND_DIR = { obstacle: 'obstacles', pickup: 'pickups', prop: 'props', theme: 'themes', character: 'characters', ending: 'endings' };
const KINDS = Object.keys(KIND_DIR);
const PLAIN = /^[a-z0-9_-]+$/, NAMESPACED = /^[a-z0-9_-]+\/[a-z0-9_-]+$/, HEX = /^#[0-9a-fA-F]{6}$/;
const ASSET = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.glb$/; // a .glb under public/: lowercase, no leading slash, no ..
const LOOK_RANGES = { exposure: [0.2, 3], ambient: [0, 3], env: [0, 3] };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const fn = (v) => typeof v === 'function';

const CHECKS = {
  obstacle(m) {
    const e = [];
    if (!['lane', 'jump', 'slide', 'timing'].includes(m.avoid)) e.push('avoid must be lane, jump, slide or timing');
    const b = m.box;
    if (!isObj(b) || !num(b.w, 0.1, 10) || !num(b.h, 0.1, 10) || !num(b.d, 0.1, 20) || (b.y !== undefined && !num(b.y, 0, 5))) e.push('box needs w, h, d in metres (optional y = bottom)');
    const needsCycle = m.avoid === 'timing';
    const cycleOk = isObj(m.cycle) && num(m.cycle.period, 0.2, 10) && num(m.cycle.on, 0.05, m.cycle.period);
    if (needsCycle ? !cycleOk : m.cycle !== undefined) e.push('cycle {period, on} is required for timing obstacles and not allowed otherwise');
    if (m.moves !== undefined && typeof m.moves !== 'boolean') e.push('moves must be true or false');
    if (!fn(m.createView)) e.push('createView(gfx) is required');
    return e;
  },
  pickup(m) {
    const e = [];
    if (!HEX.test(m.color ?? '')) e.push('color must be a hex colour like "#ff4fa3"');
    if (!(m.duration === undefined || m.duration === 'untilHit' || num(m.duration, 0.5, 60))) e.push("duration must be seconds (0.5-60), 'untilHit' or omitted");
    if (m.value !== undefined && !(Number.isInteger(m.value) && m.value > 0)) e.push('value must be a whole number of jugs above 0');
    if (m.effect !== undefined) {
      if (!isObj(m.effect) || Object.keys(m.effect).some((k) => !['reach', 'multiplier', 'shield'].includes(k))) e.push('effect may only use reach, multiplier, shield');
      else {
        if (m.effect.reach !== undefined && !num(m.effect.reach, 1, 50)) e.push('effect.reach must be 1-50 metres');
        if (m.effect.multiplier !== undefined && !num(m.effect.multiplier, 1, 10)) e.push('effect.multiplier must be 1-10');
        if (m.effect.shield !== undefined && (m.effect.shield !== true || m.duration !== 'untilHit')) e.push("effect.shield must be true, with duration 'untilHit'");
        if (m.duration === undefined) e.push('an effect needs a duration');
      }
    }
    if (m.value === undefined && m.effect === undefined) e.push('a pickup needs value or effect');
    if (m.glyph !== undefined && typeof m.glyph !== 'string') e.push('glyph must be an SVG path string (28x28 box)');
    if (m.stroke !== undefined && typeof m.stroke !== 'boolean') e.push('stroke must be true or false');
    if (m.label !== undefined && !(typeof m.label === 'string' && m.label.length >= 1 && m.label.length <= 3)) e.push('label must be 1-3 characters');
    if (m.createView !== undefined && !fn(m.createView)) e.push('createView must be a function');
    if (m.name !== undefined && !(typeof m.name === 'string' && m.name.length >= 1 && m.name.length <= 24)) e.push('name must be 1-24 characters');
    if (m.blurb !== undefined && !(typeof m.blurb === 'string' && m.blurb.length >= 1 && m.blurb.length <= 80)) e.push('blurb must be 1-80 characters');
    return e;
  },
  // Scenery without collision: the engine places it at the road's centre and drops it once its far end is behind.
  prop(m) {
    const e = [];
    if (!num(m.length, 1, 100)) e.push('length in metres (1-100) is required');
    if (!fn(m.createView)) e.push('createView(gfx, { z, length, lanes }) is required');
    return e;
  },
  theme(m) {
    const e = [];
    if (!HEX.test(m.sky ?? '')) e.push('sky must be a hex colour');
    if (!num(m.fog, 0, 1)) e.push('fog must be 0-1');
    const b = m.buildings;
    if (!isObj(b) || !Array.isArray(b.colors) || !b.colors.length || !b.colors.every((c) => HEX.test(c)) || !num(b.minH, 1, 200) || !num(b.maxH, b.minH, 300)) e.push('buildings needs colors[] (hex), minH, maxH');
    if (m.createChunk !== undefined && !fn(m.createChunk)) e.push('createChunk must be a function');
    if (m.look !== undefined) e.push(...checkLook(m.look));
    return e;
  },
  character(m) {
    const e = [];
    if (!num(m.height, 0.5, 4) || !num(m.width, 0.3, 3)) e.push('height and width in metres are required');
    if (!(m.model == null || typeof m.model === 'string')) e.push('model must be a file name in public/ or null');
    if (m.yaw !== undefined && typeof m.yaw !== 'number') e.push('yaw must be a number in radians');
    if (!fn(m.createView)) e.push('createView(gfx) is required');
    return e;
  },
  ending(m) {
    const e = [];
    const p = m.params ?? {};
    if (!isObj(p)) e.push('params must be an object of {name: {type}}');
    else for (const [k, s] of Object.entries(p)) if (!isObj(s) || !['string', 'number', 'level'].includes(s.type)) e.push(`params.${k} needs a type of string, number or level`);
    if (m.streetAfter !== undefined && !num(m.streetAfter, 0, 500)) e.push('streetAfter must be 0-500 metres of street past the finish line');
    if (!fn(m.run)) e.push('run(ctx) is required');
    return e;
  },
};

// A theme's HiFi look (spec §4), every field optional. Used only when the engine has a look pipeline (src/look.js).
export function checkLook(l) {
  if (!isObj(l)) return ['look must be an object'];
  const e = [];
  for (const k of Object.keys(l)) if (!['exposure', 'sun', 'ambient', 'env', 'skyTop', 'bloom'].includes(k)) e.push(`look: unknown key "${k}"`);
  for (const [k, [lo, hi]] of Object.entries(LOOK_RANGES)) if (l[k] !== undefined && !num(l[k], lo, hi)) e.push(`look.${k} must be ${lo} to ${hi}`);
  if (l.skyTop !== undefined && !HEX.test(l.skyTop)) e.push('look.skyTop must be a hex colour');
  if (l.sun !== undefined) {
    if (!isObj(l.sun) || Object.keys(l.sun).some((k) => !['color', 'intensity'].includes(k))) e.push('look.sun may only set color and intensity');
    else {
      if (l.sun.color !== undefined && !HEX.test(l.sun.color)) e.push('look.sun.color must be a hex colour');
      if (l.sun.intensity !== undefined && !num(l.sun.intensity, 0, 10)) e.push('look.sun.intensity must be 0 to 10');
    }
  }
  if (l.bloom !== undefined) {
    if (!isObj(l.bloom) || Object.keys(l.bloom).some((k) => !['strength', 'threshold', 'radius'].includes(k))) e.push('look.bloom may only set strength, threshold and radius');
    else for (const [k, hi] of [['strength', 3], ['threshold', 1], ['radius', 1]]) if (l.bloom[k] !== undefined && !num(l.bloom[k], 0, hi)) e.push(`look.bloom.${k} must be 0 to ${hi}`);
  }
  return e;
}

export function checkModule(m) {
  if (!isObj(m)) return ['the default export must be an object'];
  if (!KINDS.includes(m.kind)) return [`kind must be one of ${KINDS.join(', ')}`];
  if (typeof m.id !== 'string' || !(PLAIN.test(m.id) || NAMESPACED.test(m.id))) return ['id must be a-z0-9_- (built-in) or handle/name (community)'];
  const e = CHECKS[m.kind](m);
  // Any module may list files the game preloads before play (src/assets.js); only .glb loads today.
  if (m.assets !== undefined && !(Array.isArray(m.assets) && m.assets.every((a) => typeof a === 'string' && ASSET.test(a)))) e.push('assets must be a list of .glb files under public/, like "hifi/model.glb" (lowercase)');
  return e;
}

// Pack modules (packs/<pack>/<kind>s/<id>.js) re-skin a registered module: how it looks, never how it plays.
export const SKIN_FIELDS = { obstacle: ['createView'], pickup: ['createView'], prop: ['createView'], character: ['createView'], theme: ['createChunk', 'look'], ending: [] };
const PACK_PATH = /^packs\/[a-z0-9_-]+\/([a-z]+)\/(.+)\.js$/;

// entries: [{ path: 'packs/<pack>/<kind>s/<id>.js', module }]. Pure. Returns a new registry with each overlay merged over
// the module it names, plus the overlays that failed; a failed overlay leaves that module exactly as it was.
export function applyPack(registry, entries) {
  const reg = Object.fromEntries(KINDS.map((k) => [k, Object.assign(Object.create(null), registry[k])]));
  const problems = [], done = new Set();
  for (const { path, module: m } of entries) {
    const e = [], where = PACK_PATH.exec(path);
    if (!isObj(m)) e.push('the default export must be an object');
    else if (!KINDS.includes(m.kind)) e.push(`kind must be one of ${KINDS.join(', ')}`);
    else if (typeof m.id !== 'string' || !(PLAIN.test(m.id) || NAMESPACED.test(m.id))) e.push('id must name a registered module');
    else if (!where || where[1] !== KIND_DIR[m.kind] || where[2] !== m.id) e.push(`must be saved as packs/<pack>/${KIND_DIR[m.kind]}/${m.id}.js`);
    else if (!registry[m.kind]?.[m.id]) e.push(`no registered ${m.kind} "${m.id}" to re-skin`);
    else if (done.has(`${m.kind}:${m.id}`)) e.push('duplicate overlay');
    else {
      for (const k of Object.keys(m)) if (!['kind', 'id', 'assets', ...SKIN_FIELDS[m.kind]].includes(k)) e.push(`"${k}" is not a looks-only field of ${m.kind} modules: packs change how things look, not how they play`);
      const merged = { ...registry[m.kind][m.id], ...m };
      if (!e.length) e.push(...checkModule(merged));
      if (!e.length) { reg[m.kind][m.id] = merged; done.add(`${m.kind}:${m.id}`); }
    }
    if (e.length) problems.push(`${isObj(m) && m.id ? `${m.kind} "${m.id}" (${path})` : path}: ${e.join('; ')}`);
  }
  return { registry: reg, problems };
}

// Browser loader for one pack. Lazy: a low-fi session never downloads pack code.
export async function loadPack(name, files = import.meta.glob('../packs/**/*.js', { import: 'default' })) {
  const mine = Object.entries(files).filter(([p]) => p.startsWith(`../packs/${name}/`));
  return Promise.all(mine.map(async ([p, load]) => ({ path: p.replace(/^(\.\.\/)+/, ''), module: await safeLoad(p, load) }))); // a file that fails to load comes back empty, and applyPack lists it
}

// entries: [{ path: 'content/<kind>s/...js', module }]. Pure. Only modules with no problem are registered;
// the maps have no prototype, so a level naming "constructor" or "toString" finds nothing.
function assemble(entries) {
  const reg = Object.fromEntries(KINDS.map((k) => [k, Object.create(null)]));
  const problems = [];
  for (const { path, module: m } of entries) {
    const errs = checkModule(m);
    const label = isObj(m) && m.id ? `${m.kind} "${m.id}" (${path})` : path;
    if (errs.length) { problems.push(`${label}: ${errs.join('; ')}`); continue; }
    const dir = `content/${KIND_DIR[m.kind]}/`;
    const mine = [];
    if (!path.startsWith(dir)) mine.push(`is in the wrong folder, expected ${dir}`);
    const builtin = new RegExp(`^${dir}[a-z0-9_-]+\\.js$`).test(path);
    if (!builtin) {
      if (!NAMESPACED.test(m.id)) mine.push(`community ids must be namespaced like "yourhandle/${m.id}"`);
      else if (path !== `${dir}${m.id}.js`) mine.push(`must be saved as ${dir}${m.id}.js`);
    }
    if (reg[m.kind][m.id]) mine.push('duplicate id');
    if (mine.length) problems.push(`${label}: ${mine.join('; ')}`);
    else reg[m.kind][m.id] = m;
  }
  return { registry: reg, problems };
}

// Strict: throws one error that lists every problem (tests and CI).
export function buildRegistry(entries) {
  const { registry, problems } = assemble(entries);
  if (problems.length) throw new Error(problems.join('\n'));
  return registry;
}

// Lenient: the browser keeps the good modules and shows the bad ones, so one broken file disables only itself.
export const tryBuildRegistry = assemble;

// Browser loader. `fixtures` adds test/fixtures/content for the manual pass (dev only, ?fixtures in the URL).
export function loadRegistry({ fixtures = false } = {}) {
  const files = import.meta.glob('../content/**/*.js', { eager: true, import: 'default' });
  const entries = Object.entries(files).map(([p, module]) => ({ path: p.replace(/^(\.\.\/)+/, ''), module }));
  if (fixtures) {
    const extra = import.meta.glob('../test/fixtures/content/**/*.js', { eager: true, import: 'default' });
    for (const [p, module] of Object.entries(extra)) entries.push({ path: p.replace(/^.*\/fixtures\//, ''), module });
  }
  return tryBuildRegistry(entries);
}

// A hook written by someone else may throw; the game must not freeze because of it.
export function safeCall(label, fn, fallback) {
  try { return fn(); } catch (err) { console.warn(`${label} failed:`, err); return fallback; }
}

// The async twin, for code loaded on demand (a pack file, the HiFi look): a 404 or a network drop skips it, never blanks the page.
export async function safeLoad(label, load) {
  try { return await load(); } catch (err) { console.warn(`${label} failed to load:`, err); return undefined; }
}
