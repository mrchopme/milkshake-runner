export default {
  kind: 'ending', id: 'finish',
  params: { text: { type: 'string', max: 40, default: 'FINISH!' } },
  async run(ctx) { await ctx.hud.banner(ctx.params.text, 1200); return {}; },
};
