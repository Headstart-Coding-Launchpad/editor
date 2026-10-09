# Output check with no operator never passes, and validation doesn't flag it

- **Status:** shipped
- **Kind:** bug
- **Requested by:** LaunchPad Dev (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

A check written as `{ type: output, value: "..." }` with no `operator` always fails, even when the
output matches exactly, so a correct student can never complete the task. `lessons validate` and
the Builder both accept it without an error or warning.

Found while testing the code_arrange indent mode: the example task in
`2026-10-08-indent-mode-for-code-arrange-lines-fixed-in-order-student-se.md` used
`check: { type: output, value: "Too low\nHeating up!\nRound over" }`. With `operator: equals` (or
`contains`) the same output passes. Checked directly with `evaluateSingleCheck` in
`src/modules/checks.js`: no operator → `false`, `contains` / `equals` → `true`.

What should happen (either is fine):
- validation reports an error such as `Task … check output has no operator`, for every check type
  that needs one (and in `feedbackChecks`); or
- a missing operator defaults to `contains`, matching what the Builder's check editor already
  shows (see the companion request on that display mismatch).

## Example task

    - title: Repro
      type: code_arrange   # any python task shows the same
      moduleType: python
      arrangeMode: indent
      lines:
        - { id: L1, code: 'print("Hi")', depth: 0 }
      check: { type: output, value: "Hi" }   # never passes; validates clean

## Checks wanted

- Outcome: a check with no operator is either rejected by validation or evaluated with a
  documented default; never silently always-false.

## Notes

Worth a sweep of published lessons for checks with no `operator` once fixed.

## Resolution

Branch `fix/check-missing-operator`. A text check with a value and no `operator` now compares with
`contains` at runtime (`DEFAULT_TEXT_OPERATOR`, src/shared/checkHelpers.js), validation rejects
it (`validateCheckOperators`, src/modules/moduleTaskValidation.js; both Builder and `lessons
validate`), and the Builder's `CheckListEditor` writes `operator: contains` in when it opens such a
check. Shared test: `checkMissingOperator` (src/modules/checks.js). See CHANGELOG 2026-10-09. Sweep of all 79 published lessons (2,683 checks): none without an operator.
