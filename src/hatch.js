// Hatch adapter: the only file that knows how the game talks to Hatch (docs/specs/2026-10-15-hatch-contract-draft.md).
// Working defaults until the Ezra–Vlad session settles them; swap the transport here, nowhere else.
//   D1 how parameters arrive: query string for now (could become postMessage or MCP tool args).
//   D2 schemas: only `level` is read; user, history and memories land in an opaque `context` nobody reads yet.
//   D3 how session end is signalled: one { levelId, outcome, jugs, time, distance } posted to the parent per finished run.
//   D2 open: `distance` (run.z, metres) was asked for by the level-learning loop to see where runs end; provisional.

export function params(search = globalThis.location?.search ?? '') {
  const { level = null, ...context } = Object.fromEntries(new URLSearchParams(search));
  return { level, context };
}

// No parent (standalone game) → nothing happens.
export function report(result, win = globalThis.window) {
  if (win && win.parent !== win) win.parent.postMessage(result, '*'); // ponytail: '*' until Hatch's origin is known (D1/D2), then pin it
}
