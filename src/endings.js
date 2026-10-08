import * as gfx from './gfx.js';

const FINISH = { id: 'finish' };

// Resolves params (defaults from the module) and runs the ending. Endings only present; main applies the flow.
export async function playEnding(ending = FINISH, ctx) {
  const def = ctx.registry.ending[ending.id] ?? ctx.registry.ending.finish;
  const params = {};
  for (const [k, s] of Object.entries(def.params ?? {})) params[k] = ending.params?.[k] ?? s.default;
  try {
    const flow = await def.run({ ...ctx, gfx, params });
    return flow && typeof flow === 'object' ? flow : {};
  } catch (err) {
    console.warn(`ending ${def.id} failed:`, err);
    if (def.id !== 'finish') await ctx.hud.banner('FINISH!', 1200);
    return {};
  }
}
