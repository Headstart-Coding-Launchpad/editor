# Name-tag panel: show clearly where a #@peek stopped the program

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–12), 2026-10-15
- **Lessons blocked:** none yet. Wave 1c of Lesson Gen's LG-P6 Visual learning plan, from Ryan's click-through of the sandbox (`ocgq3appv6`, task 5). Build on top of `integrate/requests-2026-10-14`.

## Need

Sandbox task 5 asked students to predict `coins` and `gems` with `showVariables.at: marker`, so the panel showed the values just before `coins = coins * 2`. Ryan found predicting "from the middle" harder to follow than from the end. Our rule is now **predict from the end**. But he asked that, whenever part-way stops are used, there is **a specific visual showing where the program stopped**.

Today the `#@peek` marker is stripped, and nothing in the editor or panel shows which line it stopped before. Students have to read that from the explainer.

**Closest existing capability:** `showVariables.at: marker` and the `#@peek` marker (`docs/authoring/python.md`, Name-Tag Panel → The `#@peek` marker).

## What's wanted

- **In the editor:** a clear "stopped here" band across the gap above the marked line, e.g. a dashed bar with ⏸ and the words "The tags show the values here".
  - It must not look like slow-mo's amber "this line ran" band.
  - It shows from when the task opens, so in predict mode students know where to predict *before* they run.
- **In the panel:** a header line, "Values just before line 6", with the line number as the student sees it. It's present in every mode, including the empty predict tags.
- **When the line never ran** (a branch that didn't run), keep today's note, and change the band to "The program never reached this line".
- **Tutor views and Go Live** show the band and the header too.

## Example task

```yaml
- id: 74
  moduleType: python
  title: Halfway through
  showVariables: { mode: predict, at: marker, predict: [coins] }
  codeStages:
    - role: starter
      code: |
        coins = 10
        coins = coins + 5
        #@peek
        coins = coins * 2
  check:
    - type: variables_predicted
      hint: Stop at the bar. Which lines have run so far?
```

## Checks wanted

- None.

## Devices

- The band and header are readable at tablet width, and the band stays visible above the on-screen keyboard where it fits.

## Notes

- **Accessibility:** the band has text, not only a colour or icon, and screen readers hear "Values shown just before line 6".
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, wave 1c.

## Resolution

Shipped 2026-10-15 on `feature/peek-stopped-here-band` (for `integrate/requests-2026-10-14`; not yet on `main`). No new task fields.

- **Editor:** a dashed purple ⏸ band (a CodeMirror block widget, `src/shared/peekBandEditor.js`, CodeEditor's `peekBand` prop) in the gap above the marked line: "The tags show the values here", or "The program never reached this line" after a run that missed it. It shows from when the task opens, follows the line through edits, and is hidden in a sandbox, on a previous task's saved code, while the tutor edits and during slow-mo playback. `role="note"`, and screen readers hear "Values shown just before line N".
- **Panel:** a "Values just before line N" header (N as the student sees it) in every mode whenever `at: marker` and the peek anchors; "Line N never ran" after a run that missed it (the status note stays).
- **Tutor views and Go Live:** StudentModal (Python code mirror and Turtle view) and the Go Live viewer's workspace show the band and header, from the synced run. The student card has no editor or panel, so it shows neither.
- Docs: [python.md](../python.md#name-tag-panel-showvariables) ("The `#@peek` marker"), [CHANGELOG](../CHANGELOG.md) 2026-10-15.
