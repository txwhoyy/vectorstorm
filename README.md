# VECTORSTORM — Neon Arena Protocol

![make.fun best-game-01](https://make.fun/badge/best-game-01.svg)
![rank](https://make.fun/badge/best-game-01/txwhoyy/vectorstorm/rank.svg)
![reward](https://make.fun/badge/best-game-01/txwhoyy/vectorstorm/reward.svg)

An original neon arena survival game, built for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01).
One ship, an arena, and an escalating swarm of geometric hunters. Survive the waves, chain
kills into a combo multiplier, and grab what the wrecks drop: rapid fire, an aegis shield,
and the nova bomb.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server —
`node serve.ts` works) and click, or press Enter, to launch.

- **WASD / arrow keys** — move
- **Mouse** — aim · **hold click / Space** — fire
- **P / Esc** — pause · **M** — mute

Five enemy kinds hunt you, each flying its own pattern: the diving **dart**, the corkscrewing
**weaver**, the circling **orbiter**, the sniping **shooter**, and the armoured **bulwark** that
anchors the later waves. Every wave is larger and faster than the last.

## How it is built

Plain static files under `game/`, no build step and no libraries: a fixed-step simulation in
`game/src/` split by job — `world.js` (rules), `enemies.js` (the five kinds and the waves),
`powerups.js`, `particles.js` (the juice), `render.js` (procedural vector art on canvas),
`hud.js` (HUD and screens), `audio.js` (Web Audio synthesis — no audio files), `input.js`,
`shots.js` (the deterministic scenes the screenshots were staged with), and `main.js` (boot
and the loop). `main.ts` at the root hands the entry in: it copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`.

The screenshots in `screenshots/` are real frames of this code running in a browser, staged
deterministically with `?shot=title|action|over|wave&seed=7` (see `shots.json`).

## License

MIT — see `LICENSE`.
