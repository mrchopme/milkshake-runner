import './style.css';
import * as gfx from './gfx.js';
import { createEngine } from './engine.js';
import { loadRegistry, applyPack, loadPack, safeLoad } from './registry.js';
import { preload, gate } from './assets.js';
import { loadLevels } from './levels.js';
import { loadCharacter } from './character.js';
import { createHud, pickupIcon, pickupName } from './hud.js';
import { playLevel } from './game.js';
import { playEnding } from './endings.js';
import { createWorld } from './world.js';
import { createRun, resolveRules } from './rules.js';
import { loadSave, writeSave, recordRun } from './save.js';
import { isLocked, completeLevel } from './campaign.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'select', 'results', 'error', 'help'];
const show = (id) => SCREENS.forEach((s) => ($(s).hidden = s !== id));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (parent, tag, content, cls) => { const n = document.createElement(tag); n.textContent = content; if (cls) n.className = cls; parent.append(n); return n; };

function showErrors(errors) {
  // Community strings: textContent only.
  for (const [file, msgs] of Object.entries(errors)) text($('error-list'), 'li', `${file}: ${msgs.join('; ')}`);
  show('error');
}

// HiFi is a looks-only pack over the shipped content: on with a mouse or trackpad, off on touch. ?hifi or ?lofi forces it.
const params = new URLSearchParams(location.search);
const quality = params.has('hifi') ? 'hifi' : params.has('lofi') ? 'lofi' : matchMedia('(pointer: fine)').matches ? 'hifi' : 'lofi';

async function main() {
  const engine = createEngine($('game'));
  const look = quality === 'hifi' && await safeLoad('the HiFi look', () => import('./look.js')); // loads only for HiFi; if it fails, low-fi draws
  if (look) engine.useLook(look.createLook(engine));
  const hud = createHud();
  const save = loadSave();
  const fixtures = import.meta.env.DEV && location.search.includes('fixtures');
  let { registry, problems } = loadRegistry({ fixtures }); // a broken content module disables only itself
  if (quality === 'hifi') {
    const pack = applyPack(registry, await loadPack('hifi')); // a broken overlay disables only itself; the module underneath carries on
    registry = pack.registry;
    problems = [...problems, ...pack.problems];
  }
  if (problems.length) console.warn('Some content files are disabled:', problems);
  // Every file the registered modules list (low-fi lists none). ponytail: all at boot; per level once a pack passes ~30 MB.
  const paths = Object.values(registry).flatMap((byId) => Object.values(byId).flatMap((m) => m.assets ?? []));
  const loaded = preload(paths), ready = gate(loaded);
  if (paths.length) { $('play').textContent = 'LOADING…'; loaded.then(() => ($('play').textContent = 'RUN')); }
  const { levels, campaign, order, errors, valid } = loadLevels(registry, { fixtures });
  if (errors['campaign.json'] || errors['index.json'] || !valid(campaign.start)) return showErrors(errors);
  if (Object.keys(errors).length) console.warn('Some levels are disabled:', errors);

  const defaultRules = resolveRules();
  let backdrop = null;
  // One character in the scene at a time: a level's character replaces the previous one.
  const character = async (level) => {
    const view = await loadCharacter(registry.character[level.character?.id ?? 'milkshake']);
    for (const c of engine.scene.children.filter((c) => c.userData.character && c !== view.object)) engine.scene.remove(c);
    if (!view.object.parent) { view.object.userData.character = true; engine.scene.add(gfx.bend(view.object)); } // the GLB's toon swap and the dust materials are the module's own
    return view;
  };

  async function menu() {
    const level = levels[campaign.start];
    if (!backdrop) backdrop = createWorld(engine.scene, level, { registry, rules: defaultRules, seed: 1, end: 400 });
    const idle = createRun(defaultRules, registry.character[level.character?.id ?? 'milkshake']);
    backdrop.update(idle, 0);
    engine.setSky(backdrop.skyAt(0));
    engine.follow(idle, {}, Infinity); // a still: the felt speed of the last run does not carry into the menu
    engine.render();
    $('endless').hidden = !levels.endless || isLocked(campaign, save, 'endless');
    show('menu'); // the street and the buttons appear before the character model has downloaded
    const view = await character(level);
    view.update(idle);
    engine.render();
  }

  function levelSelect() {
    const list = $('level-list');
    list.replaceChildren();
    for (const p of problems) { // disabled content modules, listed where contributors look
      const b = document.createElement('button'), i = p.indexOf(': ');
      text(b, 'span', p.slice(0, i)); text(b, 'small', `needs fixing: ${p.slice(i + 2)}`); b.disabled = true; list.append(b);
    }
    for (const id of order) {
      const lv = levels[id], b = document.createElement('button');
      const locked = isLocked(campaign, save, id), broken = !valid(id);
      text(b, 'span', String(lv.title ?? id));
      const bits = [`by ${lv.author ?? 'unknown'}`];
      if (save.best[id]) bits.push(`best ${save.best[id]}`);
      if (locked) bits.push('locked');
      if (broken) bits.push(`needs fixing: ${errors[`${id}.json`][0]}`);
      text(b, 'small', bits.join(' · '));
      b.disabled = locked || broken;
      b.onclick = () => startLevel(id);
      list.append(b);
    }
    show('select');
  }

  // Every registered power-up explains itself here from its own name and blurb, community ones included.
  function help(back) {
    const list = $('powerup-list');
    list.replaceChildren();
    for (const def of Object.values(registry.pickup).filter((d) => d.effect)) {
      const row = document.createElement('div'), words = document.createElement('div');
      row.className = 'power';
      text(words, 'b', pickupName(def));
      if (def.blurb) text(words, 'small', def.blurb);
      row.append(pickupIcon(def), words);
      list.append(row);
    }
    $('help-ok').onclick = back;
    show('help');
  }

  async function startLevel(id, carry = {}) {
    if (!(await ready())) return; // a view needs its files before the street is built; a second click while they load is dropped
    if (!save.helpSeen) { save.helpSeen = true; writeSave(save); return help(() => startLevel(id, carry)); } // once per browser, before the first run however it starts (spec §4)
    show(null);
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    const level = levels[id];
    const view = await character(level);
    let result;
    try {
      result = await playLevel({ engine, level, registry, hud, character: view, carryJugs: carry.jugs ?? 0, carrySpeed: carry.speed });
    } catch (error) {
      console.error(error);
      result = { outcome: 'error', run: { jugs: carry.jugs ?? 0 }, world: null, error };
    }
    const { outcome, run, world } = result;
    let flow = {};
    if (outcome === 'complete') {
      flow = await playEnding(level.ending, { engine, level, registry, run, hud, character: view, rules: run.rules });
      completeLevel(save, id);
    } else { engine.render(); await wait(900); }
    recordRun(save, id, run.jugs);
    writeSave(save);
    world?.dispose();
    if (flow.next && levels[flow.next] && valid(flow.next)) return startLevel(flow.next, flow.carry ? { jugs: run.jugs, speed: run.speed } : {});

    $('result-title').textContent = outcome === 'complete' ? `${level.title}: cleared!` : outcome === 'dead' ? 'Bonk!' : 'This level broke';
    $('result-jugs').textContent = outcome === 'error' ? `Something in "${level.title}" threw an error. The other levels still work.` : `${run.jugs} jugs · best ${save.best[id]}`;
    $('again').onclick = () => startLevel(id);
    show('results');
  }

  $('play').onclick = () => startLevel(campaign.start);
  $('how').onclick = () => help(menu);
  $('levels').onclick = levelSelect;
  $('endless').onclick = () => startLevel('endless');
  $('back').onclick = menu;
  $('to-menu').onclick = menu;
  await menu();
}
main();
