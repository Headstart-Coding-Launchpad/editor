# Name-tag panel: predict mode locks Run until every prediction is in

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–17), 2026-10-15
- **Lessons blocked:** none yet. LG-P6 Visual learning, from Ryan's interview after the wave 1c sandbox click-through (`ocgq3appv6`). Build on top of `integrate/requests-2026-10-14`.

## Need

The visual builds make it very easy to change something and run it again without thinking: instant pictures, scrubbing, Arrange. LG-P6's research says the learning gain comes from **committing to a prediction first** (Hundhausen et al. 2002, Naps et al. 2002, PRIMM). Ryan decided that **predict tasks enforce it**: a student can't run the program until they've predicted. Make and Make It Your Own tasks stay free to tinker.

**Closest existing capability:** `showVariables.mode: predict` with `variables_predicted` (`docs/authoring/python.md`, Name-Tag Panel). As far as the docs say, Run works with the predict tags still empty, so a student can run first and copy the answer in.

## What's wanted

- **Predict mode** (Python and Turtle): **Run, Slow-mo and Step stay disabled** until every tag in `predict` has an answer (anything non-blank).
  - The disabled Run says why, in words: "Fill in your predictions first" (as a tooltip and beside the button on touch screens).
- **After the first Run,** the lock is gone for the rest of the task, so students can change their code and run again freely. The first-time prediction is what the report measures (`predictions.firstAllCorrect`).
- **The teacher isn't locked:** in Go Live and presentation, the presenter can always run (Ryan runs the predict moment on screen share).
- **Off switch:** `showVariables.lockRun: false` for the rare predict task that shouldn't lock. On by default in predict mode.
- **Target, view and other modes:** unchanged.

## Example task

```yaml
- id: 75
  moduleType: python
  title: What's in the bag?
  showVariables: { mode: predict, predict: [coins, gems] }
  codeStages:
    - role: starter
      code: |
        coins = 8
        gems = coins - 3
        coins = coins + gems
  check:
    - type: variables_predicted
      hint: Work down one line at a time.
```

Run stays disabled until both `coins` and `gems` have a prediction.

## Checks wanted

- None new.

## Devices

- On tablets, the "Fill in your predictions first" message shows beside the disabled Run (no hover). It must stay visible with the on-screen keyboard open.

## Notes

- **Accessibility:** the disabled Run has an accessible description giving the reason; the message is text, not only a greyed button.
- **Report:** if cheap, record how long the student spent before their first Run (time to predict), per student per task.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`; findings row 47 in `Plans/LG-P6 Sandbox findings.md`.

## Resolution

Shipped 2026-10-15 on `feature/predict-locks-run`, merged into `integrate/requests-2026-10-14` (not yet on `main`). New field `showVariables.lockRun` (default true in predict mode); `getPredictRunLock` in `src/shared/variablesPanel/variablesPanel.js`, `predictRunLock` from `useStudentCodeState`, Run / slow-mo disabled in the Python and Turtle workspaces with `PredictRunLockNote`. Docs: [python.md](../python.md#name-tag-panel-showvariables) (`lockRun` row), lesson-schema.md, validation-errors.md, CHANGELOG. A tutor's remote Run is not locked (a teacher action, like the presenter's). Time to predict in the report was not added: a follow-up if wanted.
