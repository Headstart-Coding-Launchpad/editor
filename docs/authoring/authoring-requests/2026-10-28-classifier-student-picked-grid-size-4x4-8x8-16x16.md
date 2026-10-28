# Classifier: student-picked grid size (4x4, 8x8, 16x16)

- **Status:** planned
- **Branch:** feature/classifier-ai-l1 (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 2 (how a computer sees) should let the student choose how sharp the grid the model sees is, so they find the point where a star and a house look the same. The Classifier always uses 16x16.

Closest existing capability (from `lessons capabilities`): classifier with the `grid` panel (platform-docs/activities/classifier.md): shows the 16x16 grid it sees. It lacks a grid size choice.

Current workaround and why it falls short: Show a 4x4 picture in the Information task. This fails the lesson's design choice: the student's own model never gets worse because of what it can see.

## Fun moment

Wow: drop to 4x4 and the pad mixes up their star and house; go back to 16 and it's sharp again. Dial: the grid size. Theirs: their drawings. First used: AI Level 1 Lesson 2. Play: find the smallest grid that still tells their three things apart.

## Example task

    - type: classifier
      mode: drawing
      panels: [grid, gridsize]
      gridSize: 16      # starting size; the gridsize panel lets the student pick 4, 8 or 16
    

## Checks wanted

Changing size re-reads the student's own drawings at the new size (no redrawing), and guesses use it at once. Report the size each student finished on. Marking unchanged.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on `feature/classifier-ai-l1`: `gridSize` (4 | 8 | 16, default 16) and the `gridsize` panel; drawings are stored at 16 x 16 and block-averaged to 8 / 4 for the model, so changing size needs no redrawing. The size each student finished on is in their shared state (`gridSize`), on the tutor modal and card, and counted in the report (`classifierResults.gridSizes`). Docs: [activities/classifier.md](../activities/classifier.md#grid-size).
