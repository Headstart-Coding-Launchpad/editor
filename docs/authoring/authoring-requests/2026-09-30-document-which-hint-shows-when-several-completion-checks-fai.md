# Document which hint shows when several completion checks fail

- **Status:** planned
- **Kind:** docs
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

When a task has several checks entries and more than one fails, session data suggests only the first entry's hint is ever shown, so a later, more specific not_matches_regex hint never appears. Authors need to know the rule to order checks and write hints.

Closest existing capability (from `lessons capabilities`): platform-docs/AUTHORING_GUIDE.md Checks (Multiple checks, all must pass) and python.md feedback-check hint rules; neither says which failing check's hint is shown.

Current workaround and why it falls short: Put the most specific check first and hope; a Guide Feedback entry was built on an inferred rule. Targeted hints written for common misconceptions can silently never reach students.

## Notes

Lessons that hit this gap:

- python-1-5 task 23 (Level 1 Lesson 5 — If - Branching code): 11 failed attempts across 5 students all showed only the first checks entry's hint
- scratch-1-5 task 11 (Level 1 Lesson 5 — Costume Change): Tasks 11, 18, 30, 33: 12-21 average attempts in 50-100 s, one Say message logged per keystroke

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-29).

## Resolution

Branch `fix/scratch-hint-rule`: the one shared hint rule is documented, and Scratch now follows it like Python/HTML. Only one hint is ever shown: a matched blocking feedback check's hint wins; then, on a failed attempt, the highest-priority matched feedback check's hint; otherwise the first *failed* completion check in list order with a `hint`; otherwise the generic banner. Scratch no longer falls back to the first check's hint (even a passed one) when no failed check has one, and while blocks are being placed only a definitively failed `after_block_placed` check can supply the hint (run-time checks contribute only after Run). Docs: [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md#which-hint-is-shown), with cross-references from [python.md](../python.md#feedback-checks) and [scratch.md](../scratch.md).

The python-1-5 task 23 symptom follows from rule 3: to surface a targeted hint, put the specific check first, or make it a `feedbackChecks` entry with a `priority`. The scratch-1-5 per-keystroke attempt logging is tracked separately (2026-09-30-scratch-text-field-typing-logs-a-new-attempt-on-every-keystr.md).
