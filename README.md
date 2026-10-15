# Milkshake Runner

PulsePoint's mascot Milkshake runs through Manhattan. Play: https://mrchopme.github.io/milkshake-runner/

- Levels 1 and 2 are built in. Everything after that comes from the community: levels are JSON files, and new obstacles, pickups, props, themes, characters and endings are one-file modules. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Bonus: *Konrad's Daily Commute* (`levels/last-train-newark.json`) is a satirical level with its own pack under `content/*/newark/`: Brick City streets, a mob at your heels, Penn Station at the end. It is listed under Levels, unlocked.
- Dev: `npm ci && npm run dev` (add `?fixtures` to the URL to play the example community pack). Tests: `npm test`.
- Design: [docs/specs/](docs/specs/).
