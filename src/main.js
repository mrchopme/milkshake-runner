import './style.css';
import { createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { loadLevels } from './levels.js';
import { loadCharacter } from './character.js';
import { createHud } from './hud.js';
import { playLevel } from './game.js';

async function main() {
  const engine = createEngine(document.getElementById('game'));
  const registry = loadRegistry({ fixtures: import.meta.env.DEV && location.search.includes('fixtures') });
  const { levels, campaign, errors } = loadLevels(registry);
  if (Object.keys(errors).length) console.warn(errors);
  const level = levels[campaign.start];
  const character = await loadCharacter(registry.character[level.character?.id ?? 'milkshake']);
  engine.scene.add(character.object);
  const hud = createHud();
  const { outcome, run } = await playLevel({ engine, level, registry, hud, character });
  hud.banner(`${outcome}: ${run.jugs} jugs. Reload to retry`, 1e9);
}
main();
