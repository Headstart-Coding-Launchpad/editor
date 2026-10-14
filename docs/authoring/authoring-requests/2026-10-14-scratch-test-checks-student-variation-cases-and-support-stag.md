# Scratch test-checks: student-variation cases and Support stage evaluation

- **Status:** open
- **Kind:** tooling
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Checks Writing Guide asks authors to verify each check against plausible student variations (block appended at the bottom of the stack, wrong sound block, dropdown left on its default value, Support stage resubmitted unchanged). For Scratch nothing can run those: lessons test-checks without --cases only evaluates a task's starter and its Complete-role stages, --cases is source-code only ('omit for Scratch tasks'), and Support stages are never evaluated at all. So over-strict or over-loose Scratch checks against realistic wrong or partial answers can only be found by hand-reading Blockly JSON.

Closest existing capability (from `lessons capabilities`): lessons test-checks (Scratch mode, no --cases; shipped via request #27): judges each check against the task's starter and Complete-role stages only. Lacks (a) a way to supply named block-stack variants per task with an expected pass/fail per check, and (b) evaluation of Support-role stages. --cases supports source-code tasks only.

Current workaround and why it falls short: Reason by hand over the Blockly JSON for each variation and the Support stages. Fails the Checks Writing Guide's verify-against-variations step for every Scratch code task: checks ship verified only against the ideal answer, so a check that wrongly fails a valid variant or wrongly passes a wrong one (e.g. play sound vs play sound until done, default dropdown) reaches students untested.

## Example task

    A --cases file entry for a Scratch task: { task: <id>, name: 'sound block appended at bottom', blocks: <Blockly JSON or a stage id plus an edit such as appendBlock/replaceOpcode/setField>, expect: { completion: pass, feedback: [] } }; plus Support stages reported alongside starter and Complete stages in the no---cases run.

## Checks wanted

Per variant: each completionCheck and feedbackCheck's pass/fail against the expectation. Support stages: each check's result, flagged when a Support stage passes completion.

## Notes

Lessons that hit this gap:

- rkl3upojp2 (Level 1 Lesson 6 — Sound (play sound until done / start sound)): write-lesson-checks, 2026-10-04: sound-block checks could only be verified against the Complete stage; variations (wrong sound block, default dropdown, appended block, resubmitted Support stage) were reasoned by hand.
- fnhlc4qork (Level 1 Lesson 6 — sound blocks (start sound vs play sound until done)): write-lesson-checks: to test tasks 11 and 12 against their Support stage, sounds left on the first sound, go to/glide left on random and swapped sound blocks, and task 8 with both sound blocks stacked, I built throwaway YAML copies with each variant as the starter, since test-checks only evaluates starter and Complete stages.

Follow-on to shipped request #27 (Scratch per-check results), which covered the task's own stages only.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
