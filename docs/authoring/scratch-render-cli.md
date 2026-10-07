# Rendering Scratch Scripts as SVG (CLI)

`hsc scratch render` draws a Scratch script the way the classroom shows it and saves it as a standalone SVG, plus a JSON map of every block. It's for videos, slides and docs that need the real block look. It's not part of authoring: the command never changes a lesson.

## Requirements

The command uses the app's own block definitions (`src/modules/scratch/scratch.js`, Blockly's `zelos` renderer). They need a real browser to measure text, so it runs headless Chromium through the repo's dev tools.

- Run `npm install` at the repo root, as well as `cd cli && npm install`.
- Install Chromium once with `npx playwright install chromium`.
- The first run takes about 25 seconds while Vite prepares Blockly. Later runs are faster.
- Internet access lets the SVG embed the Quicksand font. Without it, pass `--no-embed-font`.
- `--lesson` reads Firestore and needs CLI credentials (see `docs/agents/project-rules.md`). File input needs none.

## Usage

```bash
node cli/cli.mjs scratch render lesson.yaml --task 4 --out say-hello.svg
node cli/cli.mjs scratch render --lesson scratch-1-3 --task 20 --field starter
node cli/cli.mjs scratch render blocks.json --sprite Dog --out dog.svg
```

| Option | Meaning |
|---|---|
| `[file]` | A lesson (YAML or JSON) or a bare block state: one sprite's `{ blocks: { blocks: [...] } }`, a whole workspace state keyed by sprite id, or a single root block. |
| `--lesson <id>` | Fetch the lesson from Firestore instead of a file. |
| `--task <n\|id>` | Task index (0-based, as `tasks get` counts) or task id. The default is the first task with blocks. |
| `--field` | `complete` (`completeBlocks`, else the last Complete code stage), `starter` (the first Starter code stage, else `starterBlocks`), `stage:<n>` (`codeStages[n].blocks`) or `stack:<id>` (a `prebuiltStacks` entry). The default is complete, then starter, then the first Support stage. |
| `--sprite <id\|name>` | Which sprite's script to draw, or `stage`. The default is the first sprite with blocks. |
| `--out <path.svg>` | Where to save the SVG. The default is `<taskId>-<spriteId>.svg` in the current folder. The block map is saved beside it as `.json`. |
| `--no-embed-font` | Leave Quicksand out of the SVG. Text then falls back to the viewer's fonts. |

The command prints the paths, the size, the block count and any warnings.

## Output

**SVG.** Every style is written onto the elements, so the file needs no stylesheet. Each block is a `<g>` with:

- `data-id`: the stable id described below;
- `data-opcode`: for example `motion_movesteps`;
- `data-shadow="true"`: on number and text inputs.

Child blocks sit inside their parent's group, as in Blockly. Select one block with `[data-id="s1.2"]`.

**Block map (`.json`).** This file holds `source` (lesson, task, field and sprite), `width`, `height` and `warnings`. It also has `blocks`, with one entry per block giving `id`, `opcode`, `sourceId` (the block's id in the lesson, if it had one), `shadow`, and the block's own outline as `x`, `y`, `width` and `height` in SVG units. A C-block's box includes its mouth.

### Stable block ids

Ids come from the block's place in the script, so they stay the same when a lesson is re-saved. They change only if the script changes shape.

| Id | Block |
|---|---|
| `s1`, `s2` | The top block of each stack, in order |
| `s1.2`, `s1.3` | The 2nd and 3rd blocks of stack 1 |
| `s1.2/SUBSTACK.1` | The first block inside the C-block `s1.2` (`SUBSTACK2` for the else branch) |
| `s1.1/MESSAGE` | The reporter or input plugged into `MESSAGE` |
| `s1.1/MESSAGE~shadow` | The hidden default input under a reporter |

## Differences from the classroom

- **No sprite pictures in dropdowns.** Sprite dropdowns (go to, glide, touching) show the name only; the classroom also shows a thumbnail.
- **Emoji badges use the viewer's emoji font.** The badge emoji on each block is drawn with the viewing computer's emoji font, as in the classroom, so it looks different on Windows and on a Mac.
- **Values a dropdown can't show.** If a dropdown value isn't in the task's sprites, costumes, backdrops, variables or sounds, it is still added so the script shows as written. If Blockly still refuses a value, the command lists it under `warnings`.
- **Scale.** Blocks are drawn at scale 1. The classroom zooms blocks to fit the panel, but the SVG scales cleanly to any size.

## Files

- `cli/scratch-render-input.mjs` picks the task, field and sprite, and assigns the stable ids. It is pure and tested.
- `cli/scratch-render.mjs` serves the page through Vite, using its own cache in `node_modules/.vite-scratch-render`, and drives Chromium.
- `cli/scratch-render/` holds the browser page that draws and exports the script.
