# Builder check editor shows "contains" when the check has no operator

- **Status:** open
- **Kind:** bug
- **Requested by:** LaunchPad Dev (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

When a task's `output` check has no `operator` (for example a lesson published from YAML that
left it out), the Builder's completion-check editor displays the operator dropdown as
**contains**, but nothing is stored. The author sees a check that looks right, while the saved
check never passes (see the companion request on output checks with no operator). Choosing
**contains** in the dropdown doesn't help, because it already shows as selected; the author has
to pick another operator and then switch back.

Found 2026-10-09 in the Builder preview of a code_arrange indent task whose check was
`{ type: output, value: "…" }`: the editor showed "Output · Text · contains" and the preview run
reported "Check does not pass" with exactly matching output.

What should happen: the editor shows the real stored state (an empty / "choose…" operator with a
prompt to pick one), or writes the displayed default into the check as soon as the task is
opened, so what the author sees is what is saved.

## Checks wanted

- Outcome: the operator the Builder displays is always the operator stored in the task.

## Notes

Likely in the shared check editor (`src/builder/components/task-editor/check-editors/`). Fix
alongside the validation request so both sides agree on a default.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
