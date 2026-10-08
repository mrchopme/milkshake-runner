---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner — style sheet (palette)

Point-in-time snapshot, written 2026-10-08 during the v2 build (Task 9). The source of truth is the Paper file
"Milkshake Runner — style sheet" (fileId `01M46QWM611CXK4WQSBTH6FJK3`, seven boards), approved by Caedon on 2026-10-07
exactly as drawn. The values below are the Paper colour tokens as carried into `src/palette.js`; content modules reach
them as `gfx.palette`. Patterns may have evolved since; check the Paper file and `src/palette.js` before relying on this table.

| Token | Hex | Used for |
|---|---|---|
| cowWhite | `#ffffff` | Milkshake's body |
| spot | `#c8c8d0` | Milkshake's spots |
| lavender | `#b9a6e8` | muzzle, ears, horns, hands, udder; menu accent (`--accent`) |
| eye | `#1d1b26` | eyes, hoof tips, ink (`--ink`), blob shadows |
| road | `#5a5c72` | road surface |
| sidewalk | `#a3a0ab` | sidewalks |
| lane | `#f2f2f2` | lane dashes, white street props |
| dark | `#262733` | wheels, manhole, bike frame |
| taxi | `#f7c518` | taxi body |
| hazard | `#ff7a1a` | barrier rail, beam, cart awning, pigeon beaks |
| metal | `#8a8f99` | scaffold uprights |
| glass | `#8ccfe0` | taxi windows |
| pigeon | `#d9dbe6` | pigeons |
| rider | `#e5484d` | bike rider, taxi tail lights, cart stripe |
| jug | `#ffffff` | jug body |
| magnet | `#ff4fa3` | magnet orb and chip |
| shield | `#4dc3ff` | shield orb and chip, HUD hit flash |
| x2 | `#8b5cf6` | 2× orb and chip |
| arena | `#2b2e3a` | arena wall |
| plaza | `#d9d4cc` | plaza floor |
| jerseyA | `#ef7d22` | stand-in jerseys (odd), tip-off circle |
| jerseyB | `#2a5caa` | stand-in jerseys (even) |

Display font: Lilita One (SIL Open Font Licence, `public/fonts/OFL.txt`), self-hosted in `public/fonts/`.
UI tokens in `src/style.css`: `--ink #1d1b26`, `--paper #ffffff`, `--accent #b9a6e8`.
Jersey colours deliberately sit off the real team's `#f58426` / `#006bb6`.
