# Slow-mo through the Run button: one button, not two

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (Ryan asked for it, filed straight to LaunchPad Dev, as with builds 1–25), 2026-10-16
- **Lessons blocked:** none. Affects the LG-P6 pilot Python Level 2B Lesson 8 (`qj8152siy2`, taught Tue 20 Oct), task 19 "Go-Kart Race", the only slow-mo task in a real lesson so far.

## Need

Ryan (2026-10-16, clicking through `qj8152siy2`): "I think the slow mo vs run button is confusing. Maybe we need to combine them? If it's got slo mo the run button does it."

Today a slow-mo task shows **Run** beside 🐢 **Slow-mo**, ⏸ **Pause**, 👣 **Step**, ↩ **Step back** and ⏮ **Restart** (`docs/authoring/python.md`, Slow-mo). Run "still runs the program normally", and pressing Run ends a slow-mo playback. So students have two ways to run one program, and the one they reach for by habit (Run) skips the very thing the task is for.

**Closest existing capability:** `slowMo.enabled` and its controls.

## What's wanted

- **On a task with `slowMo.enabled`, Run plays the program in slow-mo.** There's no separate 🐢 Slow-mo button. Run's label could read "▶ Run (slow-mo)" so it's clear what it does.
- **Pause, Step, Step back and Restart stay**, appearing once a run is playing or paused.
- **A ⏭ Finish (or "Skip to the end") control** jumps straight to the end of the recording, for a student who's seen enough. The checks and output are exactly as for a normal Run.
- **The speed slider stays**, starting at `slowMo.speed`.
- A task option to keep today's two-button layout (e.g. `slowMo.separateButton: true`), in case a Solo Challenge wants plain runs plus optional slow-mo. The combined button should be the default.
- **Predict mode:** the p6-18 lock applies to Run as now, so a slow-mo predict task still waits for predictions.
- **Go Live:** the presenter's Run plays slow-mo on every screen, as the 🐢 button does today.

## Example task

```yaml
- title: Go-Kart Race
  slowMo:
    enabled: true
    showVariables: true
    question: How many laps has the loop done when it prints Lap 2?
```

The student presses Run and watches it play line by line, with Pause and Step to hand, or ⏭ to jump to the end.

## Checks wanted

- None new. Checks run once, when playback reaches the end or ⏭ is pressed, as today.

## Devices and accessibility

- As today's slow-mo controls: at least 44 px, icon and word, reduced motion respected.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L2B Lesson 8 for loops.md`.

Shipped 2026-10-16 on `feature/p6-28-slow-mo-run` (not yet on `main`). On a slow-mo task Run reads "▶ Run (slow-mo)" and records then plays the run (the shortcut, a Code Arrange board's Run and the tutor's remote Run too); Pause (Play while paused), Step, Step back, Restart and a new ⏭ Finish (playbackReducer `finish`) show once a run plays; new `slowMo.separateButton: true` keeps the old Run + 🐢 Slow-mo layout (validated, Builder checkbox). Docs: [python.md](../python.md#slow-mo-slowmo), turtle.md, validation-errors.md, FEATURES, CHANGELOG.
