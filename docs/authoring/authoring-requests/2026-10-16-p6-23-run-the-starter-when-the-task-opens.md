# Run the starter when the task opens (see it, change it, see the difference)

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–21), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), task 21 "Slide the Sentence", and every scrub or Modify task.

## Need

Ryan (2026-10-16): "Task 21 would be better if it immediately ran and then let them drag it, so they see it, change it, see the difference." Today the Stage appears "once the code draws (or from the start when the task has a `stageTarget`)" (`docs/authoring/python.md`, Stage). So on a scrub task the student opens an empty result pane, and has to know to press Run before there's anything to drag towards. The target ghost isn't a fix, because it shows the target rather than the student's own starting picture.

**Closest existing capability:** `stageTarget` (shows a target ghost at open) and a manual Run.

## What's wanted

- A per-task option, e.g. `runOnOpen: true`, that runs the starter (or the student's saved code) once when the task opens. The Stage, Turtle drawing or console shows the result straight away.
- This **opening run is a preview, not an attempt:** no checks, no attempt logged, and nothing counted as a Run in the report, so a student can't pass by opening the task.
- **Never for `input()` programs:** the option is ignored, and validation warns, because the run would block waiting for an answer.
- With `scrub` on, the opening run also starts live redraw, so the first drag redraws immediately.
- Good default: on for tasks with `scrub` on, and off elsewhere unless set.

## Example task

```yaml
- id: 21
  title: Slide the Sentence
  runOnOpen: true
  scrub: { enabled: true }
```

The sentence is on the Stage as soon as the task opens; the student drags the `200` and sees it slide.

## Checks wanted

- None new.

## Devices

- All. The opening run must not steal focus or open the on-screen keyboard on tablets.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`. Until this ships, the pilot's task 21 tells students to press Run first.

## Resolution

Shipped 2026-10-16 on `feature/p6-19-21-name-tag-links-scrub` (not yet on `main`). New task field `runOnOpen` (Python, Turtle; default on when `scrub` is on): once the runtime is ready the task's code runs once through the scrub preview run (`useScrubPreview`): output and Stage / turtle drawing show straight away, with no checks, no attempt, no save and no Run counted. Never for programs that call `input()` (validation warns), never in free play; no focus change. No Builder control yet (YAML only). Docs: [python.md](../python.md#live-scrubbing-scrub), turtle.md, validation-errors.md, FEATURES, CHANGELOG.
