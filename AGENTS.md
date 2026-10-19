# Working in this repo as an agent

Milkshake Runner is a three.js endless runner. Levels are JSON files in `levels/`; content (obstacles, pickups, props,
themes, characters, endings) is one-file modules in `content/`; `src/` is the engine, and a contribution never edits it.

- To make or check a level: CONTRIBUTING.md §0 and §1, then `npm run lab -- check levels/<id>.json` and
  `npm run lab -- play levels/<id>.json`; every gate must pass, and a band warning stands only if the idea justifies it;
  set `seed` to the proposed ship seed; `npm run dev` and `?level=<id>` to play it.
- To make a content module: CONTRIBUTING.md §2 and the examples in `test/fixtures/content/`; `npm test` is the gate.
- `npm test` and `npm run build` stay green. No new dependencies. A level goes in through a pull request or the
  **Submit a level** issue form; a module goes in through a pull request.
