---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-15
---

# Milkshake Runner ↔ Hatch — draft contract (2026-10-15)

> Point-in-time snapshot, drafted the day of Ezra's call. Not a spec and not a build order.
> Field names are placeholders until D1–D3 below are settled (expected after the Ezra–Vlad
> session). Source: the asks handoff in shade-os, `docs/plans/2026-10-15-milkshake-runner-ezra-asks-handoff.md`.

## Shape

Hatch opens an inspector panel, loads the game's URL, and passes context in. When a run
ends, the game hands "what happened" back. Hatch stores it. The game stores nothing about
the user (A7, A14).

## Hatch → game

| Item | ID | Game-side meaning today | Status |
|---|---|---|---|
| Who the user is | A1 | Nothing uses it yet. Caedon decides what the game wants | TBD what fields |
| Memories | A2 | Nothing uses it. Ezra owes the explanation (D6) | unknown |
| Optional level selector | A3 | A level id from `levels/index.json`, e.g. `01-broadway`, `02-garden`, `endless`. Absent → the normal menu | id scheme is stable now |
| Performance history | A4 | Equivalent to the local save's `best[id]` and `completed[]` | TBD whether it replaces local save |

## Game → Hatch

| Item | ID | What a run produces today | Status |
|---|---|---|---|
| "What happened" at session end | A5 | `levelId`, `outcome` (`complete` / `dead` / `error`), `jugs`, `time` (seconds), `distance` (metres, provisional, asked for by the level lab). Chained levels (an ending's `next`) produce one result each | contents beyond high score unspecified |

## Transport (open)

- **D1** how parameters arrive: query string, postMessage, or MCP tool args.
- **D2** schemas for user, level selector, history, memories, and the result.
- **D3** how the game signals session end.

Working default until D1–D3 land, so the game can be built against something: parameters
on the query string, result via `postMessage` to the parent window, both behind one adapter
module so the transport can change without touching the game loop.

## Built against this draft (2026-10-15)

`src/hatch.js` (PR #13, merged 3628134) implements the working default: `?level=<id>` in,
one `postMessage` per finished run out, target origin `'*'` until Hatch's origin is known.
`?level` ignores campaign locks and the one-time help screen stays; Caedon's calls.

## Do-nots

- No memory or storage layer of the game's own for user data (A14, human-confirmed).
- No leaderboard in the game; Hatch's side (B4).
- Standalone game keeps working with no Hatch present (A10, D7 assumed yes).

## Waiting on

- Ezra–Vlad session (A9): packaging as an MCP app, and probably D1–D3.
- Ezra: how memories reach the game (A2 / D6).
