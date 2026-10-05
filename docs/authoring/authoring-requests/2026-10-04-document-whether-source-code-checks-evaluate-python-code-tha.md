# Document whether source-code checks evaluate Python code that raises a SyntaxError

- **Status:** shipped
- **Kind:** docs
- **Requested by:** Ryan (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

Hint writing depends on knowing what a student sees when their code can't run. The Checks Writing Guide currently says a syntax error means no check (main or feedback) gets to evaluate the code, but session reports contradict it: python-3b-5 task 32 (a for line missing its colon) and task 34 (average = total += scores) both showed a main regex check's hint, and python-4b-5 task 20 (slices = return pizzas * 8) showed the main code-type check's hint, not a code_no_error one. We need to know, per check type (source regex/code_contains vs code_no_error vs runtime output/variable checks), which ones run on source that fails to parse, and so which hint the student sees.

Closest existing capability (from `lessons capabilities`): AUTHORING_GUIDE.md's Which hint is shown section gives the hint order (blocking feedback, matched feedback, first failed check with a hint, generic banner) but doesn't say which checks are evaluated, or how they fail, when the code raises a SyntaxError; python.md is silent too.

Current workaround and why it falls short: Assume source-only checks still run and their first failed hint shows. That leaves the Checks Writing Guide's 'Two things this does not catch' rule possibly wrong, and decides whether a wrong-route feedbackChecks entry for a syntax slip (e.g. =return) would ever fire.

## Notes

Lessons that hit this gap:

- c911s02arf task 22 (Level 1 Lesson 6 — else and elif): Feedback nudges for an else with a condition (tasks 22, 23, 24, 34, 37) and = in an if (9, 15, 23, 24, 31, 38) target code that raises a SyntaxError; test-checks shows they match the source, but whether they fire live on a SyntaxError run is undocumented.

Answer feeds a Checks Writing Guide change and the open Guide Feedback entry 'Code that can't run still gets a regex check's hint' (python-3b-5, 2026-10-01).

## Resolution

Branch `fix/authoring-docs-cli-batch`: [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md) "When the code can't run (SyntaxError)" documents it per check type. The task always fails; feedbackChecks still run against the source (so a `=return` regex nudge does fire); otherwise the first failed completion check with a hint shows: source `code` checks are evaluated normally, `code_no_error` and `variable_*` always fail, `output` checks see the error text. The external Checks Writing Guide's 'Two things this does not catch' rule should be corrected to match. Pointer in [python.md](../python.md).
