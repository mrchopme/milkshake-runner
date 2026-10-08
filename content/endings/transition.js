export default {
  kind: 'ending', id: 'transition',
  params: { next: { type: 'level' } },
  async run(ctx) { await ctx.hud.ring(); return { next: ctx.params.next, carry: true }; },
};
