# Scratch text-field typing logs a new attempt on every keystroke

- **Status:** planned
- **Kind:** bug
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

On Scratch tasks with a free-text field (a Say message), session reports log each character typed as a new distinct attempt (h, ha, have, ... have a wave), giving 12-21 average attempts on tasks students finished normally. Attempt counts can't be used to judge difficulty, and the Persistence badge may fire wrongly.

Closest existing capability (from `lessons capabilities`): Scratch after_block_placed evaluation (platform-docs/scratch.md): says checks can pass while the learner edits, but not what triggers a logged attempt.

Current workaround and why it falls short: Reviewers discount attempt counts on any Scratch task with a text field by reading raw report data; report-based task-quality verdicts on those tasks are unreliable.

## Notes

Lessons that hit this gap:

- scratch-1-3 task 20 (Level 1 Lesson 3 — Moving to a Spot): avgAttempts 12.75; one student's 45 distinct attempts were the Say message typed a character at a time
- scratch-1-5 task 11 (Level 1 Lesson 5 — Costume Change): Tasks 11, 18, 30, 33: 12-21 average attempts in 50-100 s, one Say message logged per keystroke

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-15, recurrence 2026-09-29).

## Resolution

Branch `fix/scratch-text-field-attempts`: the Scratch workspace change listener now treats Blockly's per-keystroke `block_field_intermediate_change` events as typing in progress — they still sync the workspace for live view, but no longer clear check feedback or start the `after_block_placed` / idle-feedback timers. The committed field `change` event (leaving the field or Enter) runs the checks and logs one attempt with the final text. Reports from before the fix overcount attempts on text-field tasks. Docs: [scratch.md](../scratch.md#scratch-check-types), [CHANGELOG.md](../CHANGELOG.md#2026-10-01).
