# Indent mode for code_arrange: lines fixed in order, student sets each line's depth

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-08
- **Lessons blocked:** none yet

## Need

Students need to practise which block a line belongs to by actually moving it, not by picking between near-identical pre-indented tiles. Known Misconceptions - Python: 'Indentation depth miscounted once nesting goes two levels deep' (Python Level 1 Lesson 10 all 3 students, Lesson 12 both students across tasks 16/17/23/24/28, Level 4B Lesson 3) and 'The if block's colon and indentation not recognised as part of its shape' (Level 1 Lessons 5 and 6, Level 3B Lesson 5); plus 'skipped block prints anyway' (4 of 7 in Level 1 Lesson 6). Python Level 1 Level Review 2026-10-07: nested if 'not stuck'. In code_arrange today indentation is baked into tile text, so depth is a spot-the-difference choice, and students who passed the arrange rung still failed production (Lesson 12 task 23). Lesson use: the Meaningful Fill in the Blanks slot of block-construct lessons (if, elif/else, nested if, for, while, def), Fix the Indent debug tasks, and locked excerpts of a long carried program in Project sections; Level 1 Lesson 10 would split the two indentation jumps into one task each.

Closest existing capability (from `lessons capabilities`): code_arrange (lessons capabilities: Arrange, hosts python/html; platform-docs/lesson-schema.md Code Arrange Task Fields). Lacks: any way to change a line's depth — indentation is fixed inside each slot's code text, so depth can only be tested via wrong-indent distractor tiles; no visible block structure. code_structure checks (request #26, shipped) can see depth but give the student no way to manipulate or see it.

Current workaround and why it falls short: Wrong-indent distractor tiles in code_arrange plus code_structure depth hints, and Debug Code Tasks with mis-indented starters in the editor. Fails Python Level 1 Lesson 10's New Concept (nested if: task 19 all 3 students resubmitted the misaligned elif unchanged; task 31 one student took 8 attempts) and Lesson 12's project steps (students passed recognition and arrange rungs, then failed production on task 23). Level 1's arrange rules also cap distractors at two, which limits wrong-depth variants.

## Example task

    - title: 🪜 Line Up the Warmer Check
      type: code_arrange
      moduleType: python
      arrangeMode: indent            # new: lines are fixed in order; the student only sets each line's depth
      explainer: Slide each line left or right so "Heating up!" only prints when the mode is warmer.
      startDepth: flat               # flat = every movable line starts at depth 0; given = start from the depths below (debug variant)
      showBlocks: true               # live coloured bracket from each `:` header around the lines it controls
      trace: true                    # optional Trace button: runs once and marks which lines ran / were skipped
      lines:
        - { id: L1, code: 'guess = 15', depth: 0, locked: true }
        - { id: L2, code: 'mode = "warmer"', depth: 0, locked: true }
        - { id: L3, code: 'if guess < 20:', depth: 0 }
        - { id: L4, code: 'print("Too low")', depth: 1 }
        - { id: L5, code: 'if mode == "warmer":', depth: 1 }
        - { id: L6, code: 'print("Heating up!")', depth: 2 }
        - { id: L7, code: 'print("Round over")', depth: 0 }
      check: { type: output, value: "Too low\nHeating up!\nRound over" }
      feedbackChecks:
        - check: { type: code_structure, operator: directly_nested_in, inner: 'print("Heating up!")', outer: 'if mode == "warmer":' }
          hint: Which line decides whether "Heating up!" prints? Line it up one step to the right of that line.
        - check: { type: code_structure, operator: not_nested_in, inner: 'print("Round over")', outer: 'if guess < 20:' }
          hint: Should "Round over" print every time, or only when the guess is low?
    

## Checks wanted

Outcome checks:
- Lines render in the authored order; the student cannot reorder, add, remove or edit text — only change depth.
- Each movable line snaps to whole indent steps (4 spaces for Python), from 0 up to a cap (e.g. 4 levels); locked lines show their depth greyed and cannot move.
- With showBlocks, every line ending in ':' draws a coloured bracket around the lines it currently controls, redrawn live as lines move; an elif/else at the same depth as its if shares that if's colour.
- Run assembles the program at the chosen depths (4 spaces per level) and runs it through the normal Python pipeline; check/feedbackChecks (including code_structure) evaluate it exactly as for an ordinary code_arrange task. An IndentationError shows the interpreter's message as normal.
- startDepth: flat starts every movable line at 0; given starts each at its authored depth (for "fix the indent" debug tasks, where the authored depths are deliberately wrong and the check decides correctness).
- trace (optional): one run that marks each line ran / skipped, without counting as an attempt.
- Session report: each Run is one attempt whose submission is the assembled program text (same as code_arrange today), so depth errors are visible in reports.
- Validation: arrangeMode indent needs moduleType python, at least one unlocked line, and a completion check; slots/distractors are not used in this mode.
- Builder: an Indent option in the Arrange composer — one row per line with code, depth and a lock toggle.
Method checks (optional): the same bracket colours/device as request #46's editor indent guides, so the visual carries from this task into the student's own typing.


## Devices

- Touch screens / tablets: horizontal drag on a line with snapping; also visible ← → buttons on each movable line, so no precise drag is required.
- Keyboard: Tab / Shift+Tab (or ← →) on a focused line changes its depth; up/down moves focus between lines.
- Macs / Chromebooks / trackpads: the buttons and keyboard shortcuts avoid fiddly horizontal drags.
- Brackets must stay legible on small screens and in light/dark themes; depth must not rely on colour alone (the indent itself plus the bracket line).


## Notes

Companion to request #46 (indent guides / block shading in the Python editor): please use the same visual device (coloured block brackets) in both, so what students learn in the indent task stays visible when they type. Trace button is optional for a first version. Python only to start; HTML nesting could follow later.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->

Shipped 2026-10-09 (merge of `feature/code-arrange-indent-mode` to main) as a mode of the existing
`code_arrange` activity: `arrangeMode: indent`. Docs: lesson-schema.md "Indent mode", CHANGELOG
2026-10-09. Differences from the request, agreed with Ryan:

- No `startDepth` field. Each line's `depth` is always the correct answer and an optional
  `start` sets where it begins (default 0), so a "fix the indent" task is written as
  `{ code, depth: 2, start: 1 }`. That keeps Complete (show answers) and Load authored solution
  working, and keeps the answer sealed.
- `showBlocks` defaults to true (as in the editor). The board has the same Blocks button.
- Keyboard: ← → change depth, ↑ ↓ move between lines (Tab keeps moving focus rather than
  indenting). Depth is capped at 4.
- The Trace button is not built yet (optional in the request).
- The example's `check` needs `operator: equals` (an `output` check with no operator never
  passes); the docs example has it.
