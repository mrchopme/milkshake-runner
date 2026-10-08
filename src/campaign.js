// Progression is data (levels/campaign.json); endings never decide what unlocks.
export const isLocked = (campaign, save, id) => Boolean(campaign.locked?.[id]) && !save.completed.includes(campaign.locked[id]);
export function completeLevel(save, id) { if (!save.completed.includes(id)) save.completed.push(id); return save; }

// Display order: the shipped index first, then every other level by title. Invalid files stay listed, disabled.
export function orderLevels(levels, index, errors) {
  const listed = index.filter((id) => levels[id]);
  const rest = Object.keys(levels).filter((id) => !index.includes(id)).sort((a, b) => String(levels[a].title).localeCompare(String(levels[b].title)));
  return { order: [...listed, ...rest], valid: (id) => !errors[`${id}.json`] };
}
