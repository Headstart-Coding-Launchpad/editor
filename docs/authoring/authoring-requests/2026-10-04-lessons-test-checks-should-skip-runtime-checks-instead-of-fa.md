# lessons test-checks should skip runtime checks instead of failing them

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

lessons test-checks runs only the source-code evaluator, so every output / output_not_empty / output_line_count / code_no_error / variable_* check reports completion: fail on its own complete code. That is indistinguishable from a genuinely broken regex, so a check-writing agent can't verify a mixed check set.

Closest existing capability (from `lessons capabilities`): lessons test-checks (cases format has no stdin/expected-output field); AUTHORING_GUIDE.md now documents the limitation and a stripped-copy workaround.

Current workaround and why it falls short: Hand-build a scratch lesson holding only the code-type checks and reason about runtime checks manually. Slow and error-prone, and headless pipeline stages hit approval walls running helper scripts; runtime checks ship unverified.

## Checks wanted

test-checks reports checks it cannot evaluate as 'skipped (needs a run)' rather than fail, or accepts stdin/expected output per case.

## Notes

Lessons that hit this gap:

- python-1-5 (Python Level 1, Lesson 5 row): 7 of 9 code tasks reported false failures
- python-1-2 (Python Level 1, Lesson 2 row)
- python-1-9 (Python Level 1, Lesson 9 row): 8 tasks mixed code + code_no_error checks
- python-1-2-solo task 8 (Python Level 1, Lesson 2 row (Solo Challenge))
- python-1-10 task 28 (Level 1 Lesson 10 — Nested If): tests-based checks (inputs) can't be run by lessons test-checks at all; 21 test checks verified by reasoning only

Migrated from Lesson Info/Missing Information.md (entry dated 2026-08-03).

## Resolution

Branch `fix/authoring-docs-cli-batch`: `lessons test-checks --cases` reports checks that need a run (and checks reading state a case can't supply) as `skipped` with a reason, per check in `actual.checks`; completion is judged on the evaluable checks and is `skipped` only when every check needs a run. Tasks with `tests` are skipped. Docs: [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md).
