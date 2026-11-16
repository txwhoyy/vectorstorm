// VECTORSTORM's hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ — plain files a desktop browser opens offline,
// no build step — and the screenshots of it in screenshots/. This program copies both into the
// output directory and writes dossier.json there with buildDossier from the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged): the dossier is the summary of
// the entry the scorer checks and the judge reads.
//
// In the grader the output directory is /output; anywhere else, MAKEFUN_OUTPUT_DIR names it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (reference/gate.json): the dossier text budget shapes the
// bytes; the rest restate limits the scorer enforces anyway — at most 4 screenshots of at
// most 256 KiB each, at most 993 entries and 48 MiB under game/, no path under game/ longer
// than 1000 bytes — so an entry that would be refused fails here first, where it can be fixed.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
