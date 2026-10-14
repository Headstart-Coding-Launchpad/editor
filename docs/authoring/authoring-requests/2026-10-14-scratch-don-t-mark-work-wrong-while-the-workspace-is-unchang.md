# Scratch: don't mark work wrong while the workspace is unchanged or has loose blocks

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Scratch students see 'failed' and a hint before they've done the step. platform-docs/scratch.md says 'Students should not see a failure just because they are still building', but in Scratch L1 L7 (m8q1wbgock, 2026-10-13, 5 students) task 23's hint was shown 51 times: on the untouched carried starter (attempt 1), and whenever a newly dragged block was still loose (an unattached second stack). Tasks 19-24 averaged 6.6-12.2 logged attempts. Tutor: 'Checks are still a bit over eager in Scratch, mark them as wrong before they've done it'.

Closest existing capability (from `lessons capabilities`): Scratch after_block_placed checks (scratch.md 'When checks run and what logs an attempt'): evaluated after every block edit; only a 'definitely failed' check supplies a hint, but an unchanged starter or a workspace with a loose block is treated as definitely failed.

Current workaround and why it falls short: None in the lesson: a check can't tell 'still building' from 'finished and wrong'. Fails Scratch Lesson Guide's check-timing intent and the platform's own 'no failure while building' rule; students learn to ignore the red banner.

## Example task

    No authoring change. Runtime: while the workspace equals the task's starter, or any non-hat block sits outside a script (loose), after_block_placed completion and blocking checks show no fail/hint and log no attempt; once every block is attached (or on Run), evaluate as now.

## Checks wanted

Session report: no failed attempt logged for an unchanged starter or a workspace with loose blocks; a pass still logs as soon as the workspace is correct.

## Notes

Ryan chose this behaviour 2026-10-13 in a tutor-feedback interview (over 'judge only on Run' and an idle delay).

## Resolution

Shipped on `fix/scratch-eager-checks-library-backdrop` (package W1-b, 2026-10-14). New pure helper `src/modules/scratch/stillBuilding.js` (`isScratchStillBuilding`; it works on stored workspace JSON so the CLI can reuse it). `ScratchWorkspace.jsx` saves the checkable workspaces as the task opened (after carry). While the blocks are unchanged (ids and positions ignored) or a non-hat block is loose, it holds back `after_block_placed` failures (no fail, no hint, no attempt logged) and `on_idle` feedback. Passes always count. Docs: [scratch.md](../scratch.md#scratch-check-types), "Still building"; CHANGELOG 2026-10-14.
