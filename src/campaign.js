// Progression is data (levels/campaign.json); endings never decide what unlocks.
export const isLocked = (campaign, save, id) => Boolean(campaign.locked?.[id]) && !save.completed.includes(campaign.locked[id]);
export function completeLevel(save, id) { if (!save.completed.includes(id)) save.completed.push(id); return save; }
