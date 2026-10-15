# Python screen space: editor, console, Stage and name-tag panel together

- **Status:** planned
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5). Affects all three pilot lessons. Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15).

## Need

Builds 1–6 each added a pane or controls to Python tasks. One task can now show:
- the code editor
- the console
- the Stage (with Target and Differences toggles)
- the name-tag panel
- slow-mo controls and its question
- the task's instructions

On a tablet, or a small Chromebook screen, that's too much at once. Ryan's decision: **LaunchPad Dev designs the layout.** This request sets out what has to be true.

## What has to be true

- **What a task is about is in view after Run.** If the program drew, the Stage is visible; if the panel is in predict or target mode, the panel is visible next to the code. The student doesn't have to hunt for the result.
- **Predict mode:** the code and the empty tags are visible together while the student types (with the on-screen keyboard open on a tablet).
- **Target picture:** the code and the Stage with its ghost are visible together.
- **Slow-mo:** the highlighted line, the tags and the Stage can be seen together while stepping.
- **Nothing becomes unreachable.** The console is always one tap away, even when the Stage and panel take the space.
- **Go Live and screen share:** the presenter's layout is readable on a projector.
- **Turtle tasks** get the same treatment (drawing, panel, console).

## Example task

Any Python task with Stage drawing, `showVariables` and `slowMo` together, e.g.:

```yaml
- id: 61
  moduleType: python
  title: Predict the tunnel
  showVariables: { mode: predict, predict: [size] }
  slowMo: { enabled: true }
  codeStages:
    - role: starter
      code: |
        from stage import *
        for i in range(5):
            size = i * 40
            square(size, angle=i * 15)
```

## Checks wanted

- None.

## Devices

- **Tablets, portrait and landscape,** with and without the on-screen keyboard.
- **Chromebooks and small laptops** (1366 × 768).
- **Desktops:** everything side by side where it fits.
- Touch targets stay at least 44 px.

## Notes

- An author hint (e.g. which pane to show first) is welcome if your design needs one, but optional.
- **Accessibility:** panes are labelled regions; switching between them works by keyboard; a pane that updates after Run announces it.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions: tablet layout is LaunchPad Dev's call.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
