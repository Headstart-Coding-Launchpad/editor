# Live scrubbing: run the checks when a drag ends

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–18), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), task 21 ("Slide the Sentence"), and every later scrub task.

## Need

Ryan's click-through (2026-10-16): "When you use the number drag it doesn't re-test, maybe it should?" Today a drag re-runs the program as a preview with "no attempt, no checks, no save", and the edit is "checked on the next Run" (`docs/authoring/python.md`, Live scrubbing). So a student drags the number, sees the picture change, and then has to know to press Run before the task can pass. In a scrub task the drag *is* the student's answer, and the extra Run feels like the task didn't notice.

**Closest existing capability:** `scrub` (Live scrubbing) plus a normal Run.

## What's wanted

- When a drag (or a tap-to-step change) **ends**, run the task's checks once on the new code, exactly as a Run would: attempt logged, result shown, tutor card updated.
- Previews *during* the drag stay check-free, as now (they re-run about every 200 ms).
- For programs that don't preview live ("Press Run to see it"), nothing changes.
- If one run per drag is too many attempts in the report, record a drag-run attempt as such (e.g. `source: scrub`) so report analysis can tell them apart.
- Per-task switch, e.g. `scrub.checkOnRelease: true`. Ryan's preference is on by default for scrub tasks.

## Example task

```yaml
- id: 21
  moduleType: python
  title: Slide the Sentence
  scrub: { enabled: true }
  codeStages:
    - role: starter
      code: |
        from stage import *
        snack = "popcorn"
        place = "the cinema"
        sentence = f"I love {snack} at {place}"
        text(sentence, "navy", y=200, size=24)
```

Drag the `200` to `100` and let go: the checks run and the task passes.

## Checks wanted

- None new.

## Devices

- Tablets: "drag ends" includes lifting a finger and the end of a tap-to-step.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`. Until this ships, the pilot's explainer tells students to press Run after dragging.

## Resolution

Shipped 2026-10-16 on `feature/p6-19-21-name-tag-links-scrub` (not yet on `main`). New field `scrub.checkOnRelease` (default true). When a drag ends, a slider step ends (pointer up, arrow key up, − / + tap: each step is kept as its own edit) or a colour is picked, `useScrubPreview.scrubCommitted` runs the checks once through `handleRun({ source: 'scrub' })`, so the attempt, result and tutor card are a Run's; skipped for programs that don't preview live, submit-mode tasks and while predict mode's Run lock holds. Attempts are stored with `source: 'scrub'` (`attemptLog`) and reported as `distinctAttempts[].source` (session-reports.md). Docs: [python.md](../python.md#live-scrubbing-scrub), turtle.md, validation-errors.md, FEATURES, CHANGELOG.
