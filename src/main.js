import './style.css';
import { createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { loadLevels } from './levels.js';
import { loadCharacter } from './character.js';
import { createHud } from './hud.js';
import { playLevel } from './game.js';
import { playEnding } from './endings.js';
import { createWorld } from './world.js';
import { createRun, resolveRules } from './rules.js';
import { loadSave, writeSave, recordRun } from './save.js';
import { isLocked, completeLevel } from './campaign.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'select', 'results', 'error'];
const show = (id) => SCREENS.forEach((s) => ($(s).hidden = s !== id));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (parent, tag, content, cls) => { const n = document.createElement(tag); n.textContent = content; if (cls) n.className = cls; parent.append(n); return n; };

function showErrors(errors) {
  // Community strings: textContent only.
  for (const [file, msgs] of Object.entries(errors)) text($('error-list'), 'li', `${file}: ${msgs.join('; ')}`);
  show('error');
}

async function main() {
  const engine = createEngine($('game'));
  const hud = createHud();
  const save = loadSave();
  const fixtures = import.meta.env.DEV && location.search.includes('fixtures');
  let registry;
  try { registry = loadRegistry({ fixtures }); }
  catch (err) { return showErrors({ 'content/': String(err.message).split('\n') }); }
  const { levels, campaign, order, errors, valid } = loadLevels(registry, { fixtures });
  if (errors['campaign.json'] || errors['index.json'] || !valid(campaign.start)) return showErrors(errors);
  if (Object.keys(errors).length) console.warn('Some levels are disabled:', errors);

  const defaultRules = resolveRules();
  let backdrop = null;
  const character = async (level) => {
    const view = await loadCharacter(registry.character[level.character?.id ?? 'milkshake']);
    if (!view.object.parent) engine.scene.add(view.object);
    return view;
  };

  async function menu() {
    const level = levels[campaign.start];
    const view = await character(level);
    for (const v of engine.scene.children.filter((c) => c.userData.character && c !== view.object)) engine.scene.remove(v);
    view.object.userData.character = true;
    if (!backdrop) backdrop = createWorld(engine.scene, level, { registry, rules: defaultRules, seed: 1, end: 400 });
    const idle = createRun(defaultRules, registry.character[level.character?.id ?? 'milkshake']);
    backdrop.update(idle, 0);
    view.update(idle);
    engine.setSky(backdrop.skyAt(0));
    engine.follow(idle);
    engine.render();
    $('endless').hidden = !levels.endless || isLocked(campaign, save, 'endless');
    show('menu');
  }

  function levelSelect() {
    const list = $('level-list');
    list.replaceChildren();
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

  async function startLevel(id, carry = 0) {
    show(null);
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    const level = levels[id];
    const view = await character(level);
    let result;
    try {
      result = await playLevel({ engine, level, registry, hud, character: view, carryJugs: carry });
    } catch (error) {
      console.error(error);
      result = { outcome: 'error', run: { jugs: carry }, world: null, error };
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
    if (flow.next && levels[flow.next] && valid(flow.next)) return startLevel(flow.next, flow.carry ? run.jugs : 0);

    $('result-title').textContent = outcome === 'complete' ? `${level.title}: cleared!` : outcome === 'dead' ? 'Bonk!' : 'This level broke';
    $('result-jugs').textContent = outcome === 'error' ? `Something in "${level.title}" threw an error. The other levels still work.` : `${run.jugs} jugs · best ${save.best[id]}`;
    $('again').onclick = () => startLevel(id);
    show('results');
  }

  $('play').onclick = () => startLevel(campaign.start);
  $('levels').onclick = levelSelect;
  $('endless').onclick = () => startLevel('endless');
  $('back').onclick = menu;
  $('to-menu').onclick = menu;
  await menu();
}
main();
