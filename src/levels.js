import { validateAll, validateCampaign, validateLevel } from './validate.js';
import { orderLevels } from './campaign.js';
import index from '../levels/index.json' with { type: 'json' };
import campaign from '../levels/campaign.json' with { type: 'json' };

// Loads every level file, validates all of them with the same code CI runs, and keeps the valid ones playable.
// `fixtures` adds the test pack's levels for the manual pass (dev only, ?fixtures in the URL).
export function loadLevels(registry, { fixtures = false } = {}) {
  // Globs live in here, so Node can import this module for tryLevel's tests (import.meta.glob is Vite-only).
  const files = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });
  const fixtureFiles = import.meta.glob('../test/fixtures/levels/*.json', { eager: true, import: 'default' });
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

// ponytail: GitHub only, so every shared level sits where Caedon can moderate and a URL names an account; widen when another host earns it
export const TRY_HOSTS = ['raw.githubusercontent.com', 'gist.githubusercontent.com'];
export const TRY_MAX = 65536; // characters

// A level by URL, checked by the same validator as the repo's own; every problem comes back as a message, never a throw.
export async function tryLevel(url, { levels, registry, fetch = globalThis.fetch }) {
  const fail = (message) => ({ id: null, level: null, errors: [message] });
  let u;
  try { u = new URL(url); } catch { return fail('not a URL'); }
  if (u.protocol !== 'https:' || !TRY_HOSTS.includes(u.hostname)) return fail(`only https links on ${TRY_HOSTS.join(' or ')} can be tried`);
  let text;
  try {
    const res = await fetch(u.href);
    if (!res.ok) return fail(`could not fetch it (${res.status})`);
    text = await res.text();
  } catch (e) { return fail(`could not fetch it (${e.message})`); }
  if (text.length > TRY_MAX) return fail('the file is over 64 KB');
  let level;
  try { level = JSON.parse(text); } catch (e) { return fail(`not valid JSON (${e.message})`); }
  const id = typeof level?.id === 'string' ? level.id : '';
  if (Object.hasOwn(levels, id)) return { id, level, errors: [`"${id}" is already a level in the game; give yours another id`] };
  return { id: id || null, level, errors: validateLevel(level, { fileId: id, allIds: [...Object.keys(levels), id], registry }) };
}
