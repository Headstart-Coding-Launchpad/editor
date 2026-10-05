# Run attempted completion signal for demo-mode tasks

- **Status:** shipped
- **Kind:** check type
- **Requested by:** Ryan (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

Demo-mode code tasks (Complete Example, Visual Fun Application) ask the student only to press Run and watch; there is nothing to edit. Required-path demo tasks need a completion signal that the student actually ran the code (Run / Run game pressed at least once), across Python console, Arcade Kit, Electronics and Scratch.

Closest existing capability (from `lessons capabilities`): code / code_no_error / output checks (lessons capabilities, all modules) and Arcade Kit's code checks on Run game (2026-09-13). All of them pass on the unedited starter, so they certify nothing on a task the student never edits; Arcade has no game-state check at all (platform-docs/arcade.md).

Current workaround and why it falls short: Leave the task checkless and rely on the tutor watching. On the required path this lets a student skip the demo entirely and still progress, which fails the lesson's 'see the concept work' objective for that task. Hit about 30 times across Python, Arcade, Electronics and Scratch lessons by 2026-09-17.

## Example task

    - title: 🎮 Watch It Move
      starterCode: ...
      check:
        type: run_attempted

## Checks wanted

Outcome: the task's Run (or Run game / Scratch green flag) was triggered at least once this attempt. Optional: the program finished without error.

## Notes

Lessons that hit this gap:

- python-1-5 task 24 (Python Level 1, Lesson 5 row): Arcade Visual Fun Application (If a Key Is Pressed) left checkless

Related: lessons test-checks' per-case completion reflects only the primary check, not a mode: blocking feedbackChecks entry. Migrated from Lesson Info/Missing Information.md (entry dated 2026-08-04).

## Resolution

Branch `feature/run-attempted-check`: new `run_attempted` check. Passes once Run is pressed (Python, Turtle, Electronics, HTML Run, Arcade Run game, Scratch green flag only), even if the run errors or is stopped. Optional `requireSuccess: true` needs a clean finish (Python/Turtle/Electronics; warned and ignored elsewhere). Rejected on Filesystem/Desktop and as a feedback check. Docs: [python.md](../python.md) and the other module docs, [validation-errors.md](../validation-errors.md).
