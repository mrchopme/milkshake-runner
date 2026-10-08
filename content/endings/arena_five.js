export default {
  kind: 'ending', id: 'arena_five', streetAfter: 0,
  params: { text: { type: 'string', max: 60, default: 'Season tip-off. Brought to you by Milkshake.' } },
  async run(ctx) { await ctx.hud.card(ctx.params.text, 3000); return {}; },
};
