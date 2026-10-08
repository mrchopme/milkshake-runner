import { validateAll, validateCampaign } from './validate.js';
import { orderLevels } from './campaign.js';
import index from '../levels/index.json';
import campaign from '../levels/campaign.json';

const files = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });
const fixtureFiles = import.meta.glob('../test/fixtures/levels/*.json', { eager: true, import: 'default' });

// Loads every level file, validates all of them with the same code CI runs, and keeps the valid ones playable.
// `fixtures` adds the test pack's levels for the manual pass (dev only, ?fixtures in the URL).
export function loadLevels(registry, { fixtures = false } = {}) {
  const levels = {};
  for (const [path, data] of Object.entries(fixtures ? { ...files, ...fixtureFiles } : files)) {
    const id = path.split('/').pop().slice(0, -'.json'.length);
    if (!['index', 'campaign'].includes(id)) levels[id] = data;
  }
  const errors = validateAll(levels, index, registry);
  const campaignErrors = validateCampaign(campaign, Object.keys(levels));
  if (campaignErrors.length) errors['campaign.json'] = campaignErrors;
  return { levels, campaign, errors, ...orderLevels(levels, index, errors) };
}
