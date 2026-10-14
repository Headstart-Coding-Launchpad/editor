# python.md: not_nested_in feedbackChecks example has its hint backwards

- **Status:** open
- **Kind:** docs
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

python.md's Code Structure Checks section shows a feedbackChecks entry 'not_nested_in print(total) in for * in *' with the hint 'Move print(total) out of the loop'. A feedback check fires when its check passes (test-checks confirms: a nested_in feedback check on task 42 matched only when the line was nested), so that entry fires when print(total) is already outside the loop and stays silent when it is inside, the opposite of its hint. The example should use nested_in (fire when nested) for that hint, and the page should state that a feedback check matches when its check passes.

Closest existing capability (from `lessons capabilities`): platform-docs/python.md Code Structure Checks (code_structure) example 3, and its Feedback Checks section, which never states the pass-means-match rule for code_structure.

Current workaround and why it falls short: Authors infer the rule from the code-check feedback example and confirm with test-checks matchedFeedback. Copying the documented example as written produces a feedback check that fires on correct code and never on the misconception, failing the wrong-route detection the lesson's checks need.

## Notes

Lessons that hit this gap:

- j18s0nkggo task 42 (Level 3B Lesson 6 — while loop with a stop word, building a list): Checks stage needed a feedback check firing when the ask-again line sat inside the else; the doc example implied the opposite semantics, resolved by test-checks.
- uh1nj86w7a task 6 (Level 1 Lesson 7 — .lower()/.upper() recap of if/elif/else): Indent Arrange recap needed a feedback check firing when the closing print sits inside the else; used nested_in, confirmed by test-checks matchedFeedback, against the doc example's not_nested_in.
- evc61eeilq task 21 (Level 2 Lesson 1 — Consolidation: input, if/elif/else and Boolean flags (pet adoption centre)): Indent Arrange fix-the-indent needed a feedback check firing when the closing print sits inside the else; also lesson-schema.md's Indent mode example uses directly_nested_in with a 'line it up' hint, the same inversion. Used nested_in, confirmed by test-checks matchedFeedback (also tasks 43, 44).
- xdhiku2oln task 9 (Level 2B Lesson 7 — Boolean flags and and/or/not (Indent Arrange recap)): Indent Arrange recap's code_structure feedback check written as directly_nested_in (per the docs' examples) fired on the correct program in test-checks; feedback checks fire when their condition passes, so it had to be inverted to not_nested_in. lesson-schema.md's Indent mode example has the same backwards directly_nested_in feedback check.
- ufj6g0z9d3 task 20 (Level 1 Lesson 10 — nested if): Indent Arrange task 20: test-checks confirmed a code_structure feedback check fires when its condition passes, so it had to be written as the wrong shape (not_nested_in on the inner if, nested_in on the closing print), the reverse of the python.md example's hint.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
