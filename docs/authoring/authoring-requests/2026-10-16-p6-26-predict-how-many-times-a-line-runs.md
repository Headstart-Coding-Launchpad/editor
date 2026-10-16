# Predict how many times a line runs

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (Ryan asked for it, filed straight to LaunchPad Dev, as with builds 1–25), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot A, Python Level 2B Lesson 8 (for loops, taught Tue 20 Oct), whose "how many times?" predictions fall back to multiple choice until this ships, and every later loop lesson (`while` in Lesson 9, list loops at Level 3).

## Need

Ryan (2026-10-16): guessing what a value is ("what's `i` at the end?") is no fun in a loop lesson; "how many times does this get printed?" is the prediction worth making. The name-tag panel's predict mode (`variables_predicted`) only predicts **variables**. So "how many times?" can only be multiple choice today. Its options give the answer away by elimination (3, 4 or 5), and it can't point at the line it's asking about.

Loops are where students get counts wrong: off-by-one with `range()`, a line left outside the loop (it runs once), a nested loop (it runs rows × columns times), and a `while` loop that stops one pass early or late.

**Closest existing capability:** the panel's predict mode (`showVariables.mode: predict`, with Run locked until predictions are in, p6-18), and slow-mo's loop pass counter ("pass 3 of 4", "finished: 4 passes").

## What's wanted

- **A marker for the line to count**, e.g. `#@count` on the line above, like `#@peek`. It's stripped before the student sees the code, and it follows the line when code moves. Up to 3 marked lines a task.
- **Predict mode for counts.** Next to each marked line, a small "How many times will this run?" box the student fills in before running. Run stays locked until every box has an answer, sharing p6-18's lock and wording.
- **After Run,** each marked line shows how many times it actually ran ("ran 4 times"), with ✓ or ✗ beside the prediction, in words as well as symbols. A line that never ran shows "ran 0 times".
- **On the Stage,** the count is the shape count for a drawing line, so "how many stars will it stamp?" is the same task: mark the `stamp` line.
- **Optional view mode (no prediction):** after any Run, show the run count on the marked lines. That's useful in a Debug task ("this ran once; why?").
- **Output lines too, if cheap:** for a marked `print` line, "printed 3 lines".

## Example task

```yaml
- id: 14
  title: Hip Hip Hooray
  predictRuns: true            # or a mode under showVariables; Dev's call
  codeStages:
    - role: starter
      code: |
        for i in range(3):
        #@count
            print("Hip")
        #@count
        print("Hooray")
  check:
    - type: runs_predicted     # every marked line's prediction was right
```

The student predicts 3 and 1, presses Run, and sees "ran 3 times ✓" and "ran 1 time ✓". A student who predicted 3 for Hooray sees "ran 1 time ✗" next to the line that isn't indented.

## Checks wanted

- `runs_predicted`: passes when every marked line's prediction matches its real count (whole numbers; spaces ignored). Optional `lines` to name which marks.
- `line_run_count`: `line` (or the marked line), `operator` (`equals`, `min`, `max`) and `value`, so a completion check can say "the stamp line ran 5 times" without depending on the drawing.

## Devices

- All. Boxes at least 44 px on touch screens and usable with the on-screen keyboard. The count is read aloud ("Line 3 ran 4 times. You predicted 4: right.").

## Session report

- Record each prediction and whether it was right, like `predictions`, so the pilot can measure the off-by-one misconception directly.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L2B Lesson 8 for loops.md`. The pilot Draft is `qj8152siy2`; its task 23 (Hip Hip Hooray) and the side quest on task 40 (Count the Go Lines) are the "how many times?" questions today.
- Sits beside p6-27 (typed predictions): a count box is a number field.
- Tutor view: the same chip as predict mode ("Predicted 2/2").
- Go Live: the presenter's counts show on every screen, as with the panel.

## Resolution

Shipped 2026-10-16 on `feature/p6-26-27-predict-counts-and-types` (not yet on `main`). Marker `#@count` (`src/shared/lineHints.js`, runtime-only `countSets`), task field `runCounts: predict | show` (`src/shared/runCounts.js`), the worker counts the marked lines on the same line watch as `#@peek` and slow-mo (`capture.countLines`, `done.lineCounts`), and the editor shows a number box at the end of each marked line, then "ran 3 times ✓" (`src/shared/runCountsEditor.js`; the number rules shared with p6-27's field, `answerFields.js`). Run is locked by predict mode's lock and words until every box is filled. Checks `runs_predicted` (optional `lines`) and `line_run_count` (`line` or the marked line, `operator` equals / min / max, `value`); `line` numbers are starter lines as the student sees them. Tutor chip, StudentModal, Go Live and the report (`runCountPredictions`, `runCountFirstByLine` with `offByOne`) are covered, synced in the existing `currentVariables` / `predictionLog` (no new Firebase path). Not done: "printed 3 lines" for a print line (optional; the line's run count shows instead), and `#@count` in side-quest starters (side quests don't carry the task's `runCounts`).
