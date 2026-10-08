export default {
  kind: 'ending', id: 'demo/banner',
  params: { text: { type: 'string', max: 40, default: 'YOU MADE IT' }, hold: { type: 'number', min: 0.5, max: 5, default: 2 } },
  async run(ctx) { await ctx.hud.banner(ctx.params.text, ctx.params.hold * 1000); return {}; },
};
