# Python check that can see indentation / nesting depth

- **Status:** planned
- **Kind:** check type
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

Nested-if tasks must prove the inner if is inside the outer one. normalizeCode strips all whitespace before code checks, so a nested pair and two sibling top-level ifs normalise identically, and with the given flag values both print the same output. A mis-nested assembly or free-typed answer passes.

Closest existing capability (from `lessons capabilities`): code check (normalised source, platform-docs/python.md); output checks; tests with inputs (not available to code_arrange, and only useful when inputs change the flags).

Current workaround and why it falls short: Structural code checks on source order only, or give flags a True/False split so output differs. Neither catches an elif lined up with the outer if or an arrange distractor pair that reassembles as flat ifs, so the Known Misconceptions indentation-depth entry can't be checked.

## Example task

    check: { type: code_structure, operator: nested_in, inner: "if has_water_bottle:", outer: "if has_backpack:" }

## Notes

Lessons that hit this gap:

- python-1-10-solo task 8 (Level 1 Lesson 10 — Nested If (Solo Challenge)): Arrange distractors D1+D4 reassemble into valid non-nested ifs that pass every check
- python-1-12 task 23 (Level 1 Lesson 12 — Choose Your Own Adventure - Part 2): Tasks 23, 24, 30, 31: mis-indented but runnable nesting goes undetected

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-16, recurrence 2026-09-29).

## Resolution

Branch `feature/python-code-structure-check`: new Python check `type: code_structure` with `operator` `nested_in` / `directly_nested_in` / `not_nested_in` (required) and whole-line `inner` / `outer` patterns (spacing and case ignored, `*` wildcards). It reads nesting from indentation (tabs = 4 spaces; blank, comment-only and continuation lines skipped), so sibling `if`s and an `elif` lined up with the outer `if` fail `nested_in`. No run needed: works in submit mode, feedback checks, `code_arrange` tasks hosted by Python and `lessons test-checks`; the Builder offers it as Code → Structure (nesting). Docs: [python.md](../python.md#code-structure-checks-code_structure).
