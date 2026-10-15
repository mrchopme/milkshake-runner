---
provenance: agent-generated
last-verified: never
snapshot: 2026-10-15
---

# Milkshake Runner as an MCP app: research notes

> Point-in-time snapshot written 2026-10-15 from sources read that day, not a recommendation; the MCP Apps spec may have moved since. "Confirmed" means a listed source says so; "inferred" is my reading.

## 1. What an "MCP app" is

Confirmed: MCP Apps is an opt-in extension (id `io.modelcontextprotocol/ui`, SEP-1865) to core MCP. A tool declares `_meta.ui.resourceUri` pointing at a `ui://` resource served as `text/html;profile=mcp-app`. The host renders it in a sandboxed iframe, and view and host speak JSON-RPC over `postMessage` (`ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `ui/message`, `ui/update-model-context`, `ui/resource-teardown`). CSP goes in `_meta.ui.csp` (`connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`); `_meta.ui.permissions` covers camera, microphone, geolocation, clipboardWrite. SDK: `@modelcontextprotocol/ext-apps`, npm latest 2.0.3 (published 2026-09-25); optional, the protocol can be spoken by hand.

Status: spec 2026-01-26 is marked Stable; `specification/draft/apps.mdx` is still Draft. The overview page links the stable spec, the build guide links the draft. Core MCP's latest revision is 2026-07-28. The build guide's server example imports `@modelcontextprotocol/sdk`, while the repo's peer ranges name `@modelcontextprotocol/server ^2`; one may be stale.

OpenAI: ChatGPT's docs say it implements MCP Apps, with `window.openai` an optional ChatGPT-only layer and older `openai/*` aliases kept for existing integrations. Looks layered, not divergent. I did not verify `text/html+skybridge`.

## 2. Wrapping the static Vite game

Repo facts (read, no build run): `base` is `/milkshake-runner/`. Levels are bundled at build time (`import.meta.glob`, eager), so there is no runtime level fetch. Runtime fetches are `milkshake.glb` (3.4 MB, via `BASE_URL`) and two fonts (about 12 KB, absolute `/milkshake-runner/fonts/` URLs in `src/style.css`). `levels/` is 24 KB; three.js is the only dependency. Input is `keydown` on `window` plus touch swipes; audio is synthesised, no sound files. Built size not measured; the GLB dominates (inferred).

| Option | What changes | Basis |
|---|---|---|
| Single HTML (build guide uses `vite-plugin-singlefile`) | Inline JS, CSS, fonts, GLB as base64, about 4.8 MB (my arithmetic) | Plugin confirmed; host size limits unverified. Patterns doc chunks large files via an app-only tool |
| Thin shell, assets on the game's host | Shell is the `ui://` resource; GLB and JS load from Pages; list that origin in `resourceDomains` and `connectDomains` | CSP mechanism confirmed |

Default CSP is `connect-src 'none'`, so the GLB fetch fails unless its origin is declared (confirmed). No source read addresses WebGL in the sandbox, audio autoplay, or keyboard focus (the game listens on `window`); test in a real host. Sizing is confirmed: `containerDimensions` can be flexible, the view sends `size-changed`, and fullscreen is a requestable display mode.

## 3. Mapping the draft contract

| Draft item | Mechanism | Basis |
|---|---|---|
| A1 user, A3 level id, A4 history (in) | Tool arguments, delivered once as `ui/notifications/tool-input` | Delivery confirmed; schema is ours (D2) |
| A5 result (out) | View calls a tool (`tools/call`, host-proxied) or `ui/update-model-context` / `ui/message` | Mechanisms confirmed; Hatch's choice is inference |
| D3 session end | Result call at run end; `ui/resource-teardown` signals close; `tool-cancelled` for abort | Notifications confirmed; "run end as a tool call" inferred |

Adapter changes (inferred): stop reading the query string, wait for `tool-input` before choosing the level or menu, and send the result as a tool call instead of `window.parent.postMessage`. Keep the query-string path for standalone play. The game loop stays untouched.

## 4. Hosting

Confirmed: the build guide's example is a Streamable HTTP server (Express) serving the HTML as the resource; Claude needs a reachable URL, hence a tunnel in dev. Stdio is core MCP's local alternative (not re-verified).

- Server serves inline HTML: one deployable, a 4-5 MB resource per load, a server to keep running.
- Thin shell plus the existing static host: the game deploys to GitHub Pages today (workflow and README). The server is tiny; costs are CORS and a second moving part.
- No vendor verified, none recommended.

## 5. Questions for Ezra and Vlad, most build-changing first

1. Is Hatch an MCP Apps host (`ui/*` over `postMessage`), or does it have its own iframe protocol? Everything else follows.
2. Who hosts and operates the MCP server?
3. Must the standalone game keep working without Hatch (the draft assumes yes)?
4. Is the result a tool call the game makes, or something Hatch reads? Who owns the schemas (D2)?
5. How is the user identified and authenticated (A1), and does auth reach the game?
6. Where do memories (A2) and history (A4) come from, and who stores results?
7. What size, CSP, and sandbox limits does Hatch impose (a 4-5 MB resource)?
8. Does the iframe allow WebGL, audio, keyboard focus, and fullscreen?
9. Stable 2026-01-26 or the draft: who tracks changes?

Hatch itself: nothing public found (one search returned only an unrelated Python package of that name).

## Sources

- https://modelcontextprotocol.io/extensions/apps/overview and /build, read 2026-10-15, official docs
- https://github.com/modelcontextprotocol/ext-apps `specification/2026-01-26/apps.mdx`, Stable; `specification/draft/apps.mdx`, Draft
- https://apps.extensions.modelcontextprotocol.io/api/documents/Patterns.html, SDK docs, read 2026-10-15
- https://registry.npmjs.org/@modelcontextprotocol/ext-apps, 2.0.3, published 2026-09-25, record modified 2026-09-28
- https://modelcontextprotocol.io/specification/latest, revision 2026-07-28 (page last modified 2026-10-13)
- Identifiers, method names, `_meta.ui` fields and both statuses re-checked on 2026-10-15 against the raw `apps.mdx` files, not a summary
- https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt, undated
- `cafcee6:docs/specs/2026-10-15-hatch-contract-draft.md`, agent-generated draft
